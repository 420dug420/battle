// Scope-aware list of free identifiers in a script (names it uses but never declares in an enclosing scope).
// Used to find which humantest bundle internals the rig code depends on.
const acorn = require('acorn'), fs = require('fs');
function freeVars(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
  const free = new Map(), refs = [];
  const isFn = n => /Function/.test(n.type);
  function declPattern(p, s) { if (!p) return; switch (p.type) { case 'Identifier': s.add(p.name); break; case 'ObjectPattern': p.properties.forEach(q => declPattern(q.type === 'RestElement' ? q.argument : q.value, s)); break; case 'ArrayPattern': p.elements.forEach(e => declPattern(e, s)); break; case 'AssignmentPattern': declPattern(p.left, s); break; case 'RestElement': declPattern(p.argument, s); break; } }
  // hoist: collect declarations of a scope node without entering nested functions
  function hoist(node, fnScope, blockScope) {
    const visit = (n, blk) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'VariableDeclaration') { n.declarations.forEach(d => declPattern(d.id, n.kind === 'var' ? fnScope : blk)); }
      if (n.type === 'FunctionDeclaration') { blk.add(n.id.name); return; }
      if (n.type === 'ClassDeclaration') { blk.add(n.id.name); }
      if (isFn(n) || n.type === 'ClassExpression') return;
      if (n !== node && (n.type === 'BlockStatement' || /^For/.test(n.type) || n.type === 'SwitchStatement' || n.type === 'CatchClause')) { // inner blocks: only var escapes
        for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(x => visitVarOnly(x)); else if (v && typeof v.type === 'string') visitVarOnly(v); } return; }
      for (const k in n) { if (k === 'type') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => visit(x, blk)); else if (v && typeof v.type === 'string') visit(v, blk); }
    };
    const visitVarOnly = n => { if (!n || typeof n.type !== 'string' || isFn(n)) { if (n && n.type === 'FunctionDeclaration') {} return; } if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach(d => declPattern(d.id, fnScope)); for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(visitVarOnly); else if (v && typeof v.type === 'string' && k !== 'type') visitVarOnly(v); } };
    if (Array.isArray(node)) node.forEach(x => visit(x, blockScope)); else visit(node, blockScope);
  }
  function resolve(name, chain) { for (let i = chain.length - 1; i >= 0; i--) if (chain[i].has(name)) return true; return false; }
  function walk(n, chain, parent) {
    if (!n || typeof n.type !== 'string') return;
    if (isFn(n)) {
      const s = new Set(); if (n.type === 'FunctionExpression' && n.id) s.add(n.id.name);
      n.params.forEach(p => declPattern(p, s)); const c = chain.concat([s]);
      n.params.forEach(p => walk(p, c, n));
      if (n.body.type === 'BlockStatement') { hoist(n.body.body, s, s); n.body.body.forEach(x => walk(x, c, n.body)); } else walk(n.body, c, n);
      return;
    }
    if (n.type === 'BlockStatement' || /^For/.test(n.type) || n.type === 'SwitchStatement' || n.type === 'CatchClause' || n.type === 'StaticBlock') {
      const s = new Set(); if (n.type === 'CatchClause') declPattern(n.param, s);
      const fnS = chain[chain.length - 1]; // approximate: var goes to the nearest scope already hoisted at function level
      if (n.type === 'BlockStatement' || n.type === 'StaticBlock') hoist(n.body, fnS, s); else if (/^For/.test(n.type)) { if (n.init && n.init.type === 'VariableDeclaration' && n.init.kind !== 'var') n.init.declarations.forEach(d => declPattern(d.id, s)); if (n.left && n.left.type === 'VariableDeclaration' && n.left.kind !== 'var') n.left.declarations.forEach(d => declPattern(d.id, s)); }
      else if (n.type === 'SwitchStatement') n.cases.forEach(c => hoist(c.consequent, fnS, s));
      const c = chain.concat([s]);
      for (const k in n) { if (k === 'type' || k === 'param') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, c, n)); else if (v && typeof v.type === 'string') walk(v, c, n); }
      return;
    }
    if (n.type === 'Identifier') {
      if (parent && parent.type === 'MemberExpression' && parent.property === n && !parent.computed) return;
      if (parent && (parent.type === 'Property' || parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') && parent.key === n && !parent.computed && !parent.shorthand) return;
      if (parent && (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement')) return;
      if (!resolve(n.name, chain)) { free.set(n.name, (free.get(n.name) || 0) + 1); refs.push({ name: n.name, start: n.start, end: n.end, shorthand: !!(parent && parent.type === 'Property' && parent.shorthand) }); }
      return;
    }
    if (n.type === 'Property' && n.shorthand) { walk(n.value, chain, n); return; }
    for (const k in n) { if (k === 'type') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, chain, n)); else if (v && typeof v.type === 'string') walk(v, chain, n); }
  }
  const top = new Set(); hoist(ast.body, top, top); ast.body.forEach(x => walk(x, [top], ast));
  free.refs = refs; return free;
}
module.exports = { freeVars };
if (require.main === module) { const f = freeVars(fs.readFileSync(process.argv[2], 'utf8')); console.log(JSON.stringify([...f].sort())); }
