import { useState, useCallback, useEffect, useRef } from 'react';

import { sendDeathSaveResult, clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import * as deathSaveRules from '../../services/combat/conditions/deathSaveRules.js';
import { addEntry } from '../../services/ui/logService.js';
import Subscriber from './Subscriber.jsx';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { isGmHost } from '../../services/ui/gmHost.js';
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

// Roll-less finality summary row — byte-parity with the sheet lane's rows
// (DeathSavingThrows.jsx stable/dead logEntry copies; LogDeathSaveEntry
// renders both via DEATH_SAVE_PRESENTATION). Before this, only the sheet
// seam wrote these: a modal-rolled 3rd success/failure logged the roll row
// (death-save-result listener) but never the terminal summary row.
// RAW semantics (owner decision): stabilization leaves the creature at 0
// HP — no currentHitPoints write here (nat20's restoredToHp=1 restore is
// separate and stays).
function logFinalityRow(campaignName, targetName, result) {
  const entry = result.result === 'stable'
    ? {
        type: 'death_save',
        characterName: targetName,
        result: 'stable',
        totalSuccesses: 3,
        totalFailures: result.newFailures.filter(Boolean).length,
      }
    : {
        type: 'death_save',
        characterName: targetName,
        result: 'dead',
        totalSuccesses: result.newSaves.filter(Boolean).length,
        totalFailures: 3,
      };
  addEntry(campaignName, entry).catch((e) => {
    console.error('[DeathSavePromptModal] Error logging finality row:', e);
  });
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

function DeathSavePromptModal({ campaignName, characters }) {
  const [prompts, setPrompts] = useState([]);
  // PromptIds already adjudicated — rolled on this client or resolved by
  // another client's deathSaveResult-<Target> echo. One save per down event:
  // a stale queue entry on a passive tab can never re-roll (double-save bug).
  // Mirrors ConcentrationPromptModal (6b1800fa2).
  const resolvedPromptIdsRef = useRef(new Set());

  const current = prompts.length > 0 ? prompts[0] : null;

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  // Mount-side stale re-verdict (backlog 2026-11-15 QY
  // death-save-prompt-stale-selfheal): an undrained deathSavePrompt-<Target>
  // key — e.g. a Cancel whose evaluate-dispatched click silently no-oped the
  // DELETE — replays on every SSE-connect snapshot seed / campaign-select
  // reload as an actionable Roll prompt over a target whose bucket has since
  // revived, and the .dsp-overlay intercepts clicks until dismissed. This is
  // the #1400 void-guard's bucket-canonical law (see handleRoll) applied at
  // the MOUNT seam, not just at Roll time: if the head prompt's target is a
  // PLAYER whose runtime-bucket currentHitPoints is > 0, self-evict via the
  // mirror-gated clearDeathSavePrompt lane (the DELETE's null echo also
  // retires the same stale key on every other tab) and advance the queue —
  // a brief flash is the accepted face (auto-evict), with ZERO roll,
  // counter/HP/isDead writes, or log rows. The read rides useRuntimeValue so
  // a bucket that seeds AFTER the prompt echo (reload + re-select lands the
  // SSE snapshot before the char-store seed) re-verdicts when the HP value
  // lands instead of staying blind. Conservative gates — never evict on:
  // an absent/non-numeric HP key (fresh or unloaded bucket must keep the
  // prompt), HP <= 0 (genuine arm: zero requests here, face unchanged), a
  // result-stage head (its panel survives until Done; a nat20 stamping HP=1
  // must not evict a rolled save), or a target outside the player roster
  // (monster/NPC prompts keep the existing face — scope is the player lane).
  // The hook value is only the RE-RUN TRIGGER (its useState carries the
  // previous head's read for one render after a queue advance); the verdict
  // itself re-reads the head's bucket imperatively, exactly like the #1400
  // void-guard does at Roll time.
  const leadIsPlayerPrompt = !!current && !current.result
    && Array.isArray(characters)
    && characters.some(c => c && c.name === current.targetName);
  const leadHp = useRuntimeValue(
    leadIsPlayerPrompt ? current.targetName : 'campaign',
    'currentHitPoints',
    campaignName
  );

  useEffect(() => {
    if (!leadIsPlayerPrompt || !current) return;
    const hpRaw = getRuntimeValue(current.targetName, 'currentHitPoints');
    const hp = Number(hpRaw);
    if (hpRaw == null || !Number.isFinite(hp) || hp <= 0) return;
    clearDeathSavePrompt(campaignName, current.targetName);
    advance();
  }, [advance, campaignName, current, leadHp, leadIsPlayerPrompt]);

  const handleEvent = useCallback((event) => {
    if (!event.key) return;

    const promptPrefix = `change-${campaignName}-deathSavePrompt-`;
    if (event.key.startsWith(promptPrefix)) {
      const targetName = event.key.slice(promptPrefix.length);
      if (!targetName) return;

      if (event.data == null) {
        // Cleared-key echo (the server broadcasts null on key DELETE, as
        // every client's Roll does via clearDeathSavePrompt): the prompt was
        // answered on another client — drop every un-adjudicated queued
        // prompt for that target. The prompt key is target-wide (one live
        // prompt per target server-side), so a ghost queued behind a
        // resolved head is server-absent too and must not spend a save.
        // Keeps a check this client already adjudicated so its result panel
        // survives until the user clicks Done (acting-tab asymmetry, same as
        // the concentration modal).
        const isCleared = (p) => !p.result && p.targetName === targetName;
        setPrompts(prev => (prev.some(isCleared) ? prev.filter(p => !isCleared(p)) : prev));
        return;
      }

      setPrompts(prev => {
        if (prev.some(p => p.promptId === event.data.promptId)) return prev;
        return [...prev, { targetName, ...event.data }];
      });
      return;
    }

    const resultPrefix = `change-${campaignName}-deathSaveResult-`;
    if (event.key.startsWith(resultPrefix) && event.data?.promptId) {
      // Any client's submitted result broadcasts here — stamp the promptId
      // so an echo that races this tab's stale queue entry still yields
      // exactly one roll (see the resolved-id guard in handleRoll).
      resolvedPromptIdsRef.current.add(event.data.promptId);
    }
  }, [campaignName]);

  const handleRoll = useCallback(() => {
    if (!current) return;

    if (resolvedPromptIdsRef.current.has(current.promptId)) {
      // Already adjudicated on another client (result echo landed before the
      // DELETE echo) — drop the stale queue entry instead of spending a
      // second death save for one down event.
      setPrompts(prev => prev.filter(p => p.promptId !== current.promptId));
      return;
    }

    // #1400/#1403 voided-prompt guard (single-producer law): relentless rage
    // (or any heal) can lift this target off 0 HP while their death-save
    // prompt sits queued in this modal. The service commits HP >= 1 BEFORE
    // clearing deathSaves/deathFailures (fix#105 order), so a fresh read of
    // HP > 0 here means that reset has already landed — re-writing the
    // pre-rage counters (or POSTing 'dead') from this stale prompt would
    // resurrect saves on a standing creature (dual-producer last-writer).
    // Void the prompt instead: clear + advance with NO counter writes.
    // Key ownership: this modal remains the sole producer of death-save
    // counter ACCUMULATION (interactive rolls); relentlessRageService writes
    // only its one-shot coherent reset at rage activation.
    const liveHp = Number(getRuntimeValue(current.targetName, 'currentHitPoints', campaignName)) || 0;
    if (liveHp > 0) {
      clearDeathSavePrompt(campaignName, current.targetName);
      advance();
      window.dispatchEvent(new CustomEvent('open-death-saving-throw', { detail: {} }));
      return;
    }

    const { currentSaves, currentFailures } = readDeathSaveState(current.targetName);
    const result = deathSaveRules.rollDeathSave(currentSaves, currentFailures);
    const { targetName, ...sendPayload } = buildDeathSaveOutcome(current, result);

    sendDeathSaveResult(campaignName, current.targetName, sendPayload);

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: { ...sendPayload, targetName },
    }));

    // Finality summary row after the roll row (the dispatch above logs the
    // roll row synchronously via the page-singleton death-save-result
    // listener). Stable/dead only — plain success/failure/nat20 write no
    // summary row, matching the sheet lane.
    if (result.result === 'stable' || result.result === 'dead') {
      logFinalityRow(campaignName, targetName, result);
    }

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
    resolvedPromptIdsRef.current.add(current.promptId);
  }, [advance, campaignName, current]);

  // GM-only Cancel for an accidentally armed prompt (backlog 2026-11-14
  // death-save-dismiss-for-accidental-arms): a GM card mistype to 0 HP arms a
  // prompt whose only pre-roll exit used to be spending a real save. Cancel
  // rides the #1400 void-guard's zero-write lane verbatim — clearDeathSavePrompt
  // (mirror-gated DELETE, both mirror lanes evicted on any server-confirmed
  // 2xx/404) + advance, NO roll, NO counter/HP/isDead writes, NO log row.
  // The DELETE's null echo retires every other client's dwelled prompt live
  // (same cross-tab lane the void-guard dance uses). Gated by isGmHost() —
  // the established client-side GM convention (gmHost.js, mirror of the
  // server's refuseUnlessGm hostname law): a player must never dismiss their
  // own death save. Absent the moment a result stage is reached — Cancel can
  // never undo a rolled save. No timer, no auto-resolve: prompts still wait
  // indefinitely (No Game Timers rule).
  const handleCancel = useCallback(() => {
    if (!current || current.result) return;
    clearDeathSavePrompt(campaignName, current.targetName);
    advance();
  }, [advance, campaignName, current]);

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
        <div className="dsp-overlay">
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
                <>
                  <button className="dsp-roll-btn" onClick={handleRoll} type="button">
                    <i className="fa-solid fa-dice-d20"></i> Roll Death Save
                  </button>
                  {isGmHost() && (
                    <button className="dsp-cancel-btn" onClick={handleCancel} type="button">
                      Cancel
                    </button>
                  )}
                </>
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
