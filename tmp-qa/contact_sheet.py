#!/usr/bin/env python3
"""Compose tmp-qa/items/*.png into a single contact-sheet JPEG (checker bg)."""
import glob, os, sys
import Quartz
import AppKit

files = sorted(glob.glob(os.path.join(os.path.dirname(__file__), 'items', '*.png')))
files = [f for f in files if '/test/' not in f]
cell_w, cell_h, cols = 288, 288, 6
rows = (len(files) + cols - 1) // cols
W, H = cell_w * cols, cell_h * rows

cs = AppKit.NSColorSpace.deviceRGBColorSpace()
img = AppKit.NSImage.alloc().initWithSize_(AppKit.NSMakeSize(W, H))
img.lockFocus()
ctx = AppKit.NSGraphicsContext.currentContext().CGContext()

# checkerboard (map-like grey tiles)
tile = 24
for y in range(0, H, tile):
    for x in range(0, W, tile):
        c = 0.24 if ((x // tile) + (y // tile)) % 2 == 0 else 0.30
        Quartz.CGContextSetFillColorRGB(ctx, c, c, c, 1.0)
        Quartz.CGContextFillRect(ctx, ((x, y), (tile, tile)))

for i, f in enumerate(files):
    r, c = divmod(i, cols)
    x = c * cell_w
    y = H - (r + 1) * cell_h
    ns = AppKit.NSImage.alloc().initWithContentsOfFile_(f)
    if ns is None:
        continue
    sz = ns.size()
    s = min(cell_w / sz.width, cell_h / sz.height) * 0.92
    dw, dh = sz.width * s, sz.height * s
    dx = x + (cell_w - dw) / 2
    dy = y + (cell_h - dh) / 2 + 16
    ns.drawInRect_fromRect_operation_fraction_(
        ((dx, dy), (dw, dh)), ((0, 0), sz), Quartz.kNSCompositingOperationSourceOver, 1.0)
    # label
    label = os.path.basename(f)[:-4]
    attrs = AppKit.NSDictionary.dictionaryWithObjects_andKeysForCount_(
        [AppKit.NSFont.boldSystemFontOfSize_(16), AppKit.NSColor.whiteColor()],
        ["NSFont", "NSColor"], 2)
    str_ok = False
    try:
        s_ = AppKit.NSString.stringWithString_(label)
        s_.drawAtPoint_withAttributes_(AppKit.NSMakePoint(x + 8, y + 4), attrs)
        str_ok = True
    except Exception as e:
        print('label fail', label, e)

url = Quartz.CFURLCreateWithFileSystemPath(None, os.path.join(os.path.dirname(__file__), 'items', 'contact-sheet.jpg'), Quartz.kCFURLPOSIXPathStyle, False)
dest = Quartz.CGImageDestinationCreateWithURL(url, 'public.jpeg', 1, None)
Quartz.CGImageDestinationAddImage(dest, img.CGImage(), None)
Quartz.CGImageDestinationFinalize(dest)
print('wrote contact-sheet.jpg', len(files), 'tiles', 'labels', str_ok)
