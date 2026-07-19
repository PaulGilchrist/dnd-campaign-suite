 
import React from 'react'
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js'
import { addEntry } from '../../../services/ui/logService.js'
import HiddenInput from '../../common/HiddenInput.jsx'
import DeathSavingThrows from './DeathSavingThrows.jsx'

function CharHitPoints({ playerStats, campaignName, isLocalhost }) {
      const storedHp = useRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
      const aidHpMaxIncrease = useRuntimeValue(playerStats.name, 'aidHpMaxIncrease', campaignName) || 0;
      const tempHp = useRuntimeValue(playerStats.name, 'tempHp', campaignName);
      const effectiveMaxHp = playerStats.hitPoints + Number(aidHpMaxIncrease);

      React.useEffect(() => {
          if (storedHp === null || storedHp === undefined) {
              setRuntimeValue(playerStats.name, 'currentHitPoints', playerStats.hitPoints, campaignName);
          }
      }, [storedHp, playerStats.hitPoints, playerStats.name, campaignName]);

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
          setRuntimeValue(playerStats.name, 'currentHitPoints', numValue, campaignName);

          if (delta !== 0) {
              addEntry(campaignName, {
                  type: 'hp_change',
                  targetName: playerStats.name,
                  delta,
                  currentHp: value,
                  maxHp: effectiveMaxHp,
                  isHealing: delta > 0,
                  isUnconscious: value <= 0,
              }).catch((e) => { console.error("[CharHitPoints] Error:", e); });
          }

          if (value > 0) {
              setRuntimeValue(playerStats.name, 'deathSaves', [false, false, false], campaignName);
              setRuntimeValue(playerStats.name, 'deathFailures', [false, false, false], campaignName);
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
