import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { validateReference } from '../eval/reference';
const path=process.argv[2];if(!path)throw new Error('Usage: npm run reference:import -- /path/to/reference.json');
const target=validateReference(JSON.parse(readFileSync(path,'utf8')));
mkdirSync('eval/references',{recursive:true});writeFileSync(`eval/references/${target.id}.json`,JSON.stringify(target,null,2)+'\n',{flag:'wx'});
console.log(`Validated ${target.id}: ${target.measurements.length} measurements. No calibration applied.`);
