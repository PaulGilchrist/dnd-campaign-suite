import { rollExpression } from '../../dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../rules/combat/applyDamage.js';
import { addEntry } from '../../ui/logService.js';
import { collectWeaponMastery } from '../../combat/automation/automationService.js';
import { featureModules } from './features/index.js';
import { applyMasteryEffect } from '../../automation/handlers/combat/weaponMasteryHandler.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';

export function buildFeatureRidersStep() {
  return {
    name: 'featureRiders',
    subscribe: 'celestial:applied',
    emit: 'riders:applied',
    condition: () => true,
    handler: async (ctx) => {
      let data = { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])] };
      for (const feat of featureModules) {
        if (feat.condition(ctx)) {
          const result = await feat.handler(ctx, data);
          if (!result) continue;
          if (result.modal) return result;
          if (result.popup) return result;
          if (result.data) data = result.data;
          if (result.sideEffects) await result.sideEffects();
        }
      }
      return { data };
    },
  };
}

const DAMAGE_TYPE_BREAK = Symbol('damage-type-break');

async function applyDamageTypeModifiers(ctx, ps, dmgMods) {
  for (const mod of dmgMods) {
    const key = `_${mod.name.replace(/\s+/g, '_')}_usedRound`;
    const round = getCurrentCombatRound(ctx.campaignName);
    if (mod.oncePerTurn && getRuntimeValue(ps.name, key, ctx.campaignName) === round) continue;
    const stored = getRuntimeValue(ps.name, 'empoweredStrikesDamageType', ctx.campaignName);
    if (stored) { ctx.attack.damageType = stored; setRuntimeValue(ps.name, 'empoweredStrikesDamageType', null, ctx.campaignName); return DAMAGE_TYPE_BREAK; }
    if (mod.options?.length > 0) {
      return await resolveDamageTypeModifierChoice(ctx, mod, ps);
    }
  }
  return undefined;
}

async function resolveDamageTypeModifierChoice(ctx, mod, ps) {
  const normalOption = mod.options.find(o => o.name !== 'Force');
  const forceOption = mod.options.find(o => o.name === 'Force');
  let chosenType = normalOption?.damageType || ctx.attack.damageType;

  const cs = await getCombatContext(ctx.campaignName);
  const target = cs ? getTargetFromAttacker(cs, ps.name) : null;

  if (target && normalOption && forceOption) {
    const lower = normalOption.damageType.toLowerCase();
    const isImmune = target.immunities?.some(i => i.toLowerCase() === lower);
    const isResisted = target.resistances?.some(r => r.toLowerCase() === lower);

    if (isImmune || isResisted) {
      chosenType = forceOption.damageType;
      ctx.attack.damageType = chosenType;
      const reason = isImmune ? 'immune to' : 'resists';
      addEntry(ctx.campaignName, {
        type: 'ability_use',
        characterName: ps.name,
        abilityName: mod.name,
        description: `${mod.name} — auto-selected ${chosenType} damage (${target.name} ${reason} ${normalOption.damageType})`,
        targetName: target.name,
      }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });

      ctx.attack.damageType = chosenType;
      return {
        data: { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])] },
        popup: `<b>${mod.name}</b><br/>${target.name} ${reason} ${normalOption.damageType} — using <b>${chosenType}</b>`,
      };
    }
  }

  return {
    data: { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])], _damageTypeModifier: mod },
    modal: { type: 'damageTypeChoice', props: { title: `${mod.name} — Damage Type`, types: mod.options.map(o => o.name) } },
  };
}

async function resolveUnarmedRiderOption(ctx, rider, ps, damage) {
  const optKey = `_${rider.name.replace(/\s+/g, '_')}_selectedOption`;
  const stored = getRuntimeValue(ps.name, optKey, ctx.campaignName);
  if (stored) {
    const opt = rider.options.find(o => o.name === stored);
    if (opt?.effect === 'damage_bonus') {
      const rr = rollExpression(opt.damageExpression);
      if (rr) {
        damage.formula += ` + ${opt.damageExpression} [${opt.damageType || 'same_as_weapon'}]`;
        damage.total += rr.total;
        damage.rolls = [...damage.rolls, ...rr.rolls];
      }
      setRuntimeValue(ps.name, optKey, null, ctx.campaignName);
    }
    return null;
  }
  if (rider.options?.length > 0) {
    return {
      modal: { type: 'damageTypeChoice', props: { title: `${rider.name} — Enhanced Unarmed Strike`, types: rider.options.map(o => o.name) } },
    };
  }
  return null;
}

