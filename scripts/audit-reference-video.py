#!/usr/bin/env python3
"""Audit delivered media. Never admits a source or manufactures gameplay targets.

Requires Python 3, numpy, ffprobe and ffmpeg. The output directory must be new.
PTS are retained as integer ticks with the stream's rational time base.
No resampling, deduplication, interpolation, trim, input inference or calibration.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np


def save(path, data):
    with path.open('x') as out:
        json.dump(data, out, indent=2, ensure_ascii=False, allow_nan=False)
        out.write('\n')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def audit(media, destination, source_id, uri, operator):
    if not media.is_file():
        raise ValueError('A local, complete video file is required')
    destination.mkdir(parents=True, exist_ok=False)
    manifest = {
        'version': 'delivered-video-audit-v1', 'source_id': source_id,
        'source_uri': uri, 'media_filename': media.name,
        'media_sha256': sha256(media), 'media_bytes': media.stat().st_size,
        'operator': operator, 'created_at': datetime.now(timezone.utc).isoformat(),
        'input_known': False, 'admitted': False, 'status': 'IN_PROGRESS',
        'original_capture_fps': None, 'verified_unique_content_cadence': None,
        'commands': [],
    }
    try:
        for tool in ['ffprobe', 'ffmpeg']:
            manifest[tool + '_version'] = subprocess.check_output(
                [tool, '-version'], text=True).splitlines()[0]
        command = [
            'ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_streams', '-show_frames', '-show_entries',
            'stream=index,codec_name,width,height,time_base,r_frame_rate,avg_frame_rate,'
            'field_order,pix_fmt,color_range,color_space,color_transfer,color_primaries:'
            'frame=pts,pts_time,duration,pkt_duration,width,height,key_frame,pict_type,'
            'interlaced_frame,top_field_first,repeat_pict',
            '-of', 'json', str(media.resolve()),
        ]
        manifest['commands'].append(command)
        with (destination / 'ffprobe.json').open('x') as out, \
                (destination / 'ffprobe.stderr.log').open('x') as err:
            subprocess.run(command, stdout=out, stderr=err, check=True)
        if (destination / 'ffprobe.stderr.log').stat().st_size:
            raise ValueError('ffprobe reported decoding errors; inspect its log')
        probe = json.loads((destination / 'ffprobe.json').read_text())
        if len(probe.get('streams', [])) != 1:
            raise ValueError('Exactly one selected video stream is required')
        stream = probe['streams'][0]
        frames = probe.get('frames', [])
        if len(frames) < 2 or any('pts' not in f for f in frames):
            raise ValueError('At least two original frame PTS required; no fallback clock')
        pts = [int(frame['pts']) for frame in frames]
        if any(b <= a for a, b in zip(pts, pts[1:])):
            raise ValueError('PTS must be strictly increasing; source requires review')
        time_base = Fraction(stream['time_base'])
        if time_base <= 0:
            raise ValueError('Invalid time base')
        width, height = stream['width'], stream['height']
        if any((f.get('width'), f.get('height')) != (width, height) for f in frames):
            raise ValueError('Changing resolution requires separate audited segments')
        manifest['container_timing'] = {
            'stream': stream, 'frame_count': len(frames),
            'time_base_num': time_base.numerator, 'time_base_den': time_base.denominator,
            'first_pts': pts[0], 'last_pts': pts[-1],
            'frame_interval_histogram_ticks': dict(Counter(b-a for a, b in zip(pts, pts[1:]))),
            'negative_pts_present': pts[0] < 0,
            'interlaced_frames': sum(bool(f.get('interlaced_frame')) for f in frames),
            'repeat_pict_frames': sum(bool(f.get('repeat_pict')) for f in frames),
        }
        # Same untrimmed stream and decoder order as ffprobe. Verify frame counts.
        # RGB24 is a documented normalized representation, not compressed bytes.
        command = [
            'ffmpeg', '-v', 'error', '-xerror', '-noautorotate', '-copyts',
            '-i', str(media.resolve()), '-map', '0:v:0', '-an', '-sn', '-dn',
            '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1',
        ]
        manifest['commands'].append(command)
        previous = None
        previous_hash = None
        repeats = 0
        count = 0
        size = width * height * 3
        with (destination / 'ffmpeg.stderr.log').open('x') as err, \
                (destination / 'frames.jsonl').open('x') as out:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=err)
            try:
                for index, frame in enumerate(frames):
                    data = process.stdout.read(size)
                    if len(data) != size:
                        raise ValueError('ffmpeg/ffprobe frame counts or dimensions disagree')
                    pixels = np.frombuffer(data, dtype=np.uint8)
                    digest = hashlib.sha256(data).hexdigest()
                    duplicate = None if index == 0 else digest == previous_hash
                    mad = None if previous is None else float(
                        np.abs(pixels.astype(np.int16) - previous).mean())
                    seconds = Fraction(pts[index]) * time_base
                    row = {
                        'source_id': source_id, 'decode_index': index,
                        'pts': pts[index], 'time_base_num': time_base.numerator,
                        'time_base_den': time_base.denominator,
                        'time_seconds_rational': str(seconds),
                        'duration_ticks': frame.get('duration', frame.get('pkt_duration')),
                        'decoded_rgb24_sha256': digest,
                        'exact_repeat_previous': duplicate,
                        'adjacent_mean_absolute_difference_rgb_0_255': mad,
                        'unique_content': None, 'camera_cut': None,
                        'blended_or_interpolated': None, 'manual_review': 'PENDING',
                    }
                    out.write(json.dumps(row, allow_nan=False) + '\n')
                    repeats += bool(duplicate)
                    previous, previous_hash = pixels, digest
                    count += 1
                if process.stdout.read(1):
                    raise ValueError('ffmpeg produced additional unmapped frames')
                if process.wait() != 0:
                    raise ValueError('ffmpeg failed; inspect its log')
            finally:
                process.stdout.close()
                if process.poll() is None:
                    process.kill()
                    process.wait()
        if (destination / 'ffmpeg.stderr.log').stat().st_size:
            raise ValueError('ffmpeg reported errors; inspect its log')
        if sha256(media) != manifest['media_sha256']:
            raise ValueError('Media changed during audit')
        manifest['content_diagnostics'] = {
            'decoded_frames': count, 'exact_adjacent_repeats': repeats,
            'pixel_format': 'rgb24', 'near_duplicate_threshold': None,
            'interpretation': 'Diagnostics only. Static scenes, recompression, camera motion '
                'and interpolation require frame review; distinct hashes do not establish cadence.',
        }
        manifest['status'] = 'PENDING_CONTENT_AND_CAMERA_REVIEW'
    except Exception as error:
        manifest['status'] = 'AUDIT_FAILED'
        manifest['error'] = str(error)
        raise
    finally:
        manifest['output_sha256'] = {
            p.name: sha256(p) for p in sorted(destination.iterdir()) if p.is_file()
        }
        save(destination / 'audit.json', manifest)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('media', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--source-id', required=True)
    parser.add_argument('--uri', required=True)
    parser.add_argument('--operator', required=True)
    args = parser.parse_args()
    result = audit(args.media, args.out, args.source_id, args.uri, args.operator)
    print(json.dumps({k: result[k] for k in ['source_id', 'status', 'admitted', 'media_sha256']}))
