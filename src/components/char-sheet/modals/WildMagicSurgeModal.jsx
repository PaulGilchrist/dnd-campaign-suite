import { useState, useEffect } from 'react';
import { onSurgeSelected, onDoubleRollSelected, onTamedSurgeSelected } from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';
import '../CharSheet.css';
import './WildMagicSurgeModal.css';

function WildMagicSurgeModal({ featureName, surgeTable, campaignName, playerStats, mode, onClose, roll, roll1, roll2 }) {
    const [result, setResult] = useState(null);
    const [selectedRoll, setSelectedRoll] = useState(null);
    const [selectedSurge, setSelectedSurge] = useState(null);
    const [displayRoll1, setDisplayRoll1] = useState(roll1);
    const [displayRoll2, setDisplayRoll2] = useState(roll2);
    const [displayRoll, setDisplayRoll] = useState(roll);

    useEffect(() => {
        if (mode === 'controlledChaos') {
            setDisplayRoll1(roll1);
            setDisplayRoll2(roll2);
        } else if (mode === 'roll') {
            setDisplayRoll(roll);
        }
    }, [mode, roll, roll1, roll2]);

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

        const res = await onDoubleRollSelected(
            { name: featureName, featureName, surgeTable, automation: { type: 'wild_magic_surge' } },
            playerStats || { name: 'Player' },
            campaignName,
            rollNum
        );
        setResult(res);
    };

    const handleSelectSurge = async (surge) => {
        setSelectedSurge(surge);

        const res = await onTamedSurgeSelected(
            { name: featureName, automation: { type: 'wild_magic_tamed' } },
            playerStats || { name: 'Player' },
            campaignName,
            surge
        );
        setResult(res);
    };

    const handleConfirm = async () => {
        if (!selectedSurge) return;

        const res = await onSurgeSelected(
            featureName,
            playerStats || { name: 'Player' },
            campaignName,
            selectedRoll || selectedSurge.min,
            selectedSurge
        );
        setResult(res);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {featureName}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    const roll1Surge = displayRoll1 ? getSurgeForRoll(displayRoll1) : null;
    const roll2Surge = displayRoll2 ? getSurgeForRoll(displayRoll2) : null;
    const currentRollSurge = displayRoll ? getSurgeForRoll(displayRoll) : null;

    if (mode === 'controlledChaos') {
        return (
                <div className="sp-overlay" onClick={onClose}>
                    <div className="sp-modal sp-modal--wide" data-testid="wild-magic-surge-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {featureName}
                        </div>
                        <div className="sp-body">
                            <p><b>Controlled Chaos — Choose your roll:</b></p>
                        <div className="wms-rolls-display">
                            <div className={`wms-roll-badge ${selectedRoll === displayRoll1 ? 'wms-roll-badge--selected' : ''}`}>
                                <span className="wms-roll-number">Roll 1: {displayRoll1}</span>
                                {roll1Surge && <span className="wms-roll-effect">{roll1Surge.effect.substring(0, 100)}{roll1Surge.effect.length > 100 ? '...' : ''}</span>}
                            </div>
                            <div className={`wms-roll-badge ${selectedRoll === displayRoll2 ? 'wms-roll-badge--selected' : ''}`}>
                                <span className="wms-roll-number">Roll 2: {displayRoll2}</span>
                                {roll2Surge && <span className="wms-roll-effect">{roll2Surge.effect.substring(0, 100)}{roll2Surge.effect.length > 100 ? '...' : ''}</span>}
                            </div>
                        </div>
                        <div className="wms-table">
                            {surgeTable.map((surge, idx) => {
                                const isHighlighted = displayRoll1 === null || displayRoll2 === null
                                    ? false
                                    : (surge.min <= displayRoll1 && displayRoll1 <= surge.max) || (surge.min <= displayRoll2 && displayRoll2 <= surge.max);
                                return (
                                    <button
                                        key={idx}
                                        className={`wms-entry ${isHighlighted ? 'wms-entry--highlighted' : ''} ${selectedRoll === surge.min ? 'wms-entry--selected' : ''}`}
                                        onClick={() => handleSelectRoll(surge.min)}
                                        title={surge.effect}
                                    >
                                        <span className="wms-entry-range">{surge.min}-{surge.max}</span>
                                        <span className="wms-entry-effect">{surge.effect}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
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
                        <button className="sp-roll-btn" onClick={handleConfirm} disabled={!selectedSurge}>Confirm</button>
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
                    <p><b>Wild Magic Surge — Rolling d100...</b></p>
                    <div className="wms-rolls-display">
                        <div className={`wms-roll-badge ${currentRollSurge ? 'wms-roll-badge--result' : ''}`}>
                            <span className="wms-roll-number">Rolled: {displayRoll}</span>
                            {currentRollSurge && <span className="wms-roll-effect">{currentRollSurge.effect}</span>}
                        </div>
                    </div>
                    <div className="wms-table">
                        {surgeTable.map((surge, idx) => {
                            const isMatch = displayRoll >= surge.min && displayRoll <= surge.max;
                            return (
                                <div
                                    key={idx}
                                    className={`wms-entry ${isMatch ? 'wms-entry--highlighted' : ''}`}
                                >
                                    <span className="wms-entry-range">{surge.min}-{surge.max}</span>
                                    <span className="wms-entry-effect">{surge.effect}</span>
                                </div>
                            );
                        })}
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
