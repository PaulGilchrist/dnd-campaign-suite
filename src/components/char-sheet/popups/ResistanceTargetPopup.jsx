import { useState, useEffect, useCallback } from 'react';
import './MetamagicPopup.css';

export default function ResistanceTargetPopup({ spell, _playerStats, _campaignName, range, creatureTargets, damageTypes, onConfirm, onSkip }) {
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [selectedDamageType, setSelectedDamageType] = useState(null);
    const needsTarget = !selectedTarget;
    const needsDamageType = !selectedDamageType;

    const handleSelect = useCallback((targetName) => {
        setSelectedTarget(targetName);
    }, []);

    const handleSelectDamageType = useCallback((damageType) => {
        setSelectedDamageType(damageType);
    }, []);

    const handleConfirm = useCallback(() => {
        if (needsTarget || needsDamageType) return;
        onConfirm({ targetName: selectedTarget, damageType: selectedDamageType });
    }, [selectedTarget, selectedDamageType, needsTarget, needsDamageType, onConfirm]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onSkip();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onSkip]);

    return (
        <div className="popup-overlay" onClick={onSkip}>
            <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
                <div className="metamagic-popup-inner">
                    <h3><i className="fa-solid fa-shield-halved"></i> Resistance</h3>
                    <p className="metamagic-spell-name">
                        <strong>{spell?.name || 'Spell'}</strong> — Level {spell?.level || 0} Abjuration
                    </p>
                    <p>
                        Choose a willing creature within <strong>{range}</strong> and a damage type.
                        When the target takes damage of the chosen type, it reduces the damage by 1d4.
                        This can only happen once per turn.
                    </p>
                    <div className="metamagic-twin-target">
                        <label>
                            <strong>Target:</strong>
                            <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {creatureTargets.map(name => {
                                    const isSelected = selectedTarget === name;
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => handleSelect(name)}
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
                    <div className="metamagic-twin-target" style={{ marginTop: '16px' }}>
                        <label>
                            <strong>Damage Type:</strong>
                            <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {damageTypes.map(type => {
                                    const isSelected = selectedDamageType === type;
                                    return (
                                        <div
                                            key={type}
                                            onClick={() => handleSelectDamageType(type)}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: isSelected ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {isSelected ? '\u2713 ' : ''}{type}
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
                            disabled={needsTarget || needsDamageType}
                        >
                            Cast Resistance
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
