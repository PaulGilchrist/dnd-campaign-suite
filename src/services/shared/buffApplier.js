export function applyAbilityScoreIncreases(abilities, increases) {
  if (!abilities || !increases) return;
  increases.forEach(inc => {
    if (inc.name && inc.name !== 'any') {
      const ability = abilities.find(
        a => a.name.toLowerCase() === inc.name.toLowerCase()
      );
      if (ability) {
        ability.featIncrease = (ability.featIncrease || 0) + inc.amount;
      }
    }
  });
}

export function mergeDeduplicated(target, key, newItems) {
  if (!newItems || newItems.length === 0) return;
  const existing = new Set((target[key] || []).map(i => i.toLowerCase()));
  newItems.forEach(item => {
    if (!existing.has(item.toLowerCase())) {
      target[key] = target[key] || [];
      target[key].push(item);
      existing.add(item.toLowerCase());
    }
  });
}

