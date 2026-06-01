import { useState, useCallback, useMemo } from 'react';
import utils from '../../services/utils.js';

import { sendDeathSaveResult, clearDeathSavePrompt } from '../../services/savePromptService.js';
import * as deathSaveRules from '../../services/deathSaveRules.js';
import Subscriber from './Subscriber.jsx';
import storage from '../../services/storage.js';
import './deathSavePromptModal.css';

function DeathSavePromptModal({ campaignName, characters }) {
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
    const prefix = `change-${campaignName}-deathSavePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName || !characterNames.has(targetName.toLowerCase())) return;

    setPrompts(prev => {
      if (prev.some(p => p.promptId === event.data.promptId)) return prev;
      return [...prev, { targetName, ...event.data }];
    });
  }, [campaignName, characterNames]);

  const handleRoll = useCallback(() => {
    if (!current) return;

    let currentSaves = [false, false, false];
    let currentFailures = [false, false, false];
    try {
      const savedSaves = storage.getProperty(current.targetName, 'deathSaves', campaignName);
      const savedFailures = storage.getProperty(current.targetName, 'deathFailures', campaignName);
      if (savedSaves) currentSaves = savedSaves;
      if (savedFailures) currentFailures = savedFailures;
    } catch { /* ignore */ }

    const result = deathSaveRules.rollDeathSave(currentSaves, currentFailures);

    sendDeathSaveResult(campaignName, current.targetName, {
      promptId: current.promptId,
      roll: result.roll,
      isNat20: result.isNat20,
      isNat1: result.isNat1,
      success: result.result === 'success' || result.result === 'nat20' || result.result === 'stable',
      result: result.result,
      newSaves: result.newSaves,
      newFailures: result.newFailures,
      restoredToHp: result.restoredToHp,
    });

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: {
        promptId: current.promptId,
        targetName: current.targetName,
        roll: result.roll,
        isNat20: result.isNat20,
        isNat1: result.isNat1,
        success: result.result === 'success' || result.result === 'nat20' || result.result === 'stable',
        result: result.result,
        newSaves: result.newSaves,
        newFailures: result.newFailures,
        restoredToHp: result.restoredToHp,
       },
     }));

    storage.setProperty(current.targetName, 'deathSaves', result.newSaves, campaignName);
    storage.setProperty(current.targetName, 'deathFailures', result.newFailures, campaignName);
    clearDeathSavePrompt(campaignName, current.targetName);

    if (result.restoredToHp !== null) {
      storage.setProperty(current.targetName, 'currentHitPoints', result.restoredToHp, campaignName);
    }

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { ...result } }
        : p
    ));
  }, [campaignName, current]);

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
        <div className="dsp-overlay" onClick={handleNext}>
          <div className="dsp-modal" onClick={e => e.stopPropagation()}>
            <div className="dsp-header">
              <i className="fas fa-skull-crossbones"></i> Death Saving Throw
              {queueCount > 1 && (
                <span className="dsp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
              )}
            </div>
            <div className="dsp-body">
              <p><strong>{current.targetName}</strong> must make a <strong>Death Saving Throw</strong>.</p>
              {hasResult && (
                <div className={`dsp-result ${current.result.isNat20 ? 'dsp-result-nat20' : current.result.isNat1 ? 'dsp-result-nat1' : current.result.result === 'success' || current.result.result === 'stable' ? 'dsp-result-success' : 'dsp-result-fail'}`}>
                  <p className="dsp-result-label">
                    {current.result.isNat20 && 'NATURAL 20 — STABILIZED!'}
                    {current.result.isNat1 && 'NATURAL 1 — DOUBLE FAILURE'}
                    {!current.result.isNat20 && !current.result.isNat1 && (current.result.result === 'stable' ? 'STABILIZED!' : current.result.result === 'success' ? 'DEATH SAVE SUCCESS' : current.result.result === 'dead' ? 'DEAD' : 'DEATH SAVE FAILURE')}
                  </p>
                  <p className="dsp-result-total">Roll: <strong>{current.result.roll}</strong></p>
                  {current.result.restoredToHp !== null && <p className="dsp-result-hp">Restored to {current.result.restoredToHp} HP</p>}
                </div>
              )}
            </div>
            <div className="dsp-actions">
              {!hasResult ? (
                <button className="dsp-roll-btn" onClick={handleRoll} type="button">
                  <i className="fa-solid fa-dice-d20"></i> Roll Death Save
                </button>
              ) : (
                <button className="dsp-roll-btn" onClick={handleNext} type="button">
                  {queueCount > 1 ? 'Next' : 'Done'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DeathSavePromptModal;