export function buildDamageTypeModifiersStep() {
  return {
    name: 'damageTypeModifiers',
    subscribe: 'riders:applied',
    emit: 'dmg_type:modified',
    condition: (ctx) => ctx.attack?.weaponType === 'unarmed' && !!ctx.playerStats.automation?.passives,
    handler: async (ctx) => {
      const damage = { formula: ctx.formula, total: ctx.total, rolls: [...(ctx.rolls || [])] };
      const ps = ctx.playerStats;

      const dmgMods = ps.automation.passives.filter(a => a.type === 'damage_type_modifier' && a.trigger === 'unarmed_strike_hit');
      const modsOutcome = await applyDamageTypeModifiers(ctx, ps, dmgMods);
      if (modsOutcome && modsOutcome !== DAMAGE_TYPE_BREAK) return modsOutcome;

      const riders = ps.automation.passives.filter(a => a.type === 'attack_rider' && a.trigger === 'unarmed_strike_hit' && a.chooseOne && a.options?.length > 0);
      for (const rider of riders) {
        const key = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
        const round = getCurrentCombatRound(ctx.campaignName);
        if (rider.oncePerTurn && getRuntimeValue(ps.name, key, ctx.campaignName) === round) continue;
        const outcome = await resolveUnarmedRiderOption(ctx, rider, ps, damage);
        if (outcome) return outcome;
      }

      return { data: { ...damage } };
    },
  };
}

export function buildOverchannelStep() {
  return {
    name: 'overchannel',
    subscribe: 'dmg_type:modified',
    emit: 'damage:ready',
    condition: (ctx) => ctx.overchannelActive && ctx.overchannelUseCount > 1,
    handler: async (ctx) => {
      const dicePerLevel = 2 + (ctx.overchannelUseCount - 1);
      const totalDice = dicePerLevel * ctx.overchannelSpellLevel;
      const r = rollExpression(`${totalDice}d12`);
      if (r) {
        const cs = await loadCombatSummary(ctx.campaignName);
        const app = applyDamageToTarget(cs, ctx.playerStats.name, r.total, ['Necrotic'], ctx.campaignName, null, { ignoreResistance: true, attackerName: ctx.playerStats.name });
        addEntry(ctx.campaignName, { type: 'roll', characterName: ctx.playerStats.name, rollType: 'overchannel-damage', name: 'Overchannel', formula: `${totalDice}d12`, rolls: r.rolls, total: r.total, modifier: r.modifier, damageType: 'Necrotic', targetName: ctx.playerStats.name, finalDamage: app?.finalDamage, note: 'Overchannel self-damage (ignores resistance/immunity)' }).catch((e) => { console.error("[damagePipeline] Error:", e); });
      }
      return { data: {} };
    },
  };
}

function computePoisonSaveDc(playerStats) {
  const dexMod = playerStats.abilities?.find(a => a.name === 'Dexterity')?.bonus ?? 0;
  const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus ?? 0;
  return 8 + Math.max(dexMod, intMod) + (playerStats.proficiency || 0);
}

function poisonSavePromptData(ctx, lastAttack, targetName, saveDc) {
  return {
    targetName: targetName,
    saveType: 'CON',
    saveDc: saveDc,
    attackerName: ctx.playerStats.name,
    damageFormula: `${lastAttack.damageFormula || '1d8'}+${lastAttack.modifier || 0}`,
    damageType: lastAttack.damageType || lastAttack.primaryDamageType || 'slashing',
    rawDamage: lastAttack.primaryDamage || 0,
    sourceName: lastAttack.attackName || 'Weapon',
  };
}

