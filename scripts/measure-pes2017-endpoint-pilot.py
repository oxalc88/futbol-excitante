#!/usr/bin/env python3
"""Measure a fixed-window support-point displacement; never import or calibrate PES.

Uncertainty is a documented sensitivity envelope, not a confidence interval.
Requires NumPy, OpenCV and FFmpeg. Original frame hashes are mandatory.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import cv2
import numpy as np


def project(points, matrix):
    return cv2.perspectiveTransform(np.asarray(points, float)[None], matrix)[0]


def fit(points, omit=None):
    selected = [p for i,p in enumerate(points) if i != omit]
    h, _ = cv2.findHomography(np.array([p['world_xy_m'] for p in selected], float),
                              np.array([p['image_xy'] for p in selected], float), 0)
    if h is None or not np.isfinite(h).all() or np.linalg.matrix_rank(h) != 3:
        raise ValueError('Unsolved calibration variant')
    return h


def save(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n')


def measure(root, out):
    campaign = root / 'evidence/pes2017/campaign-001'
    source = campaign / 'transfer/C4-W1u8w-yE'
    media = source / 'C4-W1u8w-yE.mp4'
    a = json.loads((campaign / 'raw/pilot-002/annotations.json').read_text())
    assert hashlib.sha256(media.read_bytes()).hexdigest() == a['source_sha256']
    timeline = [json.loads(line) for line in (source/'frames.jsonl').read_text().splitlines()]
    indices = [f['decode_index'] for f in a['frames']]
    selector = '+'.join(f'eq(n\\,{n})' for n in indices)
    command = ['ffmpeg','-v','error','-xerror','-noautorotate','-copyts','-i',str(media),
               '-map','0:v:0','-an','-sn','-dn','-vf','select='+selector,
               '-fps_mode','passthrough','-pix_fmt','rgb24','-f','rawvideo','pipe:1']
    decoded = subprocess.run(command, capture_output=True, check=True)
    assert not decoded.stderr
    frame_bytes = 1280*720*3
    assert len(decoded.stdout) == len(indices)*frame_bytes
    out.mkdir(parents=True, exist_ok=False)
    all_clouds, central, frames = [], [], []
    for position, frame in enumerate(a['frames']):
        n = frame['decode_index']
        pixels = decoded.stdout[position*frame_bytes:(position+1)*frame_bytes]
        assert hashlib.sha256(pixels).hexdigest() == timeline[n]['decoded_rgb24_sha256']
        assert timeline[n]['pts'] == frame['pts']
        passes = frame['calibration_passes']
        averaged = [{**p, 'image_xy': np.mean([v['points'][i]['image_xy'] for v in passes], axis=0).tolist()}
                    for i,p in enumerate(passes[0]['points'])]
        h = fit(averaged)
        player = frame['player']
        center = project([player['support_xy']], np.linalg.inv(h))[0]
        central.append(center)
        x0,y0,x1,y1 = player['support_region_xyxy']
        supports = [player['support_xy'],[x0,y0],[x0,y1],[x1,y0],[x1,y1]]
        holdout_world = np.array([p['world_xy_m'] for p in frame['held_out_points']])
        holdout_image = np.array([p['image_xy'] for p in frame['held_out_points']])
        heldout_residuals = np.linalg.norm(project(holdout_world,h)-holdout_image,axis=1)
        clouds, variants = [], []
        for annotation_pass in passes:
            for omitted in [None, *range(len(averaged))]:
                variant = fit(annotation_pass['points'], omitted)
                inverse = np.linalg.inv(variant)
                world_supports = project(supports,inverse)
                # Measured discrepancy vectors, transported as sensitivity modes.
                # This does not assert a spatially uniform true camera error.
                discrepancy = project(holdout_image,inverse)-holdout_world
                shifts = np.vstack([np.zeros(2),discrepancy,-discrepancy])
                cloud = (world_supports[:,None,:]+shifts[None,:,:]).reshape(-1,2)
                clouds.append(cloud)
                variants.append({'pass':annotation_pass['pass'],'omitted_landmark_index':omitted,
                                 'world_to_image':variant.tolist(),
                                 'held_out_world_discrepancy_vectors_m':discrepancy.tolist()})
        cloud = np.concatenate(clouds)
        assert np.isfinite(cloud).all()
        all_clouds.append(cloud)
        frames.append({'decode_index':n,'pts':frame['pts'],
                       'decoded_rgb24_sha256':timeline[n]['decoded_rgb24_sha256'],
                       'world_to_image':h.tolist(),'support_world_xy_m':center.tolist(),
                       'fit_residuals_px':np.linalg.norm(project([p['world_xy_m'] for p in averaged],h)
                            -np.array([p['image_xy'] for p in averaged]),axis=1).tolist(),
                       'held_out_residuals_px':heldout_residuals.tolist(),
                       'calibration_variants':variants,'sensitivity_point_cloud_m':cloud.tolist()})
        image = cv2.cvtColor(np.frombuffer(pixels,np.uint8).reshape(720,1280,3),cv2.COLOR_RGB2BGR)
        for p in frame['held_out_points']:
            observed = tuple(round(x) for x in p['image_xy'])
            predicted = tuple(round(x) for x in project([p['world_xy_m']],h)[0])
            cv2.circle(image,observed,5,(0,255,0),1)
            cv2.circle(image,predicted,5,(0,0,255),1)
            cv2.line(image,observed,predicted,(0,255,255),1)
        cv2.rectangle(image,(x0,y0),(x1,y1),(0,255,0),1)
        cv2.putText(image,f'PTS {frame["pts"]}/30000 | green: observations; red: camera',
                    (20,705),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,255,255),1)
        cv2.imwrite(str(out/f'qc-n{n}.jpg'),image)
    assert len(central) == 2
    estimate = float(np.linalg.norm(central[1]-central[0]))
    distances = np.linalg.norm(all_clouds[1][:,None,:]-all_clouds[0][None,:,:],axis=2)
    lower, upper = float(distances.min()), float(distances.max())
    uncertainty = max(abs(estimate-lower),abs(upper-estimate))
    measurement = {
        'metric':'distance','units':'m','estimate':estimate,'uncertainty':uncertainty,
        'sampleSize':2,'sampleUnit':'PTS-linked ground-support observations',
        'independentEvents':1,'observable':True,
        'startPTS':a['frames'][0]['pts'],'endPTS':a['frames'][-1]['pts'],
        'method':'Euclidean displacement between two visible trailing-foot ground-support observations, '
                 'each transformed using its own six-landmark planar homography fitted to mean labels '
                 'from two same-operator passes. Uncertainty is the maximum deviation from the nominal '
                 'result over all combinations of two label passes, six leave-one-landmark-out fits '
                 'plus each full fit, observed support-region corners, and signed held-out world '
                 'discrepancy vectors. Fixed decoded-image endpoints; no input onset or speed inference.',
        'uncertaintyType':'conditional_observed_sensitivity_envelope_not_confidence_interval',
        'sensitivityInterval':[lower,upper],
        'uncertaintyLimitations':['Conditional on the regulation internal-marking planar template.',
            'Transported residual vectors are sensitivity modes, not a proof of a uniform spatial error bound.',
            'Does not quantify population variation, original-capture timing, input or gait-centre motion.',
            'Two same-operator label passes do not establish inter-annotator repeatability.'],
    }
    result = {
        'version':'pes-observed-displacement-pilot-v1','status':'RESEARCH_PILOT_NOT_REFERENCE_TARGET',
        'measurementClass':'B','input_known':False,
        'source':{'game':'PES 2017','platform':None,'build':None,'mode':'Skills Training / Sprint (visible HUD)',
                  'difficulty':None,'gameSpeed':None,'controller':None,'camera':None},
        'capture':{'uri':'https://www.youtube.com/watch?v=C4-W1u8w-yE','sha256':a['source_sha256'],
                   'provenance':'SECONDARY_PUBLIC_MEDIA','timebase':'PTS','time_base':a['time_base'],
                   'pts':[f['pts'] for f in a['frames']],'controlledInputs':False,'operator':a['operator']},
        'event':{'id':'training-attempt-01-post-shot-support-displacement','selection':a['selection'],
                 'catalog_testId':None,'scenario_id':None,'campaign_slot':None},
        'measurements':[measurement],
        'exportEligible':False,
        'exportBlockers':['Secondary provenance is not DIRECT_CAPTURE; required game configuration is unknown.',
                          'Fixed-window foot-support displacement is not a matched catalog locomotion scenario.',
                          'Sensitivity envelope is not a validated total measurement uncertainty for an evaluator target.'],
        'calibration_and_world_tracks':frames,
        'runtime':{'opencv':cv2.__version__,'numpy':np.__version__,
                   'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0]},
        'decode_command':command,
    }
    save(out/'observation.json',result)
    print(json.dumps({'status':result['status'],'estimate_m':estimate,
                      'sensitivity_interval_m':[lower,upper],'uncertainty_m':uncertainty,'imported':0}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--out',type=Path,required=True,help='New output directory')
    args = parser.parse_args()
    measure(args.root.resolve(),args.out)
