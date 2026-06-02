import { useState, useCallback, useMemo } from 'react';
import utils from '../../services/utils.js';
import { rollD20 } from '../../services/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { computeAuraBonus } from '../../services/auraOfProtection.js';
import './savePromptModal.css';

function SavePromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);

  const characterNames = useMemo(() => new Set((characters || []).map(c => {
    const name = typeof c === 'string' ? c : c.name;
    return name ? utils.getName(name).toLowerCase() : '';
  })), [characters]);

  const current = prompts.length > 0 ? prompts[0] : null;

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName || !characterNames.has(targetName.toLowerCase())) return;

    setPrompts(prev => {
      if (prev.some(p => p.promptId === event.data.promptId)) return prev;
      return [...prev, { targetName, ...event.data }];
    });
  }, [campaignName, characterNames]);

  const handleClearedEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePromptCleared-`;
    if (!event.key.startsWith(prefix)) return;
    if (!event.data?.promptId) return;
    setPrompts(prev => prev.filter(p => p.promptId !== event.data.promptId));
  }, [campaignName]);

  const handleDismiss = useCallback(() => {
    if (current) {
      clearSavePrompt(campaignName, current.targetName, current.promptId);
      advance();
    }
  }, [campaignName, current, advance]);

  const handleRollSave = useCallback(async () => {
    if (!current) return;

    let saveBonus = 0;
    try {
      const stored = localStorage.getItem('combatSummary');
      if (stored) {
        const cs = JSON.parse(stored);
        const creature = cs.creatures.find(c =>
          c.name === current.targetName || c.name.startsWith(current.targetName + ' ')
        );
        if (creature?.saveBonuses?.[current.saveType] != null) {
          saveBonus = creature.saveBonuses[current.saveType];
        }
      }
    } catch { /* ignore */ }

    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName });
    const auraBonus = aura.bonus;
    const roll = rollD20();
    const total = roll + saveBonus + auraBonus;
    const success = total >= current.saveDc;
    const bonusDetail = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;

    sendSaveResult(campaignName, current.targetName, {
      promptId: current.promptId,
      success,
      roll,
      total,
      saveBonus: saveBonus + auraBonus,
    });

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: {
        promptId: current.promptId,
        targetName: current.targetName,
        saveType: current.saveType,
        saveDc: current.saveDc,
        success,
        roll,
        total,
        saveBonus: saveBonus + auraBonus,
        bonusDetail,
        rawDamage: current.rawDamage,
        dcSuccess: current.dcSuccess,
      },
    }));

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll, total, saveBonus: saveBonus + auraBonus, bonusDetail } }
        : p
    ));
  }, [campaignName, current, characters, activeMapName]);

  const handleNext = useCallback(() => {
    advance();
  }, [advance]);

  const abilityLabel = current ? (current.saveType || '').toUpperCase() : '';
  const queueCount = prompts.length;
  const hasResult = current?.result != null;

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
              {current.dcSuccess === 'half' && <p className="sp-note">Half damage on successful save</p>}
              {current.dcSuccess === 'none' && <p className="sp-note">No damage on successful save</p>}
              {current.sourceName && <p className="sp-source">Source: {current.sourceName}</p>}
              {hasResult && (
                <div className={`sp-result ${current.result.success ? 'sp-result-success' : 'sp-result-fail'}`}>
                  <p className="sp-result-label">{current.result.success ? 'SAVE SUCCESS' : 'SAVE FAILURE'}</p>
                  <p className="sp-result-total">Total: <strong>{current.result.total}</strong> vs DC {current.saveDc}</p>
                  <p className="sp-result-breakdown">d20 ({current.result.roll}) + {current.result.saveBonus}{current.result.bonusDetail ? ' ' + current.result.bonusDetail : ''}</p>
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
    </>
  );
}

export default SavePromptModal;
