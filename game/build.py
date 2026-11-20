t=open('template.html').read()
for k,f in [('/*SIM*/','sim.js'),('/*SPRITES*/','sprites.js'),('/*PRESETS*/','presets.js'),('/*MODEL3D*/','model3d.js'),('/*APP*/','app.js')]:
    t=t.replace(k,open(f).read())
open('index.html','w').write(t)
