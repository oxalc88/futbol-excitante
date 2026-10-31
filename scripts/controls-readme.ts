import { readFileSync,writeFileSync } from 'node:fs';
import { controlsMarkdown } from '../src/browser/controls-model';
const file='README.md',source=readFileSync(file,'utf8'),start='<!-- controls:start -->',end='<!-- controls:end -->',a=source.indexOf(start),b=source.indexOf(end);
if(a<0||b<a)throw new Error('README controls markers are missing or reversed');
const updated=source.slice(0,a+start.length)+'\n'+controlsMarkdown()+'\n'+source.slice(b);
writeFileSync(file,updated);
