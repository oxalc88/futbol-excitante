import { readFileSync } from 'node:fs';
import { evaluateBureaucracy } from '../../gauntlet/runtime/bureaucracy.js';

const file=process.argv[2];
if(!file)throw new Error('usage: gauntlet:bureaucracy <trace.json>');
const input=JSON.parse(readFileSync(file,'utf8'));
const result=evaluateBureaucracy(input);
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exitCode=1;
