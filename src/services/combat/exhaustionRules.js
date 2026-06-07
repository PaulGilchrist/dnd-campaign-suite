export const EXHAUSTION_LEVELS = 6

export function getExhaustionSaveDC(exhaustionLevel) {
  return 10 + exhaustionLevel
}

export function isDeadFromExhaustion(exhaustionLevel) {
  return exhaustionLevel >= EXHAUSTION_LEVELS
}

export function getLevelAfterLongRest(currentLevel) {
  if (typeof currentLevel === 'number' && currentLevel > 0) {
    return Math.max(0, currentLevel - 1)
   }
  return currentLevel
}
