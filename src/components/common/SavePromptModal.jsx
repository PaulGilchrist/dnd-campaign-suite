import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import utils from '../../services/ui/utils.js';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { dropPendingSavePrompt } from '../../services/automation/common/savePrompt.js';
import Subscriber from './Subscriber.jsx';
import CreatureBadge from './CreatureBadge.jsx';
import { getSaveDisadvantage, getHolyAuraSaveAdvantage, getHolyNimbusSaveAdvantage } from './savePromptUtils.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import { addEntry } from '../../services/ui/logService.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { stampLeadingEvasionSelections, clearLeadingEvasionSelection } from '../../services/rules/combat/evasionUtils.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import './SavePromptModal.css';
import { getPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { hasBuffEffect } from '../../services/automation/common/buffToggle.js';
import { useSaveRerollHandlers } from './useSaveRerollHandlers.js';
import { cancelInfernalWoundAfterSaveSuccess } from '../../services/rules/features/infernalWoundService.js';
import { consumeBurstOfIngenuityBuff } from '../../services/encounters/monsterBurstOfIngenuity.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';

const GUARDED_MIND_SAVE_TYPES = ['Intelligence', 'Wisdom', 'Charisma', 'INT', 'WIS', 'CHA'];

function hasShareableEvasionFor(current, characters) {
  if (current.dcSuccess !== 'half') return false;
  const normalizedSaveType = normalizeSaveType(current.saveType);
  return (characters || []).some(c => {
    if (utils.getName(c.name) === utils.getName(current.targetName)) return false;
    const ev = c?.computedStats?.evasionEffects;
    return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
  });
}

// Reads active conditions once and answers whether the target (or its own
// feature) grants evasion for this save. Shared by roll logic and the note UI.
function getEvasionContext(current, characters, campaignName) {
  const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
  const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
  const targetChar = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
  const ownEvasion = targetChar?.computedStats?.evasionEffects;
  const normalizedSaveType = normalizeSaveType(current.saveType);
  const hasOwnEvasion = !isIncapacitated && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
  return { isIncapacitated, hasOwnEvasion };
}

function safeFindTargetCharacter(current, characters) {
  try {
    return findTargetCharacter(current, characters);
  } catch { /* ignore */ }
  return null;
}

function characterSaveFields(character, current) {
  let saveBonus = 0;
  let saveModifiers = null;
  let activeConditions = [];
  try {
    saveBonus = getAbilitySaveBonus(character.computedStats || character, current.saveType);
    saveModifiers = character.saveModifiers || character.computedStats?.saveModifiers;
    activeConditions = getRuntimeValue(current.targetName, 'activeConditions') || [];
  } catch { /* ignore */ }
  return { saveBonus, saveModifiers, activeConditions };
}

function findCombatCreatureSaveBonus(targetName, saveType, campaignName) {
  const combatSummary = getCombatSummary(campaignName);
  const creature = combatSummary?.creatures?.find(
    c => utils.getName(c.name) === utils.getName(targetName)
  );
  return creature ? (creature.saveBonuses?.[normalizeSaveType(saveType).toLowerCase()] ?? 0) : 0;
}

function resolveTargetSaveBonus(current, characters, campaignName) {
  const character = safeFindTargetCharacter(current, characters);
  if (character) {
    if (typeof character === 'string') return { saveBonus: 0, saveModifiers: null, activeConditions: [] };
    return characterSaveFields(character, current);
  }
  return {
    saveBonus: findCombatCreatureSaveBonus(current.targetName, current.saveType, campaignName),
    saveModifiers: null,
    activeConditions: [],
  };
}

// CLA-034: conditional_advantage passives with condition:"charmed"/"frightened"
// (Beguiling Twist, Brave, Fey Ancestry) mean "advantage on saves AGAINST that
// condition" — key on the condition this save is rolled against (prompt
// condition/saveConditions), never on the target merely having the condition
// active (which over-granted on unrelated saves and missed fresh saves).
function saveConditionsOfPrompt(current) {
  if (current.condition) return [current.condition];
  return current.saveConditions || [];
}

function modifierListGrantsAdvantage(current, saveModifiers, campaignName) {
  const saveConditions = saveConditionsOfPrompt(current);
  for (const mod of saveModifiers) {
    if (mod.target !== 'saving_throw' || mod.effect !== 'advantage') continue;
    if (mod.condition === 'against_spell') {
      // CLA-324: against_spell advantage only on saves against spells — spell-origin is
      // identifiable from the prompt flag (monster-card save attacks, spell save-damage
      // prompts) or a spell-save-owned campaign lastAttack from the spell pipeline.
      const lastAttackOrigin = getRuntimeValue('campaign', 'lastAttack', campaignName) || {};
      const spellOrigin = current.isSpellDamage === true ||
        (lastAttackOrigin.rollType === 'spell-save' && (!current.attackerName || lastAttackOrigin.attackerName === current.attackerName));
      if (spellOrigin) return true;
    }
    if (mod.condition && saveConditions.includes(mod.condition)) return true;
    if (mod.saveType && current.condition && mod.condition === current.condition) return true;
  }
  return false;
}

function isDodgeDexAdvantage(current, characters, campaignName) {
  const targetActiveBuffs = getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || [];
  const isDodgeActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'dodge');
  const isDexSave = (current.saveType || '').toUpperCase() === 'DEX';
  // BA-001: 2014-only clause — 2024 Dodge grants no saving-throw benefit.
  const is2024 = ((characters || []).find(c => c.name === current?.targetName)?.rules || '5e') === '2024';
  return isDodgeActive && isDexSave && !is2024;
}

// SP-014: beacon te lives at campaign ROOT targetEffects (producers write
// setRuntimeValue('campaign','targetEffects',…)); the per-characters probe never
// populated. Mirrors the root-read lane (useLoggedDiceRollSaves.js:315/:76) plus
// te.target matching so another creature's beacon never grants cross-target.
function isBeaconOfHopeAdvantage(current, campaignName) {
  const rootTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
  return rootTargetEffects.some(te => te.target === current.targetName && te.effect === 'beacon_of_hope') && normalizeSaveType(current.saveType) === 'WIS';
}

function computeSaveAdvantage({ current, campaignName, hasDisadvantage, saveModifiers, characters }) {
  if (current.advantage) return true;
  if (hasDisadvantage) return false;
  if (saveModifiers && saveModifiers.length > 0 && modifierListGrantsAdvantage(current, saveModifiers, campaignName)) return true;
  // Dodge: advantage on Dexterity saving throws only
  if (isDodgeDexAdvantage(current, characters, campaignName)) return true;
  // CLA-394 Zealous Presence: blanket advantage on saving throws (buff effect
  // advantage_attacks_and_saves) — mirrors the Dodge block shape.
  if (hasBuffEffect(current?.targetName, 'advantage_attacks_and_saves', campaignName)) return true;
  // Beacon of Hope: advantage on Wisdom saving throws
  if (isBeaconOfHopeAdvantage(current, campaignName)) return true;
  // Circle of Power: blanket advantage on saving throws
  if (isCircleOfPowerActive(current.targetName, campaignName)) return true;
  // Holy Aura: advantage on all saving throws for warded targets
  if (getHolyAuraSaveAdvantage(current, campaignName)) return true;
  // Source-restricted save advantage (e.g. Holy Nimbus: advantage against Fiends/Undead for allies)
  return !!getHolyNimbusSaveAdvantage(current, characters, campaignName);
}

