// MA-0648: monster-side summon affordance for actions[] rows authored
// automation:{type:"monster_summon", options:[{monster},{monster,chance}]}
// (Drow Mage "Summon Demon" — formerly a zero-affordance inert row).
// One chip click = gate → coin-flip adjudication (d100 ≤ chance×100 picks
// the chance option, else the first chance-less fallback) → spawn the
// chosen monster into combatSummary as an ally of the caster, initiative
// right after the caster (summonSpiritHandler's spawn seam: cs push + sort
// + storage.set + initiative-rolled dispatch), te "summoned" registered on
// the spawn, every step logged. Uses economy reuses the MA-0020
// monsterSpellUses gate/spend/refusal untouched (numeric uses/maxUses).
// "Can't summon other demons", dismiss-as-action and the exact 10-minute
// expiry clock stay §70 advisory residuals on the summon log.
import { addEntry } from '../ui/logService.js';
import { registerTargetEffect } from '../combat/conditions/targetEffectDefinitions.js';
import { rollDie, rollExpression } from '../dice/diceRoller.js';
import { applyDamageToTarget } from '../rules/combat/applyDamage.js';
import { getCombatSummary } from './combatData.js';
import { getNextUniqueMonsterName, getMonsterSaveBonuses } from './encounterToInitiative.js';
import { resolveMonsterIRV } from '../npcs/monsterIrvUtils.js';
import { monsterAbilitySaveUsesGate, spendMonsterAbilityUse, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup } from './monsterAbilityUses.js';
import { loadMonsters } from '../ui/dataLoader.js';
import storage from '../ui/storage.js';
import cloneDeep from 'lodash/cloneDeep.js';

export function isMonsterSummonRow(row) {
  return row?.automation?.type === 'monster_summon'
    && Array.isArray(row.automation.options)
    && row.automation.options.length > 0;
}

// Single honest coin flip: the chance option lands on d100 ≤ chance×100,
// a miss falls back to the first chance-less option (RAW "or attempts to
// summon a shadow demon with a 50 percent chance of success" — else quasit).
// MA-0651: rows with NO chance-less fallback (Drow Priestess "yochlol, 30%
// chance of success" — miss means nothing arrives + self-damage) return
// monster:null on failure so the resolver routes the self-damage leg.
export function adjudicateSummonAttempt(options, rollFn = rollDie) {
  const attempt = options.find(o => o && o.chance != null);
  const fallback = options.find(o => o && o.chance == null) || null;
  if (!attempt) {
    return { monster: (fallback || options[0]).monster, roll: null, success: true, chance: null };
  }
  const roll = rollFn(100);
  const success = roll <= Math.round(attempt.chance * 100);
  return {
    monster: success ? attempt.monster : (fallback ? fallback.monster : null),
    roll,
    success,
    chance: attempt.chance,
  };
}

export function buildSummonCoinFlipLog({ monsterName, action, verdict }) {
  const pct = Math.round((verdict.chance ?? 0) * 100);
  return {
    type: 'roll',
    characterName: monsterName,
    rollType: 'monster_summon_coin_flip',
    name: `${action.name} summon attempt`,
    rolls: verdict.roll != null ? [verdict.roll] : [],
    total: verdict.roll ?? 0,
    bonus: 0,
    mode: 'normal',
    description: `${monsterName} flips for ${action.name}: d100 ${verdict.roll} vs ${pct}% — ${verdict.success ? `success, summons ${verdict.monster}` : (verdict.monster ? `failure, falls back to ${verdict.monster}` : 'failure, no demon answers')}.`,
    timestamp: Date.now(),
  };
}

export function buildSummonSpawnLog({ monsterName, action, summonedName, durationMinutes }) {
  return {
    type: 'summons',
    characterName: monsterName,
    summonName: summonedName,
    description: `${monsterName} summons ${summonedName} via ${action.name} — ally of ${monsterName}, appears within ${action.automation.range_ft ?? 60} ft, remains ${durationMinutes} minutes (expiry clock, dismiss-as-action and "can't summon other demons" are §70 GM-enforced residuals).`,
    summonedCreatures: [summonedName],
    timestamp: Date.now(),
  };
}

