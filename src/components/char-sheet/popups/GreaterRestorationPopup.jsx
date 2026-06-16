import { useState, useEffect, useCallback } from 'react';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import utils from '../../../services/ui/utils.js';
import './MetamagicPopup.css';
import '../CharSheet.css';

const RESTORATION_CONDITIONS = [
    { key: 'charmed', label: 'Charmed' },
    { key: 'petrified', label: 'Petrified' },
];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export default function GreaterRestorationPopup({ spell, _playerStats, _campaignName, creatureTargets, range, onConfirm, onSkip }) {
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [targetConditions, setTargetConditions] = useState([]);
    const [targetExhaustion, setTargetExhaustion] = useState(0);
    const [targetHasCurse, setTargetHasCurse] = useState(false);
    const [targetHasAbilityReduction, setTargetHasAbilityReduction] = useState(false);
    const [targetHasHpMaxReduction, setTargetHasHpMaxReduction] = useState(false);
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
        setTargetConditions(allConditions);

        const exhaustion = getRuntimeValue(targetName, 'exhaustionLevel') || 0;
        setTargetExhaustion(exhaustion);

        const activeBuffs = getRuntimeValue(targetName, 'activeBuffs') || [];
        const hasCurse = activeBuffs.some(b => b.type === 'cursed' || b.cursed);
        setTargetHasCurse(hasCurse);

        const abilityReductions = getRuntimeValue(targetName, 'abilityReductions') || {};
        setTargetHasAbilityReduction(Object.keys(abilityReductions).length > 0);

        const hpMaxReduction = getRuntimeValue(targetName, 'hpMaxReduction') || 0;
        setTargetHasHpMaxReduction(hpMaxReduction > 0);
    }, []);

    const toggleSelection = useCallback((type, condition) => {
        setSelections(prev => {
            if (type === 'condition') {
                const exists = prev.some(s => s.type === 'condition' && s.condition === condition);
                if (exists) {
                    return prev.filter(s => !(s.type === 'condition' && s.condition === condition));
                }
                return [...prev, { type: 'condition', condition }];
            }
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

    const availableConditions = RESTORATION_CONDITIONS.filter(c =>
        targetConditions.some(cond => conditionMatches(cond, c.key))
    );

    const needsTarget = !selectedTarget;
    const needsSelection = selections.length === 0;

    return (
        <div className="popup-overlay" onClick={onSkip}>
            <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
                <div className="metamagic-popup-inner">
                    <h3><i className="fa-solid fa-hand-holding-medical"></i> Greater Restoration</h3>
                    <p className="metamagic-spell-name">
                        <strong>{spell?.name || 'Spell'}</strong> — Level {spell?.level || 5} Abjuration
                    </p>
                    <p>
                        Choose a creature within <strong>{range}</strong> and select the effect(s) to remove.
                        This spell can remove one or more of the following from the target:
                        an exhaustion level, the Charmed or Petrified condition, a curse (including attunement to a cursed magic item),
                        any reduction to an ability score, or any reduction to the target&#39;s Hit Point maximum.
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
                                    {targetExhaustion > 0 && (
                                        <div
                                            onClick={() => toggleSelection('exhaustion')}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.type === 'exhaustion') ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.type === 'exhaustion') ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.type === 'exhaustion') ? '\u2713 ' : ''}Exhaustion level (current: {targetExhaustion})
                                        </div>
                                    )}
                                    {availableConditions.map(c => (
                                        <div
                                            key={c.key}
                                            onClick={() => toggleSelection('condition', c.key)}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.type === 'condition' && s.condition === c.key) ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.type === 'condition' && s.condition === c.key) ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.type === 'condition' && s.condition === c.key) ? '\u2713 ' : ''}{c.label} condition
                                        </div>
                                    ))}
                                    {targetHasCurse && (
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
                                            {selections.some(s => s.type === 'curse') ? '\u2713 ' : ''}Curse (including attunement to cursed magic item)
                                        </div>
                                    )}
                                    {targetHasAbilityReduction && (
                                        <div
                                            onClick={() => toggleSelection('ability_reduction')}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.type === 'ability_reduction') ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.type === 'ability_reduction') ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.type === 'ability_reduction') ? '\u2713 ' : ''}Ability score reduction
                                        </div>
                                    )}
                                    {targetHasHpMaxReduction && (
                                        <div
                                            onClick={() => toggleSelection('hp_max_reduction')}
                                            style={{
                                                padding: '6px 10px',
                                                margin: '4px 0',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                backgroundColor: selections.some(s => s.type === 'hp_max_reduction') ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                                border: selections.some(s => s.type === 'hp_max_reduction') ? '1px solid #4CAF50' : '1px solid transparent',
                                            }}
                                        >
                                            {selections.some(s => s.type === 'hp_max_reduction') ? '\u2713 ' : ''}Hit Point maximum reduction
                                        </div>
                                    )}
                                    {targetExhaustion === 0 && availableConditions.length === 0 && !targetHasCurse && !targetHasAbilityReduction && !targetHasHpMaxReduction && (
                                        <div style={{ padding: '6px 10px', fontStyle: 'italic', color: '#999' }}>
                                            No removable effects found on this target
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
                            Cast Greater Restoration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
