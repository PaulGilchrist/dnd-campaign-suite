import { useState } from 'react';
import { onSurgeSelected, onTamedSurgeSelected } from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';
import '../CharSheet.css';
import './WildMagicSurgeModal.css';

function WildMagicSurgeModal({ featureName, surgeTable, campaignName, playerStats, mode, onClose, roll, roll1, roll2 }) {
    const [selectedRoll, setSelectedRoll] = useState(null);
    const [selectedSurge, setSelectedSurge] = useState(null);

    const getSurgeForRoll = (rollNum) => {
        if (!surgeTable || surgeTable.length === 0) return null;
        return surgeTable.find(e => rollNum >= e.min && rollNum <= e.max);
    };

    const getAvailableSurges = () => {
        if (!surgeTable || surgeTable.length === 0) return [];
        return surgeTable.slice(0, -1);
    };

    const handleSelectRoll = async (rollNum) => {
        const surge = getSurgeForRoll(rollNum);
        if (!surge) return;
        setSelectedRoll(rollNum);
        setSelectedSurge(surge);
    };

    const handleConfirmRoll = async () => {
        if (!selectedRoll) return;
        const surge = getSurgeForRoll(selectedRoll);
        if (!surge) return;

        await onSurgeSelected(
            featureName,
            playerStats || { name: 'Player' },
            campaignName,
            selectedRoll,
            surge
        );
        onClose();
    };

    const handleSelectSurge = async (surge) => {
        setSelectedSurge(surge);
    };

    const roll1Surge = roll1 ? getSurgeForRoll(roll1) : null;
    const roll2Surge = roll2 ? getSurgeForRoll(roll2) : null;
    const currentRollSurge = roll ? getSurgeForRoll(roll) : null;

    if (mode === 'controlledChaos') {
        return (
                <div className="sp-overlay wms-overlay--no-dismiss" onClick={e => e.stopPropagation()}>
                    <div className="sp-modal sp-modal--wide wms-modal--centered" data-testid="wild-magic-surge-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {featureName}
                        </div>
                        <div className="sp-body">
                            <p><b>Controlled Chaos — Choose your roll:</b></p>
                        <div className="wms-rolls-display wms-rolls-display--centered">
                            <div className={`wms-roll-badge ${selectedRoll === roll1 ? 'wms-roll-badge--selected' : ''}`}
                                 onClick={() => handleSelectRoll(roll1)}
                                 style={{ cursor: 'pointer' }}>
                                <span className="wms-roll-number">Roll 1: {roll1}</span>
                                {roll1Surge && <span className="wms-roll-effect">{roll1Surge.effect}</span>}
                            </div>
                            <div className={`wms-roll-badge ${selectedRoll === roll2 ? 'wms-roll-badge--selected' : ''}`}
                                 onClick={() => handleSelectRoll(roll2)}
                                 style={{ cursor: 'pointer' }}>
                                <span className="wms-roll-number">Roll 2: {roll2}</span>
                                {roll2Surge && <span className="wms-roll-effect">{roll2Surge.effect}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" type="button" onClick={handleConfirmRoll} disabled={!selectedRoll}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'tamedSurge') {
        const availableSurges = getAvailableSurges();
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal sp-modal--wide" data-testid="wild-magic-surge-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {featureName}
                    </div>
                    <div className="sp-body">
                        <p><b>Tamed Surge — Choose your effect:</b></p>
                        <p>Choose one effect from the Wild Magic Surge table.</p>
                        <div className="wms-table">
                            {availableSurges.map((surge, idx) => (
                                <button
                                    key={idx}
                                    className={`wms-entry ${selectedSurge === surge ? 'wms-entry--selected' : ''}`}
                                    onClick={() => handleSelectSurge(surge)}
                                    title={surge.effect}
                                >
                                    <span className="wms-entry-range">{surge.min}-{surge.max}</span>
                                    <span className="wms-entry-effect">{surge.effect}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={async () => {
                            if (!selectedSurge) return;
                            await onTamedSurgeSelected(
                                { name: featureName, automation: { type: 'wild_magic_tamed' } },
                                playerStats || { name: 'Player' },
                                campaignName,
                                selectedSurge
                            );
                            onClose();
                        }} disabled={!selectedSurge}>Confirm</button>
                        <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal sp-modal--wide" data-testid="wild-magic-surge-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p><b>Wild Magic Surge — Rolled: {roll}</b></p>
                    <div className="wms-rolls-display">
                        <div className={`wms-roll-badge ${currentRollSurge ? 'wms-roll-badge--result' : ''}`}>
                            <span className="wms-roll-number">Rolled: {roll}</span>
                            {currentRollSurge && <span className="wms-roll-effect">{currentRollSurge.effect}</span>}
                        </div>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}

export default WildMagicSurgeModal;
