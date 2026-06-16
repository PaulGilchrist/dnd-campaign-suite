import { useState, useEffect, useCallback } from 'react';
import { getRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import utils from '../../../services/ui/utils.js';
import './MetamagicPopup.css';
import '../CharSheet.css';

const ALLOWED_CONDITIONS = [
    { key: 'blinded', label: 'Blinded' },
    { key: 'deafened', label: 'Deafened' },
    { key: 'paralyzed', label: 'Paralyzed' },
    { key: 'poisoned', label: 'Poisoned' },
];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export default function LesserRestorationPopup({ spell, _playerStats, _campaignName, creatureTargets, range, onConfirm, onSkip }) {
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [targetConditions, setTargetConditions] = useState([]);
    const [selections, setSelections] = useState([]);

    const loadTargetData = useCallback(async (targetName) => {
        setSelectedTarget(targetName);
        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];

        let csConditions = [];
        try {
            const cs = await getCombatSummary();
            if (cs) {
                const creature = cs.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
                if (creature && Array.isArray(creature.conditions)) {
                    csConditions = creature.conditions.map(c => c.key);
                }
            }
        } catch { /* ignore */ }

        const allConditions = [...new Set([...conditions, ...csConditions])];
        const applicableConditions = allConditions.filter(c =>
            ALLOWED_CONDITIONS.some(ac => conditionMatches(c, ac.key))
        );
        setTargetConditions(applicableConditions);
    }, []);

    const toggleSelection = useCallback((condition) => {
        setSelections(prev => {
            const exists = prev.some(s => s.condition === condition);
            if (exists) {
                return prev.filter(s => s.condition !== condition);
            }
            return [...prev, { condition }];
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (!selectedTarget || selections.length === 0) return;
        onConfirm({ targetName: selectedTarget, condition: selections[0]?.condition });
    }, [selectedTarget, selections, onConfirm]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onSkip();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onSkip]);

    const availableConditions = ALLOWED_CONDITIONS.filter(c =>
        targetConditions.some(cond => conditionMatches(cond, c.key))
    );

    const needsTarget = !selectedTarget;
    const needsSelection = selections.length === 0;

    return (
        <div className="popup-overlay" onClick={onSkip}>
            <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
                <div className="metamagic-popup-inner">
                    <h3><i className="fa-solid fa-hand-holding-medical"></i> Lesser Restoration</h3>
                    <p className="metamagic-spell-name">
                        <strong>{spell?.name || 'Spell'}</strong> — Level {spell?.level || 2} Abjuration
                    </p>
                    <p>
                        Choose a creature within <strong>{range}</strong> and select one condition to remove.
                        This spell can end one condition on the target: Blinded, Deafened, Paralyzed, or Poisoned.
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
                                <strong>Condition to remove from {selectedTarget}:</strong>
                                <div style={{ marginTop: '8px' }}>
                                    {availableConditions.map(c => (
                                        <div
                                            key={c.key}
                                            onClick={() => toggleSelection(c.key)}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.condition === c.key) ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.condition === c.key) ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.condition === c.key) ? '\u2713 ' : ''}{c.label} condition
                                        </div>
                                    ))}
                                    {availableConditions.length === 0 && (
                                        <div style={{ padding: '6px 10px', fontStyle: 'italic', color: '#999' }}>
                                            No applicable conditions found on this target
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
                            Cast Lesser Restoration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
