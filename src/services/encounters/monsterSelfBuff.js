// MA-0655: monster-side self-buff affordance for actions[] rows authored
// automation:{type:"monster_self_buff", effect:"enlarge", rounds:N}
// (Duergar "Enlarge" — formerly a zero-affordance inert row). Mirrors the
// MA-0648 monsterSummon / MA-0554 self-aura registration style.
// One chip click = gate → spend FIRST (double-spend guard) → register te
// `enlarged` ON SELF → ONE merged addExpiration clock (rounds×1 via
// expirationQueue, remove_target_effect expiry) → grant log. An already
// enlarged monster refuses with zero spend; exhausted uses refuse via the
// MA-0020 monsterSpellUses gate (`enlarge_refused`, zero te).
// STR checks/saves advantage and the rest-rearm clause stay §70 advisory
// residuals (no generic ability-check advantage channel / rest consumer).
// MA-0658 extends the SAME seam generically to Duergar "Invisibility"
// (effect:"invisible", rounds:600): effect-keyed grant/refusal copy +
// endSelfBuffOnTrigger enders (attack/cast in MonsterCardModal, enlarge
// here) drop the self te early with an `${effectKey}_ended` log; RAW
// invisibility advantage adjudication and concentration-break stay §70.
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect, getActiveTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
import { addExpiration, KEY as EXPIRATION_KEY } from '../rules/effects/expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { monsterAbilitySaveUsesGate, spendMonsterAbilityUse, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup } from './monsterAbilityUses.js';

export function isMonsterSelfBuffRow(row) {
  return row?.automation?.type === 'monster_self_buff' && !!row.automation.effect;
}

export function selfBuffRounds(action) {
  return Number(action?.automation?.rounds) || 10;
}

// 10 rounds = 1 minute (combat-round clock). MA-0655 enlarged twin pins
// "10 rounds (1 minute)" byte-identical; MA-0658 rounds:600 → "(1 hour)".
function selfBuffDurationNote(rounds) {
  const minutes = rounds / 10;
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${rounds} rounds (${hours} hour${hours === 1 ? '' : 's'})`;
  }
  return `${rounds} rounds (${minutes} minute${minutes === 1 ? '' : 's'})`;
}

export function buildSelfBuffGrantLog({ monsterName, action, effectKey, rounds }) {
  const effectNote = effectKey === 'enlarged'
    ? 'damage dice on Strength-based weapon attacks doubled by the attack-damage consumer. STR checks/saves advantage and rest-rearm are GM-enforced (§70 advisory).'
    : `ends when it attacks, casts a spell, or uses its Enlarge (attack/cast/enlarge enders drop the te with an \`${effectKey}_ended\` log), or when its clock runs out. Concentration-break ender and invisibility advantage/disadvantage adjudication are GM-enforced (§70 advisory).`;
  return {
    type: 'automation',
    automationType: `${effectKey}_granted`,
    characterName: monsterName,
    abilityName: action?.name || 'Self Buff',
    description: `${monsterName} ${action?.name || 'Self Buff'}: te \`${effectKey}\` armed on itself for ${selfBuffDurationNote(rounds)} — ${effectNote}`,
    timestamp: Date.now(),
  };
}

export function buildAlreadyEnlargedRefusalLog({ monsterName, action, effectKey }) {
  const slug = String(action?.name || effectKey || 'self_buff').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    type: 'automation',
    automationType: `${slug}_refused`,
    automationDetail: `already_${effectKey}`,
    characterName: monsterName,
    abilityName: action?.name || 'Self Buff',
    description: `${monsterName} is already ${effectKey} — ${action?.name || 'Self Buff'} refused, zero use spent. Refusal reason: already_${effectKey}.`,
    timestamp: Date.now(),
  };
}

export function buildAlreadyEnlargedRefusalPopup({ monsterName, action, effectKey }) {
  return `<div class="mc-prerequisite-refusal"><h3>Already ${effectKey.charAt(0).toUpperCase()}${effectKey.slice(1)}</h3><p>${monsterName} is already ${effectKey} — ${action?.name || 'Self Buff'} refused. No use spent; the existing ${action?.name || 'Self Buff'} clock keeps running.</p></div>`;
}

export function buildSelfBuffPopup({ monsterName, action, effectKey, rounds, remaining }) {
  const usesNote = remaining != null ? ` ${remaining} use(s) left (recharges after a short or long rest, GM-enforced).` : '';
  const body = effectKey === 'enlarged'
    ? `${monsterName} grows to Large via ${action?.name || 'Self Buff'} — Strength-based weapon damage dice doubled for ${rounds} rounds (one merged clock). STR checks/saves advantage are GM-enforced (§70).`
    : `${monsterName} turns invisible via ${action?.name || 'Self Buff'} — te \`invisible\` armed for ${selfBuffDurationNote(rounds)} (one merged clock). Ends on attack, spell cast, or Enlarge (logged); invisibility adjudication is GM-enforced (§70).`;
  return `<div class="mc-prerequisite-refusal"><h3>${monsterName} is ${effectKey.charAt(0).toUpperCase()}${effectKey.slice(1)}</h3><p>${body}${usesNote}</p></div>`;
}