function consumeCosmicOmen(campaignName) {
  const cosmicOmenPendingRaw = getRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', campaignName);
  if (cosmicOmenPendingRaw) {
    try {
      const pending = JSON.parse(cosmicOmenPendingRaw);
      if (pending && typeof pending.value === 'number' && pending.value > 0) {
        const isWeal = pending.type === 'Weal';
        const bonus = isWeal ? pending.value : -pending.value;
        const detail = `(${bonus >= 0 ? '+' : ''}${bonus} from ${pending.type})`;
        setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', null, campaignName, true);
        return { bonus, detail };
      }
    } catch (_e) { /* ignore */ }
  }
  return { bonus: 0, detail: '' };
}

// Rolls 1d4 only when at least one matching targetEffect exists for the target.
function rollEffectDie(allTargetEffects, targetName, effect) {
  if (!targetName) return null;
  if (allTargetEffects.filter(te => te.target === targetName && te.effect === effect).length === 0) return null;
  return rollExpression('1d4');
}

// Bane/bless effect dice for the target and its attacker. Rolls in the same
// order as the original inline block: target bane, attacker bane, target bless.
function rollEffectDieContributions(allTargetEffects, current) {
  const baneSaveDie = rollEffectDie(allTargetEffects, current.targetName, 'bane_penalty');
  const baneAttackerDie = current.attackerName ? rollEffectDie(allTargetEffects, current.attackerName, 'bane_penalty') : null;
  const blessSaveDie = rollEffectDie(allTargetEffects, current.targetName, 'bless_bonus');
  return {
    baneSaveRoll: baneSaveDie ? baneSaveDie.total : null,
    baneSavePenalty: baneSaveDie ? -baneSaveDie.total : 0,
    baneAttackerBonus: baneAttackerDie ? baneAttackerDie.total : 0,
    baneAttackerRoll: baneAttackerDie ? baneAttackerDie.total : null,
    blessSaveBonus: blessSaveDie ? blessSaveDie.total : 0,
    blessSaveRoll: blessSaveDie ? blessSaveDie.total : null,
  };
}

function findWardingBondSaveBonus(current, campaignName) {
  const targetBuffs = getRuntimeValue(current.targetName, 'activeBuffs', campaignName);
  const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
  const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond' && b.saveBonus);
  return wardingBondBuff ? wardingBondBuff.saveBonus : 0;
}

// Display-side twins of the roll lane's FLAT activeBuffs folds (findWardingBond-
// SaveBonus + consumeBurstOfIngenuityBuff): same effect keys, same "first
// matching buff wins" reads, so the header breakdown line equals the modifier
// the Roll seam will fold. Dice-based folds (Bane/Bless effect dice) and the
// at-roll Cosmic Omen draw stay roll-time-only — they cannot be known pre-roll.
const LIVE_BUFF_SAVE_BONUSES = [
  { effect: 'warding_bond', label: 'Warding Bond', icon: 'fa-ring' },
  { effect: 'burst_of_ingenuity', label: 'Burst of Ingenuity', icon: 'fa-lightbulb' },
];

function getLiveBuffSaveBonusParts(activeBuffs) {
  const buffs = Array.isArray(activeBuffs) ? activeBuffs : [];
  const parts = [];
  for (const def of LIVE_BUFF_SAVE_BONUSES) {
    const buff = buffs.find(b => b && b.effect === def.effect);
    if (!buff) continue;
    // warding_bond folds only a truthy saveBonus (roll reader `&& b.saveBonus`);
    // burst folds Number(saveBonus) (non-numeric → 0). A 0 fold adds nothing —
    // no chip, matching the roll's effective contribution.
    const value = Number(buff.saveBonus) || 0;
    if (!value) continue;
    parts.push({
      key: def.effect,
      value,
      icon: def.icon,
      cls: value < 0 ? 'effect-debuff' : 'effect-buff',
      label: `${signedBonus(value)} (${def.label})`,
      tooltip: `${def.label}: ${signedBonus(value)} to saving throws — folded into the pending roll`,
    });
  }
  return parts;
}

function buildBonusDetail({ auraBonusStr, cosmicOmenDetail, baneSaveRoll, baneAttackerRoll, blessSaveRoll, wardingBondSaveBonus }) {
  const bonusDetailParts = [auraBonusStr, cosmicOmenDetail];
  if (baneSaveRoll) {
    bonusDetailParts.push(`-${baneSaveRoll} [Bane]`);
  }
  if (baneAttackerRoll) {
    bonusDetailParts.push(`+${baneAttackerRoll} [Bane]`);
  }
  if (blessSaveRoll) {
    bonusDetailParts.push(`+${blessSaveRoll} [Bless]`);
  }
  if (wardingBondSaveBonus > 0) {
    bonusDetailParts.push(`+${wardingBondSaveBonus} [Warding Bond]`);
  }
  return bonusDetailParts.filter(Boolean).join(' ') || undefined;
}

function buildSaveDamageFields(current) {
  const rawDamage = current.rawDamage || 0;
  const damageType = current.damageType || null;
  return {
    damageFormula: current.damageFormula || null,
    attackName: current.sourceName || current.name || null,
    damageType,
    rawDamage,
    primaryDamage: rawDamage,
    primaryDamageType: damageType,
    actualDamage: rawDamage,
    damageApplied: rawDamage > 0,
  };
}

function buildSecondaryDamageFields(current) {
  if (!current.secondaryFormula) return {};
  return {
    secondaryFormula: current.secondaryFormula,
    secondaryDamageType: current.secondaryDamageType || null,
    secondaryRawDamage: current.secondaryRawDamage || 0,
    secondaryTotal: current.secondaryRawDamage || 0,
  };
}

function buildLastAttackData(current, { finalRoll, roll1, roll2, result, total, success }) {
  return {
    attackerName: current.attackerName || current.targetName,
    targetName: current.targetName,
    d20: finalRoll,
    d20Rolls: [roll1, roll2],
    // FULL folded bonus (base + aura + omen + bane/bless dice + warding-bond/
    // burst flat folds) — d20 + bonus === total, so save consumers that
    // recompute the total from this record (Boon of Fate, reroll re-surfaces)
    // can never disagree with the modal's live breakdown line.
    bonus: result.saveBonus,
    total,
    rollType: 'save',
    saveType: current.saveType || null,
    saveDc: current.saveDc,
    saveResult: success ? 'success' : 'failure',
    saveConditions: current.condition ? [current.condition] : (current.saveConditions || []),
    ...buildSaveDamageFields(current),
    ...buildSecondaryDamageFields(current),
    timestamp: Date.now(),
  };
}

