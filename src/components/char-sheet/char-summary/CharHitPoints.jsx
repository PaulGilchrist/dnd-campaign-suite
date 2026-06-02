 
import React from 'react'
import { setRuntimeValue, useRuntimeValue } from '../../../hooks/useRuntimeState.js'
import { clearDeathSavePrompt } from '../../../services/savePromptService.js'
import HiddenInput from '../../common/HiddenInput.jsx'
import DeathSavingThrows from './DeathSavingThrows.jsx'

function CharHitPoints({ playerStats, campaignName }) {
     const storedHp = useRuntimeValue(playerStats.name, 'currentHitPoints', campaignName);
     const currentHitPoints = storedHp != null ? storedHp : playerStats.hitPoints;
     const [showInputCurrentHitPoints, setShowInputCurrentHitPoints] = React.useState(false);
     const handleInputToggleCurrentHitPoints = () => {
         setShowInputCurrentHitPoints((showInputCurrentHitPoints) => !showInputCurrentHitPoints);
     };
      const handleValueChangeCurrentHitPoints = (value) => {
          const oldHp = currentHitPoints;
          const delta = value - oldHp;
          setRuntimeValue(playerStats.name, 'currentHitPoints', value, campaignName);

          if (delta !== 0) {
              fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      type: 'hp_change',
                      targetName: playerStats.name,
                      delta,
                      currentHp: value,
                      maxHp: playerStats.hitPoints,
                      isHealing: delta > 0,
                      isUnconscious: value <= 0,
                  })
              }).catch(() => {});
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
                <b>Hit Points: </b>{playerStats.hitPoints}/<HiddenInput handleInputToggle={handleInputToggleCurrentHitPoints} handleValueChange={(value) => handleValueChangeCurrentHitPoints(value)} showInput={showInputCurrentHitPoints} value={currentHitPoints}></HiddenInput> <span className="text-muted">(max/cur)</span>
            </div>
            {currentHitPoints <= 0 && (
                <DeathSavingThrows playerStats={playerStats} campaignName={campaignName} />
            )}
        </div>
    )
}

export default CharHitPoints
