// lab/roofPlane/harness-batch.mjs — faldones por POLÍGONO (esquinas de eje).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRoofPlane } from './core/roofPlane.js';
import { buildParamsMap } from '../../src/core/projectParams.js';

const here = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(here, 'fixtures/modelo-26.json'), 'utf8'));
const paramsMap = buildParamsMap(model.projectParams || []);
const CG = 1784556741132;   // cielo general 3250 -> cota 3350
const CA = 1784556741408;   // cielo alto 3850 -> cota 3950

const faldones = [
  { n: 'F1 eje A (L)', canal: 1784600403613, cielo: CG, poly: [
    {x:3000,y:0},{x:14500,y:0},{x:14500,y:2000},{x:12800,y:2000},{x:12800,y:1200},{x:3000,y:1200} ] },
  { n: 'F2 eje H', canal: 1784670218571, cielo: CG, poly: [
    {x:0,y:5400},{x:12800,y:5400},{x:12800,y:1200},{x:0,y:1200} ] },
  { n: 'F3 eje C der (L)', canal: 1784605101040, cielo: CG, poly: [
    {x:12800,y:2000},{x:23200,y:2000},{x:23200,y:8300},{x:19000,y:8300},{x:19000,y:6600},{x:12800,y:6600} ] },
  { n: 'F4 X=12800', canal: 1784753357217, cielo: CA, poly: [
    {x:12800,y:6600},{x:19000,y:6600},{x:19000,y:18750},{x:12800,y:18750} ] },
  { n: 'F5 X=22400', canal: 1784756626924, cielo: CA, poly: [
    {x:19000,y:9700},{x:22400,y:9700},{x:22400,y:16400},{x:19000,y:16400} ] },
  { n: 'F6 X=22400 b', canal: 1784759799178, cielo: CA, poly: [
    {x:19000,y:8300},{x:22400,y:8300},{x:22400,y:9700},{x:19000,y:9700} ] },
  { n: 'F7 X=29300', canal: 1784757472733, cielo: CG, poly: [
    {x:22400,y:8300},{x:29300,y:8300},{x:29300,y:16400},{x:22400,y:16400} ] },
  { n: 'F8 X=24800', canal: 1784833573291, cielo: CG, poly: [
    {x:23200,y:4200},{x:24800,y:4200},{x:24800,y:5150},{x:23200,y:5150} ] },
  { n: 'F9 X=28400', canal: 1784757439976, cielo: CG, poly: [
    {x:23200,y:5150},{x:28400,y:5150},{x:28400,y:8300},{x:23200,y:8300} ] }
];

const base = { supportOffset:100, crownClearance:200, heelHeight:300, gutterNotchWidth:200,
  trussSpacing:1200, chainOrigin:'start', shortSpanThreshold:500,
  purlinSpacing:800, purlinProfileH:35, purlinCommercialLength:6000, purlinOverlap:100 };

let ok = 0;
for (const f of faldones) {
  const plane = { ...base, id:f.n, canalWallId:f.canal, supportLevelId:f.cielo, polygon:f.poly };
  const r = resolveRoofPlane({ model, plane, paramsMap });
  const errs = r.findings.filter(x => x.severity === 'error');
  const gaps = r.trussPositions.map(p=>Math.round(p.offset)).slice(1).map((o,i)=>Math.round(o-r.trussPositions[i].offset));
  const status = !r.resolved ? 'NO RESUELVE' : errs.length ? `${errs.length} ERROR` : 'OK';
  if (r.resolved && !errs.length) ok++;
  console.log(`\n${f.n}: ${status}`);
  if (r.resolved) {
    console.log(`  pend ${r.slopePercent.toFixed(2)}% · ${r.tramos.length} tramo(s) · ${r.trussPositions.length} cerchas · luces ${r.tramos.map(t=>Math.round(t.span)).join(',')}`);
    console.log(`  vanos ${gaps.join(', ')}`);
    console.log(`  esconde ${r.tramos.map(t=>Math.round(t.hiddenBy)).join(',')}mm`);
  }
  for (const e of errs) console.log(`  x ${e.category}: ${e.message}`);
}
console.log(`\n=== ${ok}/${faldones.length} faldones cierran sin errores ===`);
