import { ENCOUNTER_CONFIG } from '../../config/encounterConfig.js';

export function calculateXPThreshold(playerLevels, difficultyIndex, config = ENCOUNTER_CONFIG) {
  return playerLevels.reduce((sum, level) => {
    const idx = parseInt(level, 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 20) {
      return sum + (config.xpThresholds[idx]?.[difficultyIndex] ?? 0);
      }
    return sum;
    }, 0);
}

export function calculateDifficultyMultiplier(monsterCount, partySize, config = ENCOUNTER_CONFIG) {
  const ratio = monsterCount / (partySize || 1);
  for (const entry of config.difficultyMultipliers) {
    if (ratio <= entry.ratioMax) {
      return entry.multiplier;
       }
     }
  return config.difficultyMultipliers[config.difficultyMultipliers.length - 1].multiplier;
}

function crToNumber(cr) {
  if (typeof cr === 'number') return cr;
  if (!cr) return 0;
  if (cr.includes('/')) {
    const [n, d] = cr.split('/');
    return parseFloat(n) / parseFloat(d);
    }
  return parseFloat(cr) || 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
   }
  return a;
}

export function getDifficultyLabel(totalXP, monsterCount, threshold, partySize) {
  const multiplier = calculateDifficultyMultiplier(monsterCount, partySize);
  const effectiveXP = totalXP / multiplier;
  const ratio = effectiveXP / threshold;
  if (ratio < ENCOUNTER_CONFIG.difficultyRatios.easyMax) return 'Easy';
  if (ratio < ENCOUNTER_CONFIG.difficultyRatios.mediumMax) return 'Medium';
  if (ratio < ENCOUNTER_CONFIG.difficultyRatios.hardMax) return 'Hard';
  return 'Deadly';
}

export function generateEncounterSuggestions({
  monsters,
  playerLevels,
  difficulty,
  environments,
  count = ENCOUNTER_CONFIG.defaultSuggestionCount,
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
  const crMin = Math.max(0, avgLevel * ENCOUNTER_CONFIG.crRange.minMultiplier);
  const crMax = Math.max(crMin + ENCOUNTER_CONFIG.crRange.minGap, avgLevel);

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
    const multiplier = calculateDifficultyMultiplier(totalCount, partySize);
    const targetRawXP = threshold * multiplier;

     // If the current selection is already over budget, remove allies
    while (totalXP > targetRawXP * ENCOUNTER_CONFIG.budgetTolerance && workingMonsters.length > 1) {
      const removed = workingMonsters.pop();
      totalXP -= removed.monster.xp * removed.qty;
      totalCount -= removed.qty;
     }

     // Iterate to increase quantities while staying within budget
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < workingMonsters.length && totalCount < partySize; i++) {
        const wm = workingMonsters[i];
        const newTotalXP = totalXP + wm.monster.xp;
        const newCount = totalCount + 1;
        const newMultiplier = calculateDifficultyMultiplier(newCount, partySize);
        const newEffective = newTotalXP / newMultiplier;

         // Don't go over deadly threshold * safety cap
        const deadlyThreshold = calculateXPThreshold(playerLevels, 3);
        if (newEffective > deadlyThreshold * ENCOUNTER_CONFIG.deadlyMultiplier) break;

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
      difficultyLabel: getDifficultyLabel(totalXP, totalCount, threshold, partySize),
     };
   }

   // Try different anchor monsters
  const shuffled = shuffle(candidates);
  for (const anchor of shuffled) {
    if (suggestions.length >= count * ENCOUNTER_CONFIG.suggestionOvergenerate) break;

    const key = anchor.index;
    if (seen.has(key)) continue;
    seen.add(key);

    const suggestion = buildSuggestion(anchor);
    if (suggestion) {
      suggestion.anchorIndex = anchor.index;
      suggestions.push(suggestion);
     }
   }

   // Pick the best count suggestions — prefer those close to target difficulty
  const diffOrder = { Easy: 0, Medium: 1, Hard: 2, Deadly: 3 };
  const targetDiff = difficulty;

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
