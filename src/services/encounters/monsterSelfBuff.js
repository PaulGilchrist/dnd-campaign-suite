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
import { setTempHp } from '../automation/handlers/buffs/tempHpService.js';
import { getCombatContext } from '../rules/combat/damageUtils.js';

export function isMonsterSelfBuffRow(row) {
  return row?.automation?.type === 'monster_self_buff' && !!row.automation.effect;
}

export function selfBuffRounds(action) {
  return Number(action?.automation?.rounds) || 10;
}

// 10 rounds = 1 minute (combat-round clock). MA-0655 enlarged twin pins
// "10 rounds (1 minute)" byte-identical; MA-0658 rounds:600 → "(1 hour)".
// MA-0694: Bolster fields — temp_hp self grant via tempHpService
// (replace-if-larger) + ally_radius_ft area advantage leg (te
// `bolster_advantage` on self + allied combatants, ONE merged clock with
// the self te). rounds:2 rides the round counter: granted in round R it
// survives the boundary + the empyrean's whole next turn and clears at the
// start of round R+2 — the closest round-clock shape to RAW "until the end
// of the empyrean's next turn" (processExpirationList: currentRound >=
// appliedRound + rounds).
export function bolsterTempHp(action) {
  return Number(action?.automation?.temp_hp) || 0;
}

export function bolsterAllyRadiusFt(action) {
  return Number(action?.automation?.ally_radius_ft) || 0;
}

