// MA-0554: self-aura activation affordance for actions[] rows carrying the
// MA-0043 zone-dict shape (Darkmantle Darkness Aura — 15-ft self emanation,
// 1/Day, formerly an inert zero-chip prose row). A zone-dict row authored
// `self:true` arms a targetEffect ON THE MONSTER ITSELF (the area picker
// excludes the caster, so the lair zone picker cannot model self-auras).
// Reuses the existing machinery untouched:
//   - uses economy: monsterAbilityUses gate/spend/refusal (MA-0020 map,
//     monsterSpellUses) — spend at activation, second click refused with
//     `<slug>_refused` zero-spend log + popup on BOTH refusal arms: the
//     gate-exhausted arm reuses buildAbilitySaveRefusalPopup ("Uses
//     Exhausted"), the mid-flight double-spend guard shows its own
//     reason-distinct "Already Armed" popup (#1136 — was log-only, so a
//     raced second click was refused silently in the UI).
//   - te grant: registerTargetEffect on self (MA-0042 te shape: radiusFt
//     meta), reusing the pre-registered te key authored in
//     zone.effect_key (lair_darkness) — no new registry entry.
// Light/vision legs stay advisory (§70 no illumination model): the
// darkvision/light-immunity clause rides the arm log + popup, GM-enforced.
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
import { armDurationClockIfEnforced, durationArmNote } from '../rules/effects/zoneDurationClock.js';
import { monsterAbilitySaveUsesGate, spendMonsterAbilityUse, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup } from './monsterAbilityUses.js';

export const SELF_AURA_LIGHT_ADVISORY = 'No illumination model (§70): darkness does not obscure, suppress darkvision, or block light in-engine — GM-enforced.';

// MA-0043 zone dict honored on an actions[] row ONLY when authored
// self-origin and save-less: {self:true, radius_ft:N, no_save:true}.
export function isSelfAuraRow(row) {
  return !!row && row.zone?.self === true && row.zone?.radius_ft != null && row.save_dc == null;
}

// Authored zone.advisory rides log/popup; rows without one get the generic
// §70 copy — never both (no duplicated advisory).
function selfAuraAdvisory(action) {
  return action?.zone?.advisory || SELF_AURA_LIGHT_ADVISORY;
}

export function buildSelfAuraArmLog({ monsterName, action, effectKey, radiusFt, armedRounds = null }) {
  const duration = action?.duration || 'GM-adjudicated';
  const durNote = armedRounds != null
    ? `Duration ${duration} — expiry clock armed (${durationArmNote(armedRounds)}).`
    : `Duration ${duration} — GM-enforced.`;
  return {
    type: 'automation',
    automationType: 'self_aura_armed',
    characterName: monsterName,
    abilityName: action?.name || 'Self Aura',
    description: `${monsterName} ${action?.name || 'Self Aura'}: ${effectKey} self aura armed on ${monsterName} (radius ${radiusFt} ft, no save). ${selfAuraAdvisory(action)} ${durNote}`,
    timestamp: Date.now(),
  };
}

export function buildSelfAuraPopup({ monsterName, action, effectKey, radiusFt, remaining }) {
  const usesNote = remaining != null ? ` ${remaining} use(s) left today (resets at dawn, GM-enforced).` : '';
  return `<div class="mc-prerequisite-refusal"><h3>${action?.name || 'Self Aura'} — ${radiusFt}-ft Aura</h3><p>${monsterName} arms ${effectKey} on itself (radius ${radiusFt} ft, no save). ${selfAuraAdvisory(action)}${usesNote}</p></div>`;
}

// #1136: the mid-flight double-spend refusal popup. Mirrors the house
// refusal-popup SHAPE (mc-prerequisite-refusal div, 'refused' / 'no …
// spent' / 'reset at dawn (GM-enforced for monsters)' vocabulary —
// buildAbilitySaveRefusalPopup :47 CANON, cited #1082) with reason-
// DISTINCT WORDS (#1348): the gate-exhausted arm says 'Uses Exhausted —
// has already used … today'; this arm fired because the spend raced a
// preceding click that already burned the use mid-flight, so it says
// 'Already Armed'.
export function buildSelfAuraDoubleSpendRefusalPopup({ monsterName, useKey, maxUses }) {
  return `<div class="mc-prerequisite-refusal"><h3>Already Armed</h3><p>${monsterName} is already activating ${useKey} — a preceding click spent the ${maxUses}/Day use. ${useKey} refused: no second use spent, no aura re-armed. Uses reset at dawn (GM-enforced for monsters).</p></div>`;
}

// One chip click = one adjudicated activation. Exhausted rows refuse with
// zero te and zero spend; otherwise spend 1/day FIRST (double-spend guard),
// then grant the self te and log the arm with the §70 light advisory.
// #1136: BOTH refusal arms speak to the player — the gate-exhausted arm via
// the shared "Uses Exhausted" popup, the mid-flight guard via the local
// "Already Armed" popup (reason-distinct copy, #1348).
export async function resolveSelfAuraRow({ action, monsterName, campaignName, setPopupHtml, storedUses = {}, deps = {} }) {
  if (!isSelfAuraRow(action)) return { resolved: false, reason: 'not-self-aura' };
  const log = deps.addEntry || addEntry;
  const gate = monsterAbilitySaveUsesGate(action, storedUses);
  if (gate?.exhausted) {
    setPopupHtml(buildAbilitySaveRefusalPopup({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
    await log(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
    return { resolved: false, reason: 'exhausted' };
  }
  const radiusFt = Number(action.zone.radius_ft);
  const effectKey = action.zone.effect_key || 'lair_darkness';
  let remaining = null;
  if (gate) {
    remaining = await spendMonsterAbilityUse({ monsterName, use: { useKey: gate.useKey, maxUses: gate.maxUses, actionName: action.name }, campaignName, deps });
    if (remaining == null) {
      // #1136: the mid-flight double-spend guard used to refuse LOG-ONLY
      // (spendMonsterAbilityUse logs `<slug>_refused` + loud console guard;
      // the player saw nothing). Now it pops the reason-distinct refusal
      // popup so a raced second click answers in the UI, same shape as the
      // gate-exhausted arm above. Log stays (already correct, zero spend).
      setPopupHtml(buildSelfAuraDoubleSpendRefusalPopup({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
      return { resolved: false, reason: 'exhausted' };
    }
  }
  const register = deps.registerTargetEffect || registerTargetEffect;
  register(campaignName, monsterName, effectKey, monsterName, {
    radiusFt,
    noun: action.zone.noun || 'darkness',
    duration: 'concentration',
  });
  // L5-003 §8.3 (triage #1): authored parseable duration + zones live ⇒
  // real expiry clock stripping the te. Indefinite ('concentration') or
  // enforcement off ⇒ no clock, advisory prose verbatim.
  const armedRounds = armDurationClockIfEnforced({
    campaignName,
    ownerName: monsterName,
    targetName: monsterName,
    effects: [{ type: 'remove_target_effect', effectKey, source: monsterName, target: monsterName }],
    durationText: action?.duration,
  });
  await log(campaignName, buildSelfAuraArmLog({ monsterName, action, effectKey, radiusFt, armedRounds }));
  setPopupHtml(buildSelfAuraPopup({ monsterName, action, effectKey, radiusFt, remaining }));
  return { resolved: true, effectKey, radiusFt, remaining };
}