function computeHasEvasion(current, campaignName, hasOwnEvasion, isIncapacitated, hasSelectedEvasion) {
  const sharedEvasion = !hasOwnEvasion && !isIncapacitated && hasSelectedEvasion;
  return hasOwnEvasion || sharedEvasion || isCircleOfPowerActive(current.targetName, campaignName);
}

function rollSaveDice(forceRollTo20, hasAdvantage, hasDisadvantage) {
  const roll1 = forceRollTo20 ? 20 : rollD20();
  const roll2 = (hasDisadvantage || hasAdvantage) ? rollD20() : roll1;
  const finalRoll = hasDisadvantage ? Math.min(roll1, roll2) : hasAdvantage ? Math.max(roll1, roll2) : roll1;
  return { roll1, roll2, finalRoll };
}

function saveRollMode(hasAdvantage, hasDisadvantage) {
  if (hasDisadvantage) return 'disadvantage';
  if (hasAdvantage) return 'advantage';
  return 'normal';
}

function auraBonusString(aura) {
  if (!(aura.bonus > 0)) return undefined;
  return `(+${aura.bonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})`;
}

// Full save-roll resolution: evasion, advantage/disadvantage, dice, and all
// bonus contributions (aura, cosmic omen, bane, bless, warding bond).
async function computeSaveRollOutcome({ current, characters, campaignName, activeMapName, hasSelectedEvasion, forceRollTo20 }) {
  const { saveBonus, saveModifiers } = resolveTargetSaveBonus(current, characters, campaignName);

  const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
  const auraBonus = aura.bonus;

  const { isIncapacitated, hasOwnEvasion } = getEvasionContext(current, characters, campaignName);
  const hasEvasion = computeHasEvasion(current, campaignName, hasOwnEvasion, isIncapacitated, hasSelectedEvasion);

  const hasDisadvantage = getSaveDisadvantage(current, campaignName);
  const hasAdvantage = computeSaveAdvantage({ current, campaignName, hasDisadvantage, saveModifiers, characters });

  const { roll1, roll2, finalRoll } = rollSaveDice(forceRollTo20, hasAdvantage, hasDisadvantage);
  const { bonus: cosmicOmenAppliedBonus, detail: cosmicOmenDetail } = consumeCosmicOmen(campaignName);

  // Bane (target + attacker) and bless effect dice, then Warding Bond flat bonus.
  const { baneSaveRoll, baneSavePenalty, baneAttackerBonus, baneAttackerRoll, blessSaveBonus, blessSaveRoll } =
    rollEffectDieContributions(getRuntimeValue('campaign', 'targetEffects') || [], current);

  // Warding Bond: +1 flat bonus to saving throws
  const wardingBondSaveBonus = findWardingBondSaveBonus(current, campaignName);

  // MA-1510: Burst of Ingenuity ONE-SHOT +2 — same activeBuffs saveBonus
  // fold channel as warding_bond; consume folds + strips the armed stamp on
  // this save (arm→next-resolve-consume §214, playbook §76 live seam).
  const burstSave = consumeBurstOfIngenuityBuff(current.targetName, campaignName, { rollType: 'save', rollName: current.name || current.sourceName });

  const saveBonusTotal = saveBonus + auraBonus + cosmicOmenAppliedBonus + baneSavePenalty + blessSaveBonus + baneAttackerBonus + wardingBondSaveBonus + burstSave.bonus;
  const total = finalRoll + saveBonusTotal;
  const success = total >= current.saveDc;
  const bonusDetail = buildBonusDetail({ auraBonusStr: auraBonusString(aura), cosmicOmenDetail, baneSaveRoll, baneAttackerRoll, blessSaveRoll, wardingBondSaveBonus });
  const rollMode = saveRollMode(hasAdvantage, hasDisadvantage);

  return {
    hasEvasion, finalRoll, roll1, roll2, saveBonus, auraBonus, cosmicOmenAppliedBonus, total, success,
    result: { success, roll: finalRoll, total, saveBonus: saveBonusTotal, bonusDetail: burstSave.applied ? `${bonusDetail ? bonusDetail + ' ' : ''}+${burstSave.bonus} [Burst of Ingenuity]` : bonusDetail, rawRolls: [roll1, roll2], mode: rollMode, baneRoll: baneSaveRoll, blessRoll: blessSaveRoll, baneAttackerRoll: baneAttackerRoll },
  };
}

function buildResultDispatchDetail({ current, result, saveBonus, rawRolls, rollMode, evasionActive }) {
  return {
    promptId: current.promptId,
    targetName: current.targetName,
    saveType: current.saveType,
    saveDc: current.saveDc,
    success: result.success,
    roll: result.roll,
    total: result.total,
    saveBonus,
    bonusDetail: result.bonusDetail,
    rawDamage: current.rawDamage,
    dcSuccess: current.dcSuccess,
    rawRolls,
    mode: rollMode,
    evasionActive,
  };
}

function computePromptDisplayState(current, campaignName) {
  return {
    abilityLabel: current ? (current.saveType || '').toUpperCase() : '',
    promptHasDisadvantage: current ? getSaveDisadvantage(current, campaignName) : false,
    promptHasAdvantage: current ? (!!current.advantage || getHolyAuraSaveAdvantage(current, campaignName)) : false,
  };
}

