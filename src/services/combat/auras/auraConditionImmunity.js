import { computeAuraComboEffects } from './auraComboEffects.js';
import { addEntry } from '../../ui/logService.js';

// CLA-019: aura-granted condition-immunity channel for condition-application seams.
// Membership/range gating is delegated wholesale to computeAuraComboEffects — the
// same verified self-filtered / cannot-act-gated / isWithinRange model applyDamage
// consumes for aura-granted resistances (applyDamage.js resolveCreatureDefenses).
// Missing/empty characters = inert legacy path (byte-identical callers preserved).
export async function getAuraConditionImmunities({ targetName, characters }) {
  if (!targetName || !Array.isArray(characters) || characters.length === 0) {
    return { immunities: [], immunitySources: {} };
  }
  return await computeAuraComboEffects({ targetName, characters });
}

export function auraCoversCondition(auraImmunities, conditionKey) {
  const lower = String(conditionKey || '').toLowerCase();
  if (!lower || !Array.isArray(auraImmunities?.immunities)) return false;
  return auraImmunities.immunities.includes(lower);
}

export function splitAuraCoveredConditions(saveConditions, auraImmunities) {
  const covered = (saveConditions || []).filter(c => auraCoversCondition(auraImmunities, c));
  const applicable = (saveConditions || []).filter(c => !auraCoversCondition(auraImmunities, c));
  return { covered, applicable };
}

const AURA_LABEL_BY_CONDITION = {
  frightened: 'Aura of Courage',
  charmed: 'Aura of Devotion',
};

export function logAuraConditionImmunity({ campaignName, targetName, conditionKey, auraImmunities, sourceAbility }) {
  const lower = String(conditionKey || '').toLowerCase();
  const host = auraImmunities?.immunitySources?.[lower] || null;
  const auraName = AURA_LABEL_BY_CONDITION[lower] || 'aura immunity';
  const label = lower.charAt(0).toUpperCase() + lower.slice(1);
  return addEntry(campaignName, {
    type: 'automation',
    automationType: 'condition_immunity_aura',
    characterName: targetName,
    sourceName: host || undefined,
    abilityName: sourceAbility || auraName,
    description: `${targetName} is immune to ${label} (${auraName}${host ? ' from ' + host : ''}) — condition not applied.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[auraConditionImmunity:log]', e); });
}
