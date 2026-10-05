import type ts from 'typescript';
import { createRequire } from 'node:module';
let compiler: typeof import('typescript') | undefined;
const typescript=()=>compiler??=createRequire(import.meta.url)('typescript') as typeof import('typescript');
import type { Snapshot } from './scoped-quality.js';
const LOOP='src/simulation/loop/simulation.ts';
/** Closed helper bodies only. The stepping path, declarations, imports, public
 * contracts, clocks and update order remain outside this allowlist. */
export const GAMEPLAY_HELPERS = new Set([
  'resolveLastTouchTeam','computeCornerFlagPosition','isTakerHumanControlled',
  'findHumanPassFrame','resolveServeDirection','computeGoalAreaPosition',
  'findFoulContact','issueCardForFoul','collectFoulContacts','deferredContactFacts',
  'applyThrowInFromInput','applyGoalKickFromInput','applyCornerKickFromInput','applyFreeKickFromInput',
]);
const INPUT='src/simulation/input/input-system.ts';
const INPUT_GAMEPLAY_HELPERS=new Set(['groundDistance','selectNearestTeammate','computeExplicitSwitchTarget','findSlotForPlayer','isSlotActive','getSlotTeamId','resolveSlotMap']);
export const mappedLoopGameplay=(before:Snapshot,after:Snapshot)=>mappedBodies(LOOP,GAMEPLAY_HELPERS,before,after);
export const mappedInputGameplay=(before:Snapshot,after:Snapshot)=>mappedBodies(INPUT,INPUT_GAMEPLAY_HELPERS,before,after);
/** Existing mapped modules may change behavior bodies, not import/public/global
 * architecture surfaces. New modules and unresolved shapes stay full. */
export function mappedGameplayModule(path:string,before:Snapshot,after:Snapshot):boolean {
  const text=before.read(path)?.toString();if(!text||!after.read(path))return false;
  const api=typescript(),file=api.createSourceFile(path,text,api.ScriptTarget.Latest,true),helpers=new Set<string>();
  const collect=(n:ts.Node)=>{if(api.isFunctionDeclaration(n)&&n.name&&n.body)helpers.add(n.name.text);api.forEachChild(n,collect);};collect(file);
  return helpers.size>0&&mappedBodies(path,helpers,before,after);
}
function mappedBodies(path:string,helpers:Set<string>,before:Snapshot,after:Snapshot):boolean {
  const a=before.read(path)?.toString(),b=after.read(path)?.toString();if(!a||!b||a===b)return false;
  const api=typescript();
  const printer=api.createPrinter({removeComments:true});
  const parse=(text:string)=>api.createSourceFile(path,text,api.ScriptTarget.Latest,true,api.ScriptKind.TS);
  let changed=false,unsafe=false;
  const bodies=new Map<string,string>();
  const originalNodes=new Map<string,ts.Block>();
  const nodeFacts=(body:ts.Block,file:ts.SourceFile)=>{
    const calls=new Set<string>(),elements=new Set<string>(),mutations=new Set<string>();let prohibited=false;
    const visit=(node:ts.Node)=>{
      if(api.isCallExpression(node)){const callee=printer.printNode(api.EmitHint.Unspecified,node.expression,file);calls.add(callee);if(/(?:^|\.)(?:step|restore|snapshot|stateHash|random|fetch|eval|require|setTimeout|setInterval)$/.test(callee)||api.isElementAccessExpression(node.expression))prohibited=true;}
      if(api.isElementAccessExpression(node))elements.add(printer.printNode(api.EmitHint.Unspecified,node,file));
      if(api.isBinaryExpression(node)&&node.operatorToken.kind>=api.SyntaxKind.FirstAssignment&&node.operatorToken.kind<=api.SyntaxKind.LastAssignment || api.isPrefixUnaryExpression(node)&&[api.SyntaxKind.PlusPlusToken,api.SyntaxKind.MinusMinusToken].includes(node.operator) || api.isPostfixUnaryExpression(node)){
        const target=api.isBinaryExpression(node)?node.left:node.operand;
        const path=printer.printNode(api.EmitHint.Unspecified,target,file);mutations.add(path);if(/(?:tick|clock|seed|rng|random|scheduler|eventCounter)/i.test(path))prohibited=true;
      }
      if(api.isNewExpression(node)||api.isAwaitExpression(node)||api.isYieldExpression(node))prohibited=true;
      api.forEachChild(node,visit);
    };visit(body);return {calls,elements,mutations,prohibited};
  };
  const skeleton=(file:ts.SourceFile,old:boolean)=>{
    const transform=api.transform(file,[context=>root=>{
      const visit:ts.Visitor=node=>{
        if(api.isFunctionDeclaration(node)&&node.name&&node.body&&helpers.has(node.name.text)){
          const body=printer.printNode(api.EmitHint.Unspecified,node.body,file),name=node.name.text;
          if(old){bodies.set(name,body);originalNodes.set(name,node.body);}else if(bodies.get(name)!==body){changed=true;
            // A mapped helper cannot alter deterministic machinery or invoke I/O.
            const original=originalNodes.get(name);if(!original){unsafe=true;return node;}
            const previous=nodeFacts(original,parse(a)),next=nodeFacts(node.body,file);
            if(next.prohibited||[...next.calls].some(c=>!previous.calls.has(c))||[...next.elements].some(c=>!previous.elements.has(c))||[...next.mutations].some(c=>!previous.mutations.has(c)))unsafe=true;
            if(/\b(?:fixedDt|rng|randomState|Math\.random|Date|performance|restore|snapshot|stateHash|eventCounter|schedulerMemory)\b/.test(body)||/\.(?:tick|matchClock|clock|seed)\s*(?:[+\-*/]?=|\+\+|--)/.test(body))unsafe=true;
          }
          return context.factory.updateFunctionDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,context.factory.createBlock([]));
        }
        return api.visitEachChild(node,visit,context);
      };return api.visitNode(root,visit) as ts.SourceFile;
    }]);
    const printed=printer.printFile(transform.transformed[0] as ts.SourceFile);transform.dispose();return printed;
  };
  return skeleton(parse(a),true)===skeleton(parse(b),false)&&changed&&!unsafe;
}