function signedBonus(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

// Pre-roll save-bonus breakdown for the prompt panel (display-only — the Roll
// seam recomputes everything at commit time). Same computeAuraBonus call the
// resolve lane uses (auraOfProtection.js), plus the LIVE flat activeBuffs
// folds (Warding Bond / Burst of Ingenuity) read from the same runtime store
// the roll seam reads, so the header sum equals the modifier a pending roll
// will use even when buffs are stamped mid-prompt (DG 2026-11-06 header-stale
// fix). Roll-time dice draws (Bane/Bless) remain post-roll-only by nature.
function buildPreRollBreakdown(abilityLabel, saveBonus, aura, buffParts = []) {
  const auraBonus = aura?.bonus > 0 ? aura.bonus : 0;
  // Phantom-bearer caveat (backlog 2026-11-06): computeAuraBonus flags
  // assumedCoPresent when the active map exists but the bearer has no token
  // there and no board membership — co-presence is assumed by the
  // gridless-lenient doctrine. Display-honesty only; bonus values unchanged.
  const assumedCaveat = aura?.assumedCoPresent ? ' — assumed co-present (no token)' : '';
  // Tokened-bearer drop note (backlog 2026-11-06): computeAuraBonus flags
  // targetUnpositionedBearer when the aura was dropped SOLELY because the
  // target has no positioned token on an active positioned map. The bonus is
  // NOT applied (total stays honest) — the note only explains the absence,
  // mirroring the phantom caveat above.
  const unmeasuredNote = aura?.targetUnpositionedBearer
    ? `Aura of Protection from ${aura.targetUnpositionedBearer} — target not positioned, unmeasured`
    : null;
  const buffTotal = buffParts.reduce((sum, part) => sum + part.value, 0);
  return {
    promptId: null,
    baseLabel: `${abilityLabel} ${signedBonus(saveBonus)}`,
    auraLabel: auraBonus > 0 ? `${signedBonus(auraBonus)} (Aura of Protection)` : null,
    auraTooltip: auraBonus > 0 && aura.sourceName
      ? `Aura of Protection from ${aura.sourceName}${assumedCaveat}`
      : 'Aura of Protection',
    auraUnmeasuredNote: unmeasuredNote,
    buffChips: buffParts,
    totalLabel: `= ${signedBonus(saveBonus + auraBonus + buffTotal)}`,
  };
}

// Live per-prompt aura/base read: re-derived whenever the front prompt
// changes (promptId is the staleness key — an aura resolved for a previous
// prompt is discarded via the active-flag guard, never shown on a new one).
// The flat activeBuffs contribution is layered at RENDER time from the
// reactive store read, so a mid-prompt buff stamp re-renders the line
// without waiting for a prompt swap.
function usePreRollSaveBreakdown(current, characters, campaignName, activeMapName, buffParts) {
  const [core, setCore] = useState(null);
  const latestRef = useRef(null);
  latestRef.current = { current, characters, activeMapName };
  const promptId = current?.promptId || null;
  const abilityLabel = (current?.saveType || '').toUpperCase();

  useEffect(() => {
    setCore(null);
    if (!promptId) return undefined;
    let active = true;
    (async () => {
      const snapshot = latestRef.current;
      const prompt = snapshot.current;
      if (!prompt || prompt.promptId !== promptId) return;
      const { saveBonus } = resolveTargetSaveBonus(prompt, snapshot.characters, campaignName);
      const aura = await computeAuraBonus({
        targetName: prompt.targetName,
        characters: snapshot.characters,
        campaignName,
        activeMapName: snapshot.activeMapName,
        allCreatures: getCombatSummary(campaignName)?.creatures,
      });
      if (active) {
        setCore({ promptId, saveBonus, aura });
      }
    })().catch((e) => { console.error('[SavePromptModal] Pre-roll save breakdown failed:', e); });
    return () => { active = false; };
    // promptId is the intended refresh key; the other inputs are read from
    // latestRef at effect time so unstable prop identities never re-loop.
  }, [promptId, campaignName]);

  // Recomposed on EVERY live buff change (DG 2026-11-06): base + aura come
  // from the prompt-open read, the flat buff folds from the live store.
  return useMemo(() => {
    if (!core || core.promptId !== promptId) return null;
    return { ...buildPreRollBreakdown(abilityLabel, core.saveBonus, core.aura, buffParts), promptId };
  }, [core, promptId, abilityLabel, buffParts]);
}

function findTargetCharacter(current, characters) {
  if (!current) return null;
  return (characters || []).find(c => {
    const name = typeof c === 'string' ? c : c.name;
    return name && utils.getName(name) === utils.getName(current.targetName);
  }) || null;
}

function appendSavePrompt(prev, event, prefix) {
  if (prev.some(p => p.promptId === event.data.promptId)) return prev;
  const { sourceAttackerName, attackerName: eventDataAttackerName, targetName: dataTargetName, promptId, ...restData } = event.data;
  // The arrival key identifies the SERVER key this prompt lives on:
  // '<Target>-<promptId>' (per-prompt lane) or bare '<Target>' (legacy/
  // staged producers). Queue it verbatim so Dismiss/Done clear exactly the
  // key that exists instead of guessing at a sibling shape (drained-queue
  // 404 class, backlog 2026-11-03).
  const keySuffix = event.key.slice(prefix.length);
  const targetName = dataTargetName
    || (promptId && keySuffix.endsWith(`-${promptId}`)
      ? keySuffix.slice(0, -(promptId.length + 1))
      : keySuffix)
    || null;
  const newPrompt = { targetName, attackerName: eventDataAttackerName || sourceAttackerName, promptId, ...restData, promptKeySuffix: keySuffix };

  return [...prev, newPrompt];
}

// Shared submit path for Dismiss/Done with a resolved result.
function submitResultAndClear(campaignName, current, result, { includeBaneRoll, evasionActive, sendExtra, clearPrompt, advance }) {
  const saveBonus = result.saveBonus;
  const rollMode = result.mode || 'normal';
  const rawRolls = result.rawRolls || [result.roll];

  sendSaveResult(campaignName, current.targetName, {
    promptId: current.promptId,
    success: result.success,
    roll: result.roll,
    total: result.total,
    saveBonus,
    rawRolls,
    mode: rollMode,
    bonusDetail: result.bonusDetail,
    ...sendExtra,
  });

  window.dispatchEvent(new CustomEvent('save-result', {
    detail: {
      ...buildResultDispatchDetail({ current, result, saveBonus, rawRolls, rollMode, evasionActive }),
      ...(includeBaneRoll ? { baneRoll: result.baneRoll } : {}),
    },
  }));

  // CLA-211: consume the per-prompt Leading Evasion share stamp AFTER the
  // adjudication dispatch — synchronous listeners read it during dispatch,
  // and the prune POST stays ordered behind sendSaveResult for remote lanes.
  clearLeadingEvasionSelection(campaignName, current.promptId);

  // The creator tab's save-result listener above already swept the bucket
  // row (its write makes this one a no-op via valuesEqual); on a tab without
  // that listener (cross-tab Done, staged lane) this drop is the row's only
  // sweeper — never absent, never double-POSTed.
  dropPendingSavePrompt(campaignName, current.promptId);

  clearPrompt();
  advance();
}

function applyRerollToCombatSummary(campaignName, { roll, rawRolls, saveBonus, total, saveType, saveDc, success, condition, secondaryFormula, secondaryDamageType, secondaryRawDamage }) {
  const cs = getCombatSummary(campaignName);
  if (!cs) return;
  cs.lastAttack = {
    ...cs.lastAttack, d20: roll, d20Rolls: rawRolls, bonus: saveBonus, total,
    saveType: saveType || null, saveDc, saveResult: success ? 'success' : 'failure',
    saveConditions: condition ? [condition] : [], timestamp: Date.now(),
    ...(secondaryFormula ? {
      secondaryFormula, secondaryDamageType: secondaryDamageType || null,
      secondaryRawDamage: secondaryRawDamage || 0, secondaryTotal: secondaryRawDamage || 0,
    } : {}),
  };
  storage.set('combatSummary', cs, campaignName);
}

function restoreHpAfterSuccessfulReroll(campaignName, { targetName, rawDamage, dcSuccess, healingName, healingNote }) {
  const lastAttack = getRuntimeValue('campaign', 'lastAttack', campaignName);
  const actualDamageApplied = lastAttack?.finalDamage ?? lastAttack?.primaryDamage ?? rawDamage;
  const damageToRestore = dcSuccess === 'half' ? Math.ceil(actualDamageApplied / 2) : actualDamageApplied;
  const currentHp = getRuntimeValue(targetName, 'hitPoints', campaignName);
  const maxHp = getRuntimeValue(targetName, 'maxHitPoints', campaignName) ?? (currentHp + actualDamageApplied);
  const restoredHp = Math.min(maxHp, (currentHp ?? 0) + damageToRestore);
  setRuntimeValue(targetName, 'hitPoints', restoredHp, campaignName);

  addEntry(campaignName, {
    type: 'roll', characterName: targetName, rollType: 'healing',
    name: healingName || 'Save Reroll', rolls: [], total: damageToRestore,
    modifier: 0, damageType: null, targetName, finalDamage: null,
    note: healingNote || 'save_reroll_hp_restore', timestamp: Date.now(),
  }).catch((e) => { console.error('[SavePromptModal] Error logging HP restore:', e); });
}

// Reroll submit path: posts the rerolled result, logs it, updates combat
// summary, restores HP on success, and clears the prompt. The prompt stays
// queued (result panel refreshes), so the later Done click must NOT re-DELETE
// the key this already swept — clearPrompt's per-key guard absorbs that
// second attempt (the reroll→Done double-404 face).
function createSubmitSaveResult(campaignName, setPrompts, clearPrompt, promptsRef) {
  return (saveData) => {
    const {
      promptId, targetName, success, roll, total, saveBonus, rawRolls, mode, bonusDetail,
      saveType, saveDc, sourceName, damageFormula, damageType, rawDamage, dcSuccess,
      note, healingName, healingNote,
    } = saveData;

    sendSaveResult(campaignName, targetName, {
      promptId, success, roll, total, saveBonus, rawRolls, mode, bonusDetail,
    });
    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll, total, saveBonus, bonusDetail, rawRolls, mode } }
        : p
    ));

    addEntry(campaignName, {
      type: 'roll', rollType: 'save-damage', name: sourceName || 'Unknown',
      formula: damageFormula || '', rolls: [roll], total,
      modifier: saveBonus, damageType: damageType || null, targetName,
      saveType: saveType || null, saveDc, saveResult: success ? 'success' : 'failure',
      saveRoll: roll, saveBonus, saveRawRolls: rawRolls, finalDamage: null,
      note: note || 'save_reroll', timestamp: Date.now(),
    }).catch((e) => { console.error('[SavePromptModal] Error logging reroll:', e); });

    applyRerollToCombatSummary(campaignName, saveData);

    if (success && rawDamage > 0) {
      // MA-0367: dc_success 'full' rows — the attack damage stands in FULL on
      // the rerolled success (nothing to restore); instead the successful save
      // closes any Infernal Wound the pre-reroll failure inflicted.
      if (dcSuccess === 'full') {
        cancelInfernalWoundAfterSaveSuccess(targetName, campaignName).catch((e) => { console.error('[SavePromptModal:infernal-wound-cancel]', e); });
      } else {
        restoreHpAfterSuccessfulReroll(campaignName, { targetName, rawDamage, dcSuccess, healingName, healingNote });
      }
    }

    clearPrompt(promptsRef.current[0] || { targetName });
  };
}