function selfBuffDurationNote(rounds) {
  const minutes = rounds / 10;
  if (minutes < 1) return `${rounds} round${rounds === 1 ? '' : 's'}`;
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${rounds} rounds (${hours} hour${hours === 1 ? '' : 's'})`;
  }
  return `${rounds} rounds (${minutes} minute${minutes === 1 ? '' : 's'})`;
}

export function buildSelfBuffGrantLog({ monsterName, action, effectKey, rounds }) {
  const effectNote = effectKey === 'enlarged'
    ? 'damage dice on Strength-based weapon attacks doubled by the attack-damage consumer. STR checks/saves advantage and rest-rearm are GM-enforced (§70 advisory).'
    : effectKey === 'bolstered'
      ? `te \`bolstered\` standing refuses a re-Bolster ("can't take this action again until the start of its next turn" rides the already_bolstered refusal + the legendary per-action cooldown latch); te \`bolster_advantage\` (Advantage on D20 Tests — live te fold in conditionEffects.js) stamped on itself${bolsterAllyRadiusFt(action) ? ` and allies within ${bolsterAllyRadiusFt(action)} ft` : ''}; gridless radius + ally membership GM-enforced (§42 advisory).`
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
    : effectKey === 'bolstered'
      ? `${monsterName} gains ${bolsterTempHp(action)} Temporary Hit Points (replace-if-larger) via ${action?.name || 'Self Buff'} and it + allies within ${bolsterAllyRadiusFt(action)} ft gain Advantage on D20 Tests for ${selfBuffDurationNote(rounds)} (one merged clock). Gridless radius + ally membership GM-enforced (§42).`
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

export function buildBolsterTempHpLog({ monsterName, action, amount, held }) {
  return {
    type: 'automation',
    automationType: 'bolster_temp_hp_granted',
    characterName: monsterName,
    abilityName: action?.name || 'Bolster',
    description: `${monsterName} Bolster: ${amount} Temporary Hit Points granted via tempHpService (replace-if-larger — ${held} THP standing).`,
    timestamp: Date.now(),
  };
}

export function buildBolsterAllyGrantLog({ monsterName, action, radiusFt, allyNames, rounds }) {
  const who = allyNames.length > 0 ? allyNames.join(', ') : 'no allied combatants on the board';
  return {
    type: 'automation',
    automationType: 'bolster_advantage_granted',
    characterName: monsterName,
    abilityName: action?.name || 'Bolster',
    description: `${monsterName} Bolster: te \`bolster_advantage\` (Advantage on D20 Tests — live te fold in conditionEffects.js) stamped on itself + ${who}. Gridless board: allied (non-PC) combatants stamped leniently — exact ${radiusFt}-ft radius + ally membership GM-enforced (§42 advisory). ONE merged ${selfBuffDurationNote(rounds)} clock covers every te.`,
    timestamp: Date.now(),
  };
}

// MA-0694: gridless allied-combatant membership for the Bolster advantage
// leg — combatSummary has no position/side truth, so every allied non-PC
// board member (EB-joined monsters fighting beside the empyrean; PCs are
// the opposing party) rides the te leniently (§42), radius GM-enforced.
async function resolveBolsterAllyNames({ monsterName, action, campaignName, deps = {} }) {
  const cs = await (deps.getCombatContext || getCombatContext)(campaignName);
  const creatures = Array.isArray(cs?.creatures) ? cs.creatures : null;
  if (!creatures) {
    console.error(`[monsterSelfBuff] Bolster ally leg: combatSummary unavailable for ${monsterName} ${action?.name} — Advantage stamped on self only; radius/ally membership GM-enforced (§42).`);
    return [];
  }
  return creatures.filter(c => c && c.name !== monsterName && c.type !== 'player').map(c => c.name);
}

// MA-0694: Bolster self THP leg — tempHpService replace-if-larger (MA-0275
// animalSpiritFortifyHp seam). Rows without automation.temp_hp are inert.
function applyBolsterTempHp({ monsterName, action, campaignName, deps = {} }) {
  const amount = bolsterTempHp(action);
  if (amount <= 0) return null;
  const setThp = deps.setTempHp || setTempHp;
  return { amount, held: setThp(monsterName, amount, campaignName) };
}

// MA-0694: advantage-leg arming — self THP + te `bolster_advantage` on the
// empyrean and every gridless allied combatant (§42 lenient; membership via
// resolveBolsterAllyNames). Rows without the fields return zeros/inert.
async function armBolsterLegs({ action, monsterName, campaignName, rounds, register, deps = {} }) {
  const thp = applyBolsterTempHp({ monsterName, action, campaignName, deps });
  const radiusFt = bolsterAllyRadiusFt(action);
  if (radiusFt <= 0) return { thp, radiusFt, allyNames: [] };
  const teProps = { duration: 'rounds', rounds, actionName: action.name };
  const allyNames = await resolveBolsterAllyNames({ monsterName, action, campaignName, deps });
  register(campaignName, monsterName, 'bolster_advantage', monsterName, { ...teProps });
  allyNames.forEach(allyName => register(campaignName, allyName, 'bolster_advantage', monsterName, { ...teProps }));
  return { thp, radiusFt, allyNames };
}

async function logBolsterGrants({ action, monsterName, campaignName, rounds, thp, radiusFt, allyNames, log }) {
  if (thp) {
    await log(campaignName, buildBolsterTempHpLog({ monsterName, action, amount: thp.amount, held: thp.held }));
  }
  if (radiusFt > 0) {
    await log(campaignName, buildBolsterAllyGrantLog({ monsterName, action, radiusFt, allyNames, rounds }));
  }
}

// One chip click: already-enlarged refuses zero-spend; exhausted rows refuse
// with zero te and zero spend; otherwise spend FIRST (double-spend guard),
// register te `enlarged` on self, arm ONE merged addExpiration clock, and
// log spend (monsterAbilityUses) + grant + popup. MA-0694 extends the seam
// with the Empyrean Bolster legs: automation.temp_hp self THP via
// tempHpService + automation.ally_radius_ft te `bolster_advantage` on self
// + allied combatants — all keys ride the SAME single merged clock.
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
  // MA-0694: Bolster legs — THP replace-if-larger + allied advantage te.
  const { thp, radiusFt, allyNames } = await armBolsterLegs({ action, monsterName, campaignName, rounds, register, deps });
  const expiryEffects = [{ type: 'remove_target_effect', effectKey, source: monsterName, target: monsterName }];
  if (radiusFt > 0) {
    // target-LESS entry: handleRemoveTargetEffect clears every te matching
    // effect+source — self AND every stamped ally, ONE merged clock (§37).
    expiryEffects.push({ type: 'remove_target_effect', effectKey: 'bolster_advantage', source: monsterName });
  }
  addExp({
    attackerName: monsterName,
    targetName: monsterName,
    campaignName,
    rounds,
    effects: expiryEffects,
  });
  // MA-0658: Enlarge ender — RAW "until it … uses its Enlarge": granting
  // Enlarge drops the duergar's own te `invisible` (self-origin) with an
  // `invisible_ended` / ends_on_enlarge log and clock cancel.
  if (effectKey === 'enlarged') {
    await endSelfBuffOnTrigger({ campaignName, monsterName, effectKey: 'invisible', trigger: 'enlarge', actionName: action.name, deps });
  }
  await log(campaignName, buildSelfBuffGrantLog({ monsterName, action, effectKey, rounds }));
  await logBolsterGrants({ action, monsterName, campaignName, rounds, thp, radiusFt, allyNames, log });
  setPopupHtml(buildSelfBuffPopup({ monsterName, action, effectKey, rounds, remaining }));
  return { resolved: true, effectKey, rounds, remaining, thp, allyNames };
}
