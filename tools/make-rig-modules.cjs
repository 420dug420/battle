// One-time conversion: humantest bundle -> ES module exporting its internals under real names (rig/humantest.js),
// and the Project War rig code with every minified reference renamed (rig/model3d.js).
const fs = require('fs'), path = require('path'), rename = require('./rename-free.cjs'), { freeVars } = require('./freevars.cjs');
const R = p => path.join(__dirname, '..', p);
const core = fs.readFileSync(R('rig/core_body.js'), 'utf8');
const SHIM = `
/* ===== Project War shim: the humantest internals the rig uses, under readable names.
   If humantest is rebuilt, its minified names change; fix them here only (tools/freevars.cjs lists what the rig needs). ===== */
export const HT = {
  Vector3: W, Mesh: Ae, Group: we, BoxGeometry: cn,          // three.js classes
  renderer: wr, scene: ln, camera: $n, world: di,           // humantest's renderer, scene, camera, room props
  figureRoot: Ci, character: Jt, outfits: Xu, locomotion: ot, uniforms: Un,
  litMaterial: Qi, paintTexture: _e, loftGeometry: ce, setLights: gc,
  buildCharacter: No, poseRun: hx,
  get rig() { return Ri; }, set rig(v) { Ri = v; },          // humantest's current character; poseRun() animates whatever this holds
  get gun() { return Tr; },
};
`;
fs.writeFileSync(R('rig/humantest.js'), '/* humantest bundle (three.js + character kit), unmodified apart from the shim at the end */\n' + core + '\n' + SHIM);
const MAP = { W: 'Vector3', Ae: 'Mesh', we: 'Group', cn: 'BoxGeometry', wr: 'HT.renderer', ln: 'HT.scene', $n: 'HT.camera', di: 'HT.world',
  Ci: 'HT.figureRoot', Jt: 'HT.character', Xu: 'HT.outfits', ot: 'HT.locomotion', Un: 'HT.uniforms', Qi: 'litMaterial', _e: 'paintTexture',
  ce: 'loftGeometry', gc: 'setLights', No: 'HT.buildCharacter', hx: 'HT.poseRun', Ri: 'HT.rig', Tr: 'HT.gun' };
let glue = fs.readFileSync(R('rig/glue.js'), 'utf8');
const { out, count } = rename(glue, MAP);
const left = [...freeVars(out).keys()].filter(k => !['Math', 'Object', 'Array', 'document', 'parseInt', 'HT', 'Vector3', 'Mesh', 'Group', 'BoxGeometry', 'litMaterial', 'paintTexture', 'loftGeometry', 'setLights', 'window'].includes(k));
if (left.length) throw new Error('unmapped names: ' + left.join(','));
let body = out.replace(/\nreturn M3;\s*$/, '\n');
if (body === out) throw new Error('no trailing return M3');
fs.writeFileSync(R('rig/model3d.js'), `import { HT } from './humantest.js';
const { Vector3, Mesh, Group, BoxGeometry, litMaterial, paintTexture, loftGeometry, setLights } = HT;
${body}
export default M3;
`);
console.log('renamed', count, 'references');
