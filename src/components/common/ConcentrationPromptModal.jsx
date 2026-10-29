import { useState, useCallback, useRef } from 'react';
import { sendConcentrationResult, clearConcentrationPrompt } from '../../services/combat/conditions/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { resolveConcentrationRoll } from './concentrationPromptRoll.js';
import './ConcentrationPromptModal.css';

function ConcentrationDiceRow({ result }) {
  if (result.rawRolls && result.rawRolls.length === 2) {
    const [dieA, dieB] = result.rawRolls;
    const keepFirst = result.mode === 'advantage' ? dieA >= dieB : dieA <= dieB;
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
  }
  return <span className="cnp-die cnp-die-selected">d20: {result.roll}</span>;
}

function ConcentrationResultPanel({ current }) {
  const result = current.result;
  return (
    <div className={`cnp-result ${result.success ? 'cnp-result-success' : 'cnp-result-fail'}`}>
      <p className="cnp-result-label">{result.success ? 'CONCENTRATION MAINTAINED' : 'CONCENTRATION BROKEN'}</p>
      <p className="cnp-result-total">Total: <strong>{result.total}</strong> vs DC {current.dc}</p>
      <div className="cnp-dice-row">
        <ConcentrationDiceRow result={result} />
        {result.mode && result.mode !== 'normal' && (
          <span className={`cnp-mode-badge ${result.mode}`}>{result.mode.toUpperCase()}</span>
        )}
      </div>
      <p className="cnp-result-breakdown">d20 ({result.roll}) + {result.saveBonus}{result.bonusDetail ? ' ' + result.bonusDetail : ''}</p>
    </div>
  );
}

function ConcentrationActions({ hasResult, queueCount, onRoll, onDismiss, onNext }) {
  if (!hasResult) {
    return (
      <>
        <button className="cnp-roll-btn" onClick={onRoll} type="button">
          <i className="fa-solid fa-dice-d20"></i> Roll Con Save
        </button>
        <button className="cnp-dismiss-btn" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </>
    );
  }
  return (
    <button className="cnp-roll-btn" onClick={onNext} type="button">
      {queueCount > 1 ? 'Next Check' : 'Done'}
    </button>
  );
}

function ConcentrationPromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);
  // PromptIds already adjudicated — rolled on this client or resolved by
  // another client's concentrationResult-<Target>-<promptId> echo. One save
  // per damage event: a stale queue entry can never re-roll (double-save
  // bug). The echo prefix below matches the bare-target legacy key too.
  const resolvedPromptIdsRef = useRef(new Set());
  // Rolls awaiting their async settlement on this client — a same-tick
  // second click must stay inert, never prune the check being resolved.
  const rollingPromptIdsRef = useRef(new Set());

  const current = prompts.length > 0 ? prompts[0] : null;

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  const handleEvent = useCallback((event) => {
    if (!event.key) return;
    const prefix = `change-${campaignName}-concentrationPrompt-`;
    if (!event.key.startsWith(prefix)) return;
    const keySuffix = event.key.slice(prefix.length);
    if (!keySuffix) return;

    if (event.data == null) {
      // Cleared-key echo (the server broadcasts null on key DELETE, as every
      // client's Roll/Dismiss does via clearConcentrationPrompt): the prompt
      // was answered on another client — drop exactly the check whose per-
      // promptId key (`<Target>-<promptId>`) was cleared, so a passive tab
      // can never re-roll a resolved save while a sibling multi-hit prompt
      // for the same target survives. A suffix naming only the target is the
      // legacy/staged target-wide clear — it still drops that target's
      // outstanding checks. Keeps a check this client already adjudicated
      // so its result panel survives until the user clicks Done.
      const isCleared = (p) => !p.result
        && (keySuffix === `${p.targetName}-${p.promptId}` || keySuffix === p.targetName);
      setPrompts(prev => (prev.some(isCleared) ? prev.filter(p => !isCleared(p)) : prev));
      return;
    }

    // Per-prompt keys carry the promptId; trust the payload's targetName and
    // fall back to the key suffix minus the trailing promptId.
    const { promptId, targetName: dataTargetName } = event.data;
    const targetName = dataTargetName
      || (promptId && keySuffix.endsWith(`-${promptId}`)
        ? keySuffix.slice(0, -(promptId.length + 1))
        : keySuffix);
    setPrompts(prev => {
      if (prev.some(p => p.promptId === promptId)) return prev;
      return [...prev, { targetName, ...event.data }];
    });
  }, [campaignName]);

  const handleResultEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-concentrationResult-`;
    if (!event.key.startsWith(prefix)) return;
    // Any client's submitted result broadcasts here — stamp the promptId so
    // an echo that races this tab's own Roll click still yields one roll.
    if (event.data.promptId) resolvedPromptIdsRef.current.add(event.data.promptId);
  }, [campaignName]);

  const handleDismiss = useCallback(() => {
    if (!current) return;
    // Mirror SavePromptModal.dismiss: a dismissed un-rolled prompt is a
    // client-wide answer — clear the server key (the null echo closes every
    // other client) so no orphan outlives the tab that dismissed it. The
    // clear is promptId-scoped: a sibling multi-hit prompt for this target
    // keeps its own key and stays live on every client.
    clearConcentrationPrompt(campaignName, current.targetName, current.promptId);
    advance();
  }, [campaignName, current, advance]);

  const handleRoll = useCallback(async () => {
    if (!current) return;
    const promptId = current.promptId;
    if (resolvedPromptIdsRef.current.has(promptId)) {
      // Already adjudicated on another client (result echo landed before the
      // DELETE echo) — drop the stale queue entry instead of spending a
      // second save for the same damage event.
      setPrompts(prev => prev.filter(p => p.promptId !== promptId));
      return;
    }
    if (rollingPromptIdsRef.current.has(promptId)) return; // in-flight double-click
    rollingPromptIdsRef.current.add(promptId);

    const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
    const { saveBonus, roll, rawRolls, total, success, bonusDetail, mode, advantageSources, disadvantageSource } =
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
      disadvantageSource,
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
        disadvantageSource,
      },
    }));

    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll, total, saveBonus: totalSaveBonus, bonusDetail, mode, rawRolls, advantageSources, disadvantageSource } }
        : p
    ));

    rollingPromptIdsRef.current.delete(promptId);
    resolvedPromptIdsRef.current.add(promptId);
    // promptId-scoped: only this damage event's key leaves the store — a
    // sibling multi-hit prompt keeps its own key and advances on every client.
    clearConcentrationPrompt(campaignName, current.targetName, promptId);
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
            handleResultEvent(event);
          }}
        />
      )}
      {current && (
        <div className="cnp-overlay">
          <div className="cnp-modal">
            <div className="cnp-header">
              <i className="fa-solid fa-spinner"></i> Concentration Check
              {queueCount > 1 && (
                <span className="cnp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
              )}
            </div>
            <div className="cnp-body">
              <p><strong>{current.targetName}</strong> must make a <strong>CONSTITUTION</strong> saving throw to maintain concentration on <strong>{current.spellName}</strong>.</p>
              <p className="cnp-dc">DC {current.dc}</p>
              {hasResult && <ConcentrationResultPanel current={current} />}
            </div>
            <div className="cnp-actions">
              <ConcentrationActions hasResult={hasResult} queueCount={queueCount} onRoll={handleRoll} onDismiss={handleDismiss} onNext={handleNext} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ConcentrationPromptModal;
