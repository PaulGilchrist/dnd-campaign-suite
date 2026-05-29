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
    coneAngle: 90,
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
