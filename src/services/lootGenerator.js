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

function generateCurrencyEntry(tier, totalValueGP) {
  const cpW = tier.cpWeight || 0;
  const spW = tier.spWeight || 0;
  const gpW = tier.gpWeight || 0;
  const ppW = tier.ppWeight || 0;

  if (totalValueGP <= 0) return null;

  const units = [];
  const weights = [];

  if (ppW > 0 && totalValueGP >= 100) { units.push('pp'); weights.push(ppW); }
  if (gpW > 0 && totalValueGP >= 1) { units.push('gp'); weights.push(gpW); }
  if (spW > 0 && totalValueGP >= 0.1) { units.push('sp'); weights.push(spW); }
  if (cpW > 0 && totalValueGP >= 0.01) { units.push('cp'); weights.push(cpW); }

  if (units.length === 0) return null;

  const unit = weightedPick(units, weights);
  const pluralNames = { cp: 'copper coins', sp: 'silver coins', gp: 'gold pieces', pp: 'platinum pieces' };

  let qty;
  if (unit === 'pp') {
    const maxPP = Math.max(1, Math.floor(totalValueGP / 100));
    qty = randInt(Math.max(1, Math.floor(maxPP * 0.3)), maxPP);
  } else if (unit === 'gp') {
    qty = randInt(Math.max(1, Math.floor(totalValueGP * 0.2)), Math.max(1, Math.floor(totalValueGP)));
  } else if (unit === 'sp') {
    qty = randInt(Math.max(1, Math.floor(totalValueGP * 2)), Math.max(1, Math.floor(totalValueGP * 10)));
  } else {
    const maxCP = Math.max(1, Math.floor(totalValueGP * 100));
    qty = randInt(Math.max(1, Math.floor(maxCP * 0.3)), maxCP);
  }

  return `${qty} ${pluralNames[unit]}`;
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
    if (['Property', 'Mounts and Vehicles'].includes(e.equipment_category)) return false;
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
    const res = await fetch(`/data/${file}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function generateLootSuggestions(selectedMonsters) {
  if (!selectedMonsters || !selectedMonsters.length) return [];

  const [magicItemsData, equipmentData] = await Promise.all([
    loadJSONData('magic-items.json'),
    loadJSONData('equipment.json'),
  ]);

  const lootEntries = [];

  for (const monster of selectedMonsters) {
    const qty = monster.qty || 1;
    const cr = crToNumber(monster.challenge_rating);
    const tier = getTreasureTier(cr);

    if (tier.tier === 'none') continue;

    const treasureFrequency = getTreasureFrequency(cr);
    if (Math.random() > treasureFrequency) continue;

    const numEntries = randInt(1, Math.min(qty + 2, 4));

    for (let i = 0; i < numEntries; i++) {
      let entry;
      const roll = Math.random();

      if (roll < 0.65) {
        const share = totalValueForTier(tier) / numEntries;
        entry = generateCurrencyEntry(tier, share);
      } else if (roll < 0.82) {
        entry = generateGemEntry(tier);
      } else if (roll < 0.94) {
        entry = generateEquipmentEntry(equipmentData, tier);
      } else {
        entry = generateMagicItemEntry(magicItemsData);
      }

      if (entry) lootEntries.push(entry);
    }
  }

  if (lootEntries.length === 0) {
    lootEntries.push('No loot for these monsters');
   }
  return lootEntries;
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