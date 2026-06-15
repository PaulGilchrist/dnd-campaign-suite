import { useState, useEffect, useCallback } from 'react';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';
import './MetamagicPopup.css';
import './CharSheet.css';

export default function RemoveCursePopup({ spell, _playerStats, _campaignName, creatureTargets, range, onConfirm, onSkip }) {
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [targetCursedBuffs, setTargetCursedBuffs] = useState([]);
    const [targetAttunement, setTargetAttunement] = useState([]);
    const [selections, setSelections] = useState([]);

    const loadTargetData = useCallback(async (targetName) => {
        setSelectedTarget(targetName);

        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
        const cursedBuffs = activeBuffs.filter(b => b.type === 'cursed' || b.cursed);
        setTargetCursedBuffs(cursedBuffs);

        const attunement = getRuntimeValue(targetName, 'attunement') || [];
        setTargetAttunement(attunement);
    }, []);

    const toggleSelection = useCallback((type) => {
        setSelections(prev => {
            if (prev.some(s => s.type === type)) {
                return prev.filter(s => s.type !== type);
            }
            return [...prev, { type }];
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (!selectedTarget || selections.length === 0) return;
        onConfirm({ targetName: selectedTarget, selections });
    }, [selectedTarget, selections, onConfirm]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onSkip();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onSkip]);

    const hasCurse = targetCursedBuffs.length > 0;
    const hasAttunement = targetAttunement.length > 0;
    const needsTarget = !selectedTarget;
    const needsSelection = selections.length === 0;

    return (
        <div className="popup-overlay" onClick={onSkip}>
            <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
                <div className="metamagic-popup-inner">
                    <h3><i className="fa-solid fa-hand-holding-medical"></i> Remove Curse</h3>
                    <p className="metamagic-spell-name">
                        <strong>{spell?.name || 'Spell'}</strong> — Level {spell?.level || 3} Abjuration
                    </p>
                    <p>
                        Choose a creature within <strong>{range}</strong>. This spell ends all curses affecting the target
                        and breaks the target&#39;s attunement to any cursed magic items.
                    </p>
                    <div className="metamagic-twin-target">
                        <label>
                            <strong>Target:</strong>
                            <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                {creatureTargets.map(name => (
                                    <div
                                        key={name}
                                        onClick={() => loadTargetData(name)}
                                        style={{
                                            padding: '6px 10px',
                                            margin: '4px 0',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            backgroundColor: selectedTarget === name ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                            border: selectedTarget === name ? '1px solid #4CAF50' : '1px solid transparent',
                                        }}
                                    >
                                        {selectedTarget === name ? '\u2713 ' : ''}{name}
                                    </div>
                                ))}
                            </div>
                        </label>
                    </div>
                    {selectedTarget && (
                        <div className="metamagic-twin-target" style={{ marginTop: '12px' }}>
                            <label>
                                <strong>Effects to remove from {selectedTarget}:</strong>
                                <div style={{ marginTop: '8px' }}>
                                    {hasCurse && (
                                        <div
                                            onClick={() => toggleSelection('curse')}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.type === 'curse') ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.type === 'curse') ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.type === 'curse') ? '\u2713 ' : ''}Curse ({targetCursedBuffs.length} cursed effect(s))
                                        </div>
                                    )}
                                    {hasAttunement && (
                                        <div
                                            onClick={() => toggleSelection('attunement')}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.type === 'attunement') ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.type === 'attunement') ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.type === 'attunement') ? '\u2713 ' : ''}Attunement ({targetAttunement.length} attuned item(s))
                                        </div>
                                    )}
                                    {!hasCurse && !hasAttunement && (
                                        <div style={{ padding: '6px 10px', fontStyle: 'italic', color: '#999' }}>
                                            No curses or attunement found on this target
                                        </div>
                                    )}
                                </div>
                            </label>
                        </div>
                    )}
                    <div className="metamagic-actions">
                        <button className="btn btn-secondary" onClick={onSkip}>
                            Cancel
                        </button>
                        <button
                            className="btn"
                            onClick={handleConfirm}
                            disabled={needsTarget || needsSelection}
                        >
                            Cast Remove Curse
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
