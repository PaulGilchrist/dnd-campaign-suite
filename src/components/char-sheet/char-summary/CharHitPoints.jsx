 
import React from 'react'
import { setRuntimeBatch, setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import { addEntry } from '../../../services/ui/logService.js'
import HiddenInput from '../../common/HiddenInput.jsx'
import DeathSavingThrows from './DeathSavingThrows.jsx'

function CharHitPoints({ playerStats, campaignName, isLocalhost }) {
      const storedHp = useRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
      const aidIncrease = useRuntimeValue(playerStats.name, 'aidHpMaxIncrease', campaignName);
      const heroesFeastIncrease = useRuntimeValue(playerStats.name, 'heroesFeastHpMaxIncrease', campaignName);
      const effectiveMaxHp = (playerStats.hitPoints || 0) + (Number(aidIncrease) || 0) + (Number(heroesFeastIncrease) || 0);
      const tempHp = useRuntimeValue(playerStats.name, 'tempHp', campaignName);

       const currentHitPoints = storedHp != null ? storedHp : effectiveMaxHp;
     const [showInputCurrentHitPoints, setShowInputCurrentHitPoints] = React.useState(false);
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
              if (e.detail.restoredToHp) {
                  setRuntimeValue(playerStats.name, 'currentHitPoints', e.detail.restoredToHp, campaignName);
              }
          };
          window.addEventListener('death-save-result', handler);
          return () => window.removeEventListener('death-save-result', handler);
      }, [playerStats.name, campaignName]);
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
                <DeathSavingThrows playerStats={playerStats} campaignName={campaignName} isLocalhost={isLocalhost} />
            )}
        </div>
    )
}

export default CharHitPoints
