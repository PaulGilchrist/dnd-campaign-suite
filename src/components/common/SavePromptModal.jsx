import { useState, useCallback, useRef, useEffect } from 'react';
import utils from '../../services/ui/utils.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { getAllyList } from '../../hooks/useAllySelection.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import './savePromptModal.css';
import { getPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';

function SavePromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const [rerollUsedForSave, setRerollUsedForSave] = useState(false);
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

      const pendingSaves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};
      const fullPrompt = { ...newPrompt, campaignName };
      if (!pendingSaves[newPrompt.promptId]) {
        pendingSaves[newPrompt.promptId] = fullPrompt;
        setRuntimeValue(campaignName, 'pendingSavePrompts', pendingSaves, campaignName);
      }
      return [...prev, newPrompt];
     });
   }, [campaignName]);

  const handleClearedEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePromptCleared-`;
    if (!event.key.startsWith(prefix)) return;
    if (!event.data?.promptId) return;

    const pendingSaves = getRuntimeValue(campaignName, 'pendingSavePrompts') || {};
    delete pendingSaves[event.data.promptId];
    setRuntimeValue(campaignName, 'pendingSavePrompts', pendingSaves, campaignName);
    getPendingPopupSetter(event.data.promptId);

    setPrompts(prev => prev.filter(p => p.promptId !== event.data.promptId));
  }, [campaignName]);

  const handleDismiss = useCallback(() => {
    if (current) {
      clearSavePrompt(campaignName, current.targetName);
      advance();
    }
  }, [campaignName, current, advance]);

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

    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
    const auraBonus = aura.bonus;

    const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
    const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
    const targetCharForEvasion = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
    const ownEvasion = targetCharForEvasion?.computedStats?.evasionEffects;
    const normalizedSaveType = normalizeSaveType(current.saveType);
    const hasOwnEvasion = !isIncapacitated && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
    const hasSelectedEvasion = !hasOwnEvasion && !isIncapacitated && selectedAlliesRef.current.has(current.targetName);
    const hasEvasion = hasOwnEvasion || hasSelectedEvasion;

    let hasAdvantage = false;
    if (current.advantage) {
      hasAdvantage = true;
    } else if (!current.disadvantage && saveModifiers && saveModifiers.length > 0) {
      const conditionSet = new Set(activeConditions);
      for (const mod of saveModifiers) {
        if (mod.target === 'saving_throw' && mod.effect === 'advantage') {
          if (mod.condition === 'against_spell') {
            hasAdvantage = true;
            break;
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
    if (!hasAdvantage && !current.disadvantage) {
      const targetActiveBuffs = getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || [];
      const isDodgeActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'dodge');
      const isDexSave = (current.saveType || '').toUpperCase() === 'DEX';
      if (isDodgeActive && isDexSave) {
        hasAdvantage = true;
      }
    }

    // Source-restricted save advantage (e.g. Holy Nimbus: advantage against Fiends/Undead for allies)
    if (!hasAdvantage && !current.disadvantage && current.attackerName) {
      const targetName = current.targetName;
      const attackerName = current.attackerName;
      const combatSummary = getCombatSummary(campaignName);
      const attackerCreature = combatSummary?.creatures?.find(c => utils.getName(c.name) === utils.getName(attackerName));
      if (attackerCreature) {
        const attackerType = (attackerCreature.type || '').toLowerCase();
        if (attackerType === 'fiend' || attackerType === 'undead') {
          for (const character of (characters || [])) {
            const charName = character.name;
            const holyNimbusActive = getRuntimeValue(charName, 'holyNimbusActive', campaignName);
            if (!holyNimbusActive) continue;
            const allyList = getAllyList(charName);
            if (allyList.includes(targetName)) {
              hasAdvantage = true;
              break;
            }
            if (allyList.length === 1) {
              hasAdvantage = true;
              break;
            }
          }
          // Also check NPCs with Holy Nimbus
          if (!hasAdvantage) {
            for (const creature of (combatSummary?.creatures || [])) {
              const creatureName = utils.getName(creature.name);
              if (creature.type === 'player') continue;
              const holyNimbusActive = getRuntimeValue(creatureName, 'holyNimbusActive', campaignName);
              if (!holyNimbusActive) continue;
              const allyList = getAllyList(creatureName);
              if (allyList.includes(targetName)) {
                hasAdvantage = true;
                break;
              }
              if (allyList.length === 1) {
                hasAdvantage = true;
                break;
              }
            }
          }
        }
      }
    }

    const roll1 = forceRollTo20Ref.current ? 20 : rollD20();
    const roll2 = current.disadvantage ? rollD20() : roll1;
    const finalRoll = current.disadvantage ? Math.min(roll1, roll2) : hasAdvantage ? Math.max(roll1, roll2) : roll1;
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
    const total = finalRoll + saveBonus + auraBonus + cosmicOmenAppliedBonus;
    const success = total >= current.saveDc;
    const auraBonusStr = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;
    const bonusDetail = [auraBonusStr, cosmicOmenDetail].filter(Boolean).join(' ') || undefined;

    const rollMode = current.disadvantage ? 'disadvantage' : hasAdvantage ? 'advantage' : 'normal';

    sendSaveResult(campaignName, current.targetName, {
      promptId: current.promptId,
      success,
      roll: finalRoll,
      total,
      saveBonus: saveBonus + auraBonus + cosmicOmenAppliedBonus,
      rawRolls: [roll1, roll2],
      mode: rollMode,
      bonusDetail,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: {
        promptId: current.promptId,
        targetName: current.targetName,
        saveType: current.saveType,
        saveDc: current.saveDc,
        success,
        roll: finalRoll,
        total,
        saveBonus: saveBonus + auraBonus + cosmicOmenAppliedBonus,
        bonusDetail,
        rawDamage: current.rawDamage,
        dcSuccess: current.dcSuccess,
        rawRolls: [roll1, roll2],
        mode: rollMode,
        evasionActive: hasEvasion,
      },
    }));

    const cs = getCombatSummary(campaignName);
    if (cs) {
      cs.lastAttack = {
        attackerName: current.attackerName || current.targetName,
        targetName: current.targetName,
        d20: finalRoll,
        d20Rolls: [roll1, roll2],
        bonus: saveBonus + auraBonus + cosmicOmenAppliedBonus,
        total,
        rollType: 'attack',
        saveType: current.saveType || null,
        saveDc: current.saveDc,
        saveResult: success ? 'success' : 'failure',
        saveConditions: current.condition ? [current.condition] : [],
        damageFormula: current.damageFormula || null,
        damageName: current.sourceName || null,
        damageType: current.damageType || null,
        rawDamage: current.rawDamage || 0,
        primaryDamage: current.rawDamage || 0,
        primaryDamageType: current.damageType || null,
        actualDamage: current.rawDamage || 0,
        damageApplied: (current.rawDamage || 0) > 0,
        timestamp: Date.now(),
      };
      storage.set('combatSummary', cs, campaignName);
    }

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll: finalRoll, total, saveBonus: saveBonus + auraBonus + cosmicOmenAppliedBonus, bonusDetail, rawRolls: [roll1, roll2], mode: rollMode } }
        : p
    ));

    forceRollTo20Ref.current = false;
    clearSavePrompt(campaignName, current.targetName);
  }, [campaignName, current, characters, activeMapName, selectedAlliesRef]);

  const handleEvasionConfirm = useCallback((selectedNames) => {
    selectedAlliesRef.current = new Set(selectedNames);
    setEvasionSelection(null);
  }, []);

  const handleEvasionSkip = useCallback(() => {
    selectedAlliesRef.current = new Set();
    setEvasionSelection(null);
  }, []);

  const handleNext = useCallback(() => {
    advance();
  }, [advance]);

  const abilityLabel = current ? (current.saveType || '').toUpperCase() : '';
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

  const handleFanaticalFocus = useCallback(async () => {
    if (!fanaticalFocusAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, 'fanaticalFocusUsed', true, campaignName);
    const rerollBonus = rageDamageBonus;
    let saveBonus = 0;
    let character = null;
    try {
      character = (characters || []).find(c => {
        const name = typeof c === 'string' ? c : c.name;
        return name && utils.getName(name) === utils.getName(current.targetName);
      });
      if (character && typeof character !== 'string') {
        saveBonus = getAbilitySaveBonus(character.computedStats || character, current.saveType);
      }
    } catch { /* ignore */ }
    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
    const roll1 = rollD20();
    const roll2 = current.disadvantage ? rollD20() : roll1;
    const finalRoll = current.disadvantage ? Math.min(roll1, roll2) : roll1;
    const total = finalRoll + saveBonus + aura.bonus + rerollBonus;
    const success = total >= current.saveDc;
    sendSaveResult(campaignName, current.targetName, {
      promptId: current.promptId,
      success,
      roll: finalRoll,
      total,
      saveBonus: saveBonus + aura.bonus + rerollBonus,
      rawRolls: [roll1, roll2],
      mode: current.disadvantage ? 'disadvantage' : 'normal',
      bonusDetail: `(+${rerollBonus} Fanatical Focus)`,
    });
    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll: finalRoll, total, saveBonus: saveBonus + aura.bonus + rerollBonus, bonusDetail: `(+${rerollBonus} Fanatical Focus)`, rawRolls: [roll1, roll2], mode: current.disadvantage ? 'disadvantage' : 'normal' } }
        : p
    ));

    addEntry(campaignName, {
      type: 'roll',
      rollType: 'save-damage',
      name: current.sourceName || 'Unknown',
      formula: current.damageFormula || '',
      rolls: [finalRoll],
      total,
      modifier: saveBonus + aura.bonus + rerollBonus,
      damageType: current.damageType || null,
      targetName: current.targetName,
      saveType: current.saveType || null,
      saveDc: current.saveDc,
      saveResult: success ? 'success' : 'failure',
      saveRoll: finalRoll,
      saveBonus: saveBonus + aura.bonus + rerollBonus,
      saveRawRolls: [roll1, roll2],
      finalDamage: null,
      note: 'fanatical_focus_reroll',
      timestamp: Date.now(),
    }).catch((e) => { console.error('[SavePromptModal] Error logging reroll:', e); });

    clearSavePrompt(campaignName, current.targetName);
  }, [fanaticalFocusAvailable, rageDamageBonus, current, campaignName, characters, activeMapName]);

  const handleDisciplinedSurvivor = useCallback(async () => {
    if (!disciplinedSurvivorAvailable || !current) return;
    setRerollUsedForSave(true);
    const newFocus = currentFocusPoints - 1;
    setRuntimeValue(current.targetName, 'focusPoints', newFocus, campaignName);
    let saveBonus = 0;
    let character = null;
    try {
      character = (characters || []).find(c => {
        const name = typeof c === 'string' ? c : c.name;
        return name && utils.getName(name) === utils.getName(current.targetName);
      });
      if (character && typeof character !== 'string') {
        saveBonus = getAbilitySaveBonus(character.computedStats || character, current.saveType);
      }
    } catch { /* ignore */ }
    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
    const roll1 = rollD20();
    const roll2 = current.disadvantage ? rollD20() : roll1;
    const finalRoll = current.disadvantage ? Math.min(roll1, roll2) : roll1;
    const total = finalRoll + saveBonus + aura.bonus;
    const success = total >= current.saveDc;
    sendSaveResult(campaignName, current.targetName, {
      promptId: current.promptId,
      success,
      roll: finalRoll,
      total,
      saveBonus: saveBonus + aura.bonus,
      rawRolls: [roll1, roll2],
      mode: current.disadvantage ? 'disadvantage' : 'normal',
      bonusDetail: '(-1 Focus Point)',
    });
    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll: finalRoll, total, saveBonus: saveBonus + aura.bonus, bonusDetail: '(-1 Focus Point)', rawRolls: [roll1, roll2], mode: current.disadvantage ? 'disadvantage' : 'normal' } }
        : p
    ));

    addEntry(campaignName, {
      type: 'roll',
      rollType: 'save-damage',
      name: current.sourceName || 'Unknown',
      formula: current.damageFormula || '',
      rolls: [finalRoll],
      total,
      modifier: saveBonus + aura.bonus,
      damageType: current.damageType || null,
      targetName: current.targetName,
      saveType: current.saveType || null,
      saveDc: current.saveDc,
      saveResult: success ? 'success' : 'failure',
      saveRoll: finalRoll,
      saveBonus: saveBonus + aura.bonus,
      saveRawRolls: [roll1, roll2],
      finalDamage: null,
      note: 'disciplined_survivor_reroll',
      timestamp: Date.now(),
    }).catch((e) => { console.error('[SavePromptModal] Error logging reroll:', e); });

    const cs = getCombatSummary(campaignName);
    if (cs) {
      cs.lastAttack = {
        ...cs.lastAttack,
        d20: finalRoll,
        d20Rolls: [roll1, roll2],
        bonus: saveBonus + aura.bonus,
        total,
        saveType: current.saveType || null,
        saveDc: current.saveDc,
        saveResult: success ? 'success' : 'failure',
        saveConditions: current.condition ? [current.condition] : [],
        timestamp: Date.now(),
      };
      storage.set('combatSummary', cs, campaignName);
    }

    clearSavePrompt(campaignName, current.targetName);
  }, [disciplinedSurvivorAvailable, currentFocusPoints, current, campaignName, characters, activeMapName]);

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
        <div className={`sp-overlay${evasionSelection !== null ? ' sp-overlay--dimmed' : ''}`} onClick={handleDismiss}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <div className="sp-header">
              <i className="fa-solid fa-shield-halved"></i> Saving Throw Required
              {queueCount > 1 && (
                <span className="sp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
              )}
            </div>
            <div className="sp-body">
              <p><strong>{current.targetName}</strong> must make a <strong>{abilityLabel}</strong> saving throw.{current.disadvantage ? <span className="sp-disadvantage-badge"> (Disadvantage)</span> : ''}</p>
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
                const hasEvasion = hasOwnEvasion || hasSharedEvasion;
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
                  <p className="sp-result-breakdown">d20 ({current.result.roll}) + {current.result.saveBonus}{current.result.bonusDetail ? ' ' + current.result.bonusDetail : ''}{current.result.mode === 'advantage' ? ' (Advantage)' : current.result.mode === 'disadvantage' ? ' (Disadvantage)' : ''}</p>
                  {!current.result.success && !rerollUsedForSave && fanaticalFocusAvailable && (
                    <button className="sp-stroke-btn" onClick={handleFanaticalFocus} type="button">
                      <i className="fa-solid fa-rotate"></i> Reroll Save (+{rageDamageBonus})
                    </button>
                  )}
                  {!current.result.success && !rerollUsedForSave && disciplinedSurvivorAvailable && (
                    <button className="sp-stroke-btn" onClick={handleDisciplinedSurvivor} type="button">
                      <i className="fa-solid fa-rotate"></i> Reroll Save (1 Focus Point)
                    </button>
                  )}
                  {!current.result.success && !rerollUsedForSave && livingLegendAvailable && (
                    <button className="sp-stroke-btn" onClick={async () => {
                      if (!current) return;
                      setRerollUsedForSave(true);
                      let localSaveBonus = 0;
                      const localChar = (characters || []).find(c => {
                        const name = typeof c === 'string' ? c : c.name;
                        return name && utils.getName(name) === utils.getName(current.targetName);
                      });
                      if (localChar && typeof localChar !== 'string') {
                        localSaveBonus = getAbilitySaveBonus(localChar.computedStats || localChar, current.saveType);
                      }
                      const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
                      const roll1 = rollD20();
                      const roll2 = current.disadvantage ? rollD20() : roll1;
                      const finalRoll = current.disadvantage ? Math.min(roll1, roll2) : roll1;
                      const total = finalRoll + localSaveBonus + aura.bonus;
                      const success = total >= current.saveDc;
                      sendSaveResult(campaignName, current.targetName, {
                        promptId: current.promptId,
                        success,
                        roll: finalRoll,
                        total,
                        saveBonus: localSaveBonus + aura.bonus,
                        rawRolls: [roll1, roll2],
                        mode: current.disadvantage ? 'disadvantage' : 'normal',
                      });
                      setPrompts(prev => prev.map((p, i) =>
                        i === 0
                          ? { ...p, result: { success, roll: finalRoll, total, saveBonus: localSaveBonus + aura.bonus, rawRolls: [roll1, roll2], mode: current.disadvantage ? 'disadvantage' : 'normal' } }
                          : p
                      ));

                      addEntry(campaignName, {
                        type: 'roll',
                        rollType: 'save-damage',
                        name: current.sourceName || 'Unknown',
                        formula: current.damageFormula || '',
                        rolls: [finalRoll],
                        total,
                        modifier: localSaveBonus + aura.bonus,
                        damageType: current.damageType || null,
                        targetName: current.targetName,
                        saveType: current.saveType || null,
                        saveDc: current.saveDc,
                        saveResult: success ? 'success' : 'failure',
                        saveRoll: finalRoll,
                        saveBonus: localSaveBonus + aura.bonus,
                        saveRawRolls: [roll1, roll2],
                        finalDamage: null,
                        note: 'living_legend_reroll',
                        timestamp: Date.now(),
                      }).catch((e) => { console.error('[SavePromptModal] Error logging reroll:', e); });

                      clearSavePrompt(campaignName, current.targetName);
                    }} type="button">
                      <i className="fa-solid fa-rotate"></i> Reroll Save
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
              ) : (
                <button className="sp-roll-btn" onClick={handleNext} type="button">
                  {queueCount > 1 ? 'Next Save' : 'Done'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {evasionSelection !== null && (
        <div className="sp-overlay sp-overlay--evasion" onClick={() => handleEvasionSkip()}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