function isRaging(activeBuffs) {
  return Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
}

function resolveCurrentFocusPoints(current, targetCharacter, campaignName) {
  const targetClassLevel = targetCharacter?.class?.class_levels?.[(targetCharacter.level || 1) - 1] || {};
  const maxFocusPoints = targetClassLevel.focus_points || 0;
  return current ? Number(getRuntimeValue(current.targetName, 'focusPoints', campaignName) ?? maxFocusPoints) : 0;
}

function findGuardedMindAction(targetCharacter) {
  return (targetCharacter?.computedStats?.automation?.specialActions || []).find(
    a => a.type === 'auto_reroll' && a.effect === 'override_fail_to_success' && a.oncePer === 'short_or_long_rest'
  );
}

function isIndomitableModifier(m) {
  return m.effect === 'reroll' && m.target === 'saving_throw'
    && (m.source === 'Indomitable' || /fighter_level/i.test(m.bonusExpression || ''));
}

function indomitableMaxUsesForLevel(featureLevel) {
  if (featureLevel >= 17) return 3;
  if (featureLevel >= 13) return 2;
  return 1;
}

// Indomitable (Fighter lv9+): reroll a failed save with a +fighter level bonus,
// tracked via runtime `indomitableUses` (recharged on a Long Rest).
function resolveIndomitableReroll(targetCharacter) {
  const modifiers = targetCharacter?.saveModifiers || targetCharacter?.computedStats?.saveModifiers || [];
  const modifier = modifiers.find(isIndomitableModifier);
  const featureLevel = targetCharacter?.level ?? targetCharacter?.computedStats?.level ?? 0;
  const maxUses = indomitableMaxUsesForLevel(featureLevel);
  const rerollBonus = modifier
    ? (evaluateAutoExpression(modifier.bonusExpression || '0', { level: featureLevel }) || featureLevel)
    : 0;
  return { modifier, maxUses, rerollBonus };
}

function readRerollResourceState(current, campaignName) {
  return {
    fanaticalFocusUsed: current ? getRuntimeValue(current.targetName, 'fanaticalFocusUsed', campaignName) : false,
    isRagingForSave: isRaging(getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || []),
    livingLegendActive: current ? getRuntimeValue(current.targetName, 'livingLegendActive', campaignName) === true : false,
    indomitableUses: current ? Number(getRuntimeValue(current?.targetName, 'indomitableUses', campaignName) ?? 0) : 0,
    guardedMindUsed: current ? getRuntimeValue(current.targetName, '_guardedMind_usedRest', campaignName) : false,
  };
}

function computeRerollAvailability(current, targetCharacter, campaignName) {
  const { fanaticalFocusUsed, isRagingForSave, livingLegendActive, indomitableUses, guardedMindUsed } = readRerollResourceState(current, campaignName);
  const currentFocusPoints = resolveCurrentFocusPoints(current, targetCharacter, campaignName);

  const guardedMindSpecialAction = findGuardedMindAction(targetCharacter);
  const isValidSaveType = !!current && GUARDED_MIND_SAVE_TYPES.includes(current.saveType);
  const indomitable = resolveIndomitableReroll(targetCharacter);

  return {
    fanaticalFocusAvailable: isRagingForSave && !fanaticalFocusUsed,
    currentFocusPoints,
    disciplinedSurvivorAvailable: !fanaticalFocusUsed && currentFocusPoints > 0,
    livingLegendAvailable: livingLegendActive && !fanaticalFocusUsed && indomitableUses < 1,
    guardedMindAvailable: !guardedMindUsed && !!guardedMindSpecialAction && isValidSaveType,
    indomitableAvailable: !!indomitable.modifier && indomitableUses < indomitable.maxUses,
    indomitableUses,
    indomitableMaxUses: indomitable.maxUses,
    indomitableRerollBonus: indomitable.rerollBonus,
  };
}

