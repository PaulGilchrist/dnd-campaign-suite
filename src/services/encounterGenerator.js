// XP thresholds per level [Easy, Medium, Hard, Deadly] — mirrors EncounterBuilder
const xpThresholds = [
  [15, 25, 40, 50], [25, 50, 75, 100], [50, 100, 150, 200],
  [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100],
  [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];

function crToNumber(cr) {
  if (typeof cr === 'number') return cr;
  if (!cr) return 0;
  if (cr.includes('/')) {
    const [n, d] = cr.split('/');
    return parseFloat(n) / parseFloat(d);
  }
  return parseFloat(cr) || 0;
}

function calculateXPThreshold(playerLevels, difficultyIndex) {
  return playerLevels.reduce((sum, level) => {
    const idx = parseInt(level, 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 20) {
      return sum + (xpThresholds[idx][difficultyIndex] || 0);
    }
    return sum;
  }, 0);
}

function calculateDifficultyMultiplier(monsterCount) {
  if (monsterCount <= 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateEncounterSuggestions({
  monsters,
  playerLevels,
  difficulty,
  environments,
  count = 3,
}) {
  const partySize = playerLevels.length;
  const threshold = calculateXPThreshold(playerLevels, difficulty);
  const avgLevel = playerLevels.reduce((s, l) => s + l, 0) / playerLevels.length;

  // Filter to monsters in selected environments
  const eligible = monsters.filter(m =>
    m.environments && m.environments.some(e => environments.includes(e))
  );

  if (eligible.length === 0) return [];

  // Group by best CR match — find monster types that fit the party level
  // Good CR range: 1/8 of avgLevel up to avgLevel
  const crMin = Math.max(0, avgLevel * 0.125);
  const crMax = Math.max(crMin + 0.25, avgLevel);

  const candidates = eligible.filter(m => {
    const cr = crToNumber(m.challenge_rating);
    return cr >= crMin && cr <= crMax;
  });

  if (candidates.length === 0) {
    // Fallback: use the lowest-CR monsters available
    const sorted = [...eligible].sort((a, b) => crToNumber(a.challenge_rating) - crToNumber(b.challenge_rating));
    const lowest = crToNumber(sorted[0]?.challenge_rating || 0);
    candidates.push(...eligible.filter(m => crToNumber(m.challenge_rating) <= Math.max(lowest + 1, avgLevel)));
  }

  if (candidates.length === 0) return [];

  const suggestions = [];
  const seen = new Set();

  // Build a suggestion from a given anchor monster
  function buildSuggestion(anchor) {
    const anchorCr = crToNumber(anchor.challenge_rating);
    const monstersUsed = [];

    // Try adding allies first for variety
    let workingMonsters = [{ monster: anchor, qty: 1 }];
    let totalXP = anchor.xp;
    let totalCount = 1;

    if (anchor.allies && anchor.allies.length > 0 && totalCount < partySize) {
      const shuffledAllies = shuffle(anchor.allies);
      for (const allyIdx of shuffledAllies) {
        if (totalCount >= partySize) break;
        const ally = eligible.find(m => m.index === allyIdx);
        if (!ally || ally.xp <= 0) continue;
        if (workingMonsters.some(w => w.monster.index === ally.index)) continue;
        workingMonsters.push({ monster: ally, qty: 1 });
        totalXP += ally.xp;
        totalCount++;
      }
    }

    // Now fill by adjusting quantities of the monsters we have
    // Calculate how many total monsters we can have to hit the XP target
    const multiplier = calculateDifficultyMultiplier(totalCount);
    const targetRawXP = threshold * multiplier;

    // If the current selection is already over budget, remove allies
    while (totalXP > targetRawXP * 1.1 && workingMonsters.length > 1) {
      const removed = workingMonsters.pop();
      totalXP -= removed.monster.xp * removed.qty;
      totalCount -= removed.qty;
    }

    // Now try to increase quantities of existing monsters
    // but keep total monster count ≤ party size
    // and total raw XP should produce the right difficulty when divided by multiplier
    // effectiveXP = totalMonsterXP / multiplier  (mirroring EncounterBuilder)
    // target: effectiveXP ≈ threshold
    // so totalMonsterXP ≈ threshold * multiplier

    // We want to be within a reasonable range of the target
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < workingMonsters.length && totalCount < partySize; i++) {
        const wm = workingMonsters[i];
        const newTotalXP = totalXP + wm.monster.xp;
        const newCount = totalCount + 1;
        const newMultiplier = calculateDifficultyMultiplier(newCount);
        const newEffective = newTotalXP / newMultiplier;

        // Don't go over deadly threshold
        const deadlyThreshold = calculateXPThreshold(playerLevels, 3);
        if (newEffective > deadlyThreshold * 1.5) break;

        // Don't exceed party size
        if (newCount > partySize) break;

        workingMonsters[i] = { ...wm, qty: wm.qty + 1 };
        totalXP = newTotalXP;
        totalCount = newCount;
      }
    }

    workingMonsters = workingMonsters.filter(w => w.qty > 0);

    if (workingMonsters.length === 0) return null;

    return {
      monsters: workingMonsters.map(w => ({
        ...w.monster,
        qty: w.qty,
      })),
      totalXP,
      monsterCount: totalCount,
      difficultyLabel: getDifficultyLabel(totalXP, totalCount, threshold),
    };
  }

  function getDifficultyLabel(totalXP, monsterCount, threshold) {
    const multiplier = calculateDifficultyMultiplier(monsterCount);
    const effectiveXP = totalXP / multiplier;
    const ratio = effectiveXP / threshold;
    if (ratio < 0.5) return 'Easy';
    if (ratio < 1) return 'Medium';
    if (ratio < 1.5) return 'Hard';
    return 'Deadly';
  }

  // Try different anchor monsters
  const shuffled = shuffle(candidates);
  for (const anchor of shuffled) {
    if (suggestions.length >= count * 2) break;

    const key = anchor.index;
    if (seen.has(key)) continue;
    seen.add(key);

    const suggestion = buildSuggestion(anchor);
    if (suggestion) {
      suggestion.anchorIndex = anchor.index;
      suggestions.push(suggestion);
    }
  }

  // Pick the best count suggestions — prefer more balanced difficulty
  const diffOrder = { Easy: 0, Medium: 1, Hard: 2, Deadly: 3 };
  const targetDiff = difficulty; // 0=Easy, 1=Medium, 2=Hard, 3=Deadly

  suggestions.sort((a, b) => {
    const aDiff = diffOrder[a.difficultyLabel] ?? 0;
    const bDiff = diffOrder[b.difficultyLabel] ?? 0;
    const aDist = Math.abs(aDiff - targetDiff);
    const bDist = Math.abs(bDiff - targetDiff);
    if (aDist !== bDist) return aDist - bDist;
    // Prefer more monster variety
    const aVariety = b.monsters.length - a.monsters.length;
    if (aVariety !== 0) return aVariety;
    return Math.random() - 0.5;
  });

  return suggestions.slice(0, count);
}
