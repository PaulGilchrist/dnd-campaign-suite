import { useState, useCallback, useRef } from 'react';
import utils from '../../services/ui/utils.js';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import './savePromptModal.css';

function SavePromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);
  const forceRollTo20Ref = useRef(false);

  const current = prompts.length > 0 ? prompts[0] : null;

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName) return;

    setPrompts(prev => {
      if (prev.some(p => p.promptId === event.data.promptId)) return prev;
      return [...prev, { targetName, ...event.data }];
     });
   }, [campaignName]);

  const handleClearedEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePromptCleared-`;
    if (!event.key.startsWith(prefix)) return;
    if (!event.data?.promptId) return;
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

    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName });
    const auraBonus = aura.bonus;

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
        }
      }
    }

    const roll1 = forceRollTo20Ref.current ? 20 : rollD20();
    const roll2 = current.disadvantage ? rollD20() : roll1;
    const finalRoll = current.disadvantage ? Math.min(roll1, roll2) : hasAdvantage ? Math.max(roll1, roll2) : roll1;
    const total = finalRoll + saveBonus + auraBonus;
    const success = total >= current.saveDc;
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;

    const rollMode = current.disadvantage ? 'disadvantage' : hasAdvantage ? 'advantage' : 'normal';

    sendSaveResult(campaignName, current.targetName, {
      promptId: current.promptId,
      success,
      roll: finalRoll,
      total,
      saveBonus: saveBonus + auraBonus,
      rawRolls: [roll1, roll2],
      mode: rollMode,
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
        saveBonus: saveBonus + auraBonus,
        bonusDetail,
        rawDamage: current.rawDamage,
        dcSuccess: current.dcSuccess,
        rawRolls: [roll1, roll2],
        mode: rollMode,
      },
    }));

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll: finalRoll, total, saveBonus: saveBonus + auraBonus, bonusDetail, rawRolls: [roll1, roll2], mode: rollMode } }
        : p
    ));

    forceRollTo20Ref.current = false;
    clearSavePrompt(campaignName, current.targetName);
  }, [campaignName, current, characters, activeMapName]);

  const handleNext = useCallback(() => {
    advance();
  }, [advance]);

  const abilityLabel = current ? (current.saveType || '').toUpperCase() : '';
  const queueCount = prompts.length;
  const hasResult = current?.result != null;

  const targetCharacter = current && (characters || []).find(c => {
    const name = typeof c === 'string' ? c : c.name;
    return name && utils.getName(name) === utils.getName(current.targetName);
  });

  const hasStrokeOfLuck = targetCharacter && targetCharacter.computedStats?.automation?.passives?.some(
    p => p.type === 'stroke_of_luck'
  );
  const strokeOfLuckUsed = current && hasStrokeOfLuck ? getRuntimeValue(current.targetName, 'strokeOfLuckUsed', campaignName) : false;
  const strokeOfLuckAvailable = hasStrokeOfLuck && !strokeOfLuckUsed;

  const handleStrokeOfLuck = useCallback(async () => {
    if (!strokeOfLuckAvailable || !current) return;
    forceRollTo20Ref.current = true;
    await handleRollSave();
    setRuntimeValue(current.targetName, 'strokeOfLuckUsed', true, campaignName);
  }, [strokeOfLuckAvailable, handleRollSave, current, campaignName]);

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
        <div className="sp-overlay" onClick={handleDismiss}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <div className="sp-header">
              <i className="fa-solid fa-shield-halved"></i> Saving Throw Required
              {queueCount > 1 && (
                <span className="sp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
              )}
            </div>
            <div className="sp-body">
              <p><strong>{current.targetName}</strong> must make a <strong>{abilityLabel}</strong> saving throw.</p>
              <p className="sp-dc">DC {current.saveDc}</p>
              {current.dcSuccess === 'half' && (() => {
                const saveTypeUpper = (current.saveType || '').toUpperCase();
                const targetChar = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
                const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
                const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
                const ownEvasion = targetChar?.computedStats?.evasionEffects;
                const hasOwnEvasion = !isIncapacitated && ownEvasion?.some(ef => ef.saveType === saveTypeUpper);
                const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated &&
                  (characters || []).some(c => {
                    if (utils.getName(c.name) === utils.getName(current.targetName)) return false;
                    const ev = c?.computedStats?.evasionEffects;
                    return ev?.some(ef => ef.saveType === saveTypeUpper && ef.shareable && ef.shareRange >= 5);
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
                </div>
              )}
            </div>
            <div className="sp-actions">
              {!hasResult ? (
                <>
                  <button className="sp-roll-btn" onClick={handleRollSave} type="button">
                    <i className="fa-solid fa-dice-d20"></i> Roll Save
                  </button>
                  {strokeOfLuckAvailable && (
                    <button className="sp-stroke-btn" onClick={handleStrokeOfLuck} type="button">
                      <i className="fa-solid fa-star"></i> Stroke of Luck
                    </button>
                  )}
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
    </>
  );
}

export default SavePromptModal;
