import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { referenceImportPlan } from './reference-import-plan';
const path=process.argv[2];if(!path)throw new Error('Usage: npm run reference:import -- /path/to/reference.json');
const plan=referenceImportPlan(JSON.parse(readFileSync(path,'utf8')));
mkdirSync(plan.directory,{recursive:true});writeFileSync(`${plan.directory}/${plan.filename}`,JSON.stringify(plan.target,null,2)+'\n',{flag:'wx'});
console.log(plan.message);
