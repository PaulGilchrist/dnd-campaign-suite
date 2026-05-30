import { loadEquipment } from './dataLoader.js';
import { parseMagicItemName } from './attackCalc.js';

const DAMAGE_TYPES = [
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
  'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'
];

export function extractDamageTypes(description) {
  if (!description || typeof description !== 'string') return [];
  return DAMAGE_TYPES.filter(dt =>
    new RegExp(`\\b${dt}\\b`, 'i').test(description)
  );
}

export function formatDamageTypes(types) {
  if (!types || types.length === 0) return null;
  return types.join('/');
}

export function getResistanceNotice(damageTypes, targetResistances, targetImmunities, targetName) {
  if (!damageTypes || damageTypes.length === 0) return null;
  for (const dt of damageTypes) {
    const lower = dt.toLowerCase();
    if (targetImmunities?.some(i => i.toLowerCase() === lower))
      return `${targetName} is IMMUNE to ${dt}`;
    if (targetResistances?.some(r => r.toLowerCase() === lower))
      return `${targetName} resists ${dt}`;
  }
  return null;
}

export function getCombatContext() {
  const stored = localStorage.getItem('combatSummary');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function findCreatureByName(combatSummary, name) {
  if (!combatSummary?.creatures || !name) return null;
  return combatSummary.creatures.find(c =>
    c.name === name || c.name.startsWith(name + ' ')
  );
}

export function getTargetFromAttacker(combatSummary, attackerName) {
  const attacker = findCreatureByName(combatSummary, attackerName);
  if (!attacker || !attacker.targetId) return null;
  const target = combatSummary.creatures.find(c => c.id === attacker.targetId);
  return target || null;
}

export function getAttackerTargetId(combatSummary, attackerName) {
  const attacker = findCreatureByName(combatSummary, attackerName);
  return attacker?.targetId || null;
}

function computeAbilityBonus(character, abilityName) {
  const ab = character.abilities?.find(a => a.name === abilityName);
  if (!ab) return 0;
  if (ab.bonus != null) return ab.bonus;
  return Math.floor((ab.baseScore - 10) / 2);
}

export async function computePlayerAc(character) {
  if (!character) return 10;
  const equipment = await loadEquipment();
  if (!equipment || equipment.length === 0) {
    return 10 + computeAbilityBonus(character, 'Dexterity');
  }

  const equipped = character.inventory?.equipped || [];
  const dexBonus = computeAbilityBonus(character, 'Dexterity');

  let ac = 10;
  let hasArmor = false;

  for (const itemName of equipped) {
    const { baseName } = parseMagicItemName(itemName);
    const item = equipment.find(e => e.name === baseName);
    if (!item) continue;

    if (item.equipment_category === 'Armor') {
      const base = item.armor_class?.base || 0;
      if (item.armor_class?.dex_bonus) {
        const maxBonus = item.armor_class.max_bonus != null ? item.armor_class.max_bonus : 99;
        ac = base + Math.min(dexBonus, maxBonus);
      } else {
        ac = base;
      }
      hasArmor = true;
    } else if (item.equipment_category === 'Shield') {
      ac += 2;
    }
  }

  if (!hasArmor) {
    ac = 10 + dexBonus;
  }

  return ac;
}

export function computeAcEstimate(character) {
  if (!character?.abilities) return 10;
  return 10 + computeAbilityBonus(character, 'Dexterity');
}
