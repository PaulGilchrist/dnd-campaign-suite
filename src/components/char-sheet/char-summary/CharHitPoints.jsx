 
import React from 'react'
import { setRuntimeBatch, setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import { addEntry } from '../../../services/ui/logService.js'
import HiddenInput from '../../common/HiddenInput.jsx'
import DeathSavingThrows from './DeathSavingThrows.jsx'

// Per-roll death-save result chip (2 s dwell), hosted HERE rather than inside
// DeathSavingThrows (bug-death-save-terminal-roll-chip-never-renders): a
// life-ending sheet roll writes isDead / currentHitPoints in the same React
// batch as the chip state, so the block's only commit already renders the
// DEAD-badge branch or unmounts behind the `currentHitPoints <= 0` gate below
// — the chip node would never be created there. CharHitPoints never unmounts,
// so every roll (terminal or not) paints its dwell face outside the swap.
function LastRollResult({ lastRoll }) {
    return (
        <div role="status" className={`death-saves-result ${lastRoll.success ? 'death-saves-result--success' : 'death-saves-result--failure'}`}>
            <span className="death-saves-roll-value">({lastRoll.roll})</span>
            {lastRoll.isNat1 && <span className="death-saves-nat death-saves-nat--1">NAT 1</span>}
            {lastRoll.isNat20 && <span className="death-saves-nat death-saves-nat--20">NAT 20</span>}
            <span className="death-saves-result-label">{lastRoll.success ? 'Success' : 'Failure'}</span>
        </div>
    )
}

function CharHitPoints({ playerStats, campaignName, isLocalhost }) {
      const storedHp = useRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
      const aidIncrease = useRuntimeValue(playerStats.name, 'aidHpMaxIncrease', campaignName);
      const heroesFeastIncrease = useRuntimeValue(playerStats.name, 'heroesFeastHpMaxIncrease', campaignName);
      const effectiveMaxHp = (playerStats.hitPoints || 0) + (Number(aidIncrease) || 0) + (Number(heroesFeastIncrease) || 0);
      const tempHp = useRuntimeValue(playerStats.name, 'tempHp', campaignName);

       const currentHitPoints = storedHp != null ? storedHp : effectiveMaxHp;
     const [showInputCurrentHitPoints, setShowInputCurrentHitPoints] = React.useState(false);
     // Death-save result chip state + dwell. The 2000 ms auto-hide is display-
     // only feedback (benign UI category in the no-timers guard) — the terminal
     // isDead/HP game-state writes land immediately and are NEVER delayed
     // behind it; only the chip face outlives them.
     const [lastRoll, setLastRoll] = React.useState(null);
     const showDeathSaveResult = React.useCallback((result) => {
         setLastRoll(result);
         setTimeout(() => setLastRoll(null), 2000);
     }, []);
     const handleInputToggleCurrentHitPoints = () => {
         setShowInputCurrentHitPoints((showInputCurrentHitPoints) => !showInputCurrentHitPoints);
     };
      const handleValueChangeCurrentHitPoints = (value) => {
          const numValue = Number(value);
          if (Number.isNaN(numValue)) return;
          const oldHp = currentHitPoints;
          const delta = numValue - oldHp;
          // Merged full-store write (backlog 2026-11-14 MM): ONE
          // setRuntimeBatch POST replaces the old four separate
          // setRuntimeValue calls (currentHitPoints + deathSaves +
          // deathFailures + isDead), each of which POSTed the whole
          // bucket and broadcast its own SSE echo on every >0 commit.
          // Functional semantics are unchanged: the death-bucket reset
          // still rides EVERY value>0 commit face (not only the 0→>0
          // revive transition), and setRuntimeBatch's valuesEqual
          // self-skip mirrors the four individual calls — nothing POSTs
          // when no property differs from the mirror.
          const writes = { currentHitPoints: numValue };
          if (numValue > 0) {
              writes.deathSaves = [false, false, false];
              writes.deathFailures = [false, false, false];
              writes.isDead = 0;
          }
          setRuntimeBatch(playerStats.name, writes, campaignName);

          if (delta !== 0) {
              addEntry(campaignName, {
                  type: 'hp_change',
                  targetName: playerStats.name,
                  // Mirrors the GM initiative card's 'GM HP override' stamp
                  // (createCreatureHandlers.logManualHpOverride) so the two
                  // manual-edit row families are distinguishable in the log.
                  sourceName: 'sheet editor',
                  delta,
                  currentHp: value,
                  maxHp: effectiveMaxHp,
                  isHealing: delta > 0,
                  isUnconscious: value <= 0,
                  // The canonical player stamp (mirrors logDamageApplication's
                  // `if (creature.type === 'player') entry.isPlayer = true`):
                  // this lane only ever edits a player sheet, and the log's
                  // downed copy discriminates monster vs player off this byte.
                  isPlayer: true,
              }).catch((e) => { console.error("[CharHitPoints] Error:", e); });
          }

          // The bucket reset above already covers this face; only the
          // mirror-gated prompt evict stays (DELETE lane, never a char
          // POST — evict laws 4015d88d4 / 3a99fd08a).
          if (value > 0) {
              clearDeathSavePrompt(campaignName, playerStats.name);
          }
      };

      React.useEffect(() => {
          const handler = (e) => {
              if (!e.detail || e.detail.targetName !== playerStats.name) return;
              // Rolls driven elsewhere (DeathSavePromptModal) paint the same chip
              // face here — this listener used to live inside DeathSavingThrows,
              // where the identical branch-swap/unmount race crushed terminal
              // results. Bare restore events (no roll) only lift HP, no chip.
              if (e.detail.roll != null) {
                  showDeathSaveResult({
                      roll: e.detail.roll,
                      success: e.detail.success,
                      isNat20: e.detail.isNat20,
                      isNat1: e.detail.isNat1,
                  });
              }
              // Single-writer law (fix bug-death-save-prompt-modal-roll-lane-
              // sequential-bucket-posts 2026-11-19): DeathSavePromptModal now
              // merges the NAT 20 restore into its own one setRuntimeBatch and
              // declares it via detail.hpWritten — this listener must NOT fire
              // a second whole-bucket currentHitPoints POST beside it (the old
              // pair reordered freely, leaving restored HP next to pre-roll
              // tracks via the SSE echo). Bare restore events (relentless rage
              // and similar producers without the flag) still land here.
              if (e.detail.restoredToHp && !e.detail.hpWritten) {
                  setRuntimeValue(playerStats.name, 'currentHitPoints', e.detail.restoredToHp, campaignName);
              }
          };
          window.addEventListener('death-save-result', handler);
          return () => window.removeEventListener('death-save-result', handler);
      }, [playerStats.name, campaignName, showDeathSaveResult]);
    return (
        <div>
            <div className="clickable" onClick={handleInputToggleCurrentHitPoints} onKeyDown={handleInputToggleCurrentHitPoints} tabIndex={0}>
                <b>Hit Points: </b><HiddenInput handleInputToggle={handleInputToggleCurrentHitPoints} handleValueChange={(value) => handleValueChangeCurrentHitPoints(value)} showInput={showInputCurrentHitPoints} value={currentHitPoints}></HiddenInput>/{effectiveMaxHp} <span className="text-muted">(cur/max)</span>
            </div>
            {tempHp > 0 && (
                <div className="temp-hp-display">
                    <i className="fa-solid fa-shield"></i> Temp HP: {tempHp}
                </div>
            )}
            {currentHitPoints <= 0 && (
                <DeathSavingThrows playerStats={playerStats} campaignName={campaignName} isLocalhost={isLocalhost} onRollResult={showDeathSaveResult} />
            )}
            {/* Outside the `currentHitPoints <= 0` gate on purpose: terminal
                rolls flip HP/isDead in the same commit, and the chip still has
                its 2 s dwell to paint (role=status announces it to AT too). */}
            {lastRoll && <LastRollResult lastRoll={lastRoll} />}
        </div>
    )
}

export default CharHitPoints
