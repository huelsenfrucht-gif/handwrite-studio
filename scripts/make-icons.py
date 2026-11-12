# Self-contained rasterisation of our original app icon; no external assets.
import math, struct, zlib
from pathlib import Path
segments=[(140,342,160,269),(160,269,340,89),(340,89,385,89),(385,89,423,128),(423,128,423,173),(423,173,241,354),(241,354,151,378),(151,378,140,342),(300,122,392,214),(160,269,241,354),(128,423,388,423)]
def dist(x,y,a,b,c,d):
 t=max(0,min(1,((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2)))
 return math.hypot(x-a-t*(c-a),y-b-t*(d-b))
def png(n):
 rows=[]
 for y in range(n):
  row=bytearray()
  for x in range(n):
   px,py=(x+.5)*512/n,(y+.5)*512/n
   corner=math.hypot(max(112-px,px-400,0),max(112-py,py-400,0))
   alpha=int(max(0,min(1,(113-corner)*n/512))*255)
   edge=min(dist(px,py,*s) for s in segments)
   ink=max(0,min(1,(12-edge)*n/512))
   row.extend((int(40+(242-40)*ink),int(99+(246-99)*ink),int(75+(232-75)*ink),alpha))
  rows.append(b'\x00'+row)
 def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 Path(f'public/icon-{n}.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',n,n,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))
for n in (192,512):png(n)
