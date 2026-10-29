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

function auraLabel(conditionKey) {
  return AURA_LABEL_BY_CONDITION[String(conditionKey || '').toLowerCase()] || 'aura immunity';
}

// Human-readable immunity description for log copy AND the EffectAdder inline
// notice (CLA-019 "refusal must be visible"): "Aura of Courage from ElderPaladin".
export function describeAuraImmunity(conditionKey, auraImmunities) {
  const lower = String(conditionKey || '').toLowerCase();
  const host = auraImmunities?.immunitySources?.[lower] || null;
  return `${auraLabel(lower)}${host ? ' from ' + host : ''}`;
}

export function logAuraConditionImmunity({ campaignName, targetName, conditionKey, auraImmunities, sourceAbility }) {
  const lower = String(conditionKey || '').toLowerCase();
  const host = auraImmunities?.immunitySources?.[lower] || null;
  const label = lower.charAt(0).toUpperCase() + lower.slice(1);
  return addEntry(campaignName, {
    type: 'automation',
    automationType: 'condition_immunity_aura',
    characterName: targetName,
    sourceName: host || undefined,
    abilityName: sourceAbility || auraLabel(lower),
    description: `${targetName} is immune to ${label} (${describeAuraImmunity(lower, auraImmunities)}) — condition not applied.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[auraConditionImmunity:log]', e); });
}