function EvasionNote({ current, characters, campaignName }) {
  const { isIncapacitated, hasOwnEvasion } = getEvasionContext(current, characters, campaignName);
  const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && hasShareableEvasionFor(current, characters);
  const hasEvasion = hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(current.targetName, campaignName);
  return hasEvasion
    ? <p className="sp-note sp-evasion">Evasion: No damage on success, half damage on failure</p>
    : <p className="sp-note">Half damage on successful save</p>;
}

function rollBreakdownText(result) {
  const hasDoubleRoll = result.mode !== 'normal' && Array.isArray(result.rawRolls) && result.rawRolls.length === 2;
  const rolls = hasDoubleRoll ? `${result.rawRolls[0]}, ${result.rawRolls[1]}` : result.roll;
  const bonusDetail = result.bonusDetail ? ` ${result.bonusDetail}` : '';
  const modeLabel = result.mode === 'advantage' ? ' (Advantage)' : result.mode === 'disadvantage' ? ' (Disadvantage)' : '';
  return `d20 (${rolls}) + ${result.saveBonus}${bonusDetail}${modeLabel}`;
}

const REROLL_BUTTONS = [
  { key: 'fanaticalFocusAvailable', handler: 'fanaticalFocus', icon: 'fa-rotate', label: (a) => `Reroll Save (+${a.rageDamageBonus})` },
  { key: 'indomitableAvailable', handler: 'indomitable', icon: 'fa-rotate', label: (a) => `Indomitable (+${a.indomitableRerollBonus})` },
  { key: 'disciplinedSurvivorAvailable', handler: 'disciplinedSurvivor', icon: 'fa-rotate', label: () => 'Reroll Save (1 Focus Point)' },
  { key: 'livingLegendAvailable', handler: 'livingLegend', icon: 'fa-rotate', label: () => 'Reroll Save' },
  { key: 'guardedMindAvailable', handler: 'guardedMind', icon: 'fa-shield-halved', label: () => 'Guarded Mind' },
];

function SaveResultPanel({ current, rerollUsedForSave, availability, handlers }) {
  const result = current.result;
  const showReroll = !result.success && !rerollUsedForSave;
  return (
    <div className={`sp-result ${result.success ? 'sp-result-success' : 'sp-result-fail'}`}>
      <p className="sp-result-label">{result.success ? 'SAVE SUCCESS' : 'SAVE FAILURE'}</p>
      <p className="sp-result-total">Total: <strong>{result.total}</strong> vs DC {current.saveDc}</p>
      <p className="sp-result-breakdown">{rollBreakdownText(result)}</p>
      {showReroll && REROLL_BUTTONS.filter(b => availability[b.key]).map(b => (
        <button key={b.key} className="sp-stroke-btn" onClick={handlers[b.handler]} type="button">
          <i className={`fa-solid ${b.icon}`}></i> {b.label(availability)}
        </button>
      ))}
    </div>
  );
}

function withToggledAlly(selection, targetName) {
  const currentSelection = selection?.selectedAllies || [];
  return {
    selectedAllies: currentSelection.includes(targetName)
      ? currentSelection.filter(n => n !== targetName)
      : [...currentSelection, targetName],
  };
}

