import { loadEquipment } from '../../ui/dataLoader.js';
import { parseMagicItemName } from '../core/attackCalc.js';

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
  let immuneTypes = [];
  let resistedTypes = [];
  for (const dt of damageTypes) {
    if (!dt) continue;
    const lower = dt.toLowerCase();
    if (targetImmunities?.some(i => i.toLowerCase() === lower))
      immuneTypes.push(dt);
    else if (targetResistances?.some(r => r.toLowerCase() === lower))
      resistedTypes.push(dt);
  }
  if (immuneTypes.length > 0)
    return `${targetName} is IMMUNE to ${immuneTypes.join(', ')}`;
  if (resistedTypes.length > 0)
    return `${targetName} resists ${resistedTypes.join(', ')}`;
  return null;
}

export async function getCombatContext(campaignName) {
  if (!campaignName) return null;
  try {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/change-data`);
    if (!response.ok) {
      console.error('[getCombatContext] Failed to fetch change-data:', response.status, response.statusText, 'for', campaignName);
      return null;
    }
    const data = await response.json();
    const combatSummary = data.combatSummary || null;
    // BUG (MA-1966 infra): the baked combatSummary.activeCreatureName only moves at
    // round-wrap/resort writes, so it goes stale mid-round and legendary/gate consumers
    // over-refuse fresh boundaries. The top-level activeCreatureName key is the LIVE
    // tracker truth — every Next/Prev step advances it first — so it wins whenever
    // present; the baked field is the fallback (playbook §31: "top-level is truth").
    if (combatSummary && data.activeCreatureName) {
      combatSummary.activeCreatureName = data.activeCreatureName;
    }
    return combatSummary;
   } catch (err) {
    console.error('[getCombatContext] Error fetching change-data:', err.message);
    return null;
   }
}

export function findCreatureByName(combatSummary, name) {
  if (!combatSummary?.creatures || !name) return null;
  const exact = combatSummary.creatures.find(c => c.name === name);
  if (exact) return exact;
  return combatSummary.creatures.find(c =>
    c.name.startsWith(name + ' ')
  );
}

export function getTargetFromAttacker(combatSummary, attackerName) {
  const attacker = findCreatureByName(combatSummary, attackerName);
  if (!attacker || !attacker.targetName) return null;
  const target = combatSummary.creatures.find(c => c.name === attacker.targetName);
  return target || null;
}

export function getAttackerTargetName(combatSummary, attackerName) {
  const attacker = findCreatureByName(combatSummary, attackerName);
  return attacker?.targetName || null;
}

function computeAbilityBonus(character, abilityName) {
  const ab = character.abilities?.find(a => a.name === abilityName);
  if (!ab) return 0;
  if (ab.bonus != null) return ab.bonus;
  return Math.floor((ab.baseScore - 10) / 2);
}

function armorAcContribution(item, dexBonus) {
  const base = item.armor_class?.base || 0;
  if (!item.armor_class?.dex_bonus) return base;
  const maxBonus = item.armor_class.max_bonus != null ? item.armor_class.max_bonus : 99;
  return base + Math.min(dexBonus, maxBonus);
}

export async function computePlayerAc(character) {
  if (!character) return 10;
  const equipment = await loadEquipment();
  if (!equipment || equipment.length === 0) {
    return 10 + computeAbilityBonus(character, 'Dexterity');
  }

  const equipped = character.inventory?.equipped || [];
  const dexBonus = computeAbilityBonus(character, 'Dexterity');

  // fix#1213 (#1213): gather components, compose once. The shield bonus is
  // hoisted out of the loop branches so it lands exactly once on BOTH arms —
  // armored (base+dex+shield) and shield-only (10+dex+shield, RAW). Pre-fix
  // the !hasArmor fallback recomputed 10+dex, silently discarding the shield's
  // +2 (shield-only pinned 13 at dex +3), and a shield listed before armor was
  // wiped by the armor branch's assignment. Single-contract per fix#115 idiom.
  // Disk law: real shields are equipment_category "Armor" + armor_category
  // "Shield" (public/data/equipment.json:4122-4131), so shield detection must
  // check armor_category first — mirrors reactionDebuffHandler.js:387.
  let armorAc = null;
  let shieldBonus = 0;

  for (const itemName of equipped) {
    const { baseName } = parseMagicItemName(itemName);
    const item = equipment.find(e => e.name === baseName);
    if (!item) continue;

    if (item.equipment_category === 'Shield' || item.armor_category === 'Shield') {
      shieldBonus += 2;
    } else if (item.equipment_category === 'Armor') {
      armorAc = armorAcContribution(item, dexBonus);
    }
  }

  // armorAc may be a lawful 0 (mis-tagged Armor with no armor_class, pinned
  // honest at damageUtils.test.js #1213b), so null — not falsiness — is the
  // "no armor seen" sentinel.
  return (armorAc ?? (10 + dexBonus)) + shieldBonus;
}

export function computeAcEstimate(character) {
  if (!character?.abilities) return 10;
  return 10 + computeAbilityBonus(character, 'Dexterity');
}
