import { useState, useCallback } from 'react';
import { sendConcentrationResult, clearConcentrationPrompt } from '../../services/combat/conditions/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { resolveConcentrationRoll } from './concentrationPromptRoll.js';
import './ConcentrationPromptModal.css';

function ConcentrationPromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);

  const current = prompts.length > 0 ? prompts[0] : null;

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-concentrationPrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName) return;

    setPrompts(prev => {
      if (prev.some(p => p.promptId === event.data.promptId)) return prev;
      return [...prev, { targetName, ...event.data }];
      });
     }, [campaignName]);

  const handleDismiss = useCallback(() => {
    advance();
  }, [advance]);

  const handleRoll = useCallback(async () => {
    if (!current) return;

    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
    const { saveBonus, roll, rawRolls, total, success, bonusDetail, mode, advantageSources } =
      resolveConcentrationRoll({ current, characters, campaignName, auraBonus: aura.bonus, auraSourceName: aura.sourceName });
    const totalSaveBonus = saveBonus + aura.bonus;

    sendConcentrationResult(campaignName, current.targetName, {
      promptId: current.promptId,
      success,
      roll,
      total,
      saveBonus: totalSaveBonus,
      spellName: current.spellName,
      dc: current.dc,
      mode,
      rawRolls,
      advantageSources,
    });

    window.dispatchEvent(new CustomEvent('concentration-result', {
      detail: {
        promptId: current.promptId,
        targetName: current.targetName,
        success,
        roll,
        total,
        saveBonus: totalSaveBonus,
        bonusDetail,
        spellName: current.spellName,
        dc: current.dc,
        mode,
        rawRolls,
        advantageSources,
      },
    }));

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll, total, saveBonus: totalSaveBonus, bonusDetail, mode, rawRolls, advantageSources } }
        : p
    ));

    clearConcentrationPrompt(campaignName, current.targetName);
  }, [campaignName, current, characters, activeMapName]);

  const handleNext = useCallback(() => {
    advance();
  }, [advance]);

  const queueCount = prompts.length;
  const hasResult = current?.result != null;

  return (
    <>
      {typeof EventSource !== 'undefined' && (
        <Subscriber
          campaignName={campaignName}
          handleEvent={(event) => {
            handleEvent(event);
          }}
        />
      )}
      {current && (
        <div className="cnp-overlay" onClick={handleDismiss}>
          <div className="cnp-modal" onClick={e => e.stopPropagation()}>
            <div className="cnp-header">
              <i className="fa-solid fa-spinner"></i> Concentration Check
              {queueCount > 1 && (
                <span className="cnp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
              )}
            </div>
            <div className="cnp-body">
              <p><strong>{current.targetName}</strong> must make a <strong>CONSTITUTION</strong> saving throw to maintain concentration on <strong>{current.spellName}</strong>.</p>
              <p className="cnp-dc">DC {current.dc}</p>
              {hasResult && (
                <div className={`cnp-result ${current.result.success ? 'cnp-result-success' : 'cnp-result-fail'}`}>
                  <p className="cnp-result-label">{current.result.success ? 'CONCENTRATION MAINTAINED' : 'CONCENTRATION BROKEN'}</p>
                  <p className="cnp-result-total">Total: <strong>{current.result.total}</strong> vs DC {current.dc}</p>
                  <div className="cnp-dice-row">
                    {current.result.rawRolls && current.result.rawRolls.length === 2 ? (() => {
                      const [dieA, dieB] = current.result.rawRolls;
                      const keepFirst = current.result.mode === 'advantage' ? dieA >= dieB : dieA <= dieB;
                      return (
                      <>
                        <span className={`cnp-die${keepFirst ? ' cnp-die-selected' : ' cnp-die-discarded'}`}>
                          d20: {dieA} {keepFirst ? '(kept)' : '(discarded)'}
                        </span>
                        <span className={`cnp-die${!keepFirst ? ' cnp-die-selected' : ' cnp-die-discarded'}`}>
                          d20: {dieB} {!keepFirst ? '(kept)' : '(discarded)'}
                        </span>
                      </>
                      );
                    })() : (
                      <span className="cnp-die cnp-die-selected">d20: {current.result.roll}</span>
                    )}
                    {current.result.mode && current.result.mode !== 'normal' && (
                      <span className={`cnp-mode-badge ${current.result.mode}`}>{current.result.mode.toUpperCase()}</span>
                    )}
                  </div>
                  <p className="cnp-result-breakdown">d20 ({current.result.roll}) + {current.result.saveBonus}{current.result.bonusDetail ? ' ' + current.result.bonusDetail : ''}</p>
                </div>
              )}
            </div>
            <div className="cnp-actions">
              {!hasResult ? (
                <>
                  <button className="cnp-roll-btn" onClick={handleRoll} type="button">
                    <i className="fa-solid fa-dice-d20"></i> Roll Con Save
                  </button>
                  <button className="cnp-dismiss-btn" onClick={handleDismiss} type="button">
                    Dismiss
                  </button>
                </>
              ) : (
                <button className="cnp-roll-btn" onClick={handleNext} type="button">
                  {queueCount > 1 ? 'Next Check' : 'Done'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConcentrationPromptModal;