// MA-0651: failed summon with no fallback (Drow Priestess RAW) — the
// summoner takes the authored self_damage_formula damage. Rolled via
// diceRoller, applied through the canonical applyDamageToTarget seam
// (resistances + currentHp + hp_change log), self psychic damage roll
// logged with full detail.
export function buildSummonSelfDamageLog({ monsterName, action, damageRoll }) {
  return {
    type: 'roll damage',
    characterName: monsterName,
    rollType: 'monster_summon_self_damage',
    name: `${action.name} failed summon backlash`,
    rolls: damageRoll.rolls,
    total: damageRoll.total,
    damageType: action.automation.self_damage_type || 'psychic',
    formula: action.automation.self_damage_formula,
    description: `${monsterName}'s ${action.name} attempt fails — it takes ${damageRoll.total} ${action.automation.self_damage_type || 'psychic'} damage (rolled ${damageRoll.rolls.join(' + ')}).`,
    timestamp: Date.now(),
  };
}

function selfDamagePending(action, verdict) {
  return !verdict.success && verdict.monster == null && !!action.automation.self_damage_formula;
}

async function resolveSummonSelfDamageOutcome({ action, monsterName, campaignName, setPopupHtml, verdict, remaining, deps }) {
  const getCS = deps.getCombatSummary || getCombatSummary;
  const combatSummary = getCS(campaignName) || { round: 1, creatures: [] };
  if (!Array.isArray(combatSummary.creatures)) combatSummary.creatures = [];
  verdict.selfDamage = await applySummonSelfDamage({ action, monsterName, campaignName, combatSummary, deps });
  setPopupHtml(buildSummonPopup({ monsterName, summonedName: null, verdict, remaining }));
  return { resolved: true, summonedName: null, verdict, remaining };
}

async function applySummonSelfDamage({ action, monsterName, campaignName, combatSummary, deps }) {
  const log = deps.addEntry || addEntry;
  const rollExpr = deps.rollExpression || rollExpression;
  const apply = deps.applyDamageToTarget || applyDamageToTarget;
  const damageRoll = rollExpr(action.automation.self_damage_formula);
  if (!damageRoll) {
    console.error(`[monsterSummon] unparsable self_damage_formula "${action.automation.self_damage_formula}"`);
    return null;
  }
  await log(campaignName, buildSummonSelfDamageLog({ monsterName, action, damageRoll }));
  const result = await apply(combatSummary, monsterName, damageRoll.total, [action.automation.self_damage_type || 'psychic'], { campaignName, characters: [], attackerName: monsterName });
  return { ...damageRoll, applied: result?.finalDamage ?? 0 };
}

export function buildSummonPopup({ monsterName, summonedName, verdict, remaining }) {
  const flip = verdict.roll != null ? `Coin flip: d100 ${verdict.roll} — ${verdict.success ? 'summon attempt succeeds' : 'attempt fails'}.\n` : '';
  const usesNote = remaining != null ? ` ${remaining} use(s) left today (resets at dawn, GM-enforced).` : '';
  if (!summonedName) {
    const selfNote = verdict.selfDamage ? ` ${monsterName} takes ${verdict.selfDamage.applied} ${verdict.selfDamage.damageType || 'psychic'} damage (rolled ${verdict.selfDamage.rolls.join(' + ')}).` : '';
    return `<div class="mc-prerequisite-refusal"><h3>${monsterName}'s summon fails</h3><p>${flip}No demon answers the call.${selfNote}${usesNote}</p></div>`;
  }
  return `<div class="mc-prerequisite-refusal"><h3>${monsterName} summons ${summonedName}</h3><p>${flip}${summonedName} joins the fight as an ally of ${monsterName}, acting right after it, for 10 minutes (§70 expiry GM-enforced).${usesNote}</p></div>`;
}

function getCasterInitiativeValue(combatSummary, casterName) {
  const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
  if (casterCreature?.initiative !== '' && casterCreature?.initiative !== undefined) {
    return parseInt(casterCreature.initiative, 10) || 0;
  }
  return 0;
}

function buildSummonedCreature({ monster, name, casterName, initiativeValue }) {
  const irv = resolveMonsterIRV(monster);
  const ac = typeof monster.armor_class === 'number' ? monster.armor_class : 10;
  const hp = monster.hit_points || 10;
  return {
    name,
    type: 'npc',
    monsterType: monster.type,
    size: monster.size || null,
    initiative: String(initiativeValue - 0.1),
    targetName: null,
    ac,
    resistances: irv.resistances,
    immunities: irv.immunities,
    vulnerabilities: irv.vulnerabilities,
    concentration: null,
    maxHp: hp,
    currentHp: hp,
    saveBonuses: getMonsterSaveBonuses(monster),
    monsterIndex: monster.index || null,
    actions: monster.actions || [],
    reactions: monster.reactions || [],
    summonedBy: casterName,
    summonSource: 'monster_ability',
  };
}

