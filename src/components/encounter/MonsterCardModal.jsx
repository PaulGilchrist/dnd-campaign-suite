import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { rollExpression, rollExpressionDoubled, canRollExpression, parseConstant } from '../../services/dice/diceRoller.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { extractDamageTypes, formatDamageTypes, getTargetFromAttacker, getResistanceNotice } from '../../services/rules/combat/damageUtils.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { computeConditionEffects, combineAttackModes, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditions/conditionEffects.js';
import { isProtectionFromEvilAndGoodActive, isCreatureWarded } from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';
import { resolveCreatureType } from '../../services/combat/creatureTypeResolver.js';
import { computeRangeEffect, getDistanceFeet, getNearestPlacedItem, rangeToFeet } from '../../services/rules/combat/rangeValidation.js';
import { isDistanceInRange, isWithinRange } from '../../services/rules/combat/rangeCheck.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import AttackResultPopup from '../common/AttackResultPopup.jsx';
import AllySelectionModal from '../common/AllySelectionModal.jsx';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { MonsterCardBody } from './MonsterCardBody.jsx';
import { MonsterEvasionModal } from './MonsterEvasionModal.jsx';
import { saveAbilityAbbr, abilityNameMap, extractConditionsFromSaveEffect, getSaveModifierForSaveType, toAbbr, spellHasDamage, spellDamageFormulaAtBaseLevel, extractSpellcastingSpellUses, getGatedMonsterReaction, resolveMonsterGatedReaction, MONSTER_REACTION_USES_KEY, buildChargeBonusOffer, buildChargeBonusGrantLog, buildChargeBonusDeclineLog, buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog, buildRangedVariantOffer, buildRangedVariantSelectLog, buildHitConditionClause, evaluateTargetPrerequisiteGate, gazeImmunityActive, buildGazeImmunityRefusalLog, isSpellAttackSpell, spellDamageFormulaAtLevel, spellCastLevelFromSpellcasting, monsterSpellAttackBonus, parseConcentrationDisadvantageClause, parseSpeedHalfClause, parseSubtractDieClause, parsePushFeetClause, parseSlowedClauses, parseWeakeningBreathClause, parseBanishTransportClause, parseSoulTomeTrapClause, parseDreamPlaneBanishClause, parseAcPenaltyClause, parseSpeedZeroClause, buildNoTargetRefusalPopup, buildNoTargetRefusalLog, parseAnimalSpiritVariants, parseBothOutcomesClause, extractFlatHitDamage, spellDamagelessSaveCondition, spellSaveLegOutcome, parseHpThresholdKillClause, parseInfernalWoundClause, parseEyeRayGrant, parseEyeRays, pickEyeRay, buildEyeRayAction, eyeRayAutoSuccessReason, buildEyeRayPickerPopup, buildEyeRayPickerRollLog, buildEyeRayAbilityUseLog, buildEyeRayAutoSuccessLog } from './MonsterCardHelpers.js';
import { AnimalSpiritVariantModal } from './AnimalSpiritVariantModal.jsx';
import { loadSpells } from '../../services/ui/dataLoader.js';
import { MONSTER_SPELL_USES_KEY, monsterAbilitySaveUsesGate, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup, extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import { expendLegendaryUse, legendaryDelegateAction, legendaryDelegateAttackName, buildLegendaryRefusalPopup, buildLegendaryRefusalLog, parseLegendaryAllyPrerequisite, legendaryAllyPrerequisiteSatisfied, buildLegendaryPrerequisiteRefusalPopup, buildLegendaryPrerequisiteRefusalLog, applyLegendarySelfHeal, legendaryCheckRow, legendaryCheckBonus, legendaryCheckLabel, buildLegendaryAdvisoryPopup, buildLegendaryAdvisoryLog } from '../../services/encounters/monsterLegendaryUses.js';
import { resolveLairRow } from '../../services/encounters/monsterLairActions.js';
import { MONSTER_RECHARGE_KEY, monsterRechargeGate, spendMonsterRecharge, buildRechargeRefusalPopup, buildRechargeRefusalLog } from '../../services/encounters/monsterRecharge.js';
import { resolveRoarStageAction } from '../../services/rules/features/roarService.js';
import SaveAttackAoeModal from '../char-sheet/modals/shared/SaveAttackAoeModal.jsx';
import './MonsterCardModal.css';

// MA-0031/MA-0035: a save row whose authored description names a cone or a
// line is an AoE — route through the existing area picker instead of the
// single-target block save. Coverage feet parsed from the row text
// ("30-foot Cone" / "60-foot-long, 5-foot-wide Line"); gridless coverage
// stays advisory via isWithinRange lenient mode (§7).
// MA-0084: coverage feet for an authored point-centered sphere/radius save
// row (Adult Bronze Dragon Thunderclap "20-foot-radius Sphere … within 90
// feet") — parsed from the RADIUS token ("20-foot-radius" / "10-ft-radius"),
// never the point-placement text (90 ft). Cylinder rows (radius + height
// clause) stay untouched (null).
function sphereRadiusFeet(description) {
  if (/\bcylinder\b/i.test(description)) return null;
  const m = description.match(/(\d+(?:\.\d+)?)\s*[- ]?(?:foot|feet|ft\.?)?[- ]?radius\b/i);
  return m ? Number(m[1]) : null;
}

function breathAoeShape(action, spellInfo) {
  if (spellInfo) return null;
  if (!action || action.save_dc == null) return null;
  // MA-0042: an authored zone (e.g. Adult Black Dragon Insect Cloud) is a
  // persisting radius area — picker centered on a GM-chosen point, so the
  // attacker-origin coverage gate does NOT apply (selection advisory).
  if (action.zone?.radius_ft != null) {
    return { shape: 'Radius', feet: Number(action.zone.radius_ft), rangeGateFt: null };
  }
  const description = String(action.description || '');
  const shape = /\bcone\b/i.test(description) ? 'Cone' : (/\bline\b/i.test(description) ? 'Line' : null);
  // MA-0084: a sphere/radius save row is an area too — route it through the
  // same area picker as the MA-0031 cones / MA-0042 zones. The GM positions
  // the center, so the attacker-origin gate does NOT apply (zone shape).
  if (shape === null) {
    const radiusFt = sphereRadiusFeet(description);
    if (radiusFt != null) {
      return { shape: 'Radius', feet: radiusFt, rangeGateFt: null };
    }
  }
  if (!shape) return null;
  const tokens = [...description.matchAll(/(\d+(?:\.\d+)?)\s*-?\s*(?:foot|feet)\b/gi)].map(t => Number(t[1]));
  // MA-0064: a lair line leads with its WIDTH ("5-foot-wide line … within
  // 120 feet") — coverage extends to the greatest authored distance, so the
  // gate takes the largest token. Verified breath lines state length first
  // (first === max), keeping every existing row byte-identical.
  const feet = shape === 'Line'
    ? (tokens.length ? Math.max(...tokens) : 60)
    : (tokens[0] ?? 30);
  return { shape, feet, rangeGateFt: feet };
}

// MA-0042: persisting-zone marker payload for authored `zone` rows (currently
// only Adult Black Dragon's Insect Cloud). Written at picker confirm by the
// area picker: zone te per covered creature + caster tracking key
// `_lair_insect_cloud_<caster>` (radius/saveDc, SP-111 zone shape). No
// turn-END zone-damage consumer exists in this engine (expireStaleEffects
// zone phases are turn-START save/restraint passes; the turn-end seams are
// condition_removal/sleep/stink-cleanup only), so the RAW "repeat 3d6 at
// turn end" clause is recorded + logged as GM-enforced (CLA-325 precedent)
// — wiring a turn-end zone-damage pass would be new state design.
function zoneTeForAction(action) {
  if (!action?.zone?.radius_ft || !action.name) return null;
  const slug = String(action.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const baseKey = action.zone.effect_key || `lair_${slug}`;
  const payload = {
    effectKey: baseKey,
    trackingPrefix: baseKey,
    radiusFt: Number(action.zone.radius_ft),
    repeatTurnEnd: action.zone.repeat_turn_end === true,
    damage: action.damage_dice_primary || null,
    duration: action.duration || null,
  };
  // MA-0043: authored advisory clause (e.g. darkness "dispel only by
  // 2nd-level+ light — GM-enforced") rides the arm log. Absent on
  // MA-0042's insect-cloud row (payload byte-identical there).
  if (action.zone.advisory) payload.clause = action.zone.advisory;
  // MA-0085: optional zone noun (e.g. Adult Bronze Dragon Fog Cloud "fog")
  // for the save-less picker copy. Absent → 'darkness' (MA-0043 byte-identical).
  if (action.zone.noun) payload.noun = action.zone.noun;
  return payload;
}

// MA-0031: recharge gate at row click — a spent breath weapon refuses with a
// popup + `<action-slug>_refused (not recharged)` log, zero save prompts.
// Returns { refused, gate } (gate null when refused or row not rechargeable).
// MA-0298: combo trap arms (Soul Tome te parse + fail conditions + the
// MA-0048 repeat-save clause) ride the auto-damage context to the player
// save-result seam. Byte-inert nulls for every other row.
function comboTrapArmsFrom(autoDamage) {
  return {
    saveConditions: autoDamage.saveConditions || null,
    soulTomeTrap: autoDamage.soulTomeTrap || null,
    repeatSave: autoDamage.repeatSave || null,
    // MA-0367: Infernal Wound arm rides the combo auto-damage to the
    // save-result fail seam. Byte-inert null elsewhere.
    infernalWound: autoDamage.infernalWound || null,
    // MA-0501: staged petrify ladder arm (Cockatrice) rides the combo
    // auto-damage to the save-fail seams. Byte-inert null elsewhere.
    stagedPetrify: autoDamage.stagedPetrify || null,
  };
}

function rechargeRefusalOnSpent({ action, spellInfo, monsterName, campaignName, setPopupHtml }) {
  const gate = spellInfo ? null : monsterRechargeGate(action, getRuntimeValue(monsterName, MONSTER_RECHARGE_KEY));
  if (gate && !gate.available) {
    setPopupHtml(buildRechargeRefusalPopup({ monsterName, actionName: action.name, threshold: gate.threshold }));
    addEntry(campaignName, buildRechargeRefusalLog({ monsterName, actionName: action.name, rechargeKey: gate.key, threshold: gate.threshold }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging recharge refusal:', e); });
    return { refused: true, gate: null };
  }
  return { refused: false, gate };
}

// MA-0031: post-gate save resolution. Non-recharge/non-cone rows fire the
// byte-identical single-target block save synchronously (today's flow).
// A spent-but-passed recharge row awaits its fire-spend first (picker-open
// spend convention, CLA-384); cone/line rows then open the existing AoE area
// picker instead of the single-target prompt.
// Block-save half-on-success is the app-wide dcSuccess convention (MV-20);
// spell rows carry their own authored dc_success. MA-0030: an authored
// per-action dc_success (e.g. Chilling Gaze "Success: no damage") overrides
// the 'half' default — every row without one stays byte-identical.
function resolveBlockSaveDcSuccess(spellInfo, action) {
  if (spellInfo) return spellInfo.dcSuccess || null;
  return action.save_dc != null ? (action.dc_success ?? 'half') : null;
}

// MA-0068: authored staged sleep row (Adult Brass Dragon Sleep Breath) —
// failed saves stage the sleep inside the picker (sleepService SP-107 shape:
// Incapacitated → turn-END repeat save → Unconscious for
// unconscious_minutes×10 rounds, CLA-334). Byte-inert flag default.
function sleepStagingForAction(spellInfo, action) {
  if (spellInfo || !action?.staged_sleep) return null;
  return { unconsciousRounds: (Number(action.staged_sleep.unconscious_minutes) || 10) * 10 };
}

// MA-0248: authored staged paralysis row (Ancient Silver Dragon Paralyzing
// Breath) — failed saves stage the ladder inside the picker (MA-0068 staged
// shape: Incapacitated → turn-END repeat save → Paralyzed, repeating each
// turn with auto-success after paralyzed_minutes×10 rounds, CLA-334). NOT
// sleep staging — paralysis never wakes on damage, so it rides its own
// paralyzing_staged te (paralyzingBreathService, MA-0102 sibling shape).
// Byte-inert flag default.
function stagedParalysisForAction(spellInfo, action) {
  if (spellInfo || !action?.staged_paralysis) return null;
  return { paralyzedRounds: (Number(action.staged_paralysis.paralyzed_minutes) || 1) * 10 };
}

// MA-0079: authored push clause (Adult Bronze Dragon Repulsion Breath —
// "pushed up to 60 feet straight away"). Feet parsed for the picker's failed-
// save push marker te (MA-0073 parse shape); null for every clauseless row —
// byte-inert. Spell rows never carry the monster push clause.
function pushFeetForAction(spellInfo, action) {
  if (spellInfo) return null;
  return parsePushFeetClause(action?.save_effect)?.feet ?? null;
}

// MA-0087: authored failed-save "slowed" rider clause (Adult Copper Dragon
// Slowing Breath). Parsed once and forwarded to the cone picker as an
// optional te-grant seam (byte-inert null for clauseless rows). 'slowed' is
// not a registered condition, so each clause maps to an existing registered te.
function slowedClausesForAction(spellInfo, action) {
  if (spellInfo) return null;
  return parseSlowedClauses(action?.save_effect);
}

// MA-0102: authored failed-save weakening clause (Adult Gold Dragon Weakening
// Breath). Parsed once and forwarded to the cone picker as an optional
// te-grant seam (byte-inert null for clauseless rows, MA-0087 shape): the
// picker grants the registered weakening_breath te on failed saves, excludes
// creatures already weakened by this dragon, and the turn-END seam repeats
// the save at Disadvantage until success or the 1-minute auto-success clock.
function weakeningBreathForAction(spellInfo, action) {
  if (spellInfo) return null;
  return parseWeakeningBreathClause(action?.save_effect);
}

// MA-0115: authored failed-save AC-penalty clause (Adult Green Dragon
// Noxious Miasma — "the target takes a −2 penalty to AC until the end of
// its next turn"). Parsed once and forwarded to the radius picker as an
// optional te-grant seam (byte-inert null for clauseless rows, MA-0087
// shape): the picker grants the registered ac_penalty te on each failed
// save (live consumer: conditionEffects acPenalty → sheet AC fold).
function acPenaltyClauseForAction(spellInfo, action) {
  if (spellInfo) return null;
  return parseAcPenaltyClause(action?.save_effect);
}

// MA-0146: authored failed-save speed-zero clause (Adult White Dragon
// Freezing Burst — "the target's Speed is 0 until the end of the target's
// next turn"). Parsed once and forwarded to the radius picker as an optional
// te+condition grant seam (byte-inert null for clauseless rows, MA-0115
// shape): the picker grants speed_zero te + activeCondition on each failed
// save with a rounds:2 expiry clock; live consumer conditionEffects
// speedZero → sheet Speed 0.
function speedZeroClauseForAction(spellInfo, action) {
  if (spellInfo) return null;
  return parseSpeedZeroClause(action?.save_effect);
}

// MA-0303: authored both-outcomes clause (Arch-hag Crackling Wave —
// "Failure or Success: The target is cursed ... can't take Reactions until
// the curse ends"). Parsed once and forwarded to the cone picker as an
// optional success-leg grant seam (byte-inert null for every row whose
// "Failure or Success:" tail names no condition/Reactions clause, MA-0087
// shape): the picker grants cursed + no_reactions te on SUCCESSFUL saves
// with one rounds:2 clock; failed saves keep the existing fail legs
// byte-identical.
function bothOutcomesClauseForAction(spellInfo, action) {
  if (spellInfo) return null;
  return parseBothOutcomesClause(action?.save_effect);
}

function executeBlockSaveRoll({ action, spellInfo, saveDamageFormula, saveConditions, monsterName, campaignName, target, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, prerequisite, usesGate, setPopupHtml, animalSpiritVariant = null, animalSpiritFortifyHp = null }) {
  const recharge = rechargeRefusalOnSpent({ action, spellInfo, monsterName, campaignName, setPopupHtml });
  if (recharge.refused) return;
  const spellName = spellInfo?.spellName || null;
  const saveType = spellInfo?.saveType || action.save_type;
  const dcSuccess = resolveBlockSaveDcSuccess(spellInfo, action);
  const aoe = breathAoeShape(action, spellInfo);
  // MA-0049: safety gate — a single-target block save with no armed target
  // refuses (popup + `<action>_refused (no target)`) instead of degrading
  // into a self-target save against the monster itself. AoE rows keep the
  // area picker — the picker IS their target selection.
  if (aoe == null && !target?.name) {
    const refusedName = spellName || action.name;
    setPopupHtml(buildNoTargetRefusalPopup({ monsterName, actionName: refusedName }));
    addEntry(campaignName, buildNoTargetRefusalLog({ monsterName, actionName: refusedName }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging no-target refusal:', e); });
    return;
  }
  const fire = () => {
    console.debug(`[saveDebug] MonsterCardModal.handleSaveRoll`, {
      monsterName, actionName: spellName || action.name, saveDc: action.save_dc, saveType,
      target: target ? { name: target.name, type: target.type } : null,
      creaturesAvailable: Array.isArray(creatures),
    });
    const saveMod = getSaveModifierForSaveType(saveType, target, characters, creatures);
    rollSavingThrow(saveAbilityAbbr(saveType), saveMod, buildAbilitySaveRollContext({
      monsterName, target, spellName, action, saveType, dcSuccess, saveDamageFormula, saveConditions, usesGate, prerequisite, getDamageTypesForAction, spellDamageType: spellInfo?.damageType, animalSpiritVariant, animalSpiritFortifyHp,
      // MA-0348: row save_effect until-clause wins; else the damageless spell
      // leg's honest concentration note from the spell itself.
      conditionDurationNote: extractConditionDurationNote(action?.save_effect) || spellInfo?.conditionDurationNote || null,
    }));
  };
  const sleepStaging = sleepStagingForAction(spellInfo, action);
  const stagedParalysis = stagedParalysisForAction(spellInfo, action);
  // MA-0079: authored push clause (Repulsion Breath "pushed up to 60 feet")
  // rides the picker as an instant marker te on failed saves (MA-0073 parse
  // shape). Null for every row without the clause — byte-inert.
  const pushFeet = pushFeetForAction(spellInfo, action);
  const slowedClauses = slowedClausesForAction(spellInfo, action);
  const weakeningBreath = weakeningBreathForAction(spellInfo, action);
  const acPenaltyClause = acPenaltyClauseForAction(spellInfo, action);
  const speedZeroClause = speedZeroClauseForAction(spellInfo, action);
  const bothOutcomesClause = bothOutcomesClauseForAction(spellInfo, action);
  if (aoe == null && !recharge.gate) { fire(); return; }
  (async () => {
    if (recharge.gate) await spendMonsterRecharge({ monsterName, action, campaignName });
    if (aoe != null) {
      setConePicker({ action, saveDamageFormula, saveConditions, saveType, dcSuccess, coneFt: aoe.feet, rangeGateFt: aoe.rangeGateFt, title: `${aoe.feet}-ft ${aoe.shape} (GM positions tokens; selection advisory)`, damageType: formatDamageTypes(getDamageTypesForAction(action)), zoneTe: zoneTeForAction(action), sleepStaging, stagedParalysis, pushFeet, slowedClauses, weakeningBreath, acPenaltyClause, speedZeroClause, bothOutcomesClause, conditionDurationNote: extractConditionDurationNote(action?.save_effect) });
      return;
    }
    fire();
  })().catch((e) => { console.error('[MonsterCardModal] Error resolving recharge/cone save leg:', e); });
}

// MA-0374/MA-0383: Eye Rays picker — RAW "roll 1d10 (Beholder) / 1d4
// (Beholder Zombie); reroll if already used that ray this turn" — the picker
// die is len(rays), monster-agnostic. The old rows were save-only shells
// ("Varies (WIS, CON, STR, DEX)" + multi-dice, playbook §6 VAR family): no
// ray ever resolved. rays[] (monsters.json) carries one single-ability save
// leg per ray; this picker rolls the die, rerolling any ray already fired
// this round (round-stamped runtime key eyeRaysUsed — self-resets, no
// initiative clear-list latch needed §5 monster-latch rule), names the ray
// in popup + picker roll log, honors the Gargantuan/Construct/Undead
// auto-success clauses, then routes THAT ray's own save through the existing
// block-save seam (half-damage/condition/threshold legs intact).
const EYE_RAYS_USED_KEY = 'eyeRaysUsed';

async function resolveEyeRayFire({ action, monsterName, campaignName, target, characters, creatures, rollSavingThrow, setConePicker, getDamageTypesForAction, prerequisite, usesGate, setPopupHtml }) {
  const rays = parseEyeRays(action);
  if (!rays) return;
  if (!target?.name) {
    setPopupHtml(buildNoTargetRefusalPopup({ monsterName, actionName: action.name }));
    addEntry(campaignName, buildNoTargetRefusalLog({ monsterName, actionName: action.name }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging Eye Rays no-target refusal:', e); });
    return;
  }
  const cs = await getCombatContext(campaignName);
  const round = Number(cs?.round ?? 1);
  const stored = getRuntimeValue(monsterName, EYE_RAYS_USED_KEY) || {};
  const usedKeys = Number(stored.round) === round && Array.isArray(stored.rays) ? [...stored.rays] : [];
  const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys, rollDie: () => Math.floor(Math.random() * rays.length) + 1 });
  if (!ray) {
    console.error(`[MonsterCardModal] Eye Rays picker on ${monsterName} could not resolve a fresh ray after 100 rolls — refusing.`);
    return;
  }
  // Latch stamp awaited BEFORE the save leg (playbook §5 runtime writes).
  await setRuntimeValue(monsterName, EYE_RAYS_USED_KEY, { round, rays: [...usedKeys, ray.key] }, campaignName);
  addEntry(campaignName, buildEyeRayPickerRollLog({ monsterName, ray, roll, rerolls, targetName: target.name, die: rays.length }))
    .catch((e) => { console.error('[MonsterCardModal] Error logging Eye Rays picker roll:', e); });
  const autoReason = eyeRayAutoSuccessReason(ray, (cs?.creatures || []).find(c => c.name === target.name));
  const pickerDc = action.save_dc;
  setPopupHtml(buildEyeRayPickerPopup({ monsterName, ray, roll, rerolls, targetName: target.name, die: rays.length, dc: pickerDc }));
  if (autoReason) {
    addEntry(campaignName, buildEyeRayAutoSuccessLog({ monsterName, ray, targetName: target.name, reason: autoReason }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging Eye Rays auto-success:', e); });
    return;
  }
  addEntry(campaignName, buildEyeRayAbilityUseLog({ monsterName, ray, targetName: target.name, dc: pickerDc }))
    .catch((e) => { console.error('[MonsterCardModal] Error logging Eye Rays ability_use:', e); });
  executeBlockSaveRoll({
    action: buildEyeRayAction(action, ray),
    spellInfo: { damageType: ray.damage_type, conditionDurationNote: ray.duration_note, dcSuccess: ray.dc_success },
    saveDamageFormula: ray.damage_dice || null,
    saveConditions: ray.conditions || [],
    monsterName, campaignName, target, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, prerequisite, usesGate, setPopupHtml,
  });
}

// MA-0275: Animal Spirit chooser seam — confirm applies an advisory 120 ft
// range gate (isWithinRange, lenient gridless §7: refusal popup + log, zero
// roll) then runs the block-save seam with the chosen variant threaded onto
// the save context; decline (variant null) logs the core-only resolution.
async function resolveAnimalSpiritSelection({ chooser, variant, monsterName, campaignName, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, setPopupHtml, setChooser }) {
  setChooser(null);
  if (!chooser) return;
  const target = chooser.target;
  if (variant && chooser.rangeFt != null && target?.name) {
    const inRange = await isWithinRange(monsterName, target.name, chooser.rangeFt);
    if (!inRange) {
      setPopupHtml(`<strong>${monsterName}</strong> — Animal Spirit requires a creature it can see within ${chooser.rangeFt} feet. Target <strong>${target.name}</strong> is out of range — no save was rolled.`);
      addEntry(campaignName, {
        type: 'automation blocked',
        characterName: monsterName,
        abilityName: 'Animal Spirit',
        description: `${monsterName}'s Animal Spirit refused — ${target.name} is not within ${chooser.rangeFt} feet. No save rolled, no effect applied.`,
        timestamp: Date.now(),
      }).catch((e) => { console.error('[MonsterCardModal] Error logging animal spirit range refusal:', e); });
      return;
    }
  }
  if (!variant) {
    addEntry(campaignName, {
      type: 'automation',
      automationType: 'animal_spirit_variant_declined',
      characterName: monsterName,
      abilityName: 'Animal Spirit',
      description: `${monsterName} casts Animal Spirit with no variant form selected — save resolves core damage only; no Fortify/Marked as Prey/Pesky Swarm effect applied.`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[MonsterCardModal] Error logging animal spirit decline:', e); });
  }
  executeBlockSaveRoll({ action: chooser.action, spellInfo: chooser.spellInfo, saveDamageFormula: chooser.saveDamageFormula, saveConditions: chooser.saveConditions, monsterName, campaignName, target, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, prerequisite: chooser.prerequisite, usesGate: chooser.usesGate, setPopupHtml, animalSpiritVariant: variant?.key ?? null, animalSpiritFortifyHp: variant?.tempHp ?? null });
}

function getDamageTypeChoices(action) {
  return action?.damage_type_choices?.length > 0 ? action.damage_type_choices : undefined;
}

// MA-0021: legendary-row numeric mechanic resolved after a use is spent —
// routes to the same handlers the numeric chips already use (MA-0014 intact).
// MA-0022: a non-numeric row that names another action via `delegates_to`
// resolves using THAT row's attack_bonus/damage through the identical attack
// seam (Lash → Tentacle +9 / 2d6+5), logs "Lash (Tentacle attack)".
function legendaryRowHasNumericMechanic(action) {
  if (action.attack_bonus != null || action.save_dc != null) return true;
  const formula = extractDamageDiceFromDescription(action.description, action.damage_dice_primary);
  return !!(formula && canRollExpression(formula));
}

function resolveLegendaryRowMechanic(action, { monsterName, handledActionName, handleAttack, handleSaveRoll, handleDamage, setPopupHtml, campaignName }) {
  if (action.attack_bonus != null) handleAttack(handledActionName ?? action.name, action.attack_bonus, action);
  else if (action.save_dc != null) handleSaveRoll(action, extractDamageDiceFromDescription(action.description, action.damage_dice_primary), extractConditionsFromSaveEffect(action.save_effect));
  else if (action.advisory) {
    // MA-0058: advisory row (Cloaked Flight self-Invisibility + movement) —
    // spend already logged by expendLegendaryUse; land the adjudication
    // record instead of a console dead-end (MA-0024/CLA-325 model).
    setPopupHtml(buildLegendaryAdvisoryPopup({ monsterName, action }));
    addEntry(campaignName, buildLegendaryAdvisoryLog({ monsterName, action }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging legendary advisory row:', e); });
  }
  else {
    const formula = extractDamageDiceFromDescription(action.description, action.damage_dice_primary);
    if (formula && canRollExpression(formula)) handleDamage(handledActionName ?? action.name, formula, action.damage_type_primary ? formatDamageTypes([action.damage_type_primary]) : '', action);
    else console.error(`[MonsterCardModal] legendary action "${action.name}" delegates_to "${action.delegates_to}" — no resolvable mechanic on "${monsterName}"`);
  }
}

// MA-0021: legendary-row gated click — expend 1 use (round+turn latch, refusal
// popup + legendary_use_refused zero-spend log), then resolve the row's own
// mechanic (numeric chips roll as today, MA-0014 gate intact). MA-0022: rows
// with no own numbers delegate to the named row before spending.
// MA-0023: Psychic Drain — any-ally prerequisite gate BEFORE the spend
// (≥1 creature Charmed/Grappled by the aboleth, provenance per MA-0019,
// tentacle grapples per MA-0018); met → spend, delegated Consume Memories
// save resolves via the existing MA-0019-armed-target seam untouched, then
// self_heal 1d10 rolls through the canonical applyHealingToTarget helper
// (MA-0016 choke point — 'no_healing' te refused there with healing_blocked).
async function resolveLegendaryRow({ action, monsterName, monster, campaignName, setPopupHtml, handleAttack, handleSaveRoll, handleDamage, handleCheck }) {
  const allyPrerequisite = parseLegendaryAllyPrerequisite(action);
  if (allyPrerequisite) {
    const gateCs = await getCombatContext(campaignName);
    const sat = legendaryAllyPrerequisiteSatisfied({ prerequisite: allyPrerequisite, creatures: gateCs?.creatures || [], monsterName, getRuntimeValue });
    if (!sat.satisfied) {
      setPopupHtml(buildLegendaryPrerequisiteRefusalPopup({ monsterName, actionName: action.name, prerequisite: allyPrerequisite }));
      addEntry(campaignName, buildLegendaryPrerequisiteRefusalLog({ monsterName, actionName: action.name, prerequisite: allyPrerequisite }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging ally-prerequisite refusal:', e); });
      return;
    }
  }
  let mechanicAction = action;
  let actionName = action.name;
  if (!legendaryRowHasNumericMechanic(action) && action.delegates_to) {
    const delegate = legendaryDelegateAction(monster, action);
    if (!delegate) {
      setPopupHtml(buildLegendaryRefusalPopup({ monsterName, actionName: action.name, reason: 'no-delegate' }));
      addEntry(campaignName, buildLegendaryRefusalLog({ monsterName, actionName: action.name, reason: 'no-delegate' }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging legendary delegate refusal:', e); });
      return;
    }
    mechanicAction = delegate;
    actionName = legendaryDelegateAttackName(action, delegate);
  }
  // MA-0051: authored ability-check rows (Dracolich "Detect" → Wisdom
  // (Perception)) resolve the stat-block bonus BEFORE the spend — an
  // unresolvable modifier refuses with zero spend. A met gate spends 1
  // (MA-0021 latch intact) then rolls d20+mod through the existing
  // rollSkillCheck seam (same producer as the card's Skills defense chips),
  // which logs the check roll + result and shows the popup.
  const checkBonus = legendaryCheckRow(action) ? legendaryCheckBonus(monster, action) : null;
  if (legendaryCheckRow(action) && checkBonus == null) {
    setPopupHtml(buildLegendaryRefusalPopup({ monsterName, actionName: action.name, reason: 'no-check-bonus' }));
    addEntry(campaignName, buildLegendaryRefusalLog({ monsterName, actionName: action.name, reason: 'no-check-bonus' }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging check-bonus refusal:', e); });
    return;
  }
  const result = await expendLegendaryUse({ monsterName, monster, actionName, campaignName, action });
  if (!result.spent) {
    setPopupHtml(result.popupHtml);
    return;
  }
  if (checkBonus != null) handleCheck(legendaryCheckLabel(action), checkBonus);
  else resolveLegendaryRowMechanic(mechanicAction, { monsterName, handledActionName: actionName, handleAttack, handleSaveRoll, handleDamage, setPopupHtml, campaignName });
  if (action.self_heal) {
    applyLegendarySelfHeal({ monsterName, actionName: action.name, formula: action.self_heal, campaignName })
      .catch((e) => { console.error('[MonsterCardModal] Error applying legendary self-heal:', e); });
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function extractDamageDiceFromDescription(description, existingDamageDice) {
  if (existingDamageDice) return existingDamageDice;
  if (!description) return null;
  const hitMatch = description.match(/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
  return hitMatch ? hitMatch[1].replace(/\s+/g, ' ').trim() : null;
}

function psychicStrikePreconditionFailed(name, target, allTargetEffects) {
  if (name !== 'Psychic Strike') return false;
  if (!target) {
    alert('Psychic Strike requires a target to be selected.');
    return true;
  }
  const hexEffect = allTargetEffects.find(te => te.target === target.name && te.effect === 'hex_ability_check_disadvantage');
  if (!hexEffect) {
    alert('Psychic Strike can only be used on a creature under the warlock\'s Hex spell.');
    return true;
  }
  return false;
}

function computeGrazeSettings(isMeleeAttack, monsterCharacter) {
  if (!isMeleeAttack || !monsterCharacter?.computedStats) return { grazeDamage: false, grazeAbilityMod: 0 };
  const weaponMastery = monsterCharacter.computedStats.automation?.passives?.find(p => p.type === 'weapon_mastery_choice');
  if (weaponMastery?.chosenMastery !== 'Graze') return { grazeDamage: false, grazeAbilityMod: 0 };
  const strAbility = monsterCharacter.computedStats.abilities?.find(a => a.name === 'Strength');
  return { grazeDamage: true, grazeAbilityMod: strAbility?.bonus || 0 };
}

function resolveTargetDefense(target, creatures, primaryDamageType) {
  if (!target) return { targetComputed: null, resistanceNotice: null };
  const targetStats = target.type === 'player'
    ? (creatures || []).find(c => c.name === target.name)
    : null;
  const targetComputed = targetStats?.computedStats || targetStats;
  const resistanceNotice = getResistanceNotice(
    primaryDamageType,
    target.type === 'player' ? (targetComputed?.resistances || []) : (target.resistances || []),
    target.type === 'player' ? (targetComputed?.immunities || []) : (target.immunities || []),
    target.name
  );
  return { targetComputed, resistanceNotice };
}

function applyElusive(targetEffectData, target, targetComputed, targetConditions) {
  if (target?.type !== 'player' || !targetComputed) return;
  const hasElusive = [
    ...(targetComputed.actions || []),
    ...(targetComputed.bonusActions || []),
    ...(targetComputed.reactions || []),
    ...(targetComputed.specialActions || [])
  ].some(a => a.name === 'Elusive');
  const isIncapacitated = targetConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c));
  if (hasElusive && !isIncapacitated) {
    targetEffectData.noAdvantageAgainst = true;
  }
}

function applyProtectionFromEvilPenalty(targetEffectData, target, campaignName, getAttackerCreature) {
  if (!isProtectionFromEvilAndGoodActive(target?.name, campaignName)) return;
  const attackerCreature = getAttackerCreature();
  if (attackerCreature && isCreatureWarded(resolveCreatureType(attackerCreature), target?.name, campaignName)) {
    targetEffectData.targetDisadvantageCount = (targetEffectData.targetDisadvantageCount || 0) + 1;
  }
}

function resolveTargetGridPos(mapData, target, attackerPlaced) {
  const targetPlayer = mapData.players?.find(p => p.name === target.name);
  if (targetPlayer) return { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
  if (!mapData.placedItems?.length) return null;
  const targetNpc = getNearestPlacedItem(mapData.placedItems, target.name, attackerPlaced ? { gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY } : null);
  return targetNpc ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY } : null;
}

const RANGE_MODE_HANDLERS = {
  disadvantage: (state, reason) => {
    state.rangeForcedMode = 'disadvantage';
    state.rangeReason = reason;
  },
  miss: (state, reason) => {
    state.isAutoMiss = true;
    state.rangeReason = reason;
  },
};

function computeMapRangeState(mapData, target, monsterName, attackRange) {
  const state = { isAutoMiss: false, rangeReason: null, rangeForcedMode: null };
  if (!mapData || !target) return state;
  const attackerPlaced = (mapData.placedItems || []).find(i => i.name === monsterName) || null;
  const targetPos = resolveTargetGridPos(mapData, target, attackerPlaced);
  if (!attackerPlaced || !targetPos) return state;
  const distanceFt = getDistanceFeet(
    { gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY },
    targetPos
  );
  const rangeResult = computeRangeEffect(attackRange, distanceFt);
  const handler = RANGE_MODE_HANDLERS[rangeResult.mode];
  if (handler) handler(state, rangeResult.reason);
  return state;
}

const NO_COVER = { coverAcBonus: 0, coverLevel: null, coverReason: null };

function computeBulwarkCover(target, characters) {
  for (const player of characters) {
    if (!getRuntimeValue(player.name, 'bulwarkOfForceActive')) continue;
    const bulwarkTargets = getRuntimeValue(player.name, 'bulwarkOfForceTargets') || [];
    if (bulwarkTargets.includes(target?.name)) {
      return { coverAcBonus: 2, coverLevel: 'half', coverReason: 'Bulwark of Force' };
    }
  }
  return null;
}

function computeSanctuaryCover(target, characters, campaignName) {
  for (const player of characters) {
    const sanctuaryCreatures = getRuntimeValue(player.name, 'naturesSanctuaryCreatures', campaignName) || [];
    if (sanctuaryCreatures.includes(target.name)) {
      return { coverAcBonus: 2, coverLevel: 'half', coverReason: 'Nature\'s Sanctuary' };
    }
  }
  return null;
}

function hasPassiveNamed(playerStats, passiveName) {
  return Boolean(playerStats?.automation?.passives?.some(p => p.name === passiveName));
}

function findPlacedPlayer(mapData, name) {
  return mapData.players?.find(p => p.name === name) || null;
}

function computeSmiteCover(target, characters, mapData, campaignName) {
  for (const player of characters) {
    if (!getRuntimeValue(player.name, 'smiteOfProtectionActive', campaignName)) continue;
    if (!hasPassiveNamed(player.computedStats, 'Aura of Protection')) continue;
    const paladinPos = findPlacedPlayer(mapData, player.name);
    const targetPlayer = findPlacedPlayer(mapData, target.name);
    if (!paladinPos || !targetPlayer) continue;
    const auraRange = hasPassiveNamed(player.computedStats, 'Aura Expansion') ? 30 : 10;
    if (isDistanceInRange(getDistanceFeet(paladinPos, targetPlayer), auraRange)) {
      return { coverAcBonus: 2, coverLevel: 'half', coverReason: 'Smite of Protection' };
    }
  }
  return null;
}

function computeCoverState(isAutoMiss, target, characters, mapData, campaignName) {
  if (isAutoMiss) return NO_COVER;
  if (characters) {
    const bulwark = computeBulwarkCover(target, characters);
    if (bulwark) return bulwark;
  }
  if (characters && target) {
    const sanctuary = computeSanctuaryCover(target, characters, campaignName);
    if (sanctuary) return sanctuary;
  }
  if (characters && target && mapData) {
    const smite = computeSmiteCover(target, characters, mapData, campaignName);
    if (smite) return smite;
  }
  return NO_COVER;
}

function resolveForcedMode(forcedMode, rangeForcedMode) {
  if (rangeForcedMode) return rangeForcedMode;
  return forcedMode !== 'normal' ? forcedMode : undefined;
}

function buildAutoDamageOptions(action, name) {
  return {
    // MA-0322: dice rows resolve first (byte-inert); flat prose-only hit
    // damage ("Hit: 1 Slashing damage.") falls back to a constant formula
    // the auto-damage seam resolves dice-less.
    autoDamageFormula: extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary) || extractFlatHitDamage(action) || null,
    autoDamageName: name,
    // MA-0427: MA-0426 secondary keys now produced by the shared transport
    // helper (name falls back to the chip name for synthesized actions).
    ...buildSecondaryDamageTransport(action, name),
    hitClause: buildHitConditionClause(action),
  };
}

// MA-0427: authored secondary damage (monsters.json damage_dice_secondary /
// damage_type_secondary) as the transport triple — the MA-0426 attack-path
// keys, now shared by both save seams (block-save context + attack+save combo)
// so one producer serves every secondary-damage consumer. Byte-inert nulls
// for every row without a secondary.
// eslint-disable-next-line react-refresh/only-export-components
export function buildSecondaryDamageTransport(action, fallbackName = null) {
  if (!action?.damage_dice_secondary) {
    return { autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null };
  }
  return {
    autoDamageSecondaryFormula: action.damage_dice_secondary,
    autoDamageSecondaryName: fallbackName || action.name || null,
    autoDamageSecondaryDamageType: action.damage_type_secondary ? formatDamageTypes([action.damage_type_secondary]) : null,
  };
}

// MA-0501: authored staged petrify ladder key (Cockatrice Petrifying Bite) —
// structured-only arm (never prose-parsed, playbook §67): Restrained-first →
// turn-END repeat save → Petrified for petrified_hours×600 rounds (CLA-334).
// Rides the save transport to BOTH failed-save seams (NPC inline
// handleNpcSaveDamage + PC prompt saveProcessing → cockatricePetrifyService).
// Byte-inert null for every row without the structured key.
// eslint-disable-next-line react-refresh/only-export-components
export function parseStagedPetrifyClause(action) {
  if (!action?.staged_petrify) return null;
  return { petrifiedRounds: (Number(action.staged_petrify.petrified_hours) || 24) * 600 };
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildSaveOptions(action) {
  return {
    saveDc: action?.save_dc || null,
    saveType: action?.save_type ? toAbbr(action.save_type) : null,
    dcSuccess: action?.save_dc != null ? (action?.dc_success ?? 'half') : null,
    stagedPetrify: parseStagedPetrifyClause(action),
    saveConditions: extractConditionsFromSaveEffect(action?.save_effect),
    // MA-0298: Soul Tome trap arm rides the attack+save combo context to the
    // player-save-result fail seam (soulTomeTrapService). Byte-inert null for
    // every non-trap row; MA-0104 "transported" wording never matches here.
    soulTomeTrap: parseSoulTomeTrapClause(action?.save_effect),
    // MA-0048 repeat_save seam: arm the turn-END repeat save on a fail.
    repeatSave: action?.repeat_save || null,
    // MA-0367: Infernal Glaive combo attack+save — the wound arm rides the
    // auto-damage to the save-result fail seam (infernalWoundService).
    // Byte-inert null for every row without the structured wound key.
    infernalWound: parseInfernalWoundClause(action),
    // MA-0427: secondary damage rides the save transport (see helper).
    ...buildSecondaryDamageTransport(action),
  };
}

// CLA-324: spell-origin marker for monster spell attacks (against_spell gates).
function isSpellOriginAction(action) {
  return action?.spell_attack_bonus != null
    || action?.spell_save_dc != null
    || /spell attack/i.test(action?.description || '');
}

function buildAttackRollOptions(v) {
  return {
    damageType: formatDamageTypes(v.primaryDamageType),
    damageTypeChoices: getDamageTypeChoices(v.action),
    resistanceNotice: v.resistanceNotice,
    forcedMode: resolveForcedMode(v.forcedMode, v.rangeForcedMode),
    isMelee: v.isMelee,
    isAutoCrit: v.isAutoCrit,
    isAutoMiss: v.isAutoMiss,
    rangeReason: v.rangeReason,
    coverAcBonus: v.coverAcBonus,
    coverLevel: v.coverLevel,
    coverReason: v.coverReason,
    ...buildAutoDamageOptions(v.action, v.name),
    targetName: v.target?.name,
    attackerName: v.monsterName,
    grazeDamage: v.grazeDamage,
    grazeAbilityMod: v.grazeAbilityMod,
    grazeAbilityName: 'STR',
    ...buildSaveOptions(v.action),
    isSpellDamage: isSpellOriginAction(v.action),
    chargeBonusOffer: buildChargeBonusOffer(v.action, v.name),
    // MA-0325: two-handed versatile-damage choice (HIT popup offer).
    twoHandedVariantOffer: buildTwoHandedVariantOffer(v.action, v.name),
    // MA-0436: melee-or-ranged dual-mode damage choice (HIT popup offer).
    rangedVariantOffer: buildRangedVariantOffer(v.action, v.name),
  };
}

function resolveAttackRange(action) {
  if (action?.reach) return rangeToFeet(action.reach);
  if (action?.range) return rangeToFeet(action.range);
  return 30;
}

function extractConditionKeys(creature) {
  return (creature?.conditions || []).map(c => c.key);
}

function resolveTargetSaveModifiers(target, targetComputed) {
  if (target?.type === 'player') return targetComputed?.saveModifiers;
  return target?.saveModifiers || [];
}

function resolveAttackerActionBlock(attackerConditions, monsterTargetEffects, campaignName, monsterName, actionName) {
  const cloudActionBlock = monsterTargetEffects.some(te => te.effect === 'no_action_and_bonus_action');
  if (!attackerConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c)) && !cloudActionBlock) return false;
  if (cloudActionBlock) {
    blockStinkingCloudAction(campaignName, monsterName, actionName);
  }
  return true;
}

function buildTargetEffectData({ target, targetComputed, targetConditions, targetSaveModifiers, allTargetEffects, campaignName, getAttackerCreature }) {
  const targetRiderForTarget = allTargetEffects.filter(te => te.target === target?.name);
  const targetEffectData = computeConditionEffects({ conditions: targetConditions, saveModifiers: targetSaveModifiers, targetEffects: targetRiderForTarget });
  applyElusive(targetEffectData, target, targetComputed, targetConditions);
  applyProtectionFromEvilPenalty(targetEffectData, target, campaignName, getAttackerCreature);
  return targetEffectData;
}

function hasPassiveRule(computedStats, effect) {
  return computedStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === effect);
}

function hasMonsterPassive(monsterCharacter, effect) {
  return hasPassiveRule(monsterCharacter?.computedStats, effect);
}

function resolveCurrentAllies(storedAllies, monsterName) {
  return Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : [monsterName];
}

function computeShieldOfFaithBonus(activeBuffs) {
  return Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith') ? 2 : 0;
}

function blockStinkingCloudAction(campaignName, monsterName, name) {
  addEntry(campaignName, {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: name,
    description: `${monsterName} is Poisoned by Stinking Cloud and can't take an Action or Bonus Action — ${name} refused.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[MonsterCardModal] Error:', e); });
}

// MA-0322: roll an auto-damage formula — dice rows roll as always; a flat
// constant ("1", parsed from dice-less "Hit: N <type> damage." prose) has no
// dice to roll and resolves verbatim, dice-less. Flat NEVER doubles on crit
// (dice-only doubling, playbook §4). Null when nothing resolves (MA-0014
// blocked-refusal then fires at the caller).
function resolveAutoDamageResult(formula, wasCrit) {
  const rolled = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
  if (rolled) return rolled;
  const flat = parseConstant(formula);
  return flat != null ? { total: flat, rolls: [], modifier: 0 } : null;
}

// MA-0014: never die silently on an unparseable damage formula — log the refusal.
function logBlockedDamageRoll(campaignName, monsterName, name, formula) {
  console.error(`[MonsterCardModal] Unparseable damage formula for ${monsterName} — ${name}: "${formula}"`);
  addEntry(campaignName, {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: name,
    description: `${monsterName} ${name}: damage formula "${formula}" could not be rolled — GM adjudicate manually.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[MonsterCardModal] Error logging blocked damage roll:', e); });
}

// MA-0102 generalization: any te on this monster carrying the generic
// strCheckDisadvantage flag (ray_of_enfeeble_debuff, weakening_breath)
// forces Disadvantage on its STR ability/skill checks. Ray te already
// carries the flag, so ray behavior is byte-identical.
function hasStrTestDisadvantageOn(targetEffects, monsterName) {
  return targetEffects?.some(te => te.target === monsterName && (te.effect === 'ray_of_enfeeble_debuff' || te.strCheckDisadvantage));
}

function rayDisadvantageContext(applies) {
  return applies ? { forcedMode: 'disadvantage' } : undefined;
}

function monsterSpellcastingMod(monster) {
  return Number(monster?.ability_score_modifiers?.wis) || 0;
}

async function resolveGatedSpellLevel(lastAttack) {
  if (!lastAttack) return 0;
  if (lastAttack.spellLevel != null) return Number(lastAttack.spellLevel) || 0;
  if (lastAttack.overchannelSpellLevel != null) return Number(lastAttack.overchannelSpellLevel) || 0;
  if (lastAttack.isCantrip === true) return 0;
  const spell = await findMonsterSpell(lastAttack.attackName);
  return spell?.level || 0;
}

async function findMonsterSpell(spellName) {
  const fiveESpells = await loadSpells('5e');
  const found = fiveESpells.find(s => s.name === spellName);
  if (found) return found;
  const spells2024 = await loadSpells('2024');
  return spells2024.find(s => s.name === spellName) || null;
}

// MA-0012: advisory cast logs print the row's authored save_dc/save_type
// (e.g. Aberrant Cultist "spell save DC 15, Wisdom") even when the spell's
// own spells.json entry carries no structured dc.
function buildMonsterSpellCastLog({ monsterName, spellName, spell, action, usesNote }) {
  const saveAbility = spell?.dc?.dc_type || action?.save_type || null;
  const saveNote = action?.save_dc != null ? ` (spell save DC ${action.save_dc}${saveAbility ? `, ${saveAbility}` : ''})` : '';
  const concentrationNote = spell?.concentration ? ` Concentration (${spell.duration || 'up to 1 minute'}).` : '';
  return `${monsterName} casts ${spellName} via Spellcasting${saveNote}.${concentrationNote}${usesNote || ''} Spell effect is recorded; GM-enforced for monsters.`;
}

function buildMonsterSpellCastEntry({ monsterName, spellName, spell, action, usesNote }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: spellName,
    description: buildMonsterSpellCastLog({ monsterName, spellName, spell, action, usesNote }),
    timestamp: Date.now(),
  };
}

// MA-0033: spell-ATTACK monster casts (Melf's Acid Arrow +9 at lv3) route
// through the same attack seam as delegated rows (MA-0022 shape) — d20+bonus
// vs the armed target's AC, spell-named roll/damage logs, isSpellDamage
// marker (CLA-324). Spell-attack spells must NEVER hit the block-save path.
// Validation happens BEFORE the N/Day spend so a refusal leaks no charge.
function resolveSpellAttackPlan({ spell, spellName, action, target, spellCastLogBase }) {
  const bonus = monsterSpellAttackBonus(action);
  const castLevel = spellCastLevelFromSpellcasting(action.description, spellName, spell);
  const formula = spellDamageFormulaAtLevel(spell, castLevel);
  const missing = [];
  if (!target) missing.push('no armed target (arm via the initiative card Target selector)');
  if (bonus == null || !Number.isFinite(bonus)) missing.push('no spell attack bonus authored on the row');
  if (!formula) missing.push('no damage formula in spells.json');
  if (missing.length > 0) {
    return { ok: false, reason: missing.join('; ') };
  }
  const concentrationNote = spell.concentration ? ` Concentration (${spell.duration || 'up to 1 minute'}).` : '';
  return {
    ok: true,
    bonus,
    formula,
    castLevel,
    range: spell.range,
    damageType: spell.damage?.damage_type || 'Acid',
    castLog: `${spellCastLogBase} — level ${castLevel} ranged spell attack +${bonus} vs ${target.name}, formula ${formula}.${concentrationNote} Delayed/miss-splash dice are GM-enforced for monsters.`,
  };
}

async function refuseMonsterSpellAttack({ monsterName, spellName, reason, campaignName, setPopupHtml }) {
  console.error(`[MonsterCardModal] Spell attack cast refused for '${spellName}': ${reason}`);
  setPopupHtml(`<div class="mc-prerequisite-refusal"><h3>Spell Cast Refused</h3><p>${monsterName} ${spellName}: ${reason}. Nothing spent, no roll.</p></div>`);
  await addEntry(campaignName, {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: spellName,
    description: `${monsterName} ${spellName} spell attack refused — ${reason}. Zero spend, no roll.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[MonsterCardModal] Error logging spell-attack refusal:', e); });
}

// MA-0276: advisory-path casts (no save, no attack) log their own richer
// ability_use record downstream (buildMonsterSpellCastEntry carries the same
// usesNote) — skipLog prevents the double ability_use pair per spend.
async function spendMonsterSpellUseIfNeeded({ gate, monsterName, spellName, campaignName, skipLog = false }) {
  if (gate.usesMax == null) return null;
  const usesNote = ` ${gate.usesMax}/Day use spent — ${gate.usesMax - gate.used - 1} remaining today (resets at a long rest, GM-enforced for monsters).`;
  await setRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY, { ...gate.storedUses, [spellName]: gate.used + 1 }, campaignName);
  if (!skipLog) {
    await addEntry(campaignName, {
      type: 'ability_use',
      characterName: monsterName,
      abilityName: spellName,
      description: `${monsterName} casts ${spellName} via Spellcasting.${usesNote}`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[MonsterCardModal] Error logging monster spell use spend:', e); });
  }
  return usesNote;
}

// Save-attack spells keep the MA-0003 spell-attributed save routing
// (own dc_type/dc_success); hoisted to keep handleSpellCast branch-free.
function executeMonsterSaveSpellCast({ spell, spellName, action, handleSaveRoll, saveLegCondition = null }) {
  const dcSuccess = spell?.dc?.dc_success === 'none' ? 'none' : 'half';
  // MA-0087: honor the row's authored "(level N version)" upcast on the SAVE
  // leg too (Adult Copper Mind Spike lv4 = 5d8, not the base lv2 3d8) — the
  // MA-0112 base-dice residual. spellDamageFormulaAtLevel falls back to base
  // when the row author no level clause, so every clauseless row is unchanged.
  const castLevel = spellCastLevelFromSpellcasting(action?.description, spellName, spell);
  const formula = spellDamageFormulaAtLevel(spell, castLevel) || spellDamageFormulaAtBaseLevel(spell);
  // MA-0348: damageless save legs (Hold Person) grant the condition parsed
  // off the spell's own text; damage legs stay byte-identical.
  const { saveConditions, conditionDurationNote } = spellSaveLegOutcome(spell, formula, saveLegCondition);
  handleSaveRoll(action, formula, saveConditions, {
    spellName, saveType: spell?.dc?.dc_type || action.save_type, dcSuccess,
    castLevel,
    // MA-0054: Spellcasting rows carry no damage_type_primary, so without the
    // spell's own spells.json damage type the save-damage log defaults Slashing.
    damageType: spell?.damage?.damage_type || null,
    conditionDurationNote,
  });
}

async function executeMonsterSpellAttackCast({ monsterName, spellName, plan, usesNote, campaignName, handleAttack }) {
  await addEntry(campaignName, {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: spellName,
    description: `${plan.castLog}${usesNote || ''}`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[MonsterCardModal] Error logging spell-attack cast:', e); });
  handleAttack(spellName, plan.bonus, {
    name: spellName,
    damage_dice_primary: plan.formula,
    damage_type_primary: plan.damageType,
    spell_attack_bonus: plan.bonus,
    range: plan.range,
  });
}

function spellUsesGate(monsterName, action, spellName) {
  const usesMax = extractSpellcastingSpellUses(action.description)[spellName] ?? null;
  const storedUses = getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY) || {};
  const used = Number(storedUses[spellName]) || 0;
  return { usesMax, used, storedUses, exhausted: usesMax != null && used >= usesMax };
}

// MA-0020: N/Day ability save rows (Aboleth Dominate Mind 2/Day) gate at
// click — exhausted means refusal popup + <slug>_refused log, zero save
// prompts. Spell-cast rows already paid their uses in handleSpellCast
// (MA-0005) so spellInfo rows skip this gate.
function resolveAbilityUsesGate({ action, spellInfo, monsterName, campaignName, setPopupHtml }) {
  const usesGate = spellInfo ? null : monsterAbilitySaveUsesGate(action, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
  if (!usesGate?.exhausted) return { refused: false, usesGate };
  setPopupHtml(buildAbilitySaveRefusalPopup({ monsterName, useKey: usesGate.useKey, maxUses: usesGate.maxUses }));
  addEntry(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: usesGate.useKey, maxUses: usesGate.maxUses }))
    .catch((e) => { console.error('[MonsterCardModal] Error logging ability uses refusal:', e); });
  return { refused: true, usesGate: null };
}

function buildGazeImmunityRefusalPopup({ monsterName, actionName, targetName }) {
  return `<div class="mc-gaze-immunity-refusal"><h3>Immunity — ${actionName}</h3><p>${targetName} is immune to ${monsterName}'s ${actionName} (granted by a previous successful save or a previous effect ending). No save rolled, nothing spent.</p></div>`;
}

// MA-0054: a Spellcasting cast has no authored damage_type on the row —
// prefer the spell's own spells.json damage type (e.g. Shatter Thunder).
function savePrimaryDamageType(spellDamageType, action, getDamageTypesForAction) {
  return spellDamageType || getDamageTypesForAction(action)[0] || null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAbilitySaveRollContext({ monsterName, target, spellName, action, saveType, dcSuccess, saveDamageFormula, saveConditions, usesGate, prerequisite, getDamageTypesForAction, spellDamageType, animalSpiritVariant = null, animalSpiritFortifyHp = null, conditionDurationNote = null }) {
  const primaryDamageType = savePrimaryDamageType(spellDamageType, action, getDamageTypesForAction);
  const actionName = spellName || action.name;
  const saveEffect = action?.save_effect ?? null;
  return {
    attackerName: monsterName,
    targetName: target?.name,
    actionName,
    spellName,
    saveDc: action.save_dc,
    saveType,
    dcSuccess,
    autoDamageFormula: saveDamageFormula,
    autoDamageDamageType: saveDamageFormula && primaryDamageType ? formatDamageTypes([primaryDamageType]) : null,
    autoDamageName: actionName,
    // MA-0427: dual-damage block-save rows (Brazen Gorgon Smelting Charge
    // "Failure: 2d8 + 4 Piercing damage plus 3d8 Fire damage") — the authored
    // secondary rides the save context to saveProcessing.applySaveDamage,
    // which rolls it as its own save-damage leg and halves it on a successful
    // save exactly like the primary (dc_success semantics apply to both legs).
    ...buildSecondaryDamageTransport(action, actionName),
    saveConditions,
    isSpellDamage: !!spellName,
    consumeMemoriesClause: !!prerequisite,
    // MA-0020: spend marker lands at prompt-confirm (saveProcessing); the
    // until-clause rides the condition meta as a GM-enforced durationNote.
    monsterAbilityUse: usesGate ? { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName } : undefined,
    conditionDurationNote,
    // MA-0030: authored success-immunity clause (granted at save success in saveProcessing).
    successImmunity: action?.success_immunity || null,
    // MA-0048: authored repeat-save clause (Frightful Presence) — arm the
    // turn-end repeat-save marker at the failed-save seam in saveProcessing.
    repeatSave: action?.repeat_save || null,
    // MA-0501: Cockatrice staged petrify ladder (Restrained → turn-END repeat
    // save → Petrified 24h) — arm for the saveProcessing failed-save seam.
    stagedPetrify: parseStagedPetrifyClause(action),
    // MA-0038: authored failed-save concentration-disadvantage clause
    // (Cloud of Insects) — te producer arm for saveProcessing on a fail.
    concentrationDisadvantage: parseConcentrationDisadvantageClause(saveEffect),
    // MA-0073: authored failed-save speed-halved clause (Scorching Sands) —
    // speed_half te producer arm for saveProcessing on a fail.
    speedHalf: parseSpeedHalfClause(saveEffect),
    // MA-0093: authored failed-save subtract-die debuff clause (Giggling
    // Magic) — giggling_magic_debuff te producer arm for saveProcessing.
    subtractDebuff: parseSubtractDieClause(saveEffect),
    // MA-0104: authored failed-save demiplane-transport clause (Banish) —
    // banished_demiplane te producer arm for saveProcessing on a fail.
    demiplaneTransport: parseBanishTransportClause(saveEffect),
    // MA-0107: authored failed-save dream-plane banishment clause (Adult Gold
    // Dragon lair action) — lair_dream_plane te producer arm for
    // saveProcessing on a fail (MA-0104 shape).
    dreamPlaneBanishment: parseDreamPlaneBanishClause(saveEffect),
    // MA-0115: authored failed-save AC-penalty clause (Noxious Miasma
    // "−2 penalty to AC until the end of its next turn") — ac_penalty te
    // producer arm for saveProcessing on a fail (MA-0073 shape).
    acPenaltyClause: parseAcPenaltyClause(saveEffect),
    // MA-0146: authored failed-save speed-zero clause (Adult White Dragon
    // Freezing Burst "the target's Speed is 0 until the end of the target's
    // next turn") — speed_zero producer arm for saveProcessing on a fail
    // (MA-0073 shape; the sphere row normally routes through the radius
    // picker, which carries its own speedZeroClause seam).
    speedZeroClause: parseSpeedZeroClause(saveEffect),
    // MA-0275: Animal Spirit GM-chosen variant (chooser at chip-click;
    // 'fortify' | 'marked_as_prey' | 'pesky_swarm' | null) — producer arm
    // for the EITHER-outcome grant in saveProcessing.
    animalSpiritVariant,
    animalSpiritFortifyHp,
    // MA-0352: authored HP-threshold kill clause (Banshee Deathly Wail —
    // "If the target has 25 Hit Points or fewer, it drops to 0 Hit Points")
    // — numeric threshold arm for the failed-save threshold-kill seam in
    // saveProcessing.applySaveDamage. Byte-inert null for every clauseless row.
    hpThresholdKill: parseHpThresholdKillClause(action),
    // MA-0367: Infernal Glaive structured wound key — infernal_wound te
    // producer arm for the saveProcessing/save-result failed-save seams
    // (block-save path; combo attack+save rides buildSaveOptions).
    infernalWound: parseInfernalWoundClause(action),
    // MA-0374: Beholder Eye Rays — the picked ray's structured grant spec
    // (te_grants/clock_rounds/ladder/zero_hp_clause) rides the save context
    // for the saveProcessing failed-save dispatcher + zero-HP advisory.
    // Byte-inert null for every row without an authored rays[] picker.
    eyeRay: parseEyeRayGrant(action),
  };
}

function buildMonsterSpellRefusalEntry({ monsterName, spellName, usesMax }) {
  return {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: spellName,
    description: `${monsterName} has already cast ${spellName} today (${usesMax}/Day) — ${spellName} refused. Uses reset at a long rest; GM-enforced for monsters.`,
    timestamp: Date.now(),
  };
}

function resolveTwoHandedVariantSelection({ popupHtml, decision, monsterName, campaignName, setPopupHtml }) {
  const offer = popupHtml?.twoHandedVariantOffer;
  if (!offer || popupHtml?.twoHandedVariantResolved) return;
  const attackPopupSnapshot = popupHtml;
  if (decision === 'two-handed') {
    const autoDamage = attackPopupSnapshot.autoDamage
      ? { ...attackPopupSnapshot.autoDamage, formula: offer.formula, twoHandedChoice: 'two-handed' }
      : attackPopupSnapshot.autoDamage;
    addEntry(campaignName, buildTwoHandedVariantSelectLog({ monsterName, offer, hands: 'two-handed' }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging two-handed variant selection:', e); });
    setPopupHtml({ ...attackPopupSnapshot, autoDamage, twoHandedVariantResolved: 'two-handed' });
    return;
  }
  if (decision === 'one-handed') {
    const autoDamage = attackPopupSnapshot.autoDamage
      ? { ...attackPopupSnapshot.autoDamage, twoHandedChoice: 'one-handed' }
      : attackPopupSnapshot.autoDamage;
    addEntry(campaignName, buildTwoHandedVariantSelectLog({ monsterName, offer, hands: 'one-handed' }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging one-handed variant selection:', e); });
    setPopupHtml({ ...attackPopupSnapshot, autoDamage, twoHandedVariantResolved: 'one-handed' });
  }
}

// MA-0436: band advisory for the chosen RANGED mode (gridless-lenient,
// playbook §42): measures token distance against the authored "N/M" band only
// when a map places both tokens; the mode CHOICE is the enforced part.
function buildRangedBandNote({ offer, mapData, monsterName, target }) {
  if (!offer?.normalFt) return null;
  if (!mapData || !target) return `Range band ${offer.range} ft — no map position: advisory (GM-enforced).`;
  const attackerPlaced = (mapData.placedItems || []).find(i => i.name === monsterName) || null;
  const targetPos = resolveTargetGridPos(mapData, target, attackerPlaced);
  if (!attackerPlaced || !targetPos) return `Range band ${offer.range} ft — tokens unplaced: advisory (GM-enforced).`;
  const distanceFt = Math.round(getDistanceFeet({ gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY }, targetPos));
  if (distanceFt <= offer.normalFt) return `Distance ${distanceFt} ft — within normal range (${offer.normalFt} ft).`;
  if (distanceFt <= offer.longFt) return `Distance ${distanceFt} ft — long range (${offer.normalFt}/${offer.longFt} ft): disadvantage GM-enforced.`;
  return `Distance ${distanceFt} ft — beyond ${offer.longFt} ft: out of range, GM-enforced.`;
}

function resolveRangedVariantSelection({ popupHtml, decision, monsterName, campaignName, setPopupHtml, mapData, getTarget }) {
  const offer = popupHtml?.rangedVariantOffer;
  if (!offer || popupHtml?.rangedVariantResolved) return;
  const attackPopupSnapshot = popupHtml;
  if (decision === 'ranged') {
    const autoDamage = attackPopupSnapshot.autoDamage
      ? { ...attackPopupSnapshot.autoDamage, formula: offer.formula, rangedChoice: 'ranged' }
      : attackPopupSnapshot.autoDamage;
    const rangeNote = buildRangedBandNote({ offer, mapData, monsterName, target: getTarget?.() });
    addEntry(campaignName, buildRangedVariantSelectLog({ monsterName, offer, mode: 'ranged', rangeNote }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging ranged variant selection:', e); });
    setPopupHtml({ ...attackPopupSnapshot, autoDamage, rangedVariantResolved: 'ranged' });
    return;
  }
  if (decision === 'melee') {
    const autoDamage = attackPopupSnapshot.autoDamage
      ? { ...attackPopupSnapshot.autoDamage, rangedChoice: 'melee' }
      : attackPopupSnapshot.autoDamage;
    addEntry(campaignName, buildRangedVariantSelectLog({ monsterName, offer, mode: 'melee' }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging melee variant selection:', e); });
    setPopupHtml({ ...attackPopupSnapshot, autoDamage, rangedVariantResolved: 'melee' });
  }
}

// An unpicked popup Done records the default variant so every variant
// resolution logs its choice (MA-0325 one-handed, MA-0436 melee).
function logUnpickedVariantDefaults({ campaignName, monsterName, autoDamage }) {
  if (autoDamage.twoHandedVariantOffer && autoDamage.twoHandedChoice === 'one-handed-default') {
    addEntry(campaignName, buildTwoHandedVariantSelectLog({ monsterName, offer: autoDamage.twoHandedVariantOffer, hands: 'one-handed', defaulted: true }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging two-handed default:', e); });
  }
  if (autoDamage.rangedVariantOffer && autoDamage.rangedChoice === 'melee-default') {
    addEntry(campaignName, buildRangedVariantSelectLog({ monsterName, offer: autoDamage.rangedVariantOffer, mode: 'melee', defaulted: true }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging ranged variant default:', e); });
  }
}

function MonsterAttackPopup({ popupHtml, campaignName, monsterName, setPopupHtml, onQuickRoll, onChargeBonus, onChargeBonusDecline, onTwoHandedVariant, onRangedVariant }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <AttackResultPopup
        popupHtml={popupHtml}
        onClose={() => setPopupHtml(null)}
        campaignName={campaignName}
        attackerName={monsterName}
        setPopupHtml={setPopupHtml}
        onQuickRoll={popupHtml.waitingForPlayerSave ? () => onQuickRoll(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined}
        onChargeBonus={onChargeBonus}
        onChargeBonusDecline={onChargeBonusDecline}
        onTwoHandedVariant={onTwoHandedVariant}
        onRangedVariant={onRangedVariant}
      />
    </div>
  );
}

function MonsterCardModal({ monster, onClose, campaignName, creatures, creatureName, mapName, characters }) {
  const monsterName = creatureName || monster?.name || 'Monster';
  const creatureTempHp = getRuntimeValue(monsterName, 'tempHp', campaignName) || 0;
  const fallbackCsRef = useRef(null);
  const [mapData, setMapData] = useState(null);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const [showAllyModal, setShowAllyModal] = useState(false);
  const [allyModalCreatures, setAllyModalCreatures] = useState([]);
  const storedAllies = useRuntimeValue(monsterName, 'selectedAllies', campaignName);
  const currentAllies = resolveCurrentAllies(storedAllies, monsterName);
  const pendingSaveRef = useRef(null);

  useEffect(() => {
    if (creatures) return;
    getCombatContext(campaignName).then(cs => {
      if (cs) fallbackCsRef.current = cs;
    });
  }, [creatures, campaignName]);

  useEffect(() => {
    if (!mapName) {
      setMapData(null);
      return;
    }
    mapsService.loadMapData(campaignName, mapName).then(data => {
      setMapData(data);
    }).catch(() => {
      setMapData(null);
    });
  }, [campaignName, mapName]);

  const storedTargetEffects = useRuntimeValue('campaign', 'targetEffects');
  const allTargetEffects = useMemo(() => storedTargetEffects ?? [], [storedTargetEffects]);
  const monsterTargetEffects = allTargetEffects.filter(te => te.target === (creatureName || monster?.name));
  const inspiringMoveNoOA = useRuntimeValue(monsterName, 'inspiringMovementNoOA', campaignName);
  const remarkableNoOA = useRuntimeValue(monsterName, 'remarkableAthleteNoOA', campaignName);
  const monsterCharacter = characters?.find(c => c.name === monsterName);
  const speedyOpportunityDisadvantage = hasMonsterPassive(monsterCharacter, 'opportunity_attacks_disadvantage');
  const speedyDifficultTerrainIgnore = hasMonsterPassive(monsterCharacter, 'ignore_difficult_terrain_on_dash');
  const monsterActiveBuffs = getRuntimeValue(monsterName, 'activeBuffs') || [];
  const shieldOfFaithBonus = computeShieldOfFaithBonus(monsterActiveBuffs);
  const monsterSpellUses = useRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY, campaignName);
  const monsterReactionUses = useRuntimeValue(monsterName, MONSTER_REACTION_USES_KEY, campaignName);
  // MA-0021: legendary uses map + round+turn latch subscription (header
  // counter reads used/max; the latch gates one-expend-per-turn server-side).
  const monsterLegendaryUses = useRuntimeValue(monsterName, 'monsterLegendaryUses', campaignName);
  // MA-0031: recharge map + cone picker overlay state (breath-weapon AoE).
  const monsterRecharge = useRuntimeValue(monsterName, MONSTER_RECHARGE_KEY, campaignName);
  const [conePicker, setConePicker] = useState(null);
  const [animalSpiritChooser, setAnimalSpiritChooser] = useState(null);

  const monsterSensesArray = useMemo(() => {
    if (!monster?.senses) return null;
    const senses = [];
    const senseMap = {
      blindsight: 'Blindsight',
      darkvision: 'Darkvision',
      truesight: 'Truesight',
      tremorsense: 'Tremorsense',
    };
    for (const [key, value] of Object.entries(monster.senses)) {
      const label = senseMap[key];
      if (label && value != null) {
        senses.push({ name: label, value: `${value} ft.` });
      }
    }
    return senses.length > 0 ? senses : null;
  }, [monster]);

  const handleAllyModalOpen = () => {
    const combatSummary = getCombatSummary(campaignName);
    const targets = combatSummary?.creatures?.map(c => ({
      name: c.name,
      type: c.type,
      currentHp: c.currentHp,
      maxHp: c.maxHp,
    })) || [];
    setAllyModalCreatures(targets);
    setShowAllyModal(true);
  };

  const handleAllyModalConfirm = async (selectedAllies) => {
    setShowAllyModal(false);
    setRuntimeValue(monsterName, 'selectedAllies', selectedAllies, campaignName);
    await addEntry(campaignName, {
      type: 'ability_use',
      characterName: monsterName,
      abilityName: 'Ally Selection',
      description: `${monsterName} selected allies: ${selectedAllies.join(', ')}`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[MonsterCardModal] Error logging ally selection:', e); });
  };

  const handleAllyModalCancel = () => {
    setShowAllyModal(false);
  };

  const { popupHtml, setPopupHtml, rollAttack, rollDamage, rollAbilityCheck, rollSavingThrow, rollSkillCheck, rollInitiative, quickRollPlayerSave } = useLoggedDiceRoll(
    monsterName,
    campaignName,
    {
        autoDamageSource: monsterName,
        autoDamageRoll: async (autoDamage, isCrit) => {
          if (!autoDamage) {
            logBlockedDamageRoll(campaignName, monsterName, monsterName, null);
            setPopupHtml(null);
            return;
          }
          const target = getTarget();
          const wasCrit = isCrit || autoDamage.isAutoCrit;
          const result = resolveAutoDamageResult(autoDamage.formula, wasCrit);
          if (result) {
            const context = {
              damageType: autoDamage.damageType,
              targetName: target?.name,
              attackerName: autoDamage.attackerName || monsterName,
              isAutoCrit: wasCrit,
            };
            if (autoDamage.saveDc != null) {
              context.saveDc = autoDamage.saveDc;
              context.saveType = autoDamage.saveType;
              context.dcSuccess = autoDamage.dcSuccess;
            }
            // MA-0298: combo attack+save legs carry the trap arm + fail
            // conditions + repeat-save clause to the save-result seam.
            Object.assign(context, comboTrapArmsFrom(autoDamage));
            if (autoDamage.secondaryFormula) {
              context.autoDamageSecondaryFormula = autoDamage.secondaryFormula;
              context.autoDamageSecondaryName = autoDamage.secondaryName || autoDamage.name;
              context.autoDamageSecondaryDamageType = autoDamage.secondaryDamageType;
            }
            if (autoDamage.overchannelActive) {
              context.overchannelActive = autoDamage.overchannelActive;
              context.overchannelUseCount = autoDamage.overchannelUseCount;
              context.overchannelSpellLevel = autoDamage.overchannelSpellLevel;
            }
            if (autoDamage.hitClause) {
              context.hitClause = autoDamage.hitClause;
            }
            logUnpickedVariantDefaults({ campaignName, monsterName, autoDamage });
            rollDamage({ name: autoDamage.name, formula: autoDamage.formula, total: result.total, rolls: result.rolls, modifier: result.modifier, context: context });
          } else {
            logBlockedDamageRoll(campaignName, monsterName, autoDamage.name || monsterName, autoDamage.formula);
          }
          setPopupHtml(null);
        },
       characters,
     }
  );

  const getAttackerCreature = useCallback(() => {
    if (creatures) {
      return findCreatureByName({ creatures }, monsterName);
    }
    const cs = fallbackCsRef.current;
    return cs ? findCreatureByName(cs, monsterName) : null;
  }, [creatures, monsterName]);

  const getTarget = useCallback(() => {
    if (!creatures) {
      const cs = fallbackCsRef.current;
      return cs ? getTargetFromAttacker(cs, monsterName) : null;
    }
    const attacker = findCreatureByName({ creatures }, monsterName);
    if (!attacker || !attacker.targetName) return null;
    return creatures.find(c => c.name === attacker.targetName) || null;
  }, [creatures, monsterName]);

  const getDamageTypesForAction = useCallback((action) => {
    const types = [];
    if (action.damage_type_primary) {
      types.push(action.damage_type_primary);
    }
    if (action.damage_type_secondary) {
      types.push(action.damage_type_secondary);
    }
    if (types.length === 0) {
      types.push(...extractDamageTypes(action.description));
    }
    return types;
  }, []);

  const handleAttack = (name, bonus, action) => {
    // MA-0294: recharge gate on ATTACK-roll rows (Ape Rock Recharge 6) —
    // mirrors the block-save seam exactly: a spent row refuses with popup +
    // `<action-slug>_refused (not recharged)` log, zero roll zero spend;
    // gate-bearing rows spend the recharge on fire (same MONSTER_RECHARGE_KEY
    // semantics; turn-start d6 recovery already rides rollMonsterRecharges
    // via the turnStartEffects seam for spent markers). Gateless rows and
    // synthesized spell-attack actions (no recharge) are byte-inert.
    const recharge = rechargeRefusalOnSpent({ action, spellInfo: null, monsterName, campaignName, setPopupHtml });
    if (recharge.refused) return;
    const target = getTarget();
    if (psychicStrikePreconditionFailed(name, target, allTargetEffects)) return;

    const primaryDamageType = action?.damage_type_primary ? [action.damage_type_primary] : [];
    const attackRange = resolveAttackRange(action);
    const isMeleeAttack = attackRange <= 5;

    const { grazeDamage, grazeAbilityMod } = computeGrazeSettings(isMeleeAttack, monsterCharacter);
    const { targetComputed, resistanceNotice } = resolveTargetDefense(target, creatures, primaryDamageType);

    const attackerConditions = extractConditionKeys(getAttackerCreature());
    const targetConditions = extractConditionKeys(target);

    const targetSaveModifiers = resolveTargetSaveModifiers(target, targetComputed);

    const attackerEffects = computeConditionEffects({ conditions: attackerConditions, saveModifiers: targetSaveModifiers, targetEffects: monsterTargetEffects, attackerSenses: monsterSensesArray })
    if (resolveAttackerActionBlock(attackerConditions, monsterTargetEffects, campaignName, monsterName, name)) return;

    const targetEffectData = buildTargetEffectData({ target, targetComputed, targetConditions, targetSaveModifiers, allTargetEffects, campaignName, getAttackerCreature });

    const effectiveBonus = bonus + (targetEffectData.riderAttackBonus || 0);

    const forcedMode = combineAttackModes(attackerEffects, targetEffectData, attackRange, target?.name);

    const isMelee = attackRange <= 5
    const isAutoCrit = isMelee && targetEffectData.autoCritWithin5ft

    const { isAutoMiss, rangeReason, rangeForcedMode } = computeMapRangeState(mapData, target, monsterName, attackRange);
    const { coverAcBonus, coverLevel, coverReason } = computeCoverState(isAutoMiss, target, characters, mapData, campaignName);

    // MA-0294: recharge fire-spend, mirroring the save-path picker-open
    // spend (CLA-384) — same map-write recipe, only for gate rows.
    if (recharge.gate) {
      spendMonsterRecharge({ monsterName, action, campaignName })
        .catch((e) => { console.error('[MonsterCardModal] Error spending attack recharge:', e); });
    }

    rollAttack(name, effectiveBonus, buildAttackRollOptions({
      action,
      name,
      target,
      monsterName,
      primaryDamageType,
      resistanceNotice,
      forcedMode,
      rangeForcedMode,
      isMelee,
      isAutoCrit,
      isAutoMiss,
      rangeReason,
      coverAcBonus,
      coverLevel,
      coverReason,
      grazeDamage,
      grazeAbilityMod,
    }));
  };

  // MA-0033: handleSpellCast (useCallback) must not depend on the
  // un-memoized attack seam handler — the ref keeps the callback stable.
  const rollHandlerRef = useRef(null);
  rollHandlerRef.current = handleAttack;

  const handleDamage = (name, formula, damageType, action) => {
    const target = getTarget();
    const wasCrit = popupHtml?.isCrit;
    if (wasCrit && setPopupHtml) setPopupHtml(null);
    const result = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
    if (result) {
      const context = {
        damageType,
        targetName: target?.name,
        attackerName: monsterName,
      };
      if (action?.save_dc != null) {
        context.saveDc = action.save_dc;
        context.saveType = toAbbr(action.save_type);
        context.dcSuccess = action?.dc_success ?? 'half';
      }
      rollDamage({ name: name, formula: formula, total: result.total, rolls: result.rolls, modifier: result.modifier, context: context });
    } else {
      logBlockedDamageRoll(campaignName, monsterName, name, formula);
    }
  };

  const handleAbilityCheck = (abbr, mod) => {
    const fullName = abilityNameMap[abbr] || abbr.toUpperCase();
    const context = rayDisadvantageContext(abbr === 'str' && hasStrTestDisadvantageOn(monsterTargetEffects, monsterName));
    rollAbilityCheck(fullName, mod, context);
  };

  const handleSaveThrow = (ability, mod) => rollSavingThrow(saveAbilityAbbr(ability), mod);

  const handleSkillCheck = (name, mod) => {
    const context = rayDisadvantageContext(name === 'Athletics' && hasStrTestDisadvantageOn(monsterTargetEffects, monsterName));
    rollSkillCheck(name, mod, context);
  };

  const handleInitiative = (bonus) => rollInitiative(bonus);

  const handleSaveRoll = useCallback((action, saveDamageFormula, saveConditions, spellInfo) => {
    const target = getTarget();
    // MA-0030: authored success-immunity gate — target already immune to this
    // monster's gaze (te sourced from this monster) → refusal, zero prompt.
    if (gazeImmunityActive({ action, target, monsterName, targetEffects: allTargetEffects })) {
      setPopupHtml(buildGazeImmunityRefusalPopup({ monsterName, actionName: action.name, targetName: target?.name }));
      addEntry(campaignName, buildGazeImmunityRefusalLog({ monsterName, actionName: action.name, targetName: target?.name || 'no target' }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging gaze-immunity refusal:', e); });
      return;
    }
    const gate = evaluateTargetPrerequisiteGate({ action, target, monsterName, campaignName, getRuntimeValue });
    if (!gate.satisfied) {
      setPopupHtml(gate.popupHtml);
      addEntry(campaignName, gate.refusalLog)
        .catch((e) => { console.error('[MonsterCardModal] Error logging prerequisite refusal:', e); });
      return;
    }
    const prerequisite = gate.prerequisite;
    const { refused, usesGate } = resolveAbilityUsesGate({ action, spellInfo, monsterName, campaignName, setPopupHtml });
    if (refused) return;
    // MA-0268: staged_roar row (Androsphinx Roar) — the Nth click resolves
    // ONLY the Nth roar's canonical legs (1 frightened / 2 deaf+frightened,
    // both zero-damage WIS with turn-END repeat saves; 3 CON 8d10 thunder
    // half-on-success + prone), swapped by the persisted MA-0020 spend
    // counter. Byte-inert null for every other row.
    const roarAction = resolveRoarStageAction({ action, usesGate });
    const stageAction = roarAction || action;
    const stageFormula = roarAction ? extractDamageDiceFromDescription(stageAction.description, stageAction.damage_dice_primary) : saveDamageFormula;
    const stageConditions = roarAction ? extractConditionsFromSaveEffect(stageAction.save_effect) : saveConditions;
    // MA-0275: Animal Spirit variant trio — open the form chooser before any
    // save prompt; the chooser confirmation runs the same block-save seam
    // with the chosen variant threaded onto the save context.
    const spiritVariants = parseAnimalSpiritVariants(stageAction);
    if (spiritVariants) {
      setAnimalSpiritChooser({ action: stageAction, spellInfo, saveDamageFormula: stageFormula, saveConditions: stageConditions, prerequisite, usesGate, target, ...spiritVariants });
      return;
    }
    // MA-0374/MA-0383: Eye Rays — structured rays[] + len(rays) picker
    // (RAW random ray, reroll-if-used-this-turn; d10 Beholder, d4 Beholder
    // Zombie) — the picked ray's own single-ability save leg runs
    // downstream; never the "VARIES" shell.
    if (Array.isArray(stageAction.rays) && stageAction.rays.length > 0) {
      resolveEyeRayFire({ action: stageAction, monsterName, campaignName, target, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, prerequisite, usesGate, setPopupHtml })
        .catch((e) => { console.error('[MonsterCardModal] Error resolving Eye Rays picker:', e); });
      return;
    }
    // MA-0031: recharge gate + fire-spend + cone routing live downstream.
    executeBlockSaveRoll({ action: stageAction, spellInfo, saveDamageFormula: stageFormula, saveConditions: stageConditions, monsterName, campaignName, target, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, prerequisite, usesGate, setPopupHtml });
  }, [getTarget, characters, creatures, rollSavingThrow, monsterName, getDamageTypesForAction, campaignName, setPopupHtml, allTargetEffects]);

  const handleSpellCast = useCallback(async (action, spellName) => {
    const gate = spellUsesGate(monsterName, action, spellName);
    if (gate.exhausted) {
      await addEntry(campaignName, buildMonsterSpellRefusalEntry({ monsterName, spellName, usesMax: gate.usesMax }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging monster spell refusal:', e); });
      return;
    }
    const spell = await findMonsterSpell(spellName);
    if (!spell) {
      console.error(`[MonsterCardModal] Spell '${spellName}' not found in spells.json (5e or 2024)`);
    }
    // MA-0033: attack-roll spells validate BEFORE any uses spend, then roll
    // through the attack seam — never the block-save prompt.
    const attackPlan = spell && isSpellAttackSpell(spell)
      ? resolveSpellAttackPlan({ spell, spellName, action, target: getTarget(), spellCastLogBase: `${monsterName} casts ${spellName} via Spellcasting` })
      : null;
    if (attackPlan && !attackPlan.ok) {
      await refuseMonsterSpellAttack({ monsterName, spellName, reason: attackPlan.reason, campaignName, setPopupHtml });
      return;
    }
    // MA-0348: damageless single-target save spells (Hold Person: own dc_type,
    // no area_of_effect, "must succeed … or be paralyzed" in the spell text)
    // route through the save-prompt seam too — the DC is authored on the row
    // (MA-0237/0318/0328 data pattern) and the condition lands via the
    // MA-0017 applyFailedSaveConditions leg. Zone/utility spells without a
    // damage-or-condition save clause stay advisory (CLA-325).
    const saveLegCondition = spellHasDamage(spell) ? null : spellDamagelessSaveCondition(spell);
    const routesToSave = spellHasDamage(spell) || Boolean(saveLegCondition);
    // MA-0276: attack and advisory paths emit their own ability_use cast log
    // carrying the usesNote — only the block-save path needs the spend log.
    const skipSpendLog = Boolean(attackPlan) || !routesToSave;
    const usesNote = await spendMonsterSpellUseIfNeeded({ gate, monsterName, spellName, campaignName, skipLog: skipSpendLog });
    if (attackPlan) {
      await executeMonsterSpellAttackCast({ monsterName, spellName, plan: attackPlan, usesNote, campaignName, handleAttack: rollHandlerRef.current });
      return;
    }
    if (routesToSave) {
      executeMonsterSaveSpellCast({ spell, spellName, action, handleSaveRoll, saveLegCondition });
      return;
    }
    // CLA-325 advisory model (GM-enforced for monsters): a non-damage utility spell
    // (e.g. Gust of Wind) records a spell-named cast + concentration marker and logs it;
    // there is no wind-line/zone engine consumer, so the effect is adjudicated by the GM.
    await addEntry(campaignName, buildMonsterSpellCastEntry({ monsterName, spellName, spell, action, usesNote }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging monster spell cast:', e); });
  }, [campaignName, monsterName, handleSaveRoll, getTarget, setPopupHtml]);

  // MA-0006: gated monster reactions (Feather Fall 1/Day) — consumer of the
  // CLA-315 campaign lastAttack `trigger:'falling'` seam on the monster-card
  // path. Refusals log <effect>_refused and spend nothing; a successful use
  // spends 1/day with an ability_use log. Fall-damage negation is an
  // advisory record (GM-enforced for monsters, CLA-325 precedent — the app
  // has no fall-damage pipeline).
  // MA-0013: Counterspell (2/Day) routes through the same helper — gates on a
  // spell-origin campaign lastAttack by a PC attacker, resolves the CLA-322
  // check (level <3 auto; ≥3 d20+WIS vs DC 10+level) and stamps the triggering
  // cast resolved so the same cast can't be double-countered.
  const spellAbilityMod = monsterSpellcastingMod(monster);

  const handleGatedReaction = useCallback(async (action) => {
    if (!getGatedMonsterReaction(action)) return;
    const result = await resolveMonsterGatedReaction({
      action,
      monsterName,
      campaignName,
      // MA-0467: getTarget arms the Healing Touch touch target (the card's
      // armed target-select); the resolver falls back to self unarmed.
      deps: { resolveSpellLevel: resolveGatedSpellLevel, spellAbilityMod, getTarget },
    });
    // MA-0399: Split — the resolver's popupHtml carries the trigger verdict
    // plus the GM duplication instruction; refusals surface the honest message.
    if (result?.popupHtml) setPopupHtml(result.popupHtml);
  }, [campaignName, monsterName, spellAbilityMod, getTarget, setPopupHtml]);

  // MA-0021: legendary-row gated click — expend 1 use (round+turn latch,
  // refusal popup + legendary_use_refused zero-spend log) then resolve the
  // row's own mechanic as today (numeric chips roll via the existing
  // handlers, MA-0014 chip gate intact; non-numeric rows log the advisory).
  const handleLegendaryRow = (action) => resolveLegendaryRow({
    action, monsterName, monster, campaignName, setPopupHtml, handleAttack, handleSaveRoll, handleDamage,
    handleCheck: handleSkillCheck,
  });

  // MA-0024: lair-row gated click — mirrors the legendary gated-row model.
  // Save rows resolve through the untouched block-save seam (authored DC/
  // type, half-on-success math, MA-0017 damageless-condition leg for the
  // Grasping Tide prone); advisory rows (phantasmal force) log a spell-named
  // ability_use record (CLA-325 — GM-enforced initiative-20 cadence + 24h
  // immunity, no illusion-engine consumer); unresolvable rows refuse with a
  // lair_action_refused log and zero effect.
  // MA-0043: a save-less authored zone row (Shroud of Darkness) opens the
  // same area picker in zoneOnly mode — confirm arms the zone te + tracking
  // key and logs, but rolls NO save (canonical darkness lair = no save) and
  // applies NO damage. Light/darkvision/dispel adjudication stays advisory
  // (§7 no light model).
  const handleLairZone = useCallback((action) => {
    const radiusFt = Number(action.zone?.radius_ft) || 0;
    setConePicker({ action, saveDamageFormula: null, saveConditions: [], saveType: null, dcSuccess: null, coneFt: radiusFt, rangeGateFt: null, title: `${radiusFt}-ft radius (GM positions; selection advisory)`, damageType: null, zoneTe: zoneTeForAction(action), zoneOnly: true });
  }, []);

  const handleLairRow = (action) => resolveLairRow({
    action,
    monsterName,
    campaignName,
    setPopupHtml,
    handleSaveRoll,
    handleAttack,
    handleDamage,
    handleZone: handleLairZone,
    saveDamageFormula: extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary),
    saveConditions: extractConditionsFromSaveEffect(action?.save_effect),
  });

  // MA-0007: GM-adjudicated charge-damage clause (monsters.json conditional_damage).
  // Grant: roll the clause dice, apply as its own damage roll + hp_change, log the
  // clause. Decline: base damage only, logged. Base "Done" still applies the primary
  // formula in both cases. No offer is rendered on misses (gated in DiceRollResult).
  const resolveChargeBonus = useCallback(async (decision) => {
    const offer = popupHtml?.chargeBonusOffer;
    if (!offer || popupHtml?.chargeBonusResolved) return;
    const attackPopupSnapshot = popupHtml;
    if (decision === 'granted') {
      const target = getTarget();
      const wasCrit = Boolean(attackPopupSnapshot.isCrit || attackPopupSnapshot.isAutoCrit);
      const result = wasCrit ? rollExpressionDoubled(offer.formula) : rollExpression(offer.formula);
      if (!result) {
        console.error('[MonsterCardModal] Charge bonus roll failed for formula', offer.formula);
        return;
      }
      await rollDamage({
        name: `${offer.attackName} — Charge Bonus`,
        formula: offer.formula,
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier,
        context: { damageType: offer.damageType, targetName: target?.name, attackerName: monsterName, isAutoCrit: wasCrit },
      });
      await addEntry(campaignName, buildChargeBonusGrantLog({ monsterName, offer, total: result.total }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging charge bonus grant:', e); });
      setPopupHtml({ ...attackPopupSnapshot, chargeBonusResolved: 'granted' });
      return;
    }
    await addEntry(campaignName, buildChargeBonusDeclineLog({ monsterName, offer }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging charge bonus decline:', e); });
    setPopupHtml({ ...attackPopupSnapshot, chargeBonusResolved: 'declined' });
  }, [popupHtml, getTarget, rollDamage, setPopupHtml, campaignName, monsterName]);

  const attackerCannotAct = useMemo(() => {
    const creature = getAttackerCreature();
    if (!creature) return false;
    return (creature.conditions || []).some(c => CONDITIONS_THAT_CANNOT_ACT.has(c.key));
  }, [getAttackerCreature]);

  // SP-111: Stinking Cloud's "can't take an Action or Bonus Action" rider —
  // blocks Actions/Traits/Legendary rows but NOT Reactions (those stay
  // gated solely by the condition-based attackerCannotAct above).
  const attackerActionBlocked = attackerCannotAct
    || monsterTargetEffects.some(te => te.effect === 'no_action_and_bonus_action');

  const hasShareableEvasionForSave = useCallback((saveType) => {
    if (!saveType || !characters) return false;
    const normalizedSaveType = normalizeSaveType(saveType);
    return characters.some(c => {
      const ev = c?.computedStats?.evasionEffects;
      return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
    });
  }, [characters]);

  const handleQuickRollWithEvasion = useCallback((promptId, targetName, saveType, saveDc) => {
    const pendingSave = { promptId, targetName, saveType, saveDc };
    const hasEvasion = hasShareableEvasionForSave(saveType);
    if (hasEvasion) {
      pendingSaveRef.current = pendingSave;
      setEvasionSelection([]);
    } else {
      quickRollPlayerSave(promptId, targetName, saveType, saveDc);
    }
  }, [hasShareableEvasionForSave, quickRollPlayerSave]);

  const handleEvasionConfirm = useCallback((selectedNames) => {
    if (!pendingSaveRef.current) return;
    const { promptId, targetName, saveType, saveDc } = pendingSaveRef.current;
    const selectedAllies = new Set(selectedNames);
    quickRollPlayerSave(promptId, targetName, saveType, saveDc, selectedAllies);
    setEvasionSelection(null);
    pendingSaveRef.current = null;
  }, [quickRollPlayerSave]);

  const handleEvasionSkip = useCallback(() => {
    if (!pendingSaveRef.current) return;
    const { promptId, targetName, saveType, saveDc } = pendingSaveRef.current;
    quickRollPlayerSave(promptId, targetName, saveType, saveDc);
    setEvasionSelection(null);
    pendingSaveRef.current = null;
  }, [quickRollPlayerSave]);

  if (!monster) return null;

  return (
    <>
    <div className={`mc-overlay${evasionSelection !== null ? ' mc-overlay--dimmed' : ''}`} onClick={onClose}>
      <MonsterCardBody
        monster={monster}
        monsterName={monsterName}
        onClose={onClose}
        creatureTempHp={creatureTempHp}
        shieldOfFaithBonus={shieldOfFaithBonus}
        handleInitiative={handleInitiative}
        handleAbilityCheck={handleAbilityCheck}
        handleSaveThrow={handleSaveThrow}
        handleSkillCheck={handleSkillCheck}
        attackerCannotAct={attackerCannotAct}
        attackerActionBlocked={attackerActionBlocked}
        handleAttack={handleAttack}
        handleDamage={handleDamage}
        handleSaveRoll={handleSaveRoll}
        handleSpellCast={handleSpellCast}
        handleAllyModalOpen={handleAllyModalOpen}
        currentAllies={currentAllies}
        monsterTargetEffects={monsterTargetEffects}
        inspiringMoveNoOA={inspiringMoveNoOA}
        remarkableNoOA={remarkableNoOA}
        speedyOpportunityDisadvantage={speedyOpportunityDisadvantage}
        speedyDifficultTerrainIgnore={speedyDifficultTerrainIgnore}
        getAttackerCreature={getAttackerCreature}
        campaignName={campaignName}
        characters={characters}
        creatures={creatures}
        monsterSpellUses={monsterSpellUses}
        monsterReactionUses={monsterReactionUses}
        monsterLegendaryUses={monsterLegendaryUses}
        monsterRecharge={monsterRecharge}
        handleGatedReaction={handleGatedReaction}
        handleLegendaryRow={handleLegendaryRow}
        handleLairRow={handleLairRow}
      />
      {popupHtml && (
        <MonsterAttackPopup
          popupHtml={popupHtml}
          campaignName={campaignName}
          monsterName={monsterName}
          setPopupHtml={setPopupHtml}
          onQuickRoll={handleQuickRollWithEvasion}
          onChargeBonus={() => resolveChargeBonus('granted')}
          onChargeBonusDecline={() => resolveChargeBonus('declined')}
          onTwoHandedVariant={(decision) => resolveTwoHandedVariantSelection({ popupHtml, decision, monsterName, campaignName, setPopupHtml })}
          onRangedVariant={(decision) => resolveRangedVariantSelection({ popupHtml, decision, monsterName, campaignName, setPopupHtml, mapData, getTarget })}
        />
      )}
    </div>
    {evasionSelection !== null && pendingSaveRef.current && (
      <MonsterEvasionModal
        evasionSelection={evasionSelection}
        setEvasionSelection={setEvasionSelection}
        creatures={creatures}
        monsterName={monsterName}
        handleEvasionConfirm={handleEvasionConfirm}
        handleEvasionSkip={handleEvasionSkip}
      />
    )}
    {showAllyModal && (
        <AllySelectionModal
          creatures={allyModalCreatures}
          currentAllies={currentAllies}
          onConfirm={handleAllyModalConfirm}
          onCancel={handleAllyModalCancel}
        />
      )}
      {conePicker && (
        <SaveAttackAoeModal
          action={conePicker.action}
          playerStats={{ name: monsterName }}
          campaignName={campaignName}
          range={conePicker.coneFt}
          damage={conePicker.saveDamageFormula}
          damageType={conePicker.damageType}
          saveType={conePicker.saveType}
          saveDc={conePicker.action.save_dc}
          dcSuccess={conePicker.dcSuccess}
          titleOverride={conePicker.title}
          excludeNames={[monsterName]}
          rangeGateFt={conePicker.rangeGateFt}
          zoneTe={conePicker.zoneTe}
          zoneOnly={conePicker.zoneOnly === true}
          saveConditions={conePicker.saveConditions}
          sleepStaging={conePicker.sleepStaging}
          stagedParalysis={conePicker.stagedParalysis}
          pushFeet={conePicker.pushFeet}
          slowedClauses={conePicker.slowedClauses}
          weakeningBreath={conePicker.weakeningBreath}
          acPenaltyClause={conePicker.acPenaltyClause}
          speedZeroClause={conePicker.speedZeroClause}
          bothOutcomesClause={conePicker.bothOutcomesClause}
          conditionDurationNote={conePicker.conditionDurationNote}
          storeLastAttack={false}
          onClose={() => setConePicker(null)}
        />
      )}
      <AnimalSpiritVariantModal
        chooser={animalSpiritChooser}
        monsterName={monsterName}
        onResolve={(variant) => resolveAnimalSpiritSelection({ chooser: animalSpiritChooser, variant, monsterName, campaignName, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, setPopupHtml, setChooser: setAnimalSpiritChooser })}
        onSkip={() => resolveAnimalSpiritSelection({ chooser: animalSpiritChooser, variant: null, monsterName, campaignName, creatures, characters, rollSavingThrow, setConePicker, getDamageTypesForAction, setPopupHtml, setChooser: setAnimalSpiritChooser })}
      />
    </>
  );
}

export default MonsterCardModal;
