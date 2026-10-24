import { validateObservedReference, validateReference } from '../eval/reference';

export function referenceImportPlan(value:unknown) {
  if(value && typeof value==='object' && 'version' in value && value.version==='pes-observed-v1') {
    const target=validateObservedReference(value);
    return {directory:'eval/reference',filename:'pes-observed.json',target,
      message:'Validated approximate public-video reference: diagnostic only, not used by evaluate. No calibration applied.'};
  }
  const target=validateReference(value);
  return {directory:'eval/references',filename:`${target.id}.json`,target,
    message:`Validated ${target.id}: ${target.measurements.length} measurements. No calibration applied.`};
}