async function requestPoisonedWeaponsSave(ctx) {
  const poisonedActive = getRuntimeValue(ctx.playerStats.name, 'poisonedWeaponsActive', ctx.campaignName);
  if (!poisonedActive) return { saveResult: null, saveDc: 0 };
  const lastAttack = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
  if (!lastAttack?.hit) return { saveResult: null, saveDc: 0 };

  const targetName = lastAttack.targetName;
  const saveDc = computePoisonSaveDc(ctx.playerStats);

  const { promise } = createSaveListener(ctx.campaignName, poisonSavePromptData(ctx, lastAttack, targetName, saveDc));

  addEntry(ctx.campaignName, {
    type: 'save_result',
    characterName: ctx.playerStats.name,
    targetName: targetName,
    saveType: 'CON',
    saveDc: saveDc,
    description: `Poisoned weapon: ${targetName} must make a DC ${saveDc} CON save or take ${lastAttack.damageType || 'weapon'} damage plus 2d8 Poison damage and gain the Poisoned condition until the end of your next turn.`,
    success: null,
  }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });

  const saveResult = await promise;

  setRuntimeValue(ctx.playerStats.name, 'poisonedWeaponsActive', null, ctx.campaignName);

  if (saveResult && !saveResult.success) {
    ctx.autoDamageSecondaryFormula = '2d8';
    ctx.autoDamageSecondaryName = 'Poison';
    ctx.autoDamageSecondaryDamageType = 'Poison';
  }

  return { saveResult, saveDc };
}

function applyPoisonHpDamage(targetName, actualPoisonDamage, isPlayer, creature, campaignName) {
  if (isPlayer) {
    const storedCurrentHp = getRuntimeValue(targetName, 'currentHitPoints');
    const currentTempHp = Number(getRuntimeValue(targetName, 'tempHp', campaignName) || 0);
    let damageAfterTempHp = actualPoisonDamage;
    if (currentTempHp > 0) {
      const absorbed = Math.min(damageAfterTempHp, currentTempHp);
      damageAfterTempHp -= absorbed;
      setRuntimeValue(targetName, 'tempHp', currentTempHp - absorbed, campaignName);
    }
    const oldHp = storedCurrentHp;
    const newHp = Math.max(0, oldHp - damageAfterTempHp);
    setRuntimeValue(targetName, 'currentHitPoints', newHp, campaignName);
  } else {
    const oldHp = creature.currentHp;
    creature.currentHp = Math.max(0, oldHp - actualPoisonDamage);
  }
}

function resolvePoisonTargetDefenses(creature, characters, targetName, isPlayer) {
  const playerComputed = isPlayer
    ? (characters.find(c => (typeof c === 'string' ? c : c.name) === targetName)?.computedStats || characters.find(c => (typeof c === 'string' ? c : c.name) === targetName))
    : null;
  const resistances = isPlayer ? (playerComputed?.resistances || []) : (creature?.resistances || []);
  const immunities = isPlayer ? (playerComputed?.immunities || []) : (creature?.immunities || []);
  return { resistances, immunities };
}

function computePoisonDamageVsDefenses(poisonDamage, resistances, immunities) {
  if (immunities.includes('Poison')) return 0;
  if (resistances.includes('Poison')) return Math.max(0, Math.ceil(poisonDamage / 2));
  return Math.max(0, poisonDamage);
}

async function recordPoisonSecondaryDamage(ctx, actualPoisonDamage) {
  const existing = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
  if (!existing) return;
  existing.secondaryDamage = actualPoisonDamage;
  existing.secondaryDamageType = 'Poison';
  existing.actualDamage = (existing.actualDamage || 0) + actualPoisonDamage;
  await setRuntimeValue('campaign', 'lastAttack', existing, ctx.campaignName);
}

function buildPoisonOutcomeDescription(targetName, saveDc, primaryDmg, primaryType, actualPoisonDamage) {
  const totalDmg = primaryDmg + actualPoisonDamage;
  let desc = `<strong>${targetName}</strong> failed the CON save (DC ${saveDc}).`;
  if (primaryDmg > 0) {
    desc += `<br/>Took <strong>${primaryDmg} ${primaryType}</strong> + <strong>${actualPoisonDamage} Poison</strong> = <strong>${totalDmg} total damage</strong>.`;
  } else {
    desc += `<br/>Took <strong>${actualPoisonDamage} Poison damage</strong>.`;
  }
  desc += `<br/><br/><em>Condition lasts until the end of your next turn.</em>`;
  return desc;
}

