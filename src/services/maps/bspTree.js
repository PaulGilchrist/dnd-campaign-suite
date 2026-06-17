export function rectCenter(r) {
  return [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
}

export function rectIntersects(a, b, padding) {
  padding = padding || 0;
  return (
    a.x - padding <= b.x + b.w - 1 + padding &&
    a.x + a.w - 1 + padding >= b.x - padding &&
    a.y - padding <= b.y + b.h - 1 + padding &&
    a.y + a.h - 1 + padding >= b.y - padding
  );
}

export function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w - 1 && y >= r.y && y <= r.y + r.h - 1;
}

export class BSPNode {
  constructor(rect) {
    this.rect = rect;
    this.left = null;
    this.right = null;
    this.room = null;
  }

  split(rng, minSize) {
    minSize = minSize || 4;
    if (this.left || this.right) return false;

    let splitHorizontal;
    if (this.rect.w > this.rect.h * 1.25) {
      splitHorizontal = false;
    } else if (this.rect.h > this.rect.w * 1.25) {
      splitHorizontal = true;
    } else {
      splitHorizontal = rng() < 0.5;
    }

    if (splitHorizontal) {
      if (this.rect.h < minSize * 2) return false;
      const split =
        this.rect.y + minSize + Math.floor(rng() * (this.rect.h - minSize * 2));
      this.left = new BSPNode({
        x: this.rect.x,
        y: this.rect.y,
        w: this.rect.w,
        h: split - this.rect.y,
      });
      this.right = new BSPNode({
        x: this.rect.x,
        y: split,
        w: this.rect.w,
        h: this.rect.y + this.rect.h - split,
      });
    } else {
      if (this.rect.w < minSize * 2) return false;
      const split =
        this.rect.x + minSize + Math.floor(rng() * (this.rect.w - minSize * 2));
      this.left = new BSPNode({
        x: this.rect.x,
        y: this.rect.y,
        w: split - this.rect.x,
        h: this.rect.h,
      });
      this.right = new BSPNode({
        x: split,
        y: this.rect.y,
        w: this.rect.x + this.rect.w - split,
        h: this.rect.h,
      });
    }
    return true;
  }

  createRooms(rng, minRoom, maxRoom) {
    const rooms = [];
    this._recursiveCreateRooms(rng, rooms, minRoom, maxRoom);
    return rooms;
  }

  _recursiveCreateRooms(rng, rooms, minRoom, maxRoom) {
    if (this.left) this.left._recursiveCreateRooms(rng, rooms, minRoom, maxRoom);
    if (this.right)
      this.right._recursiveCreateRooms(rng, rooms, minRoom, maxRoom);

    if (!this.left && !this.right) {
      const maxW = Math.min(maxRoom, this.rect.w);
      const maxH = Math.min(maxRoom, this.rect.h);
      const w = minRoom + Math.floor(rng() * (maxW - minRoom + 1));
      const h = minRoom + Math.floor(rng() * (maxH - minRoom + 1));
      const maxOffX = Math.max(0, Math.min(2, this.rect.w - w));
      const maxOffY = Math.max(0, Math.min(2, this.rect.h - h));
      const x = this.rect.x + Math.floor(rng() * (maxOffX + 1));
      const y = this.rect.y + Math.floor(rng() * (maxOffY + 1));
      const room = { rect: { x, y, w, h }, id: rooms.length, connected: [] };
      this.room = room;
      rooms.push(room);
    }
  }
}
