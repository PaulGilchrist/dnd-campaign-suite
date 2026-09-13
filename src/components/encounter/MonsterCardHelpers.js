import { getAbilitySaveModifier } from '../../services/shared/abilityLookup.js';
import { findLastAttack } from '../../services/automation/common/damageRollback.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

export function hasEntries(obj) {
  return obj && Object.keys(obj).length > 0;
}

export function hasSenseEntries(senses) {
  if (!senses) return false;
  return senses.blindsight || senses.darkvision || senses.truesight || senses.tremorsense || senses.passive_perception;
}

export function saveAbilityAbbr(full) {
  const map = { Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA' };
  return map[full] || full?.substring(0, 3).toUpperCase();
}

const abilityNameMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export { abilityNameMap };

export function parseInitiativeBonus(initStr) {
  if (!initStr) return null;
  const match = initStr.match(/^([+-]\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function formatSenses(senses) {
  const parts = [];
  if (senses.blindsight) parts.push(`blindsight ${senses.blindsight}`);
  if (senses.darkvision) parts.push(`darkvision ${senses.darkvision}`);
  if (senses.truesight) parts.push(`truesight ${senses.truesight}`);
  if (senses.tremorsense) parts.push(`tremorsense ${senses.tremorsense}`);
  if (senses.passive_perception) parts.push(`passive Perception ${senses.passive_perception}`);
  return parts.join(', ');
}

const CONDITIONS = ['blinded', 'charmed', 'cursed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

export function extractConditionsFromSaveEffect(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return [];
  const found = [];
  for (const condition of CONDITIONS) {
    const regex = new RegExp(`\\b${condition}\\b`, 'i');
    if (regex.test(saveEffect)) {
      found.push(condition);
    }
  }
  return found;
}

export function extractSpellNamesFromSpellcasting(description) {
  if (!description || typeof description !== 'string') return [];
  const names = [];
  const re = /<strong>([^<]+)<\/strong>/g;
  let match;
  while ((match = re.exec(description)) !== null) {
    const name = match[1].trim();
    if (!name || name.endsWith(':')) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function extractSpellcastingSpellUses(description) {
  if (!description || typeof description !== 'string') return {};
  const uses = {};
  const re = /<strong>([^<]+)<\/strong>/g;
  let match;
  let limit = null;
  while ((match = re.exec(description)) !== null) {
    const text = match[1].trim();
    if (!text) continue;
    const dayHeader = text.match(/^(\d+)\s*\/\s*Day:?$/i);
    if (dayHeader) { limit = parseInt(dayHeader[1], 10); continue; }
    if (text.endsWith(':')) { limit = null; continue; }
    if (limit != null) uses[text] = limit;
  }
  return uses;
}

export function spellHasDamage(spell) {
  if (!spell) return false;
  const damage = spell.damage;
  if (!damage) return false;
  if (damage.damage_dice) return true;
  return Object.keys(damage.damage_at_slot_level || {}).length > 0;
}

export function spellDamageFormulaAtBaseLevel(spell) {
  if (!spellHasDamage(spell)) return null;
  const damage = spell.damage;
  return damage.damage_dice
    || damage.damage_at_slot_level?.[String(spell.level)]
    || Object.values(damage.damage_at_slot_level || {})[0]
    || null;
}

export function toAbbr(name) {
  const ABBR_MAP = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };
  return ABBR_MAP[name] || name?.substring(0, 3).toLowerCase();
}

function getCreatureSaveModifier(creature, abilityKey) {
  if (!creature) return 0;
  if (creature.saving_throws?.[abilityKey] != null) {
    return creature.saving_throws[abilityKey].modifier;
  }
  if (creature.ability_score_modifiers?.[abilityKey] != null) {
    return creature.ability_score_modifiers[abilityKey];
  }
  return 0;
}

export function getSaveModifierForSaveType(saveType, target, characters, creatures) {
  const abilityKey = toAbbr(saveType);
  if (!abilityKey || !target) return 0;

  if (target.type === 'player') {
    const playerChar = characters?.find(c => c.name === target.name);
    if (playerChar?.abilities) {
      return getAbilitySaveModifier(playerChar.abilities, abilityKey);
    }
    return getCreatureSaveModifier(creatures?.find(c => c.name === target.name), abilityKey);
  }

  return getCreatureSaveModifier(target, abilityKey);
}

// MA-0006: gated monster reactions (e.g. Aarakocra Aeromancer Feather Fall
// 1/Day). Rows carry automation {type:'reaction', trigger:'falling',
// effect:'feather_fall'}; the monster card gates them on the campaign
// lastAttack CLA-315 'falling' trigger seam (no fall-damage pipeline exists —
// negation is recorded advisory, GM-enforced for monsters, CLA-325 precedent).
export const MONSTER_REACTION_USES_KEY = 'monsterReactionUses';

const GATED_MONSTER_REACTIONS = {
  feather_fall: { effect: 'feather_fall', trigger: 'falling', label: 'Feather Fall', icon: 'fa-feather' },
};

export function getGatedMonsterReaction(action) {
  const effect = action?.automation?.effect;
  return effect ? GATED_MONSTER_REACTIONS[effect] || null : null;
}

export function monsterReactionUsesRemaining(action, storedUses) {
  const maxUses = action?.maxUses ?? action?.uses ?? null;
  if (maxUses == null) return null;
  const used = Number(storedUses?.[action?.automation?.effect]) || 0;
  return Math.max(0, maxUses - used);
}

function lastAttackTrigger(lastAttack) {
  if (!lastAttack) return null;
  if (lastAttack.trigger) return lastAttack.trigger;
  if (lastAttack.attackEvent && lastAttack.attackEvent.trigger) return lastAttack.attackEvent.trigger;
  return null;
}

function reactionInvolvesMonster(lastAttack, monsterName) {
  return Boolean(lastAttack) && (lastAttack.attackerName === monsterName || lastAttack.targetName === monsterName);
}

function reactionMaxUses(action) {
  if (action && action.maxUses != null) return Number(action.maxUses);
  if (action && action.uses != null) return Number(action.uses);
  return 1;
}

export function monsterReactionGate({ def, action, monsterName, lastAttack, currentRound, storedUses, usedRound }) {
  if (lastAttackTrigger(lastAttack) !== def.trigger) {
    return { ok: false, reason: 'trigger', message: `${def.label}: no falling event — ${monsterName} can only react to a fall.` };
  }
  if (!reactionInvolvesMonster(lastAttack, monsterName)) {
    return { ok: false, reason: 'actor', message: `${def.label}: ${monsterName} is not the falling creature — refused.` };
  }
  const round = Number(currentRound) || 0;
  if (round > 0 && Number(usedRound) === round) {
    return { ok: false, reason: 'round', message: `${def.label}: Reaction already used this round (1/round) — refused.` };
  }
  const used = Number((storedUses && storedUses[def.effect]) || 0);
  const limit = reactionMaxUses(action);
  if (used >= limit) {
    return { ok: false, reason: 'uses', message: `${def.label}: 1/Day uses already spent today — refused. Uses reset at a long rest; GM-enforced for monsters.` };
  }
  return { ok: true, used, limit };
}

export async function resolveMonsterGatedReaction({ action, monsterName, campaignName, deps = {} }) {
  const def = getGatedMonsterReaction(action);
  if (!def) return null;
  const findLast = deps.findLastAttack || findLastAttack;
  const getCombat = deps.getCombatContext || getCombatContext;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const latchKey = `_${def.effect}_usedRound`;
  const lastAttack = await findLast(campaignName);
  const cs = await getCombat(campaignName);
  const currentRound = Number(cs?.round ?? 1);
  const storedUses = getRV(monsterName, MONSTER_REACTION_USES_KEY) || {};
  const usedRound = Number(getRV(monsterName, latchKey) ?? 0);
  const gate = monsterReactionGate({ def, action, monsterName, lastAttack, currentRound, storedUses, usedRound });
  if (!gate.ok) {
    await log(campaignName, {
      type: 'automation',
      characterName: monsterName,
      automationType: `${def.effect}_refused`,
      name: def.label,
      description: `${def.label} refused (${gate.reason}): ${gate.message}`,
      timestamp: Date.now(),
    });
    return { ok: false, message: gate.message };
  }
  await setRV(monsterName, latchKey, currentRound, campaignName);
  await setRV(monsterName, MONSTER_REACTION_USES_KEY, { ...storedUses, [def.effect]: gate.used + 1 }, campaignName);
  const remaining = Math.max(0, gate.limit - gate.used - 1);
  const message = `${monsterName} uses ${def.label} — falling damage negated (GM-enforced for monsters — advisory record, no fall-damage pipeline). ${gate.limit}/Day · ${remaining} left today.`;
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: def.label,
    description: message,
    timestamp: Date.now(),
  });
  return { ok: true, message, remaining };
}