async function applyFailedPoisonSaveOutcome(ctx, saveDc) {
  const lastAttack = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
  const targetName = lastAttack?.targetName;
  if (!targetName) return;

  const cs = await loadCombatSummary(ctx.campaignName);
  const rollResult = rollExpression('2d8');
  const poisonDamage = rollResult?.total || 7;
  const characters = getRuntimeValue('characters', 'characters', ctx.campaignName) || [];
  const creature = cs?.creatures?.find(c => c.name === targetName);
  const isPlayer = creature?.type === 'player';
  const { resistances, immunities } = resolvePoisonTargetDefenses(creature, characters, targetName, isPlayer);
  const actualPoisonDamage = computePoisonDamageVsDefenses(poisonDamage, resistances, immunities);

  if (actualPoisonDamage > 0) {
    applyPoisonHpDamage(targetName, actualPoisonDamage, isPlayer, creature, ctx.campaignName);
    await recordPoisonSecondaryDamage(ctx, actualPoisonDamage);
  }

  const conditionDef = { key: 'poisoned', label: 'Poisoned' };
  addCondition({ combatSummary: cs, creatureName: targetName, conditionDef, dc: saveDc, ability: 'CON', getRuntimeValue, setRuntimeValue, campaignName: ctx.campaignName, playerStats: ctx.playerStats });

  const primaryDmg = lastAttack?.primaryDamage || 0;
  const primaryType = lastAttack?.primaryDamageType || 'weapon';
  ctx.setPopupHtml?.({
    type: 'automation_info',
    name: 'Poisoned Weapons',
    description: buildPoisonOutcomeDescription(targetName, saveDc, primaryDmg, primaryType, actualPoisonDamage),
  });

  addEntry(ctx.campaignName, {
    type: 'ability_use',
    characterName: ctx.playerStats.name,
    abilityName: 'Poisoned Weapons',
    description: `Poison dose triggered on ${targetName} — target failed CON save (DC ${saveDc}), took ${actualPoisonDamage || poisonDamage} Poison damage (plus ${primaryDmg} ${primaryType} damage) and gained Poisoned condition.`,
    targetName: targetName,
  }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });
}

export function buildProceedToDamageStep() {
  return {
    name: 'proceedToDamage',
    subscribe: 'damage:ready',
    emit: 'damage:applied',
    condition: (ctx) => ctx.formula != null,
    handler: async (ctx) => {
      const { saveResult, saveDc } = await requestPoisonedWeaponsSave(ctx);

      ctx.proceedWithDamage(ctx.attack, ctx.formula, ctx.total, ctx.rolls, ctx.modifier, ctx.critLabels, ctx);

      if (saveResult && !saveResult.success) {
        await applyFailedPoisonSaveOutcome(ctx, saveDc);
      }

      return { data: { _done: true } };
    },
  };
}

export function buildStalkersFlurryPostDamageStep() {
  return {
    name: 'stalkersFlurryPostDamage',
    subscribe: 'damage:applied',
    emit: 'cleave:check',
    condition: (ctx) => !!ctx.playerStats.automation?.passives,
    handler: async (ctx) => {
      const secondaryTarget = getRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', ctx.campaignName);
      const pending = getRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', ctx.campaignName);
      if (pending && secondaryTarget && ctx.total > 0) {
        ctx.setPopupHtml?.(null);
        ctx.setAttackRiderModal?.(null);
        const cs = await getCombatContext(ctx.campaignName);
        const characters = getRuntimeValue('characters', 'characters', ctx.campaignName) || [];
        applyDamageToTarget(cs, secondaryTarget, ctx.total, [ctx.attack.damageType], ctx.campaignName, characters, { ignoreResistance: false, attackerName: ctx.playerStats.name, suppressHpLog: false, ...{ isAutoCrit: ctx.isCrit } });
        await addEntry(ctx.campaignName, {
          type: 'ability_use',
          characterName: ctx.playerStats.name,
          abilityName: "Stalker's Flurry - Sudden Strike",
          description: `Sudden Strike: ${ctx.total} damage to ${secondaryTarget} (same as primary attack).`,
        }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });
        setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrike', null, ctx.campaignName);
        setRuntimeValue(ctx.playerStats.name, 'pendingSuddenStrikeTarget', null, ctx.campaignName);
      }
      return { data: {} };
    },
  };
}