async function gateAndSpendSummon({ action, monsterName, campaignName, setPopupHtml, storedUses, deps }) {
  const log = deps.addEntry || addEntry;
  const gate = monsterAbilitySaveUsesGate(action, storedUses);
  if (gate?.exhausted) {
    setPopupHtml(buildAbilitySaveRefusalPopup({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
    await log(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: gate.useKey, maxUses: gate.maxUses }));
    return { ok: false };
  }
  if (!gate) return { ok: true, remaining: null };
  const remaining = await spendMonsterAbilityUse({ monsterName, use: { useKey: gate.useKey, maxUses: gate.maxUses, actionName: action.name }, campaignName, deps });
  return remaining == null ? { ok: false } : { ok: true, remaining };
}

function spawnSummonedCreature({ combatSummary, monster, monsterName, campaignName, deps }) {
  // Base name on an empty board (expandMonstersToCreatures naming),
  // numbered suffix on collision (EB-join getNextUniqueMonsterName seam).
  const summonedName = combatSummary.creatures.some(c => c.name === monster.name)
    ? getNextUniqueMonsterName(monster.name, combatSummary.creatures)
    : monster.name;
  const initiativeValue = getCasterInitiativeValue(combatSummary, monsterName);
  const creature = buildSummonedCreature({ monster, name: summonedName, casterName: monsterName, initiativeValue });
  combatSummary.creatures.push(creature);
  combatSummary.creatures.sort((a, b) => {
    const aInit = a.initiative === '' || a.initiative === undefined ? 0 : Number(a.initiative);
    const bInit = b.initiative === '' || b.initiative === undefined ? 0 : Number(b.initiative);
    return bInit - aInit;
  });
  const register = deps.registerTargetEffect || registerTargetEffect;
  register(campaignName, summonedName, 'summoned', monsterName, { duration: '10_minutes' });
  const setCS = deps.setCombatSummary || ((cs) => storage.set('combatSummary', cloneDeep(cs), campaignName));
  setCS(combatSummary);
  if (!deps.skipDomEvents) {
    window.dispatchEvent(new CustomEvent('initiative-rolled'));
  }
  return summonedName;
}

// One chip click: exhausted rows refuse with zero roll/zero spend/zero spawn;
// otherwise spend 1/Day FIRST (double-spend guard), coin-flip, spawn the
// chosen monster into combatSummary as an ally acting right after the
// caster, register te "summoned", and log attempt + outcome + spawn.
export async function resolveMonsterSummonRow({ action, monsterName, campaignName, setPopupHtml, storedUses = {}, deps = {} }) {
  if (!isMonsterSummonRow(action)) return { resolved: false, reason: 'not-monster-summon' };
  const log = deps.addEntry || addEntry;
  const gateResult = await gateAndSpendSummon({ action, monsterName, campaignName, setPopupHtml, storedUses, deps });
  if (!gateResult.ok) return { resolved: false, reason: 'exhausted' };
  const remaining = gateResult.remaining;

  const verdict = adjudicateSummonAttempt(action.automation.options, deps.rollDie || rollDie);
  await log(campaignName, buildSummonCoinFlipLog({ monsterName, action, verdict }));

  // MA-0651: no chance-less fallback + failed flip → nothing spawns, the
  // summoner takes the authored self-damage instead (both outcomes logged).
  if (selfDamagePending(action, verdict)) {
    return resolveSummonSelfDamageOutcome({ action, monsterName, campaignName, setPopupHtml, verdict, remaining, deps });
  }

  const monsters = deps.monsters || await loadMonsters();
  const monster = monsters.find(m => m.index === verdict.monster);
  if (!monster) {
    console.error(`[monsterSummon] Monster "${verdict.monster}" not found in monsters.json`);
    setPopupHtml(buildSummonPopup({ monsterName, summonedName: verdict.monster, verdict, remaining }));
    return { resolved: false, reason: 'monster-not-found' };
  }

  const getCS = deps.getCombatSummary || getCombatSummary;
  const combatSummary = getCS(campaignName) || { round: 1, creatures: [] };
  if (!Array.isArray(combatSummary.creatures)) combatSummary.creatures = [];
  const summonedName = spawnSummonedCreature({ combatSummary, monster, monsterName, campaignName, deps });

  await log(campaignName, buildSummonSpawnLog({ monsterName, action, summonedName, durationMinutes: action.automation.duration_minutes ?? 10 }));
  setPopupHtml(buildSummonPopup({ monsterName, summonedName, verdict, remaining }));
  return { resolved: true, summonedName, verdict, remaining };
}
