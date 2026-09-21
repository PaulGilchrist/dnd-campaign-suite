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
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect, getActiveTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../rules/effects/expirations.js';
import { monsterAbilitySaveUsesGate, spendMonsterAbilityUse, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup } from './monsterAbilityUses.js';

export function isMonsterSelfBuffRow(row) {
  return row?.automation?.type === 'monster_self_buff' && !!row.automation.effect;
}

export function selfBuffRounds(action) {
  return Number(action?.automation?.rounds) || 10;
}

export function buildSelfBuffGrantLog({ monsterName, action, effectKey, rounds }) {
  return {
    type: 'automation',
    automationType: `${effectKey}_granted`,
    characterName: monsterName,
    abilityName: action?.name || 'Self Buff',
    description: `${monsterName} ${action?.name || 'Self Buff'}: te \`${effectKey}\` armed on itself for ${rounds} rounds (1 minute) — damage dice on Strength-based weapon attacks doubled by the attack-damage consumer. STR checks/saves advantage and rest-rearm are GM-enforced (§70 advisory).`,
    timestamp: Date.now(),
  };
}

export function buildAlreadyEnlargedRefusalLog({ monsterName, action, effectKey }) {
  const slug = String(action?.name || effectKey || 'self_buff').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return {
    type: 'automation',
    automationType: `${slug}_refused`,
    automationDetail: 'already_enlarged',
    characterName: monsterName,
    abilityName: action?.name || 'Self Buff',
    description: `${monsterName} is already ${effectKey} — ${action?.name || 'Self Buff'} refused, zero use spent. Refusal reason: already_enlarged.`,
    timestamp: Date.now(),
  };
}

export function buildAlreadyEnlargedRefusalPopup({ monsterName, action, effectKey }) {
  return `<div class="mc-prerequisite-refusal"><h3>Already ${effectKey.charAt(0).toUpperCase()}${effectKey.slice(1)}</h3><p>${monsterName} is already ${effectKey} — ${action?.name || 'Self Buff'} refused. No use spent; the existing ${action?.name || 'Self Buff'} clock keeps running.</p></div>`;
}

export function buildSelfBuffPopup({ monsterName, action, effectKey, rounds, remaining }) {
  const usesNote = remaining != null ? ` ${remaining} use(s) left (recharges after a short or long rest, GM-enforced).` : '';
  return `<div class="mc-prerequisite-refusal"><h3>${monsterName} is ${effectKey.charAt(0).toUpperCase()}${effectKey.slice(1)}</h3><p>${monsterName} grows to Large via ${action?.name || 'Self Buff'} — Strength-based weapon damage dice doubled for ${rounds} rounds (one merged clock). STR checks/saves advantage are GM-enforced (§70).${usesNote}</p></div>`;
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
  await log(campaignName, buildSelfBuffGrantLog({ monsterName, action, effectKey, rounds }));
  setPopupHtml(buildSelfBuffPopup({ monsterName, action, effectKey, rounds, remaining }));
  return { resolved: true, effectKey, rounds, remaining };
}
