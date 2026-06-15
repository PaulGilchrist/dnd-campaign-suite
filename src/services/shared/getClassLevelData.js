export function getClassLevelData(playerStats) {
  const levels = playerStats.class?.class_levels;
  if (!levels) return null;
  return levels.find(cl => cl.level === playerStats.level) || null;
}