function resolveCleaveCreatureHp(creature, ps) {
  if (!creature) return { currentHp: 0, maxHp: 0 };
  if (creature.type === 'player') {
    const currentHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? getRuntimeValue(creature.name, 'hitPoints') ?? 0;
    const maxHp = getRuntimeValue(creature.name, 'hitPoints') ?? ps?.hitPoints ?? 0;
    return { currentHp, maxHp };
  }
  return { currentHp: creature.currentHp ?? creature.maxHp, maxHp: creature.maxHp };
}

async function collectCleaveSecondTargets(ctx, cs, lastAttack, firstTarget) {
  const hasMapPositions = !!ctx.playerStats?.mapName && !!firstTarget?.position;
  if (!hasMapPositions) {
    return cs.creatures
      .filter(c => c.name !== lastAttack.targetName)
      .map(c => ({ ...c, ...resolveCleaveCreatureHp(c, ctx.playerStats) }));
  }
  const attackerName = ctx.playerStats.name;
  const reach = 8;
  const secondTargets = [];
  for (const c of cs.creatures) {
    if (c.name === lastAttack.targetName) continue;
    const nearFirst = await isWithinRange(firstTarget.name, c.name, 5);
    const nearAttacker = await isWithinRange(attackerName, c.name, reach);
    if (nearFirst && nearAttacker) {
      secondTargets.push({ ...c, ...resolveCleaveCreatureHp(c, ctx.playerStats) });
    }
  }
  return secondTargets;
}

function rollCleaveAttack(ctx, targetAc) {
  const abilityName = ctx.playerStats?.abilities?.[0]?.name || 'STR';
  const ability = ctx.playerStats?.abilities?.find(a => a.name === abilityName);
  const abilityMod = ability?.bonus || 0;
  const attackBonus = abilityMod + (ctx.playerStats.proficiency || 0);
  const d20Roll = Math.floor(Math.random() * 20) + 1;
  const totalRoll = d20Roll + attackBonus;
  return totalRoll >= targetAc;
}

async function handleCleaveTargetSelected(ctx, cleaveTargetName) {
  if (!cleaveTargetName || !ctx.rollDamage) return;

  const combatSummary = await getCombatContext(ctx.campaignName);
  const target = combatSummary?.creatures?.find(c => c.name === cleaveTargetName);
  const targetAc = target?.ac || 0;
  const hit = rollCleaveAttack(ctx, targetAc);

  const cleaveFormula = ctx._cleaveAttackInfo?.damageFormula || '0';
  const damageResult = hit ? rollExpression(cleaveFormula) : null;

  if (hit && damageResult) {
    const context = {
      targetName: cleaveTargetName,
      damageType: ctx._cleaveAttackInfo.damageType,
      attackerName: ctx.playerStats.name,
    };
    ctx.rollDamage(`${ctx._cleaveAttackInfo.attackName} (Cleave)`, cleaveFormula, damageResult.total, damageResult.rolls, 0, context);
    addEntry(ctx.campaignName, {
      type: 'ability_use',
      characterName: ctx.playerStats.name,
      abilityName: 'Cleave',
      description: `${ctx.playerStats.name} used Cleave on ${ctx._cleaveAttackInfo.attackName} against ${cleaveTargetName}`,
      targetName: cleaveTargetName,
    }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });
    return;
  }

  const context = {
    targetName: cleaveTargetName,
    damageType: ctx._cleaveAttackInfo.damageType,
    attackerName: ctx.playerStats.name,
    isAutoMiss: true,
  };
  ctx.rollDamage(`${ctx._cleaveAttackInfo.attackName} (Cleave)`, cleaveFormula, 0, [], 0, context);
  addEntry(ctx.campaignName, {
    type: 'ability_use',
    characterName: ctx.playerStats.name,
    abilityName: 'Cleave',
    description: `${ctx.playerStats.name} used Cleave on ${ctx._cleaveAttackInfo.attackName} against ${cleaveTargetName} — Miss`,
    targetName: cleaveTargetName,
  }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });
}