function EvasionSelectionOverlay({ prompts, evasionSelection, onSelectionChange, onConfirm, onSkip }) {
  const selected = evasionSelection?.selectedAllies || [];
  return (
    <div className="sp-overlay sp-overlay--evasion">
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-shield-halved"></i> Leading Evasion — Choose Allies
        </div>
        <div className="sp-body">
          <p>Which of the following creatures making this save should benefit from <strong>Leading Evasion</strong>?</p>
          <p className="sp-note">Select all allies within 5 feet of the Bard. On a successful save, selected allies take no damage. On a failure, they take half damage.</p>
          <div className="secondary-target-list">
            {prompts.map((prompt, i) => (
              <label
                key={i}
                className={`secondary-target-row ${selected.includes(prompt.targetName) ? 'secondary-target-selected' : ''}`}
                onClick={() => onSelectionChange(withToggledAlly(evasionSelection, prompt.targetName))}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(prompt.targetName)}
                  readOnly
                  tabIndex={-1}
                />
                <span className="secondary-target-name">
                  <strong>{prompt.targetName}</strong>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="sp-actions">
          <button
            className="sp-roll-btn"
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0}
            type="button"
          >
            <i className="fa-solid fa-shield-halved"></i> Apply Evasion ({selected.length})
          </button>
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// MA-0427: dual-damage save prompts (Brazen Gorgon Smelting Charge —
// "2d8 + 4 Piercing plus 3d8 Fire") name BOTH formulas honestly in the DC
// prompt copy; renders null for every single-damage prompt (byte-inert).
function DualDamageNotice({ current }) {
  if (!current.secondaryFormula) return null;
  const primary = current.damageFormula ? `${current.damageFormula} ${current.damageType || ''}`.trim() : 'Primary';
  const secondary = `${current.secondaryFormula} ${current.secondaryDamageType || ''}`.trim();
  return (
    <p className="sp-note">
      {primary} + {secondary} damage{current.dcSuccess === 'half' ? ', half on a successful save' : ''}
    </p>
  );
}

// Pre-roll save-bonus breakdown + aura-unmeasured note (display-only lane,
// same buildPreRollBreakdown compute the post-roll view keeps rendering).
// Extracted from SavePromptDialog mirroring the DualDamageNotice/SaveResultPanel
// component shapes. Buff chips re-render live (mid-prompt stamps).
function PreRollBreakdown({ preRoll, current }) {
  if (!preRoll || !current || preRoll.promptId !== current.promptId) return null;
  return (
    <>
      <div className="sp-preroll-bonus" data-testid="sp-preroll-bonus">
        <span className="sp-preroll-base">{preRoll.baseLabel}</span>
        {preRoll.auraLabel && (
          <CreatureBadge icon="fa-shield-heart" label={preRoll.auraLabel} cls="effect-buff" tooltip={preRoll.auraTooltip} />
        )}
        {preRoll.buffChips.map(chip => (
          <CreatureBadge key={chip.key} icon={chip.icon} label={chip.label} cls={chip.cls} tooltip={chip.tooltip} />
        ))}
        <span className="sp-preroll-total">{preRoll.totalLabel}</span>
      </div>
      {preRoll.auraUnmeasuredNote && (
        <p className="sp-note" data-testid="sp-aura-unmeasured">{preRoll.auraUnmeasuredNote}</p>
      )}
    </>
  );
}

function SavePromptDialog({
  current, prompts, dimmed, characters, campaignName, display, hasResult, preRoll,
  rerollUsedForSave, rerollAvailability, handlers,
}) {
  const { abilityLabel, promptHasDisadvantage, promptHasAdvantage } = display;
  const queueCount = prompts.length;
  return (
    <div className={`sp-overlay${dimmed ? ' sp-overlay--dimmed' : ''}`}>
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-shield-halved"></i> Saving Throw Required
          {queueCount > 1 && (
            <span className="sp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
          )}
        </div>
        <div className="sp-body">
          <p><strong>{current.targetName}</strong> must make a <strong>{abilityLabel}</strong> saving throw.{promptHasAdvantage ? <span className="sp-advantage-badge"> (Advantage)</span> : ''}{promptHasDisadvantage ? <span className="sp-disadvantage-badge"> (Disadvantage)</span> : ''}</p>
          <p className="sp-dc">DC {current.saveDc}</p>
          <PreRollBreakdown preRoll={preRoll} current={current} />
          {current.dcSuccess === 'half' && (
            <EvasionNote current={current} characters={characters} campaignName={campaignName} />
          )}
          {current.dcSuccess === 'none' && <p className="sp-note">No damage on successful save</p>}
          <DualDamageNotice current={current} />
          {/* MA-0367: dc_success 'full' — the save gates only a non-damage
              clause (the Infernal Wound); the attack damage stands regardless. */}
          {current.dcSuccess === 'full' && <p className="sp-note">Full damage regardless — this save determines any additional effect only</p>}
          {current.sourceName && <p className="sp-source">Source: {current.sourceName}</p>}
          {hasResult && (
            <SaveResultPanel
              current={current}
              rerollUsedForSave={rerollUsedForSave}
              availability={rerollAvailability}
              handlers={{
                fanaticalFocus: handlers.fanaticalFocus,
                indomitable: handlers.indomitable,
                disciplinedSurvivor: handlers.disciplinedSurvivor,
                livingLegend: handlers.livingLegend,
                guardedMind: handlers.guardedMind,
              }}
            />
          )}
        </div>
        <div className="sp-actions">
          {!hasResult ? (
            <>
              <button className="sp-roll-btn" onClick={handlers.rollSave} type="button">
                <i className="fa-solid fa-dice-d20"></i> Roll Save
              </button>
              <button className="sp-dismiss-btn" onClick={handlers.dismiss} type="button">
                Dismiss
              </button>
            </>
          )               : (
            <button className="sp-roll-btn" onClick={handlers.done} type="button">
              {queueCount > 1 ? 'Next Save' : 'Done'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SavePromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const [rerollUsedForSave, setRerollUsedForSave] = useState(false);
  const [lastEvasionState, setLastEvasionState] = useState(false);
  const forceRollTo20Ref = useRef(false);
  const selectedAlliesRef = useRef(new Set());

  const current = prompts.length > 0 ? prompts[0] : null;

  const hasShareableEvasion = !current ? false : hasShareableEvasionFor(current, characters);

  const evasionTriggeredIdsRef = useRef(new Set());

  useEffect(() => {
    if (current && hasShareableEvasion && !evasionTriggeredIdsRef.current.has(current.promptId)) {
      evasionTriggeredIdsRef.current.add(current.promptId);
      setEvasionSelection({ selectedAllies: [] });
    }
  }, [current, hasShareableEvasion]);

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  // Server keys this client has already DELETEd while their prompts may still
  // sit in the queue (reroll-submit clears, then Done; or rapid double
  // Dismisses racing the SSE round-trip). A second clear for the same key
  // would honest-404 — skip it. A fresh value echo on the key revives it
  // (a re-POST legitimately recreates the server key).
  const clearedPromptKeysRef = useRef(new Set());

  const clearPrompt = useCallback((prompt) => {
    const keySuffix = prompt?.promptKeySuffix || prompt?.targetName;
    if (!keySuffix) return;
    if (clearedPromptKeysRef.current.has(keySuffix)) return;
    clearedPromptKeysRef.current.add(keySuffix);
    clearSavePrompt(campaignName, keySuffix);
  }, [campaignName]);

  const handleEvent = useCallback((event) => {
    if (!event.key) return;
    const prefix = `change-${campaignName}-savePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const keySuffix = event.key.slice(prefix.length);
    if (!keySuffix) return;

    if (event.data == null) {
      // Cleared-key echo (the server broadcasts null on key DELETE, as every
      // client's Roll-Done/Dismiss does via clearPrompt): the save was
      // answered or dismissed on another client — drop exactly the
      // un-adjudicated prompt whose key was cleared (per-prompt key suffix
      // '<Target>-<promptId>', or arrival-key match), plus the legacy
      // bare-target clear which is target-wide by construction (the server
      // only ever held one key for that target). Keeps any check this client
      // already rolled so its result panel survives until Done — the
      // ConcentrationPromptModal/DeathSavePromptModal cross-tab doctrine.
      const isCleared = (p) => !p.result
        && (p.promptKeySuffix === keySuffix
          || keySuffix === `${p.targetName}-${p.promptId}`
          || keySuffix === p.targetName);
      setPrompts(prev => (prev.some(isCleared) ? prev.filter(p => !isCleared(p)) : prev));
      return;
    }

    clearedPromptKeysRef.current.delete(keySuffix);
    setPrompts(prev => appendSavePrompt(prev, event, prefix));
   }, [campaignName]);

  const handleClearedEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePromptCleared-`;
    if (!event.key.startsWith(prefix)) return;
    if (!event.data?.promptId) return;
    getPendingSavePrompt(event.data.promptId);
    getPendingPopupSetter(event.data.promptId);
    setPrompts(prev => prev.filter(p => p.promptId !== event.data.promptId));
  }, [campaignName]);

  const handleDismiss = useCallback(() => {
    if (!current) return;
    if (current.result) {
      submitResultAndClear(campaignName, current, current.result, {
        includeBaneRoll: false, evasionActive: lastEvasionState,
        clearPrompt: () => clearPrompt(current), advance,
      });
      return;
    }
    // Un-rolled dismissal is a client-wide answer (concentration doctrine):
    // sweep the prompt's memory-registry residue, drop its pendingSavePrompts
    // /pendingSaveListenerPrompts rows (broadcast — otherwise they orphan in
    // the campaign bucket forever, backlog 2026-11-03), clear exactly its
    // arrival key, then advance.
    getPendingSavePrompt(current.promptId);
    getPendingPopupSetter(current.promptId);
    // Producer abandonment notice (Divine Spark dismiss-softlock 2026-11-05):
    // producers parked on a raw `save-result` window listener never resolve
    // here, so modal families (DivineSparkModal et al) stranded at
    // "Rolling…" with no buttons. A dedicated `save-dismissed` event carries
    // the promptId so opted-in producers can refuse(); it is NOT a
    // `save-result` — the createSaveListener promise doctrine ("a DISMISSED
    // save never resolves", savePrompt.js) stays intact, because the ~40
    // `.promise` consumers all treat a falsy `success` as "save failed →
    // apply damage" and must never see an un-rolled save as an outcome.
    window.dispatchEvent(new CustomEvent('save-dismissed', {
      detail: { promptId: current.promptId, targetName: current.targetName },
    }));
    dropPendingSavePrompt(campaignName, current.promptId);
    clearPrompt(current);
    advance();
  }, [campaignName, current, lastEvasionState, clearPrompt, advance]);

  const handleRollSave = useCallback(async () => {
    if (!current) return;

    const { hasEvasion, ...roll } = await computeSaveRollOutcome({
      current, characters, campaignName, activeMapName,
      hasSelectedEvasion: selectedAlliesRef.current.has(current.targetName),
      forceRollTo20: forceRollTo20Ref.current,
    });
    setLastEvasionState(hasEvasion);

    const cs = getCombatSummary(campaignName);
    if (cs) {
      storage.set('lastAttack', buildLastAttackData(current, roll), campaignName);
    }

    setPrompts(prev => prev.map((p, i) =>
      i === 0 ? { ...p, result: roll.result } : p
    ));

    forceRollTo20Ref.current = false;
  }, [campaignName, current, characters, activeMapName, selectedAlliesRef]);

  const handleDone = useCallback(() => {
    if (!current) return;
    const result = current.result;
    if (!result) {
      advance();
      return;
    }
    submitResultAndClear(campaignName, current, result, {
      includeBaneRoll: true,
      evasionActive: lastEvasionState,
      sendExtra: { baneRoll: result.baneRoll },
      clearPrompt: () => clearPrompt(current),
      advance,
    });
  }, [campaignName, current, lastEvasionState, clearPrompt, advance]);

  // CLA-211: persist the GM's per-save share selection to the runtime store
  // (broadcast, skipSync=false) keyed by promptId so every adjudication lane
  // gates Leading Evasion on the explicit choice — presence of a shareable
  // holder alone no longer folds. Skip grants nothing and is logged declined.
  const handleEvasionConfirm = useCallback((selectedNames) => {
    selectedAlliesRef.current = new Set(selectedNames);
    const chosen = prompts
      .filter(p => selectedNames.includes(p.targetName))
      .map(p => [p.promptId, [p.targetName]]);
    if (chosen.length > 0) {
      stampLeadingEvasionSelections(campaignName, chosen);
      addEntry(campaignName, {
        type: 'automation',
        automationType: 'leading_evasion_shared',
        characterName: current?.targetName || null,
        description: `Leading Evasion shared with ${selectedNames.join(', ')} — DC ${current?.saveDc} ${current?.saveType} save${current?.sourceName ? ` (${current.sourceName})` : ''}. Selected allies take half damage on a failed save and no damage on a successful save.`,
        timestamp: Date.now(),
      }).catch((e) => { console.error('[SavePromptModal] Error logging Leading Evasion share:', e); });
    }
    setEvasionSelection(null);
  }, [campaignName, current, prompts]);

  const handleEvasionSkip = useCallback(() => {
    selectedAlliesRef.current = new Set();
    addEntry(campaignName, {
      type: 'automation',
      automationType: 'leading_evasion_declined',
      characterName: current?.targetName || null,
      description: `Leading Evasion share declined for DC ${current?.saveDc} ${current?.saveType} save${current?.sourceName ? ` (${current.sourceName})` : ''} — no allies selected; every unselected target pays normal save damage.`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[SavePromptModal] Error logging Leading Evasion decline:', e); });
    setEvasionSelection(null);
  }, [campaignName, current]);

  const { abilityLabel, promptHasDisadvantage, promptHasAdvantage } = computePromptDisplayState(current, campaignName);
  const hasResult = current?.result != null;

  // Reactive target-buff read (CharReactions live-row pattern): an SSE echo of
  // a mid-prompt activeBuffs write notifies the runtime store, re-renders
  // here, and the breakdown line re-sums from the SAME store the roll seam
  // (findWardingBondSaveBonus / consumeBurstOfIngenuityBuff) reads at commit.
  const liveTargetBuffs = useRuntimeValue(current?.targetName, 'activeBuffs', campaignName);
  const liveBuffParts = useMemo(() => getLiveBuffSaveBonusParts(liveTargetBuffs), [liveTargetBuffs]);

  const preRoll = usePreRollSaveBreakdown(current, characters, campaignName, activeMapName, liveBuffParts);

  useEffect(() => {
    setRerollUsedForSave(false);
  }, [current?.promptId]);

  const targetCharacter = findTargetCharacter(current, characters);

  const rageDamageBonus = targetCharacter?.class?.class_levels?.[(targetCharacter.level || 1) - 1]?.rage_damage ?? 2;
  const {
    fanaticalFocusAvailable, currentFocusPoints, disciplinedSurvivorAvailable,
    livingLegendAvailable, guardedMindAvailable, indomitableAvailable,
    indomitableUses, indomitableMaxUses, indomitableRerollBonus,
  } = computeRerollAvailability(current, targetCharacter, campaignName);

  const promptsRef = useRef([]);
  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  const submitSaveResult = useMemo(
    () => createSubmitSaveResult(campaignName, setPrompts, clearPrompt, promptsRef),
    [campaignName, clearPrompt]
  );

  const rerollAvailability = {
    fanaticalFocusAvailable,
    rageDamageBonus,
    currentFocusPoints,
    indomitableAvailable,
    indomitableUses,
    indomitableMaxUses,
    indomitableRerollBonus,
    disciplinedSurvivorAvailable,
    livingLegendAvailable,
    guardedMindAvailable,
  };

  const {
    handleFanaticalFocus, handleDisciplinedSurvivor, handleIndomitable,
    handleLivingLegend, handleGuardedMind,
  } = useSaveRerollHandlers({ campaignName, characters, activeMapName, current, setRerollUsedForSave, submitSaveResult, availability: rerollAvailability });

  return (
    <>
      {typeof EventSource !== 'undefined' && (
        <Subscriber
          campaignName={campaignName}
          handleEvent={(event) => {
            handleEvent(event);
            handleClearedEvent(event);
          }}
        />
      )}
      {current && (
        <SavePromptDialog
          current={current}
          prompts={prompts}
          dimmed={evasionSelection !== null}
          characters={characters}
          campaignName={campaignName}
          display={{ abilityLabel, promptHasDisadvantage, promptHasAdvantage }}
          hasResult={hasResult}
          preRoll={preRoll}
          rerollUsedForSave={rerollUsedForSave}
          rerollAvailability={rerollAvailability}
          handlers={{
            rollSave: handleRollSave,
            dismiss: handleDismiss,
            done: handleDone,
            fanaticalFocus: handleFanaticalFocus,
            indomitable: handleIndomitable,
            disciplinedSurvivor: handleDisciplinedSurvivor,
            livingLegend: handleLivingLegend,
            guardedMind: handleGuardedMind,
          }}
        />
      )}
      {evasionSelection !== null && (
        <EvasionSelectionOverlay
          prompts={prompts}
          evasionSelection={evasionSelection}
          onSelectionChange={setEvasionSelection}
          onConfirm={handleEvasionConfirm}
          onSkip={handleEvasionSkip}
        />
      )}
    </>
  );
}

export default SavePromptModal;
