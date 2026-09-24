// MA-1014: monster-side adjudication of spell_save_dc-only zone/utility rows
// (Ice Devil "Ice Wall" — casts Wall of Ice, level 8 version, no components,
// INT, spell save DC 17, Recharge 6). The row carried a decoy spell_save_dc
// that no renderer branch consumed (zero affordance, MA-1014). The sanctioned
// spell transport seam is handleSpellCast's CLA-325 utility/advisory route
// (§207/§230 twins) — a proceeding chip press here:
//   - recharge economy: the EXISTING live MA-0031 gate (monsterRecharge.js
//     reads flat recharge:"6") — refused rows get the shared
//     .mc-recharge-refusal popup + `<action-slug>_refused (not recharged)`
//     log, ZERO spend (§408/MA-0963 shape); a fresh row spends at resolve
//     (MA-0633 spend-at-resolve byte-shape — this route has no picker),
//     d6 recovery rides the untouched turnStartEffects seam;
//   - cast record: advisory ability_use carrying the row's RAW clauses —
//     spell save DC + casting ability + "(level 8 version)" + no-components
//     (the block-save seam would resolve this row "DC Unknown" since the
//     spell_save_dc never reaches the DC, §218 family — advisory is honest
//     because the wall is a §70 zero-consumer object: GM places it and
//     adjudicates positioning/damage).
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { MONSTER_RECHARGE_KEY, monsterRechargeGate, spendMonsterRecharge, buildRechargeRefusalPopup, buildRechargeRefusalLog } from './monsterRecharge.js';
import { MONSTER_SPELL_USES_KEY, monsterAbilitySaveUsesGate, spendMonsterAbilityUse, buildAbilitySaveRefusalPopup, buildAbilitySaveRefusalLog } from './monsterAbilityUses.js';

// MA-1016: fog/invisibility zone states have no engine consumer either —
// the wall copy stays byte-identical (ma1014 pins), honest per-family
// advisory for the widened innate rows (Ice Mephit "Fog Cloud", imp
// "Invisibility").
function zoneAdvisoryNote({ spellName, action }) {
  const text = `${spellName || ''} ${action?.description || ''}`;
  if (/fog/i.test(text)) return ' Fog zones have no engine consumer (§70) — GM places the fog cloud and adjudicates obscurement and duration. GM-enforced for monsters.';
  if (/invisib/i.test(text)) return ' Invisibility has no monster-side consumer (§70) — GM adjudicates the hidden state and its RAW enders. GM-enforced for monsters.';
  return ' Wall/zone objects have no engine consumer (§70) — GM places the wall and adjudicates area placement, positioning saves and duration. GM-enforced for monsters.';
}

export function buildUtilitySpellCastLog({ monsterName, spellName, spell, action, castLevel }) {
  const ability = action?.spellcasting_ability || null;
  const dcNote = action?.spell_save_dc != null ? ` (spell save DC ${action.spell_save_dc}${ability ? `, ${ability}` : ''})` : (ability ? ` (${ability})` : '');
  const levelNote = castLevel != null ? ` Level ${castLevel} version.` : '';
  const componentNote = /no spell components/i.test(action?.description || '') ? ' No spell components required.' : '';
  const concentrationNote = spell?.concentration ? ` Concentration (${spell.duration || 'up to 1 minute'}).` : '';
  return `${monsterName} casts ${spellName} via Spellcasting${dcNote}.${levelNote}${componentNote}${concentrationNote}${zoneAdvisoryNote({ spellName, action })}`;
}

function refuseRechargePress({ gate, monsterName, action, campaignName, setPopupHtml, log }) {
  if (setPopupHtml) setPopupHtml(buildRechargeRefusalPopup({ monsterName, actionName: action.name, threshold: gate.threshold }));
  return log(campaignName, buildRechargeRefusalLog({ monsterName, actionName: action.name, rechargeKey: gate.key, threshold: gate.threshold }))
    .catch((e) => { console.error('[monsterUtilitySpellCast] Error logging recharge refusal:', e); });
}

function refuseUsesPress({ usesGate, monsterName, campaignName, setPopupHtml, log }) {
  if (setPopupHtml) setPopupHtml(buildAbilitySaveRefusalPopup({ monsterName, useKey: usesGate.useKey, maxUses: usesGate.maxUses }));
  return log(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: usesGate.useKey, maxUses: usesGate.maxUses }))
    .catch((e) => { console.error('[monsterUtilitySpellCast] Error logging uses refusal:', e); });
}

// Costs spend at resolve (no picker on this route): recharge FIRST (single
// merged map write, MA-0005 recipe), then the MA-0020 uses map.
async function spendUtilityCosts({ gate, usesGate, action, monsterName, campaignName, deps, log }) {
  if (gate) {
    // Forward the injected deps (set/get runtime + logger) — spendMonsterRecharge
    // owns the single merged map write (MA-0005 recipe).
    await spendMonsterRecharge({ monsterName, action, campaignName, deps: { ...deps, addEntry: log } });
  }
  if (usesGate) {
    // MA-0020 map spend (single merged write inside); logs "1 use spent,
    // N left today". Key = abilitySaveUseKey(action) = row name.
    await spendMonsterAbilityUse({ monsterName, use: { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName: action.name }, campaignName, deps: { ...deps, addEntry: log } });
  }
}

function utilityPressGates(action, monsterName, getRV) {
  return {
    gate: monsterRechargeGate(action, getRV(monsterName, MONSTER_RECHARGE_KEY) || {}),
    usesGate: monsterAbilitySaveUsesGate(action, getRV(monsterName, MONSTER_SPELL_USES_KEY) || {}),
  };
}

// One chip click = one adjudicated cast. Refusals pay nothing; a proceeding
// press spends its costs, then records the advisory cast.
// MA-1016: innate rows without recharge (Ice Mephit "Fog Cloud") carry the
// MA-0633 numeric uses/maxUses gate instead — exhausted refusal rides the
// shared MA-0020 seam (mc-prerequisite-refusal popup + `fog_cloud_refused`
// automation log, ZERO spend, §57/§172), a fresh row spends at resolve via
// spendMonsterAbilityUse (MA-0633 spend-at-resolve byte-shape). Rest-rearm
// of the 1/Day key stays the known §70 residual (GM clears at dawn).
// Helpers hoisted to hold the complexity ceiling (§45).
export async function resolveUtilitySpellCastRow({ action, spellName, spell = null, castLevel = null, monsterName, campaignName, setPopupHtml, deps = {} }) {
  if (!action || (action.spell_save_dc == null && action.spellcasting_ability == null)) return { resolved: false, reason: 'not-utility-row' };
  const log = deps.addEntry || addEntry;
  const getRV = deps.getRuntimeValue || getRuntimeValue;
  const { gate, usesGate } = utilityPressGates(action, monsterName, getRV);
  if (gate && !gate.available) {
    await refuseRechargePress({ gate, monsterName, action, campaignName, setPopupHtml, log });
    return { resolved: false, reason: 'not-recharged' };
  }
  if (usesGate && usesGate.exhausted) {
    await refuseUsesPress({ usesGate, monsterName, campaignName, setPopupHtml, log });
    return { resolved: false, reason: 'uses-exhausted' };
  }
  await spendUtilityCosts({ gate, usesGate, action, monsterName, campaignName, deps, log });
  await log(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: spellName,
    description: buildUtilitySpellCastLog({ monsterName, spellName, spell, action, castLevel }),
    timestamp: Date.now(),
  }).catch((e) => { console.error('[monsterUtilitySpellCast] Error logging utility spell cast:', e); });
  return { resolved: true, rechargeKey: gate ? gate.key : null };
}
