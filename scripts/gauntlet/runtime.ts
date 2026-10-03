import { validateMemory } from '../../gauntlet/runtime/memory.js';
const [action] = process.argv.slice(2);
if (action !== 'memory-validate') throw new Error('Usage: runtime.ts memory-validate');
const result = await validateMemory(process.cwd());
console.log(JSON.stringify(result,null,2));
if (!result.valid) process.exitCode=1;
