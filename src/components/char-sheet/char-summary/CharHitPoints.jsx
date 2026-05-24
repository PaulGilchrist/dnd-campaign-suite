 
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
    }, [playerStats]);
    const handleInputToggleCurrentHitPoints = () => {
        setShowInputCurrentHitPoints((showInputCurrentHitPoints) => !showInputCurrentHitPoints);
    };
    const handleValueChangeCurrentHitPoints = (value) => {
        storage.setProperty(playerStats.name, 'currentHitPoints', value, campaignName);
        setCurrentHitPoints(value);

        if (value > 0) {
            storage.setProperty(playerStats.name, 'deathSaves', [false, false, false], campaignName);
            storage.setProperty(playerStats.name, 'deathFailures', [false, false, false], campaignName);
        }
    };
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
