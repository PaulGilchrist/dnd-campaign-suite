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

export function mergeAbilitiesByKey(target, key, newItems, keyFn) {
  if (!newItems || newItems.length === 0) return;
  const existing = new Set((target[key] || []).map(item => keyFn(item).toLowerCase()));
  newItems.forEach(item => {
    if (!existing.has(keyFn(item).toLowerCase())) {
      target[key] = target[key] || [];
      target[key].push(item);
      existing.add(keyFn(item).toLowerCase());
    }
  });
}

export function resetMiscBonuses(abilities) {
  if (!abilities) return;
  abilities.forEach(ability => {
    ability.miscIncrease = 0;
  });
}

export function resetFeatIncreases(abilities) {
  if (!abilities) return;
  abilities.forEach(ability => {
    ability.featIncrease = 0;
  });
}

export function resetBackgroundIncreases(abilities) {
  if (!abilities) return;
  abilities.forEach(ability => {
    ability.backgroundIncrease = 0;
  });
}
