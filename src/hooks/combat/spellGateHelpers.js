import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { isStable } from '../../services/combat/conditions/deathSaveRules.js';
import { isCreaturePresent } from '../../services/combat/creaturePresence.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getCsAndTargets(campaignName, opts = {}) {
  const { excludeCaster = false, includeCaster = false, casterName = '' } = opts;
  const cs = getCombatSummary(campaignName);
  if (!cs?.creatures) {
    console.error(`Creature targets empty for unknown: cs=${cs ? 'exists' : 'null'}, characters.length=undefined`);
    return { cs, creatureTargets: [] };
  }
  // Split-party law: away PCs hold no slot and are not valid targets.
  let creatureTargets = cs.creatures.filter(isCreaturePresent).map(c => c.name);
  if (excludeCaster) {
    creatureTargets = creatureTargets.filter(n => n !== casterName);
  }
  if (includeCaster && !creatureTargets.includes(casterName)) {
    creatureTargets.unshift(casterName);
  }
  return { cs, creatureTargets };
}

// SP-110: canonical Spare-the-Dying target — a living creature at 0 HP that is
// not yet Stable. PCs read the runtime store (combatSummary player entries are
// 1/1 placeholders); monsters carry real HP on their combatSummary currentHp only,
// and per the canonical isCreatureDead model a monster at 0 HP is DEAD — so only
// a dying-modelled monster (deathSaves array on its cs entry) can qualify.
// Undead and constructs are excluded (5e spell text, retained app behavior).
export function isSpareTheDyingTarget(cs, creatureName) {
  const creature = cs?.creatures?.find(c => c.name === creatureName);
  if (!creature) return false;
  const monsterType = String(creature.monsterType || '').toLowerCase();
  if (monsterType.includes('undead') || monsterType.includes('construct')) return false;
  if (creature.type === 'player') {
    const hp = getRuntimeValue(creatureName, 'currentHitPoints');
    if (hp == null || Number(hp) !== 0) return false;
    if (getRuntimeValue(creatureName, 'isDead')) return false;
    const saves = getRuntimeValue(creatureName, 'deathSaves');
    return !(Array.isArray(saves) && isStable(saves));
  }
  if (Number(creature.currentHp) !== 0) return false;
  return Array.isArray(creature.deathSaves) && !isStable(creature.deathSaves);
}

export function extractMaxTargets(spell) {
  const upcastAtSlotLevel = spell.upcast_at_slot_level;
  if (!upcastAtSlotLevel || typeof upcastAtSlotLevel !== 'object') return null;
  const effectiveSlotLevel = spell.upcastLevel || spell.level;
  const value = upcastAtSlotLevel[String(effectiveSlotLevel)];
  if (value && typeof value === 'string') {
    const match = value.match(/(\d+)\s+targets?/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

export async function resolveHumanoids(campaignName, casterName) {
  const cs = getCombatSummary(campaignName);
  const nonCasterCreatures = cs?.creatures?.filter(c => c.name !== casterName) || [];
  const targets = [];
  for (const creature of nonCasterCreatures) {
    if (creature.type === 'player') {
      targets.push(creature.name);
    } else {
      try {
        const monsterData = await getMonsterData(creature.name, null);
        if (monsterData?.type && monsterData.type.toLowerCase() === 'humanoid') {
          targets.push(creature.name);
        }
      } catch { /* default to excluding */ }
    }
  }
  return targets;
}

export async function resolveBeasts(campaignName) {
  const cs = getCombatSummary(campaignName);
  const allCreatureNames = cs?.creatures?.map(c => c.name) || [];
  const beastTargets = [];
  for (const creatureName of allCreatureNames) {
    const csCheck = getCombatSummary(campaignName);
    const creature = csCheck?.creatures?.find(c => c.name === creatureName);
    if (creature?.type === 'player') continue;
    try {
      const monsterData = await getMonsterData(creatureName, null);
      if (monsterData?.type && monsterData.type.toLowerCase() === 'beast') {
        beastTargets.push(creatureName);
      }
    } catch { /* Not a known monster, skip */ }
  }
  return beastTargets;
}

export function makePending(type, spell, extra = {}) {
  return {
    spell,
    spellName: spell.name,
    spellLevel: spell.level || 0,
    castingTime: spell.casting_time,
    ...extra,
  };
}
