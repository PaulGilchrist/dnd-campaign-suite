import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadEquipment, loadMagicItems, loadMonsters } from '../ui/dataLoader.js';

const treasureTierMap = [
  { minCR: 0, maxCR: 1.5, tier: 'none', valueRange: [0, 0], cpWeight: 1, spWeight: 0, gpWeight: 0, ppWeight: 0 },
  { minCR: 1.5, maxCR: 3, tier: 'poor', valueRange: [25, 75], cpWeight: 0.35, spWeight: 0.40, gpWeight: 0.25, ppWeight: 0 },
  { minCR: 3, maxCR: 5, tier: 'moderate', valueRange: [100, 125], cpWeight: 0.10, spWeight: 0.30, gpWeight: 0.60, ppWeight: 0 },
  { minCR: 5, maxCR: 7, tier: 'standard', valueRange: [175, 250], cpWeight: 0, spWeight: 0.10, gpWeight: 0.80, ppWeight: 0.10 },
  { minCR: 7, maxCR: 9, tier: 'rich', valueRange: [375, 500], cpWeight: 0, spWeight: 0, gpWeight: 0.60, ppWeight: 0.40 },
  { minCR: 9, maxCR: 11, tier: 'greater', valueRange: [1000, 2250], cpWeight: 0, spWeight: 0, gpWeight: 0.30, ppWeight: 0.70 },
  { minCR: 11, maxCR: 17, tier: 'major', valueRange: [3250, 15000], cpWeight: 0, spWeight: 0, gpWeight: 0.05, ppWeight: 0.95 },
  { minCR: 17, maxCR: 30, tier: 'treasure hoard', valueRange: [20000, 45000], cpWeight: 0, spWeight: 0, gpWeight: 0, ppWeight: 1 },
];

const magicItemRarityWeights = {
  common: 40,
  uncommon: 35,
  rare: 17,
  'very rare': 6,
  legendary: 2,
  artifact: 0,
};

const gemTypes = [
  { name: 'Pearl', adj: ['', 'smooth ', 'flawless '] },
  { name: 'Coral', adj: ['branch of ', 'pink '] },
  { name: 'Amber', adj: ['cloudy ', 'clear '] },
  { name: 'Ruby', adj: ['deep red ', 'scarlet '] },
  { name: 'Peridot', adj: ['golden '] },
  { name: 'Topaz', adj: ['azure ', 'green '] },
  { name: 'Lapis Lazuli', adj: ['', 'deep blue '] },
  { name: 'Aquamarine', adj: ['pale '] },
  { name: 'Citrine', adj: ['golden yellow '] },
  { name: 'Malachite', adj: ['green banded '] },
  { name: 'Jasper', adj: ['blood red '] },
  { name: 'Turquoise', adj: ['', 'sky blue '] },
];

const jewelryTypes = [
  'ring set with a ',
  'neck chain of ',
  'brooch shaped like a ',
  'pendant with a small ',
  'earring made of ',
  'bracelet woven from ',
];

const commonGemValues = [1, 2, 3, 5, 10, 25, 50, 75, 100, 125, 150, 200, 300, 400, 500, 600, 750, 1000];
const fineGemValues = [800, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000];

