import { useState, useCallback } from 'react';

import { sendDeathSaveResult, clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import Subscriber from './Subscriber.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import './DeathSavePromptModal.css';

function isSuccessResult(result) {
  return result.result === 'success' || result.result === 'nat20' || result.result === 'stable';
}

function buildDeathSaveOutcome(current, result) {
  return {
    promptId: current.promptId,
    targetName: current.targetName,
    roll: result.roll,
    isNat20: result.isNat20,
    isNat1: result.isNat1,
    success: isSuccessResult(result),
    result: result.result,
    newSaves: result.newSaves,
    newFailures: result.newFailures,
    restoredToHp: result.restoredToHp,
  };
}

function readDeathSaveState(targetName) {
  let currentSaves = [false, false, false];
  let currentFailures = [false, false, false];
  try {
    const savedSaves = getRuntimeValue(targetName, 'deathSaves');
    const savedFailures = getRuntimeValue(targetName, 'deathFailures');
    if (savedSaves) currentSaves = savedSaves;
    if (savedFailures) currentFailures = savedFailures;
  } catch { /* ignore */ }
  return { currentSaves, currentFailures };
}

function resultLabel(result) {
  if (result.isNat20) return 'NATURAL 20 — STABILIZED!';
  if (result.isNat1) return 'NATURAL 1 — DOUBLE FAILURE';
  if (result.result === 'stable') return 'STABILIZED!';
  if (result.result === 'success') return 'DEATH SAVE SUCCESS';
  if (result.result === 'dead') return 'DEAD';
  return 'DEATH SAVE FAILURE';
}

function resultCssClass(result) {
  if (result.isNat20) return 'dsp-result-nat20';
  if (result.isNat1) return 'dsp-result-nat1';
  if (isSuccessResult(result)) return 'dsp-result-success';
  return 'dsp-result-fail';
}

function DeathSaveResult({ result }) {
  return (
    <div className={`dsp-result ${resultCssClass(result)}`}>
      <p className="dsp-result-label">{resultLabel(result)}</p>
      <p className="dsp-result-total">Roll: <strong>{result.roll}</strong></p>
      {result.restoredToHp !== null && <p className="dsp-result-hp">Restored to {result.restoredToHp} HP</p>}
    </div>
  );
}

function DeathSavePromptModal({ campaignName }) {
  const [prompts, setPrompts] = useState([]);

  const current = prompts.length > 0 ? prompts[0] : null;

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-deathSavePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const targetName = event.key.slice(prefix.length);
    if (!targetName) return;

    setPrompts(prev => {
      if (prev.some(p => p.promptId === event.data.promptId)) return prev;
      return [...prev, { targetName, ...event.data }];
     });
    }, [campaignName]);

  const handleRoll = useCallback(() => {
    if (!current) return;

    const { currentSaves, currentFailures } = readDeathSaveState(current.targetName);
    const result = deathSaveRules.rollDeathSave(currentSaves, currentFailures);
    const { targetName, ...sendPayload } = buildDeathSaveOutcome(current, result);

    sendDeathSaveResult(campaignName, current.targetName, sendPayload);

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: { ...sendPayload, targetName },
    }));

    setRuntimeValue(current.targetName, 'deathSaves', result.newSaves, campaignName);
    setRuntimeValue(current.targetName, 'deathFailures', result.newFailures, campaignName);
    if (result.result === 'dead') {
      setRuntimeValue(current.targetName, 'isDead', 1, campaignName);
    }
    clearDeathSavePrompt(campaignName, current.targetName);

    if (result.restoredToHp !== null) {
      setRuntimeValue(current.targetName, 'currentHitPoints', result.restoredToHp, campaignName);
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
        <div className="dsp-overlay" onClick={(e) => {
          if (e.target.closest('.dsp-modal')) return;
          handleNext?.();
        }}>
          <div className="dsp-modal">
            <div className="dsp-header">
              <i className="fas fa-skull-crossbones"></i> Death Saving Throw
              {queueCount > 1 && (
                <span className="dsp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
              )}
            </div>
            <div className="dsp-body">
              <p><strong>{current.targetName}</strong> must make a <strong>Death Saving Throw</strong>.</p>
              {hasResult && <DeathSaveResult result={current.result} />}
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
