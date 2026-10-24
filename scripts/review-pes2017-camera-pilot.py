#!/usr/bin/env python3
"""Reproduce the campaign-001 camera pilot. Writes diagnostics, never targets.

Requires numpy, opencv-python-headless, ffmpeg. All frame identities are checked
against the supplied RGB24 audit. RANSAC/LK settings are algorithm parameters,
not PES gameplay thresholds or source-admission criteria.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

import cv2
import numpy as np


def save(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def project(points, matrix):
    return cv2.perspectiveTransform(np.asarray(points, dtype=float)[None], matrix)[0]


def review(root, out):
    campaign = root / 'evidence/pes2017/campaign-001'
    source = campaign / 'transfer/C4-W1u8w-yE'
    media = source / 'C4-W1u8w-yE.mp4'
    annotations = json.loads((campaign / 'raw/pilot-001/annotations.json').read_text())
    assert hashlib.sha256(media.read_bytes()).hexdigest() == annotations['source_sha256']
    timeline = [json.loads(line) for line in (source / 'frames.jsonl').read_text().splitlines()]
    out.mkdir(parents=True, exist_ok=False)
    command = ['ffmpeg', '-v', 'error', '-xerror', '-noautorotate', '-copyts',
               '-i', str(media), '-map', '0:v:0', '-an', '-sn', '-dn',
               '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']
    frames = {}
    with (out / 'decode.stderr.log').open('w') as err:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=err)
        try:
            for row in timeline:
                data = process.stdout.read(1280 * 720 * 3)
                assert len(data) == 1280 * 720 * 3
                assert hashlib.sha256(data).hexdigest() == row['decoded_rgb24_sha256']
                n = row['decode_index']
                if 200 <= n <= 270:
                    frames[n] = np.frombuffer(data, np.uint8).reshape(720, 1280, 3).copy()
            assert process.stdout.read(1) == b''
            assert process.wait() == 0
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.kill()
                process.wait()
    assert (out / 'decode.stderr.log').stat().st_size == 0
    passes = annotations['calibration_keyframe']['passes']
    world = [p['world_xy_m'] for p in passes[0]['correspondences']]
    fits = []
    matrices = []
    for annotation_pass in passes:
        pixels = np.array([p['image_xy'] for p in annotation_pass['correspondences']], float)
        matrix, _ = cv2.findHomography(np.array(world), pixels, 0)
        matrices.append(matrix)
        errors = np.linalg.norm(project(world, matrix) - pixels, axis=1)
        fits.append({'pass': annotation_pass['pass'], 'world_to_image': matrix.tolist(),
                     'residuals_px': errors.tolist(), 'rms_px': float(np.sqrt(np.mean(errors**2)))})
    cv2.setRNGSeed(0)
    # Propagate through adjacent original frames, retaining every correspondence.
    camera = {270: matrices[1]}
    matches = []
    for n in range(269, 199, -1):
        a = cv2.cvtColor(frames[n+1], cv2.COLOR_RGB2GRAY)
        b = cv2.cvtColor(frames[n], cv2.COLOR_RGB2GRAY)
        mask = np.zeros_like(a)
        mask[180:565, 20:1240] = 255
        for x, y in [(580,330), (690,360), (360,470), (470,550), (900,410), (1100,400)]:
            cv2.rectangle(mask, (x-100,y-80), (x+100,y+80), 0, -1)
        points = cv2.goodFeaturesToTrack(a, 500, 0.01, 8, mask=mask)
        forward, st, _ = cv2.calcOpticalFlowPyrLK(a, b, points, None, winSize=(21,21), maxLevel=3)
        backward, sb, _ = cv2.calcOpticalFlowPyrLK(b, a, forward, None, winSize=(21,21), maxLevel=3)
        good = ((st[:,0] == 1) & (sb[:,0] == 1)
                & (np.linalg.norm(backward-points, axis=2)[:,0] < 1))
        src, dst = points[good,0], forward[good,0]
        matrix, mask_inliers = cv2.findHomography(src, dst, cv2.RANSAC, 2)
        if matrix is None:
            raise ValueError(f'Unsolved camera step {n+1} -> {n}')
        keep = mask_inliers[:,0].astype(bool)
        errors = np.linalg.norm(project(src, matrix) - dst, axis=1)
        matches.append({'from_decode_index': n+1, 'to_decode_index': n,
                        'from_pts': timeline[n+1]['pts'], 'to_pts': timeline[n]['pts'],
                        'from_xy': src.tolist(), 'to_xy': dst.tolist(), 'inlier': keep.tolist(),
                        'from_to_matrix': matrix.tolist(),
                        'rms_inlier_px': float(np.sqrt(np.mean(errors[keep]**2)))})
        camera[n] = matrix @ camera[n+1]
        camera[n] /= camera[n][2,2]
    checks = []
    for check in annotations['held_out_checks']:
        prediction = project([check['world_xy_m']], camera[check['decode_index']])[0]
        checks.append({**check, 'predicted_image_xy': prediction.tolist(),
                       'residual_px': float(np.linalg.norm(prediction-check['image_xy']))})
    repeat_differences = np.array([p['image_xy'] for p in passes[0]['correspondences']]) - np.array(
        [p['image_xy'] for p in passes[1]['correspondences']])
    result = {
        'version': 'pes-camera-pilot-diagnostics-v1',
        'status': 'WITHHELD_PENDING_CALIBRATION_AND_UNCERTAINTY',
        'source_sha256': annotations['source_sha256'], 'input_known': False,
        'decode_command': command, 'verified_rgb24_hash_count': len(timeline),
        'opencv_version': cv2.__version__,
        'ffmpeg_version': subprocess.check_output(['ffmpeg','-version'], text=True).splitlines()[0],
        'calibration_fits': fits, 'held_out_checks': checks,
        'same_operator_pass_differences_px': np.linalg.norm(repeat_differences,axis=1).tolist(),
        'largest_held_out_residual_px': max(c['residual_px'] for c in checks),
        'camera_solutions': [{'decode_index': n, 'pts': timeline[n]['pts'],
                              'world_to_image': h.tolist()} for n,h in sorted(camera.items())],
        'candidate_world_support_points': [
            {**p, 'candidate_xy_m': project([p['support_xy']], np.linalg.inv(camera[p['decode_index']]))[0].tolist(),
             'accepted': False} for p in annotations['player_observations']],
        'uncertainty': {'status': 'NOT_ESTIMATED',
                        'reason': 'Visible camera drift and same-operator click differences remain. '
                                  'Inlier RMS is not an error bound at the player; three collinear '
                                  'validation points do not bound 2D extrapolation. No arbitrary sigma assigned.'},
        'measurements': [],
        'reasons': ['Per-frame pitch refit and independent calibration checks are required.',
                    'Three support observations are one trajectory, not three independent trials.',
                    'Observed support motion does not establish input, plateau or maximum speed.',
                    'Secondary provenance and unknown configuration cannot be exported under the current contract.'],
    }
    save(out / 'diagnostics.json', result)
    # Compact raw matches, still primary evidence for the proposed camera motion.
    raw_matches = ''.join(json.dumps(m, separators=(',',':'), allow_nan=False)+'\n' for m in matches)
    (out / 'camera-feature-matches.jsonl.gz').write_bytes(gzip.compress(raw_matches.encode(), mtime=0))
    for n in [210,225,240,270]:
        im = cv2.cvtColor(frames[n], cv2.COLOR_RGB2BGR)
        for c in checks:
            if c['decode_index'] != n:
                continue
            observed = tuple(round(v) for v in c['image_xy'])
            predicted = tuple(round(v) for v in c['predicted_image_xy'])
            cv2.circle(im, observed, 5, (0,255,0), 1)
            cv2.circle(im, predicted, 5, (0,0,255), 1)
            cv2.line(im, observed, predicted, (0,255,255), 1)
        cv2.putText(im, f'PTS {timeline[n]["pts"]}/30000 | green: observation; red: model',
                    (20,705), cv2.FONT_HERSHEY_SIMPLEX, .6, (255,255,255), 1)
        cv2.imwrite(str(out / f'qc-n{n}.jpg'), im)
    print(json.dumps({'status': result['status'], 'largest_held_out_residual_px':
                      result['largest_held_out_residual_px'], 'accepted_measurements': 0}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--out', type=Path, required=True, help='New output directory')
    args = parser.parse_args()
    review(args.root.resolve(), args.out)
