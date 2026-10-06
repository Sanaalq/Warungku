"""Generate PWA PNG icons without external deps."""
import math, struct, zlib, sys, os

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y*w*4:(y+1)*w*4]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def seg_d(px, py, ax, ay, bx, by):
    dx, dy = bx-ax, by-ay
    t = max(0, min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx+dy*dy)))
    return math.hypot(px-ax-t*dx, py-ay-t*dy)

def make(size, maskable=False):
    S = size / 512.0
    pad = 0.12 if maskable else 0.0   # glyph scale-down for safe zone
    sc = 1 - pad*2
    px = bytearray(size*size*4)
    rad = 0 if maskable else 112
    # glyph in 512 space: segments + arc
    segs = [(96,240,416,240),(112,240,138,376),(138,376,173,404),(173,404,339,404),(339,404,374,376),(374,376,400,240),(256,112,256,84)]
    sw = 15
    for y in range(size):
        for x in range(size):
            # 2x2 supersample
            acc = [0,0,0,0]
            for sy in (0.25,0.75):
                for sx in (0.25,0.75):
                    X, Y = (x+sx)/S, (y+sy)/S
                    # rounded rect
                    inside = True
                    if rad:
                        cx = min(max(X, rad), 512-rad); cy = min(max(Y, rad), 512-rad)
                        inside = math.hypot(X-cx, Y-cy) <= rad
                    if not inside: continue
                    t = (X+Y)/1024
                    r = int(0xfb + (0xea-0xfb)*t); g = int(0x92 + (0x58-0x92)*t); b = int(0x3c + (0x0c-0x3c)*t)
                    # glyph coords
                    gx = (X-256)/sc+256; gy = (Y-256)/sc+256
                    d = min(seg_d(gx,gy,*s) for s in segs)
                    # arc: center (256,240) r=128 upper half
                    if gy <= 240: d = min(d, abs(math.hypot(gx-256, gy-240)-128))
                    if d <= sw: r=g=b=255
                    acc[0]+=r; acc[1]+=g; acc[2]+=b; acc[3]+=255
            i = (y*size+x)*4
            px[i:i+4] = bytes([acc[0]//4 if acc[3] else 0, acc[1]//4 if acc[3] else 0, acc[2]//4 if acc[3] else 0, acc[3]//4])
    return px

out = sys.argv[1]
for name, size, mk in [('icon-192.png',192,False),('icon-512.png',512,False),('icon-maskable-512.png',512,True)]:
    png(os.path.join(out, name), size, size, make(size, mk)); print('ok', name)
