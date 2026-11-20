// Rewrite free identifiers (names a script uses but never declares) according to a map; locally declared names of the same spelling are left alone.
const { freeVars } = require('./freevars.cjs');
module.exports = function rename(src, map) {
  const edits = freeVars(src).refs.filter(r => map[r.name] != null).map(r => ({ s: r.start, e: r.end, r: r.shorthand ? r.name + ': ' + map[r.name] : map[r.name] }));
  edits.sort((a, b) => b.s - a.s); let out = src; for (const d of edits) out = out.slice(0, d.s) + d.r + out.slice(d.e);
  return { out, count: edits.length };
};
