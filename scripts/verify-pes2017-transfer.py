#!/usr/bin/env python3
"""Verify transfer manifests and timelines; does not admit gameplay references."""
import argparse
from collections import Counter
from fractions import Fraction
import gzip
import hashlib
import json
from pathlib import Path


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def rows(path):
    with (gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()) as stream:
        return [json.loads(line) for line in stream]


def verify(root, local_audit):
    reports = []
    for directory in sorted(p for p in root.iterdir() if p.is_dir()):
        timeline_path = next(directory.glob('frames.jsonl*'))
        timeline = rows(timeline_path)
        manifest_path = next(directory.glob('*/MANIFEST.json'))
        manifest = json.loads(manifest_path.read_text())
        assert timeline and len(timeline) > 1
        for n, row in enumerate(timeline):
            assert row['source_id'] == directory.name and row['decode_index'] == n
            assert isinstance(row['pts'], int) and row['pts'] >= 0
            tb = Fraction(row['time_base_num'], row['time_base_den'])
            assert tb > 0
            assert Fraction(row['time_seconds_rational']) == row['pts'] * tb
            assert len(row['decoded_rgb24_sha256']) == 64
            if n:
                previous = timeline[n-1]
                assert row['pts'] > previous['pts']
                assert (row['time_base_num'], row['time_base_den']) == (previous['time_base_num'], previous['time_base_den'])
                assert row['exact_repeat_previous'] == (row['decoded_rgb24_sha256'] == previous['decoded_rgb24_sha256'])
        jpeg_hashes = {}
        for image in manifest['frames']:
            row = timeline[image['decode_index']]
            for key in ['pts','time_base_num','time_base_den']:
                assert image[key] == row[key]
            assert image['decoded_rgb24_sha256_from_audit'] == row['decoded_rgb24_sha256']
            image_path = manifest_path.parent / image['file']
            assert image_path.is_file()
            jpeg_hashes[image['file']] = digest(image_path)
        media = directory / (directory.name + '.mp4')
        local_verified = media.is_file()
        if local_verified:
            assert digest(media) == manifest['media_sha256']
        report = {
            'source_id': directory.name, 'input_known': False,
            'local_full_media': local_verified,
            'media_sha256_reported': manifest['media_sha256'],
            'media_sha256_verified_here': local_verified,
            'timeline_sha256': digest(timeline_path), 'timeline_rows': len(timeline),
            'time_base': {'num': timeline[0]['time_base_num'], 'den': timeline[0]['time_base_den']},
            'first_pts': timeline[0]['pts'], 'last_pts': timeline[-1]['pts'],
            'pts_interval_histogram_ticks': dict(Counter(b['pts']-a['pts'] for a,b in zip(timeline,timeline[1:]))),
            'exact_repeats_in_supplied_audit': sum(bool(r['exact_repeat_previous']) for r in timeline),
            'jpeg_count': len(manifest['frames']), 'jpeg_manifest_joins_verified': True,
            'jpeg_artifact_sha256': jpeg_hashes,
            'jpeg_pixels_equal_audit_rgb_hash': 'NOT_CLAIMED_LOSSY_JPEG',
            'original_capture_cadence_hz': None, 'admitted_reference_source': False,
        }
        if directory.name == 'C4-W1u8w-yE':
            actual = rows(local_audit / 'frames.jsonl')
            assert len(actual) == len(timeline)
            keys = ['pts','time_base_num','time_base_den','decoded_rgb24_sha256','exact_repeat_previous']
            assert all(all(a[k] == b[k] for k in keys) for a,b in zip(actual,timeline))
            report['independently_decoded_pts_and_rgb_hash_matches'] = len(actual)
            report['reviewed_cadence_window'] = {'start_decode_index': 207, 'end_decode_index': 242,
                'start_pts': 207207, 'end_pts': 242242,
                'exact_repeats': sum(bool(r['exact_repeat_previous']) for r in actual[207:243]),
                'unique_content_cadence_hz': None,
                'reason': 'Camera and player motion reviewed in 36 successive original images. '
                          'Repeated or similar limb poses do not establish a uniform whole-scene cadence.'}
        reports.append(report)
    return {'version':'pes-transfer-verification-v1','source_count':len(reports),
            'status':'TRANSFER_VERIFIED_NOT_REFERENCE_ADMISSION','sources':reports}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--transfer', type=Path, required=True)
    parser.add_argument('--training-audit', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    value = verify(args.transfer, args.training_audit)
    args.out.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'sources':len(value['sources']), 'status':value['status'],
                      'timeline_rows':[s['timeline_rows'] for s in value['sources']]}))