// MA-0658: ender log — self-buff te dropped before its clock by a RAW
// end trigger (attack / cast / enlarge), with the merged clock cancelled.
export function buildSelfBuffEndLog({ monsterName, effectKey, trigger, actionName }) {
  return {
    type: 'automation',
    automationType: `${effectKey}_ended`,
    automationDetail: `ends_on_${trigger}`,
    characterName: monsterName,
    abilityName: actionName || 'Self Buff',
    description: `${monsterName}'s ${effectKey} ends on ${trigger} — te \`${effectKey}\` dropped and its expiration clock cancelled.`,
    timestamp: Date.now(),
  };
}

// MA-0658: RAW ender consumer shared by the attack / cast / enlarge seams.
// Drops a monster-self-buff-origin te (target === source === monster) from
// the campaign targetEffects store, cancels its merged addExpiration clock
// entry, and logs `${effectKey}_ended` / ends_on_${trigger}. Returns false
// (zero write, zero log) when the creature carries no matching self te.
export async function endSelfBuffOnTrigger({ campaignName, monsterName, effectKey, trigger, actionName, deps = {} }) {
  const getVal = deps.getRuntimeValue || getRuntimeValue;
  const setVal = deps.setRuntimeValue || setRuntimeValue;
  const log = deps.addEntry || addEntry;
  const stored = getVal('campaign', 'targetEffects', campaignName);
  if (!Array.isArray(stored)) return false;
  const te = stored.find(e => e.target === monsterName && e.effect === effectKey && e.source === monsterName);
  if (!te) return false;
  setVal('campaign', 'targetEffects', stored.filter(e => e !== te), campaignName);
  const list = getVal(monsterName, EXPIRATION_KEY, campaignName);
  if (Array.isArray(list)) {
    const remaining = list.filter(entry => !(entry.target === monsterName && Array.isArray(entry.effects)
      && entry.effects.some(ef => ef.type === 'remove_target_effect' && ef.effectKey === effectKey && ef.source === monsterName)));
    if (remaining.length !== list.length) {
      setVal(monsterName, EXPIRATION_KEY, remaining, campaignName);
    }
  }
  await log(campaignName, buildSelfBuffEndLog({ monsterName, effectKey, trigger, actionName }));
  return true;
}

// Doubles the primary dice COUNT of a damage formula (1d8 + 2 → 2d8 + 2),
// modifier untouched — the enlarged discriminator distinct from crit ×2
// (crit still multiplies the doubled formula downstream as today).
export function doublePrimaryDiceCount(formula) {
  if (!formula) return formula;
  return String(formula).replace(/(\d+)d\d+/gi, (m, count) => `${Number(count) * 2}${m.slice(m.indexOf('d'))}`);
}

// One chip click: already-enlarged refuses zero-spend; exhausted rows refuse
// with zero te and zero spend; otherwise spend FIRST (double-spend guard),
// register te `enlarged` on self, arm ONE merged addExpiration clock, and
// log spend (monsterAbilityUses) + grant + popup.
export async function resolveMonsterSelfBuffRow({ action, monsterName, campaignName, setPopupHtml, storedUses = {}, deps = {} }) {
  if (!isMonsterSelfBuffRow(action)) return { resolved: false, reason: 'not-self-buff' };
  const log = deps.addEntry || addEntry;
  const effectKey = action.automation.effect;
  const getActive = deps.getActiveTargetEffect || getActiveTargetEffect;
  const register = deps.registerTargetEffect || registerTargetEffect;
  const addExp = deps.addExpiration || addExpiration;

  if (getActive(campaignName, monsterName, effectKey)) {
    setPopupHtml(buildAlreadyEnlargedRefusalPopup({ monsterName, action, effectKey }));
    await log(campaignName, buildAlreadyEnlargedRefusalLog({ monsterName, action, effectKey }));
    return { resolved: false, reason: 'already-active' };
  }

  const gate = monsterAbilitySaveUsesGate(action, storedUses);
  if (gate?.exhausted) {
    setPopupHtml(buildAbilitySaveRefusalPopup({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
    await log(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
    return { resolved: false, reason: 'exhausted' };
  }

  let remaining = null;
  if (gate) {
    remaining = await spendMonsterAbilityUse({ monsterName, use: { useKey: gate.useKey, maxUses: gate.maxUses, actionName: action.name }, campaignName, deps });
    if (remaining == null) return { resolved: false, reason: 'exhausted' };
  }

  const rounds = selfBuffRounds(action);
  register(campaignName, monsterName, effectKey, monsterName, {
    duration: 'minute',
    rounds,
    actionName: action.name,
  });
  addExp({
    attackerName: monsterName,
    targetName: monsterName,
    campaignName,
    rounds,
    effects: [{ type: 'remove_target_effect', effectKey, source: monsterName, target: monsterName }],
  });
  // MA-0658: Enlarge ender — RAW "until it … uses its Enlarge": granting
  // Enlarge drops the duergar's own te `invisible` (self-origin) with an
  // `invisible_ended` / ends_on_enlarge log and clock cancel.
  if (effectKey === 'enlarged') {
    await endSelfBuffOnTrigger({ campaignName, monsterName, effectKey: 'invisible', trigger: 'enlarge', actionName: action.name, deps });
  }
  await log(campaignName, buildSelfBuffGrantLog({ monsterName, action, effectKey, rounds }));
  setPopupHtml(buildSelfBuffPopup({ monsterName, action, effectKey, rounds, remaining }));
  return { resolved: true, effectKey, rounds, remaining };
}
