// MA-0020: N/Day enforcement for monster ABILITY save rows (e.g. Aboleth
// "Dominate Mind (2/Day)"). Reuses the MA-0005 runtime uses-map
// (`monsterSpellUses`, keyed by ability/spell name per monster) — no third
// map. Gate fires on the MonsterCardModal ability-save-row click path
// (refusal popup + `<slug>_refused` log, zero save prompts); the spend
// lands at prompt-confirm in saveProcessing.applySaveOutcome with an
// ability_use log and "X left today". Control/telepathy/expiry clauses stay
// advisory (CLA-325 precedent): the authored "until …" clause rides the
// activeConditionMeta durationNote stamp — no plane/control subsystem.
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

export const MONSTER_SPELL_USES_KEY = 'monsterSpellUses';

export function abilitySaveUseKey(action) {
  return String(action?.name || '').replace(/\s*\(\d+\s*\/\s*Day(?:\s*Each)?\)\s*$/i, '').trim();
}

export function abilitySaveMaxUses(action) {
  const max = action?.maxUses ?? action?.uses ?? null;
  return max == null ? null : Number(max);
}

export function monsterAbilitySaveUsesGate(action, storedUses) {
  const maxUses = abilitySaveMaxUses(action);
  if (maxUses == null || !Number.isFinite(maxUses) || maxUses <= 0) return null;
  const useKey = abilitySaveUseKey(action);
  const used = Number(storedUses?.[useKey]) || 0;
  return { useKey, maxUses, used, remaining: Math.max(0, maxUses - used), exhausted: used >= maxUses };
}

function refusalSlug(useKey) {
  return String(useKey || 'ability').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function buildAbilitySaveRefusalLog({ monsterName, useKey, maxUses }) {
  return {
    type: 'automation',
    automationType: `${refusalSlug(useKey)}_refused`,
    characterName: monsterName,
    abilityName: useKey,
    description: `${monsterName} has already used ${useKey} today (${maxUses}/Day) — ${useKey} refused. Uses reset at dawn; GM-enforced for monsters.`,
    timestamp: Date.now(),
  };
}

export function buildAbilitySaveRefusalPopup({ monsterName, useKey, maxUses }) {
  return `<div class="mc-prerequisite-refusal"><h3>Uses Exhausted</h3><p>${monsterName} has already used ${useKey} today (${maxUses}/Day). No save rolled, nothing spent. Uses reset at dawn (GM-enforced for monsters).</p></div>`;
}

export async function spendMonsterAbilityUse({ monsterName, use, targetName, campaignName, deps = {} }) {
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const setRV = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const stored = getRV(monsterName, MONSTER_SPELL_USES_KEY) || {};
  const used = Number(stored[use.useKey]) || 0;
  if (used >= use.maxUses) {
    console.error(`[monsterAbilityUses] Double-spend guard: ${monsterName} ${use.useKey} already at ${use.maxUses}/${use.maxUses} — no spend.`);
    await log(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: use.useKey, maxUses: use.maxUses }));
    return null;
  }
  const remaining = use.maxUses - used - 1;
  await setRV(monsterName, MONSTER_SPELL_USES_KEY, { ...stored, [use.useKey]: used + 1 }, campaignName);
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: use.actionName || use.useKey,
    description: `${monsterName} uses ${use.useKey}${targetName ? ` on ${targetName}` : ''} — 1 use spent, ${remaining} left today (resets at dawn, GM-enforced for monsters).`,
    timestamp: Date.now(),
  });
  return remaining;
}

export function extractConditionDurationNote(saveEffect) {
  if (!saveEffect || typeof saveEffect !== 'string') return null;
  const m = saveEffect.match(/\b(until\b[^.;]+)/i);
  return m ? `${m[1].trim()} (GM-enforced)` : null;
}