export function buildCleaveMasteryStep() {
  return {
    name: 'cleaveMastery',
    subscribe: 'cleave:check',
    emit: 'cleave:done',
    condition: (ctx) => !!ctx.setSecondaryTargetModal && ctx.attack?.name && ctx.playerStats?.automation,
    handler: async (ctx) => {
      const lastAttack = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
      if (!lastAttack?.hit) return { data: {} };

      const available = collectWeaponMastery(lastAttack.attackName, ctx.playerStats);
      if (!available) return { data: {} };
      const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
      if (!allMasteries.includes('Cleave')) return { data: {} };

      const cs = await loadCombatSummary(ctx.campaignName);
      const firstTarget = cs?.creatures?.find(c => c.name === lastAttack.targetName);
      const secondTargets = await collectCleaveSecondTargets(ctx, cs, lastAttack, firstTarget);
      if (secondTargets.length === 0) return { data: {} };

      const cleaveDamageFormula = lastAttack.damageFormula
        ? lastAttack.damageFormula.replace(/\+\s*\d+/g, '').trim()
        : lastAttack.damageFormula;

      ctx._cleaveAttackInfo = {
        attackName: lastAttack.attackName,
        damageFormula: cleaveDamageFormula || lastAttack.damageFormula,
        damageType: lastAttack.damageType || 'same_as_weapon',
      };

      ctx.setSecondaryTargetModal?.({
        title: 'Cleave — Choose Second Target',
        targets: secondTargets,
        onTargetSelected: (cleaveTargetName) => handleCleaveTargetSelected(ctx, cleaveTargetName),
        onSkip: () => {},
        featureDescription: 'On a hit, the second creature takes weapon damage (no ability modifier to damage unless negative). Once per turn.',
      });

      return {
        data: { _cleavePending: true },
        modal: { type: 'cleaveTargetSelection', props: { title: 'Cleave — Choose Second Target', targets: secondTargets } },
      };
    },
  };
}

export function buildTacticalMasterStep() {
  return {
    name: 'tacticalMaster',
    subscribe: 'cleave:done',
    emit: 'tactical:done',
    condition: (ctx) => ctx.attack?.name && ctx.playerStats?.automation,
    handler: async (ctx) => {
      const lastAttack = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
      if (!lastAttack?.hit) return { data: {} };

      const available = collectWeaponMastery(lastAttack.attackName, ctx.playerStats);
      if (!available) return { data: {} };

      const choiceMasteries = available.choiceMasteries || [];
      const replaceOptions = available.replaceMasteryOptions || [];
      const modalOptions = replaceOptions.length > 0 ? replaceOptions : choiceMasteries;
      const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
      const autoApplyMasteries = allMasteries.filter(m => !['Graze', 'Topple', 'Nick', ...choiceMasteries, ...replaceOptions].includes(m));

      console.log('[WM-004 debug] tacticalMaster step', { attackName: lastAttack.attackName, allMasteries, autoApplyMasteries, targetName: lastAttack.targetName });
      const wh = (ctx.playerStats.equipment || []).find(e => e.name === 'Warhammer');
      console.log('[WM-004 debug] equipment probe', 'mastery=' + (wh ? String(wh.mastery) : 'no-equip'), 'equipKeys=' + (wh ? Object.keys(wh).join(',') : '-'), 'lastAttack=', JSON.stringify(lastAttack).slice(0, 200));

      const targetName = lastAttack.targetName;

      for (const masteryName of autoApplyMasteries) {
        const alreadyApplied = getRuntimeValue('campaign', `_${masteryName}_appliedTarget`, ctx.campaignName);
        if (alreadyApplied === targetName) continue;
        if (masteryName !== 'Slow') {
          setRuntimeValue('campaign', `_${masteryName}_appliedTarget`, targetName, ctx.campaignName);
        }
        await applyMasteryEffect(masteryName, ctx.playerStats, ctx.campaignName, targetName).catch((e) => { console.error('[Mastery] Error:', e); });
      }

      if (modalOptions.length > 0) {
        const isChoiceMode = !!available.choiceMasteries && available.choiceMasteries.length > 0;
        ctx.setModalState?.({
          tacticalMasterPending: {
            attackName: lastAttack.attackName,
            baseMastery: available.baseMastery,
            replaceOptions: modalOptions,
            targetName,
            isChoiceMode,
          },
        });
        return {
          data: { _tacticalMasterPending: true },
          modal: { type: 'tacticalMaster', props: { attackName: lastAttack.attackName, baseMastery: available.baseMastery, replaceOptions: modalOptions, targetName, isChoiceMode } },
        };
      }
      return { data: {} };
    },
  };
}

