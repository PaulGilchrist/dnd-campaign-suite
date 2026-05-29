export const OverlayShape = {
  RADIUS: 'radius',
  CONE: 'cone',
  LINE: 'line',
};

export const DEFAULTS = {
  radius: {
    radiusFt: 20,
    coneAngle: 0,
    widthFt: 0,
    distanceFt: 0,
    color: 'rgba(255,80,60,0.35)',
  },
  cone: {
    radiusFt: 0,
    coneAngle: 53,
    widthFt: 0,
    distanceFt: 60,
    color: 'rgba(255,80,60,0.35)',
  },
  line: {
    radiusFt: 0,
    coneAngle: 0,
    widthFt: 5,
    distanceFt: 60,
    color: 'rgba(255,80,60,0.35)',
  },
};

export const toGrid = (ft) => ft / 5;

export const createOverlay = (shape, gridX, gridY, angle = 0) => ({
  id: crypto.randomUUID(),
  shape,
  startGridX: gridX,
  startGridY: gridY,
  angle,
  ...DEFAULTS[shape],
});

const CELL = 40;

const gridToScreen = (gridX, gridY) => ({
  x: gridX * CELL + CELL / 2,
  y: gridY * CELL + CELL / 2,
});

export const hitTestOverlay = (overlay, gridX, gridY) => {
  const { x: ox, y: oy } = gridToScreen(overlay.startGridX, overlay.startGridY);
  const sx = gridX * CELL + CELL / 2;
  const sy = gridY * CELL + CELL / 2;
  const dx = sx - ox;
  const dy = sy - oy;

  switch (overlay.shape) {
    case OverlayShape.RADIUS: {
      const r = (overlay.radiusFt / 5) * CELL;
      return dx * dx + dy * dy <= r * r;
    }
    case OverlayShape.CONE: {
      const dist = (overlay.distanceFt / 5) * CELL;
      const r2 = dx * dx + dy * dy;
      if (r2 > dist * dist) return false;
      const halfSpread = (overlay.coneAngle / 2) * (Math.PI / 180);
      const angleRad = overlay.angle * (Math.PI / 180);
      let pointAngle = Math.atan2(dy, dx) - angleRad;
      while (pointAngle > Math.PI) pointAngle -= 2 * Math.PI;
      while (pointAngle < -Math.PI) pointAngle += 2 * Math.PI;
      return Math.abs(pointAngle) <= halfSpread;
    }
    case OverlayShape.LINE: {
      const dist = (overlay.distanceFt / 5) * CELL;
      const w = (overlay.widthFt / 5) * CELL;
      const angleRad = overlay.angle * (Math.PI / 180);
      const cos = Math.cos(-angleRad);
      const sin = Math.sin(-angleRad);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      return rx >= 0 && rx <= dist && ry >= -w / 2 && ry <= w / 2;
    }
    default:
      return false;
  }
};

export const svgOrigin = (overlay) => gridToScreen(overlay.startGridX, overlay.startGridY);
