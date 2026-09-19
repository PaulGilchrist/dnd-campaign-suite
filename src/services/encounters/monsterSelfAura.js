// MA-0554: self-aura activation affordance for actions[] rows carrying the
// MA-0043 zone-dict shape (Darkmantle Darkness Aura — 15-ft self emanation,
// 1/Day, formerly an inert zero-chip prose row). A zone-dict row authored
// `self:true` arms a targetEffect ON THE MONSTER ITSELF (the area picker
// excludes the caster, so the lair zone picker cannot model self-auras).
// Reuses the existing machinery untouched:
//   - uses economy: monsterAbilityUses gate/spend/refusal (MA-0020 map,
//     monsterSpellUses) — spend at activation, second click refused with
//     `<slug>_refused` zero-spend log.
//   - te grant: registerTargetEffect on self (MA-0042 te shape: radiusFt
//     meta), reusing the pre-registered te key authored in
//     zone.effect_key (lair_darkness) — no new registry entry.
// Light/vision legs stay advisory (§70 no illumination model): the
// darkvision/light-immunity clause rides the arm log + popup, GM-enforced.
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
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

export function buildSelfAuraArmLog({ monsterName, action, effectKey, radiusFt }) {
  const duration = action?.duration || 'GM-adjudicated';
  return {
    type: 'automation',
    automationType: 'self_aura_armed',
    characterName: monsterName,
    abilityName: action?.name || 'Self Aura',
    description: `${monsterName} ${action?.name || 'Self Aura'}: ${effectKey} self aura armed on ${monsterName} (radius ${radiusFt} ft, no save). ${selfAuraAdvisory(action)} Duration ${duration} — GM-enforced.`,
    timestamp: Date.now(),
  };
}

export function buildSelfAuraPopup({ monsterName, action, effectKey, radiusFt, remaining }) {
  const usesNote = remaining != null ? ` ${remaining} use(s) left today (resets at dawn, GM-enforced).` : '';
  return `<div class="mc-prerequisite-refusal"><h3>${action?.name || 'Self Aura'} — ${radiusFt}-ft Aura</h3><p>${monsterName} arms ${effectKey} on itself (radius ${radiusFt} ft, no save). ${selfAuraAdvisory(action)}${usesNote}</p></div>`;
}

// One chip click = one adjudicated activation. Exhausted rows refuse with
// zero te and zero spend; otherwise spend 1/day FIRST (double-spend guard),
// then grant the self te and log the arm with the §70 light advisory.
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
    if (remaining == null) return { resolved: false, reason: 'exhausted' };
  }
  const register = deps.registerTargetEffect || registerTargetEffect;
  register(campaignName, monsterName, effectKey, monsterName, {
    radiusFt,
    noun: action.zone.noun || 'darkness',
    duration: 'concentration',
  });
  await log(campaignName, buildSelfAuraArmLog({ monsterName, action, effectKey, radiusFt }));
  setPopupHtml(buildSelfAuraPopup({ monsterName, action, effectKey, radiusFt, remaining }));
  return { resolved: true, effectKey, radiusFt, remaining };
}