function computeToppleSaveDc(ctx, lastAttack) {
  const weaponAttack = ctx.playerStats.attacks?.find(a => a.name === lastAttack.attackName);
  const abilityName = weaponAttack?.abilityName || 'Strength';
  const ability = ctx.playerStats.abilities?.find(a => a.name === abilityName);
  const abilityMod = ability?.bonus || 0;
  const prof = ctx.playerStats.proficiency || 0;
  return { abilityName, saveDc: 8 + abilityMod + prof };
}

async function handleToppleFailure(ctx, toppleTargetName, saveDc, abilityName) {
  const cs = await loadCombatSummary(ctx.campaignName);
  const conditionDef = { key: 'prone', label: 'Prone' };
  addCondition({ combatSummary: cs, creatureName: toppleTargetName, conditionDef, dc: saveDc, ability: 'CON', getRuntimeValue, setRuntimeValue, campaignName: ctx.campaignName, playerStats: ctx.playerStats });

  addEntry(ctx.campaignName, {
    type: 'save_result',
    characterName: ctx.playerStats.name,
    rollType: 'save-topple',
    targetName: toppleTargetName,
    saveDc,
    saveType: 'CON',
    success: false,
    description: `${toppleTargetName} failed CON save vs Topple. Gains Prone condition.`,
  }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });

  addEntry(ctx.campaignName, {
    type: 'ability_use',
    characterName: ctx.playerStats.name,
    abilityName: 'Topple',
    description: `${ctx.playerStats.name} used Topple on ${toppleTargetName} — target failed CON save (DC ${saveDc}, weapon ${abilityName}), fell Prone.`,
    targetName: toppleTargetName,
  }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });
}

export function buildToppleMasteryStep() {
  return {
    name: 'toppleMastery',
    subscribe: 'tactical:done',
    emit: 'mastery:done',
    condition: (ctx) => ctx.attack?.name && ctx.playerStats,
    handler: async (ctx) => {
      const lastAttack = await getRuntimeValue('campaign', 'lastAttack', ctx.campaignName);
      if (!lastAttack?.hit) return { data: {} };

      const available = collectWeaponMastery(lastAttack.attackName, ctx.playerStats);
      if (!available) return { data: {} };
      const allMasteries = [available.baseMastery, ...(available.extraMasteries || [])].filter(Boolean);
      const choiceMast = available.choiceMasteries || [];
      const hasTopple = allMasteries.includes('Topple') || choiceMast.includes('Topple');
      if (!hasTopple) return { data: {} };
      if (available.baseMastery !== 'Topple') return { data: {} };

      const toppleTargetName = lastAttack.targetName;
      const { abilityName, saveDc } = computeToppleSaveDc(ctx, lastAttack);

      const { promise } = createSaveListener(ctx.campaignName, {
        targetName: toppleTargetName,
        saveType: 'CON',
        saveDc,
      });

      addEntry(ctx.campaignName, {
        type: 'save_result',
        characterName: ctx.playerStats.name,
        targetName: toppleTargetName,
        saveType: 'CON',
        saveDc,
        description: `Topple: ${toppleTargetName} must make a DC ${saveDc} CON save (weapon ${abilityName}) or fall Prone.`,
        success: null,
      }).catch((e) => { console.error("[attackRollPostDamage:log-error]", e); });

      const result = await promise;

      if (result && !result.success) {
        await handleToppleFailure(ctx, toppleTargetName, saveDc, abilityName);
      }

      return { data: {} };
    },
  };
}

export function buildMasteryDoneStep() {
  return {
    name: 'masteryDone',
    subscribe: 'cleave:check',
    emit: 'pipeline:complete',
    condition: () => true,
    handler: async () => {
      return { data: { _pipelineComplete: true } };
    },
  };
}
