import { useState, useEffect, useCallback } from 'react';
import './MetamagicPopup.css';

export default function HeroesFeastTargetPopup({ spell, _playerStats, _campaignName, range, _rangeFt, creatureTargets, maxTargets, _attackerPos, onConfirm, onSkip }) {
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

    const hpIncrease = 11;

    return (
        <div className="popup-overlay" onClick={onSkip}>
            <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
                <div className="metamagic-popup-inner">
                    <h3><i className="fa-solid fa-utensils"></i> Heroes&apos; Feast</h3>
                    <p className="metamagic-spell-name">
                        <strong>{spell?.name || 'Spell'}</strong> — Level {spell?.level || 6} Conjuration
                    </p>
                    <p>
                        Choose up to <strong>{maxTargets}</strong> creatures within <strong>{range}</strong>.
                        Each target gains <strong>{hpIncrease}</strong> Hit Point maximum (and current HP),
                        Resistance to Poison damage, and Immunity to the Frightened and Poisoned conditions for 24 hours.
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
                            Cast Heroes&apos; Feast
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
