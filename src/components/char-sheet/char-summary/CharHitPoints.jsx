 
import React from 'react'
import storage from '../../../services/storage.js'
import HiddenInput from '../../common/HiddenInput.jsx'
import DeathSavingThrows from './DeathSavingThrows.jsx'

function CharHitPoints({ playerStats, campaignName }) {
     const [currentHitPoints, setCurrentHitPoints] = React.useState(0);
     const [showInputCurrentHitPoints, setShowInputCurrentHitPoints] = React.useState(false);
     React.useEffect(() => {
         let value = storage.getProperty(playerStats.name, 'currentHitPoints', campaignName);
         setCurrentHitPoints(value != null ? value : playerStats.hitPoints);
     }, [playerStats, campaignName]);
     const handleInputToggleCurrentHitPoints = () => {
         setShowInputCurrentHitPoints((showInputCurrentHitPoints) => !showInputCurrentHitPoints);
     };
      const handleValueChangeCurrentHitPoints = (value) => {
          const oldHp = currentHitPoints;
          const delta = value - oldHp;
          storage.setProperty(playerStats.name, 'currentHitPoints', value, campaignName);
          setCurrentHitPoints(value);

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
              storage.setProperty(playerStats.name, 'deathSaves', [false, false, false], campaignName);
              storage.setProperty(playerStats.name, 'deathFailures', [false, false, false], campaignName);
          }
      };

      React.useEffect(() => {
          const handler = (e) => {
              if (!e.detail || e.detail.targetName !== playerStats.name) return;
              if (e.detail.restoredToHp) {
                  storage.setProperty(playerStats.name, 'currentHitPoints', e.detail.restoredToHp, campaignName);
                  setCurrentHitPoints(e.detail.restoredToHp);
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
