m=open('/home/claude/combat/model3d.js').read()
h=open('/home/claude/armor/mock.html').read()
a=h.index('<script>')+8; b=h.index('</script>')
open('/home/claude/armor/mock.html','w').write(h[:a]+m+h[b:])
