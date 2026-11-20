#!/bin/bash
cd /home/claude/h3d
python3 - <<'PY'
body=open('core_body.js').read(); glue=open('glue.js').read()
s='window.Model3D=(()=>{'+body+glue+'\n})();'
open('m3d.js','w').write(s); open('/home/claude/combat/model3d.js','w').write(s)
open('harness.html','w').write('<!DOCTYPE html><html><body style="margin:0"><span id="tris"></span><div id="hud"></div><script>'+s+'</script></body></html>')
PY