function randInt(min, max) {
  if (min > max) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function normalizeCurrency(totalGP) {
  const totalCP = Math.round(totalGP * 100);
  const cpRemainder = totalCP % 10;
  let spTotal = Math.floor(totalCP / 10);
  const spRemainder = spTotal % 10;
  let gpTotal = Math.floor(spTotal / 10);
  const gpRemainder = gpTotal % 10;
  const pp = Math.floor(gpTotal / 10);
  return { pp, gp: gpRemainder, sp: spRemainder, cp: cpRemainder };
}

export function formatCurrencyString(currency) {
  const parts = [];
  if (currency.pp) parts.push(`${currency.pp} platinum piece${currency.pp !== 1 ? 's' : ''}`);
  if (currency.gp) parts.push(`${currency.gp} gold piece${currency.gp !== 1 ? 's' : ''}`);
  if (currency.sp) parts.push(`${currency.sp} silver coin${currency.sp !== 1 ? 's' : ''}`);
  if (currency.cp) parts.push(`${currency.cp} copper coin${currency.cp !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(', ') : '0 platinum pieces';
}

export function calculateEncounterXp(selectedMonsters) {
  if (!selectedMonsters || !selectedMonsters.length) return 0;
  return selectedMonsters.reduce((sum, m) => sum + (m.xp || 0) * (m.qty || 1), 0);
}

function pick(arr) {
  if (!arr || !arr.length) return null;
  return arr[randInt(0, arr.length - 1)];
}

function crToNumber(cr) {
  if (typeof cr === 'number') return cr;
  if (!cr) return 0.25;
  const str = String(cr);
  if (str.includes('/')) {
    const [n, d] = str.split('/');
    const num = parseFloat(n) / parseFloat(d);
    return isNaN(num) ? 0.25 : num;
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0.25 : num;
}

function getTreasureTier(cr) {
  for (const tier of treasureTierMap) {
    if (cr >= tier.minCR && cr <= tier.maxCR) return tier;
  }
  return treasureTierMap[0];
}

function weightedPick(values, weights) {
  const total = weights.reduce((s, w) => s + (w || 0), 0);
  if (!total) return values[values.length - 1];
  let roll = Math.random() * total;
  for (let i = 0; i < values.length; i++) {
    roll -= weights[i] || 0;
    if (roll <= 0) return values[i];
  }
  return values[values.length - 1];
}

const currencyUnitRules = [
  {
    unit: 'pp',
    minGP: 100,
    toGP: 100,
    weightKey: 'ppWeight',
    rollQty: (totalValueGP) => {
      const maxPP = Math.max(1, Math.floor(totalValueGP / 100));
      return randInt(Math.max(1, Math.floor(maxPP * 0.3)), maxPP);
    },
  },
  {
    unit: 'gp',
    minGP: 1,
    toGP: 1,
    weightKey: 'gpWeight',
    rollQty: (totalValueGP) => randInt(Math.max(1, Math.floor(totalValueGP * 0.2)), Math.max(1, Math.floor(totalValueGP))),
  },
  {
    unit: 'sp',
    minGP: 0.1,
    toGP: 0.1,
    weightKey: 'spWeight',
    rollQty: (totalValueGP) => randInt(Math.max(1, Math.floor(totalValueGP * 2)), Math.max(1, Math.floor(totalValueGP * 10))),
  },
  {
    unit: 'cp',
    minGP: 0.01,
    toGP: 0.01,
    weightKey: 'cpWeight',
    rollQty: (totalValueGP) => {
      const maxCP = Math.max(1, Math.floor(totalValueGP * 100));
      return randInt(Math.max(1, Math.floor(maxCP * 0.3)), maxCP);
    },
  },
];

function selectCurrencyUnits(tier, totalValueGP) {
  const units = [];
  const weights = [];
  for (const rule of currencyUnitRules) {
    const weight = tier[rule.weightKey] || 0;
    if (weight > 0 && totalValueGP >= rule.minGP) {
      units.push(rule);
      weights.push(weight);
    }
  }
  return { units, weights };
}

function generateCurrencyEntry(tier, totalValueGP) {
  if (totalValueGP <= 0) return null;

  const { units, weights } = selectCurrencyUnits(tier, totalValueGP);
  if (units.length === 0) return null;

  const rule = weightedPick(units, weights);
  return rule.rollQty(totalValueGP) * rule.toGP;
}

function generateGemEntry(tier) {
  const [minV, maxV] = tier.valueRange;
  let valuePool;

  if (maxV <= 500) {
    valuePool = commonGemValues.filter(v => v >= minV * 0.5 && v <= maxV * 1.5);
  } else if (maxV <= 2000) {
    const pool = [...commonGemValues.slice(-5), ...fineGemValues.slice(0, 3)];
    valuePool = pool.filter(v => v >= minV * 0.5 && v <= maxV * 1.5);
  } else {
    valuePool = fineGemValues.filter(v => v <= maxV * 1.5);
  }

  if (!valuePool || !valuePool.length) return null;

  const value = pick(valuePool);
  const gemObj = pick(gemTypes);
  const adj = pick(gemObj.adj);
  const isJewelry = Math.random() < 0.35 && value >= 25;

  if (isJewelry) {
    const jewelType = pick(jewelryTypes);
    return `${jewelType}${gemObj.name.toLowerCase()}, ${value} gp`;
  }
  return `${adj}${gemObj.name}, ${value} gp`;
}

function generateEquipmentEntry(equipmentData, tier) {
  if (!equipmentData || !equipmentData.length) return null;
  const [minV, maxV] = tier.valueRange;

  const eligible = equipmentData.filter(e => {
    if (!e.cost) return false;
    if (['Property', 'Mounts and Vehicles', 'Material'].includes(e.equipment_category)) return false;
    const costGP = convertCostToGP(e.cost);
    if (!costGP && costGP !== 0) return false;
    return costGP >= minV * 0.2 && costGP <= maxV * 1.5;
  });

  if (!eligible || !eligible.length) return null;
  const item = pick(eligible);
  return `${item.name} (${formatCost(item.cost)})`;
}

function convertCostToGP(cost) {
  if (!cost || typeof cost.quantity !== 'number') return null;
  const toGP = { cp: 0.01, sp: 0.1, gp: 1, pp: 100 };
  const factor = toGP[cost.unit];
  if (!factor && factor !== 0) return null;
  return cost.quantity * factor;
}

function formatCost(cost) {
  if (!cost || typeof cost.quantity !== 'number') return '0 gp';
  return `${cost.quantity} ${cost.unit}`;
}

function normalizeRarity(rarity) {
  if (!rarity) return null;
  const r = rarity.toLowerCase().trim();
  if (r.includes('artifact')) return 'artifact';
  if (r.includes('legendary')) return 'legendary';
  if (r.includes('very rare') || r.includes('+3')) return 'very rare';
  if (r.includes('rare') && !r.includes('very')) return 'rare';
  if (r.includes('uncommon') && !r.includes('rare')) return 'uncommon';
  if (!['varies', 'unknown'].includes(r)) return 'common';
  return null;
}

function generateMagicItemEntry(magicItemsData) {
  if (!magicItemsData || !magicItemsData.length) return null;

  const rarityKeys = Object.keys(magicItemRarityWeights);
  const weights = rarityKeys.map(r => magicItemRarityWeights[r]);
  let targetRarity = weightedPick(rarityKeys, weights);

  for (let attempt = 0; attempt < rarityKeys.length; attempt++) {
    const eligible = magicItemsData.filter(item => normalizeRarity(item.rarity) === targetRarity);
    if (eligible.length > 0) {
      return formatMagicItemEntry(pick(eligible));
    }
    targetRarity = pick(rarityKeys);
  }

  return null;
}

function formatMagicItemEntry(item) {
  let entry = `"${item.name}"`;
  const rarity = normalizeRarity(item.rarity);
  if (rarity) {
    const display = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    entry += ` (${display}`;
    if (item.type) {
      entry += `, ${item.type}`;
    }
    if (item.requiresAttunement) {
      entry += ', requires attunement';
    }
    entry += ')';
  }
  return entry;
}

async function loadJSONData(file) {
  try {
    if (file === 'monsters.json') return loadMonsters();
    if (file === 'magic-items.json') return loadMagicItems();
    if (file === 'equipment.json') return loadEquipment();
    const res = await fetch(`/data/${file}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    console.error('[lootGenerator] Error loading /data/', file)
    return [];
  }
}

function rollMonsterEntries(tier, numEntries, equipmentData, magicItemsData, accum) {
  const roll = Math.random();

  if (roll < 0.65) {
    const share = totalValueForTier(tier) / numEntries;
    const entry = generateCurrencyEntry(tier, share);
    if (typeof entry === 'number' && entry > 0) accum.currencyGP.push(entry);
  } else if (roll < 0.82) {
    const entry = generateGemEntry(tier);
    if (entry) accum.otherEntries.push(entry);
  } else if (roll < 0.94) {
    const entry = generateEquipmentEntry(equipmentData, tier);
    if (entry) accum.otherEntries.push(entry);
  } else {
    const entry = generateMagicItemEntry(magicItemsData);
    if (entry) accum.otherEntries.push(entry);
  }
}

function buildLootEntries(currencyGP, otherEntries) {
  const lootEntries = [];
  if (currencyGP.length > 0) {
    const totalCurrencyGP = currencyGP.reduce((s, v) => s + v, 0);
    const formatted = formatCurrencyString(normalizeCurrency(totalCurrencyGP));
    if (formatted && formatted !== '0 platinum pieces') lootEntries.push(formatted);
  }

  for (const entry of otherEntries) {
    lootEntries.push(entry);
  }

  if (lootEntries.length === 0) {
    lootEntries.push('No loot for these monsters');
  }

  return lootEntries;
}

export async function generateLootSuggestions(selectedMonsters) {
  if (!selectedMonsters || !selectedMonsters.length) {
    return { lootEntries: [], totalEncounterXp: 0 };
  }

  const [magicItemsData, equipmentData] = await Promise.all([
    loadJSONData('magic-items.json'),
    loadJSONData('equipment.json'),
  ]);

  const accum = { currencyGP: [], otherEntries: [] };

  for (const monster of selectedMonsters) {
    const qty = monster.qty || 1;
    const cr = crToNumber(monster.challenge_rating);
    const tier = getTreasureTier(cr);

    if (tier.tier === 'none') continue;
    if (Math.random() > getTreasureFrequency(cr)) continue;

    const numEntries = randInt(1, Math.min(qty + 2, 4));

    for (let i = 0; i < numEntries; i++) {
      rollMonsterEntries(tier, numEntries, equipmentData, magicItemsData, accum);
    }
  }

  return {
    lootEntries: buildLootEntries(accum.currencyGP, accum.otherEntries),
    totalEncounterXp: calculateEncounterXp(selectedMonsters),
  };
}

function getTreasureFrequency(cr) {
  if (cr < 0.5) return 0;
  if (cr <= 2) return 0.30;
  if (cr <= 4) return 0.50;
  return 1;
}

function totalValueForTier(tier) {
  const [lo, hi] = tier.valueRange;
  return (lo + hi) / 2;
}

export async function generateLootFromCombatSummary(combatSummary, characters, _campaignName) {
  if (!combatSummary || !combatSummary.creatures) {
    return { lootEntries: [], totalEncounterXp: 0 };
  }

  const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
  const characterNames = new Set((characters || []).map(c => c.name));

  const filteredCreatures = combatSummary.creatures.filter(creature => {
    if (creature.type !== 'npc') return true;
    if (!creature.monsterIndex) return true;
    const isSummoned = targetEffects.some(
      te => te.target === creature.name && te.effect === 'summoned'
    );
    if (!isSummoned) return true;
    const summoner = targetEffects.find(
      te => te.target === creature.name && te.effect === 'summoned'
    );
    if (!summoner) return true;
    if (summoner.source === 'GM') return true;
    if (characterNames.has(summoner.source)) return false;
    return true;
  });

  const monsterCounts = {};
  for (const creature of filteredCreatures) {
    if (!creature.monsterIndex) continue;
    if (!monsterCounts[creature.monsterIndex]) {
      monsterCounts[creature.monsterIndex] = { count: 0, creature };
    }
    monsterCounts[creature.monsterIndex].count++;
  }

  const monsterList = Object.values(monsterCounts).map(({ count, creature }) => ({
    index: creature.monsterIndex,
    name: creature.name,
    qty: count,
  }));

  const monsterData = await loadJSONData('monsters.json');
  const monsterMap = {};
  if (monsterData) {
    for (const m of monsterData) {
      monsterMap[m.index] = m;
    }
  }

  const enrichedList = monsterList.map(entry => {
    const fullMonster = monsterMap[entry.index] || {};
    return {
      name: entry.name,
      qty: entry.qty,
      xp: fullMonster.xp || 0,
      challenge_rating: fullMonster.challenge_rating,
    };
  });

  return generateLootSuggestions(enrichedList);
}