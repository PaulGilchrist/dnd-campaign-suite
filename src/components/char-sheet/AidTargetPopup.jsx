import { useState, useEffect, useCallback } from 'react';
import './MetamagicPopup.css';

export default function AidTargetPopup({ spell, _playerStats, _campaignName, range, _rangeFt, creatureTargets, maxTargets, _attackerPos, onConfirm, onSkip }) {
    const [selectedTargets, setSelectedTargets] = useState([]);
    const needsTargets = selectedTargets.length === 0;

    const toggleTarget = useCallback((targetName) => {
        setSelectedTargets(prev => {
            if (prev.includes(targetName)) {
                return prev.filter(t => t !== targetName);
            }
            if (prev.length >= maxTargets) return prev;
            return [...prev, targetName];
        });
    }, [maxTargets]);

    const handleConfirm = useCallback(() => {
        if (needsTargets) return;
        onConfirm(selectedTargets);
    }, [selectedTargets, needsTargets, onConfirm]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onSkip();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onSkip]);

    const getSlotLevel = () => {
        return spell.level || 2;
    };

    const hpIncrease = 5 + ((getSlotLevel() - 2) * 5);

    return (
        <div className="popup-overlay" onClick={onSkip}>
            <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
                <div className="metamagic-popup-inner">
                    <h3><i className="fa-solid fa-shield-halved"></i> Aid</h3>
                    <p className="metamagic-spell-name">
                        <strong>{spell?.name || 'Spell'}</strong> — Level {spell?.level || 2} Abjuration
                    </p>
                    <p>
                        Choose up to <strong>{maxTargets}</strong> creatures within <strong>{range}</strong>.
                        Each target&#39;s Hit Point maximum and current Hit Points increase by <strong>{hpIncrease}</strong> for the duration.
                    </p>
                    <div className="metamagic-twin-target">
                        <label>
                            <strong>Targets ({selectedTargets.length}/{maxTargets}):</strong>
                            <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {creatureTargets.map(name => {
                                    const isSelected = selectedTargets.includes(name);
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => toggleTarget(name)}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: isSelected ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {isSelected ? '\u2713 ' : ''}{name}
                                        </div>
                                    );
                                })}
                            </div>
                        </label>
                    </div>
                    <div className="metamagic-actions">
                        <button className="btn btn-secondary" onClick={onSkip}>
                            Cancel
                        </button>
                        <button
                            className="btn"
                            onClick={handleConfirm}
                            disabled={needsTargets}
                        >
                            Cast Aid
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
