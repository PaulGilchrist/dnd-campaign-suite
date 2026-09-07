import { useState, useCallback, useRef, useEffect } from 'react';
import utils from '../../services/ui/utils.js';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { getSaveDisadvantage, getHolyAuraSaveAdvantage, getHolyNimbusSaveAdvantage } from './savePromptUtils.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import { addEntry } from '../../services/ui/logService.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import './SavePromptModal.css';
import { getPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { createFanaticalFocusHandler, createDisciplinedSurvivorHandler, createGuardedMindHandler, createLivingLegendHandler, createIndomitableHandler } from './savePromptHandlers.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';

function SavePromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const [rerollUsedForSave, setRerollUsedForSave] = useState(false);
  const [lastEvasionState, setLastEvasionState] = useState(false);
  const forceRollTo20Ref = useRef(false);
  const selectedAlliesRef = useRef(new Set());

  const current = prompts.length > 0 ? prompts[0] : null;

  const hasShareableEvasion = !current ? false : (() => {
    const normalizedSaveType = normalizeSaveType(current.saveType);
    if (current.dcSuccess !== 'half') return false;
    return (characters || []).some(c => {
      if (utils.getName(c.name) === utils.getName(current.targetName)) return false;
      const ev = c?.computedStats?.evasionEffects;
      return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
    });
  })();

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

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePrompt-`;
    if (!event.key.startsWith(prefix)) return;

    setPrompts(prev => {
      if (prev.some(p => p.promptId === event.data.promptId)) return prev;
      const { sourceAttackerName, attackerName: eventDataAttackerName, targetName: dataTargetName, ...restData } = event.data;
      const targetName = dataTargetName || event.key.slice(prefix.length) || null;
      const newPrompt = { targetName, attackerName: eventDataAttackerName || sourceAttackerName, ...restData };

      console.debug(`[saveDebug] SavePromptModal.handleEvent SSE prompt received`, { promptId: newPrompt.promptId, targetName: newPrompt.targetName, sourceName: newPrompt.sourceName, saveType: newPrompt.saveType, saveDc: newPrompt.saveDc, keys: Object.keys(newPrompt) });
      return [...prev, newPrompt];
     });
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
    if (current) {
      const result = current.result;
      if (result) {
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
        });

        window.dispatchEvent(new CustomEvent('save-result', {
          detail: {
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
            evasionActive: lastEvasionState,
          },
        }));
      }
      clearSavePrompt(campaignName, current.targetName);
      advance();
    }
  }, [campaignName, current, lastEvasionState, advance]);

  const handleRollSave = useCallback(async () => {
    if (!current) return;

    let saveBonus = 0;
    let saveModifiers = null;
    let activeConditions = [];
    let character = null;
    try {
      character = (characters || []).find(c => {
        const name = typeof c === 'string' ? c : c.name;
        return name && utils.getName(name) === utils.getName(current.targetName);
      });
      if (character && typeof character !== 'string') {
        saveBonus = getAbilitySaveBonus(character.computedStats || character, current.saveType);
        saveModifiers = character.saveModifiers || character.computedStats?.saveModifiers;
        activeConditions = getRuntimeValue(current.targetName, 'activeConditions') || [];
      }
    } catch { /* ignore */ }

    if (!character) {
      const combatSummary = getCombatSummary(campaignName);
      const creature = combatSummary?.creatures?.find(
        c => utils.getName(c.name) === utils.getName(current.targetName)
      );
      if (creature) {
        saveBonus = creature.saveBonuses?.[current.saveType?.toLowerCase()] ?? 0;
      }
    }

    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
    const auraBonus = aura.bonus;

    const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
    const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
    const targetCharForEvasion = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
    const ownEvasion = targetCharForEvasion?.computedStats?.evasionEffects;
    const normalizedSaveType = normalizeSaveType(current.saveType);
    const hasOwnEvasion = !isIncapacitated && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
    const hasSelectedEvasion = !hasOwnEvasion && !isIncapacitated && selectedAlliesRef.current.has(current.targetName);
    const hasEvasion = hasOwnEvasion || hasSelectedEvasion || isCircleOfPowerActive(current.targetName, campaignName);
    setLastEvasionState(hasEvasion);

    const hasDisadvantage = getSaveDisadvantage(current, campaignName);

    let hasAdvantage = false;
    if (current.advantage) {
      hasAdvantage = true;
    } else if (!hasDisadvantage && saveModifiers && saveModifiers.length > 0) {
      const conditionSet = new Set(activeConditions);
      for (const mod of saveModifiers) {
        if (mod.target === 'saving_throw' && mod.effect === 'advantage') {
          if (mod.condition === 'against_spell') {
            // CLA-324: against_spell advantage only on saves against spells — spell-origin is
            // identifiable from the prompt flag (monster-card save attacks, spell save-damage
            // prompts) or a spell-save-owned campaign lastAttack from the spell pipeline.
            const lastAttackOrigin = getRuntimeValue('campaign', 'lastAttack', campaignName) || {};
            const spellOrigin = current.isSpellDamage === true ||
              (lastAttackOrigin.rollType === 'spell-save' && (!current.attackerName || lastAttackOrigin.attackerName === current.attackerName));
            if (spellOrigin) {
              hasAdvantage = true;
              break;
            }
          }
          if (mod.condition && conditionSet.has(mod.condition)) {
            hasAdvantage = true;
            break;
          }
          if (mod.saveType && current.condition && mod.condition === current.condition) {
            hasAdvantage = true;
            break;
          }
        }
      }
    }

      // Dodge: advantage on Dexterity saving throws only
    if (!hasAdvantage && !hasDisadvantage) {
      const targetActiveBuffs = getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || [];
      const isDodgeActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'dodge');
      const isDexSave = (current.saveType || '').toUpperCase() === 'DEX';
      if (isDodgeActive && isDexSave) {
        hasAdvantage = true;
      }
    }

    // Beacon of Hope: advantage on Wisdom saving throws
    if (!hasAdvantage && !hasDisadvantage) {
      const targetCharForBeacon = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
      if (targetCharForBeacon?.targetEffects?.some(te => te.effect === 'beacon_of_hope') && (current.saveType || '').toUpperCase() === 'WIS') {
        hasAdvantage = true;
      }
    }

    // Circle of Power: blanket advantage on saving throws
    if (!hasAdvantage && !hasDisadvantage) {
      if (isCircleOfPowerActive(current.targetName, campaignName)) {
        hasAdvantage = true;
      }
    }

    // Holy Aura: advantage on all saving throws for warded targets
    if (!hasAdvantage && !hasDisadvantage && getHolyAuraSaveAdvantage(current, campaignName)) {
      hasAdvantage = true;
    }

    // Source-restricted save advantage (e.g. Holy Nimbus: advantage against Fiends/Undead for allies)
    if (!hasAdvantage && !hasDisadvantage && getHolyNimbusSaveAdvantage(current, characters, campaignName)) {
      hasAdvantage = true;
    }

    const roll1 = forceRollTo20Ref.current ? 20 : rollD20();
    const roll2 = (hasDisadvantage || hasAdvantage) ? rollD20() : roll1;
    const finalRoll = hasDisadvantage ? Math.min(roll1, roll2) : hasAdvantage ? Math.max(roll1, roll2) : roll1;
    let cosmicOmenAppliedBonus = 0;
    let cosmicOmenDetail = '';
    const cosmicOmenPendingRaw = getRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus');
    if (cosmicOmenPendingRaw) {
      try {
        const pending = JSON.parse(cosmicOmenPendingRaw);
        if (pending && typeof pending.value === 'number' && pending.value > 0) {
          const isWeal = pending.type === 'Weal';
          cosmicOmenAppliedBonus = isWeal ? pending.value : -pending.value;
          cosmicOmenDetail = `(${cosmicOmenAppliedBonus} from ${pending.type})`;
          setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', null, campaignName, true);
        }
      } catch (_e) { /* ignore */ }
    }

    // Bane: apply -1d4 penalty to saving throws for cursed targets
    let baneSavePenalty = 0;
    let baneSaveRoll = null;
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const baneEffects = allTargetEffects.filter(te => te.target === current.targetName && te.effect === 'bane_penalty');
    if (baneEffects.length > 0) {
      const r = rollExpression('1d4');
      if (r) {
        baneSavePenalty = -r.total;
        baneSaveRoll = r.total;
      }
    }

    // Bane on attacker: grant +1d4 to the target's save when the attacker is cursed by Bane
    let baneAttackerBonus = 0;
    let baneAttackerRoll = null;
    if (current.attackerName) {
      const baneOnAttacker = allTargetEffects.filter(te => te.target === current.attackerName && te.effect === 'bane_penalty');
      if (baneOnAttacker.length > 0) {
        const r = rollExpression('1d4');
        if (r) {
          baneAttackerBonus = r.total;
          baneAttackerRoll = r.total;
        }
      }
    }

    // Bless: add 1d4 to saving throws
    let blessSaveBonus = 0;
    let blessSaveRoll = null;
    const blessEffects = allTargetEffects.filter(te => te.target === current.targetName && te.effect === 'bless_bonus');
    if (blessEffects.length > 0) {
      const r = rollExpression('1d4');
      if (r) {
        blessSaveBonus += r.total;
        blessSaveRoll = r.total;
      }
    }

    // Warding Bond: +1 flat bonus to saving throws
    let wardingBondSaveBonus = 0;
    const targetBuffs = getRuntimeValue(current.targetName, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
    const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond' && b.saveBonus);
    if (wardingBondBuff) {
      wardingBondSaveBonus = wardingBondBuff.saveBonus;
    }

    const total = finalRoll + saveBonus + auraBonus + cosmicOmenAppliedBonus + baneSavePenalty + blessSaveBonus + baneAttackerBonus + wardingBondSaveBonus;
    const success = total >= current.saveDc;
    const auraBonusStr = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;
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
    const bonusDetail = bonusDetailParts.filter(Boolean).join(' ') || undefined;

    const rollMode = hasDisadvantage ? 'disadvantage' : hasAdvantage ? 'advantage' : 'normal';

    const cs = getCombatSummary(campaignName);
    if (cs) {
      const lastAttackData = {
        attackerName: current.attackerName || current.targetName,
        targetName: current.targetName,
        d20: finalRoll,
        d20Rolls: [roll1, roll2],
        bonus: saveBonus + auraBonus + cosmicOmenAppliedBonus,
        total,
        rollType: 'save',
        saveType: current.saveType || null,
        saveDc: current.saveDc,
        saveResult: success ? 'success' : 'failure',
        saveConditions: current.condition ? [current.condition] : [],
        damageFormula: current.damageFormula || null,
        attackName: current.sourceName || current.name || null,
        damageType: current.damageType || null,
        rawDamage: current.rawDamage || 0,
        primaryDamage: current.rawDamage || 0,
        primaryDamageType: current.damageType || null,
        actualDamage: current.rawDamage || 0,
        damageApplied: (current.rawDamage || 0) > 0,
        ...(current.secondaryFormula ? {
          secondaryFormula: current.secondaryFormula,
          secondaryDamageType: current.secondaryDamageType || null,
          secondaryRawDamage: current.secondaryRawDamage || 0,
          secondaryTotal: current.secondaryRawDamage || 0,
        } : {}),
        timestamp: Date.now(),
      };
      storage.set('lastAttack', lastAttackData, campaignName);
    }

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll: finalRoll, total, saveBonus: saveBonus + auraBonus + cosmicOmenAppliedBonus + baneSavePenalty + blessSaveBonus + baneAttackerBonus + wardingBondSaveBonus, bonusDetail, rawRolls: [roll1, roll2], mode: rollMode, baneRoll: baneSaveRoll, blessRoll: blessSaveRoll, baneAttackerRoll: baneAttackerRoll } }
        : p
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
      baneRoll: result.baneRoll,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: {
        promptId: current.promptId,
        targetName: current.targetName,
        saveType: current.saveType,
        saveDc: current.saveDc,
        success: result.success,
        roll: result.roll,
        total: result.total,
        saveBonus,
        bonusDetail: result.bonusDetail,
        baneRoll: result.baneRoll,
        rawDamage: current.rawDamage,
        dcSuccess: current.dcSuccess,
        rawRolls,
        mode: rollMode,
        evasionActive: lastEvasionState,
      },
    }));
    clearSavePrompt(campaignName, current.targetName);
    advance();
  }, [campaignName, current, lastEvasionState, advance]);

  const handleEvasionConfirm = useCallback((selectedNames) => {
    selectedAlliesRef.current = new Set(selectedNames);
    setEvasionSelection(null);
  }, []);

  const handleEvasionSkip = useCallback(() => {
    selectedAlliesRef.current = new Set();
    setEvasionSelection(null);
  }, []);

  const abilityLabel = current ? (current.saveType || '').toUpperCase() : '';
  const promptHasDisadvantage = current ? getSaveDisadvantage(current, campaignName) : false;
  const promptHasAdvantage = current ? (!!current.advantage || getHolyAuraSaveAdvantage(current, campaignName)) : false;
  const queueCount = prompts.length;
  const hasResult = current?.result != null;

  useEffect(() => {
    setRerollUsedForSave(false);
  }, [current?.promptId]);

  const targetCharacter = current && (characters || []).find(c => {
    const name = typeof c === 'string' ? c : c.name;
    return name && utils.getName(name) === utils.getName(current.targetName);
  });

  const rageDamageBonus = targetCharacter?.class?.class_levels?.[(targetCharacter.level || 1) - 1]?.rage_damage ?? 2;
  const fanaticalFocusUsed = current ? getRuntimeValue(current.targetName, 'fanaticalFocusUsed', campaignName) : false;
  const activeBuffsForSave = getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || [];
  const isRagingForSave = Array.isArray(activeBuffsForSave) && activeBuffsForSave.some(b => b.damageBonusExpression);
  const fanaticalFocusAvailable = isRagingForSave && !fanaticalFocusUsed;

  const livingLegendActive = current ? getRuntimeValue(current.targetName, 'livingLegendActive', campaignName) === true : false;
  const indomitableUses = current ? Number(getRuntimeValue(current?.targetName, 'indomitableUses', campaignName) ?? 0) : 0;
  const indomitableMax = 1;
  const targetClassLevel = targetCharacter?.class?.class_levels?.[(targetCharacter.level || 1) - 1] || {};
  const maxFocusPoints = targetClassLevel.focus_points || 0;
  const currentFocusPoints = current ? Number(getRuntimeValue(current.targetName, 'focusPoints', campaignName) ?? maxFocusPoints) : 0;
  const disciplinedSurvivorAvailable = !fanaticalFocusUsed && currentFocusPoints > 0;
  const livingLegendAvailable = livingLegendActive && !fanaticalFocusUsed && indomitableUses < indomitableMax;

  const guardedMindUsed = current ? getRuntimeValue(current.targetName, '_guardedMind_usedRest', campaignName) : false;
  const guardedMindSpecialAction = (targetCharacter?.computedStats?.automation?.specialActions || []).find(
    a => a.type === 'auto_reroll' && a.effect === 'override_fail_to_success' && a.oncePer === 'short_or_long_rest'
  );
  const validSaveTypes = ['Intelligence', 'Wisdom', 'Charisma', 'INT', 'WIS', 'CHA'];
  const isValidSaveType = current && validSaveTypes.includes(current.saveType);
  const guardedMindAvailable = !guardedMindUsed && guardedMindSpecialAction && isValidSaveType;

  // Indomitable (Fighter lv9+): reroll a failed save with a +fighter level bonus,
  // tracked via runtime `indomitableUses` (recharged on a Long Rest).
  const targetSaveModifiersForIndomitable = targetCharacter?.saveModifiers || targetCharacter?.computedStats?.saveModifiers || [];
  const indomitableModifier = targetSaveModifiersForIndomitable.find(
    m => m.effect === 'reroll' && m.target === 'saving_throw' && (m.source === 'Indomitable' || /fighter_level/i.test(m.bonusExpression || ''))
  );
  const indomitableFeatureLevel = targetCharacter?.level ?? targetCharacter?.computedStats?.level ?? 0;
  const indomitableMaxUses = indomitableFeatureLevel >= 17 ? 3 : indomitableFeatureLevel >= 13 ? 2 : 1;
  const indomitableAvailable = !!indomitableModifier && indomitableUses < indomitableMaxUses;
  const indomitableRerollBonus = indomitableModifier
    ? (evaluateAutoExpression(indomitableModifier.bonusExpression || '0', { level: indomitableFeatureLevel }) || indomitableFeatureLevel)
    : 0;

  const submitSaveResult = useCallback((saveData) => {
    const {
      promptId, targetName, success, roll, total, saveBonus, rawRolls, mode, bonusDetail,
      saveType, saveDc, condition, sourceName, damageFormula, damageType, rawDamage, dcSuccess,
      secondaryFormula, secondaryDamageType, secondaryRawDamage,
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

    const cs = getCombatSummary(campaignName);
    if (cs) {
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

    if (success && rawDamage > 0) {
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

    clearSavePrompt(campaignName, targetName);
  }, [campaignName]);

  const handleFanaticalFocus = useCallback(async () => {
    if (!fanaticalFocusAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, 'fanaticalFocusUsed', true, campaignName);
    const handler = createFanaticalFocusHandler({ campaignName, characters, activeMapName, current, rageDamageBonus, fanaticalFocusAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [fanaticalFocusAvailable, rageDamageBonus, current, campaignName, characters, activeMapName, submitSaveResult]);

  const handleDisciplinedSurvivor = useCallback(async () => {
    if (!disciplinedSurvivorAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, 'focusPoints', currentFocusPoints - 1, campaignName);
    const handler = createDisciplinedSurvivorHandler({ campaignName, current, currentFocusPoints, disciplinedSurvivorAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [disciplinedSurvivorAvailable, currentFocusPoints, current, campaignName, submitSaveResult]);

  const handleIndomitable = useCallback(async () => {
    if (!indomitableAvailable || !current) return;
    setRerollUsedForSave(true);
    const handler = createIndomitableHandler({ campaignName, characters, activeMapName, current, indomitableAvailable, currentUses: indomitableUses, maxUses: indomitableMaxUses, rerollBonus: indomitableRerollBonus, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [indomitableAvailable, indomitableUses, indomitableMaxUses, indomitableRerollBonus, current, campaignName, characters, activeMapName, submitSaveResult]);

  const handleGuardedMind = useCallback(async () => {
    if (!guardedMindAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, '_guardedMind_usedRest', 'rest', campaignName);
    const handler = createGuardedMindHandler({ campaignName, current, guardedMindAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [guardedMindAvailable, current, campaignName, submitSaveResult]);

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
        <div className={`sp-overlay${evasionSelection !== null ? ' sp-overlay--dimmed' : ''}`} onClick={(e) => {
          if (e.target.closest('.sp-modal')) return;
          handleDismiss?.();
        }}>
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
              {current.dcSuccess === 'half' && (() => {
                const normalizedSaveType = normalizeSaveType(current.saveType);
                const targetChar = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
                const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
                const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
                const ownEvasion = targetChar?.computedStats?.evasionEffects;
                const hasOwnEvasion = !isIncapacitated && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
                const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated &&
                  (characters || []).some(c => {
                    if (utils.getName(c.name) === utils.getName(current.targetName)) return false;
                    const ev = c?.computedStats?.evasionEffects;
                    return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
                  });
                const hasEvasion = hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(current.targetName, campaignName);
                return hasEvasion
                  ? <p className="sp-note sp-evasion">Evasion: No damage on success, half damage on failure</p>
                  : <p className="sp-note">Half damage on successful save</p>;
              })()}
              {current.dcSuccess === 'none' && <p className="sp-note">No damage on successful save</p>}
              {current.sourceName && <p className="sp-source">Source: {current.sourceName}</p>}
              {hasResult && (
                <div className={`sp-result ${current.result.success ? 'sp-result-success' : 'sp-result-fail'}`}>
                  <p className="sp-result-label">{current.result.success ? 'SAVE SUCCESS' : 'SAVE FAILURE'}</p>
                  <p className="sp-result-total">Total: <strong>{current.result.total}</strong> vs DC {current.saveDc}</p>
                  <p className="sp-result-breakdown">d20 ({current.result.mode !== 'normal' && Array.isArray(current.result.rawRolls) && current.result.rawRolls.length === 2 ? `${current.result.rawRolls[0]}, ${current.result.rawRolls[1]}` : current.result.roll}) + {current.result.saveBonus}{current.result.bonusDetail ? ' ' + current.result.bonusDetail : ''}{current.result.mode === 'advantage' ? ' (Advantage)' : current.result.mode === 'disadvantage' ? ' (Disadvantage)' : ''}</p>
                  {!current.result.success && !rerollUsedForSave && fanaticalFocusAvailable && (
                    <button className="sp-stroke-btn" onClick={handleFanaticalFocus} type="button">
                      <i className="fa-solid fa-rotate"></i> Reroll Save (+{rageDamageBonus})
                    </button>
                  )}
                  {!current.result.success && !rerollUsedForSave && indomitableAvailable && (
                    <button className="sp-stroke-btn" onClick={handleIndomitable} type="button">
                      <i className="fa-solid fa-rotate"></i> Indomitable (+{indomitableRerollBonus})
                    </button>
                  )}
                  {!current.result.success && !rerollUsedForSave && disciplinedSurvivorAvailable && (
                    <button className="sp-stroke-btn" onClick={handleDisciplinedSurvivor} type="button">
                      <i className="fa-solid fa-rotate"></i> Reroll Save (1 Focus Point)
                    </button>
                  )}
                  {!current.result.success && !rerollUsedForSave && livingLegendAvailable && (
                    <button className="sp-stroke-btn" onClick={async () => {
                      const handler = createLivingLegendHandler({ campaignName, characters, activeMapName, current, livingLegendAvailable, setRerollUsedForSave, submitSaveResult });
                      await handler();
                    }} type="button">
                      <i className="fa-solid fa-rotate"></i> Reroll Save
                    </button>
                  )}
                  {!current.result.success && !rerollUsedForSave && guardedMindAvailable && (
                    <button className="sp-stroke-btn" onClick={handleGuardedMind} type="button">
                      <i className="fa-solid fa-shield-halved"></i> Guarded Mind
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="sp-actions">
              {!hasResult ? (
                <>
                  <button className="sp-roll-btn" onClick={handleRollSave} type="button">
                    <i className="fa-solid fa-dice-d20"></i> Roll Save
                  </button>
                  <button className="sp-dismiss-btn" onClick={handleDismiss} type="button">
                    Dismiss
                  </button>
                </>
              )               : (
                <button className="sp-roll-btn" onClick={handleDone} type="button">
                  {queueCount > 1 ? 'Next Save' : 'Done'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {evasionSelection !== null && (
        <div className="sp-overlay sp-overlay--evasion" onClick={(e) => {
          if (e.target.closest('.sp-modal')) return;
          handleEvasionSkip?.();
        }}>
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
                    className={`secondary-target-row ${evasionSelection?.selectedAllies?.includes(prompt.targetName) ? 'secondary-target-selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentSelection = evasionSelection?.selectedAllies || [];
                      const isSelected = currentSelection.includes(prompt.targetName);
                      setEvasionSelection({
                        selectedAllies: isSelected
                          ? currentSelection.filter(n => n !== prompt.targetName)
                          : [...currentSelection, prompt.targetName],
                      });
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={(evasionSelection?.selectedAllies || []).includes(prompt.targetName)}
                      onChange={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleEvasionConfirm(evasionSelection?.selectedAllies || []);
                }}
                disabled={(evasionSelection?.selectedAllies || []).length === 0}
                type="button"
              >
                <i className="fa-solid fa-shield-halved"></i> Apply Evasion ({(evasionSelection?.selectedAllies || []).length})
              </button>
              <button className="sp-dismiss-btn" onClick={(e) => {
                e.stopPropagation();
                handleEvasionSkip();
              }} type="button">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SavePromptModal;
