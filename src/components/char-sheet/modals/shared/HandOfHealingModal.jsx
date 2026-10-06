import React, { useCallback } from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import utils from '../../../../services/ui/utils.js'
import { addEntry } from '../../../../services/ui/logService.js'
import { getCombatSummary } from '../../../../services/encounters/combatData.js'
import SecondaryTargetModal from './SecondaryTargetModal.jsx'
import '../../CharSheet.css'

const CUREABLE_CONDITIONS = ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned', 'Stunned'];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

function getCombatSummaryConditionKeys(campaignName, targetName) {
    try {
        const combatSummary = getCombatSummary(campaignName);
        const creature = combatSummary?.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
        if (creature && Array.isArray(creature.conditions)) {
            return creature.conditions.map(c => c.key);
        }
    } catch { /* ignore */ }
    return [];
}

function getTargetConditions(targetName, campaignName) {
    // Get conditions from runtime state (where Stunning Strike writes them)
    const runtimeConditions = getRuntimeValue(targetName, 'activeConditions') || [];

    // Also check combat summary for conditions stored on NPCs
    const csKeys = getCombatSummaryConditionKeys(campaignName, targetName);
    if (csKeys.length === 0) return runtimeConditions;

    // Merge both sources, deduplicate case-insensitively
    const seen = new Set(runtimeConditions.map(c => String(c).toLowerCase()));
    const merged = [...runtimeConditions];
    for (const key of csKeys) {
        const lower = String(key).toLowerCase();
        if (!seen.has(lower)) {
            merged.push(key);
            seen.add(lower);
        }
    }
    return merged;
}

// CLA-159: pending picker stage — mirrors the verified Healing Light target-modal
// seam (CLA-163): SecondaryTargetModal inside .short-rest-modal, confirmLabel Heal.
function HandOfHealingPickerStage({ healName, creatureTargets, onPick, onSkip }) {
    return (
        <div className="short-rest-overlay no-print">
            <div className="short-rest-modal">
                <SecondaryTargetModal
                    title={`Choose target for ${healName}`}
                    targets={creatureTargets}
                    onTargetSelected={onPick}
                    onSkip={onSkip}
                    featureDescription={`Choose a creature you can touch to heal with ${healName}.`}
                    confirmLabel="Heal"
                    confirmIcon="fa-hand-holding-heart"
                    showHp={true}
                />
            </div>
        </div>
    );
}

function PhysiciansTouchSection({ targetName, healName, monkName, campaignName, hasPhysiciansTouch }) {
    const [curedCondition, setCureCondition] = React.useState(null);
    const curedOnMount = React.useRef(false);

    const removeCondition = useCallback((conditionName) => {
        const conditions = getTargetConditions(targetName, campaignName);
        const filtered = conditions.filter(c => !conditionMatches(String(c).toLowerCase(), conditionName.toLowerCase()));
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

        addEntry(campaignName, {
            type: 'condition',
            characterName: targetName,
            condition: conditionName,
            action: 'broken',
            sourceName: `${monkName} (${healName}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[HandOfHealingModal] Error:", e); });

        setCureCondition(conditionName);
    }, [campaignName, targetName, healName, monkName]);

    const cureableConditions = React.useMemo(() => {
        const conditions = getTargetConditions(targetName, campaignName);
        return Array.isArray(conditions)
            ? CUREABLE_CONDITIONS.filter(cc => conditions.some(c => conditionMatches(c, cc)))
            : [];
    }, [targetName, campaignName]);

    React.useEffect(() => {
        if (!curedOnMount.current && cureableConditions.length === 1 && hasPhysiciansTouch) {
            removeCondition(cureableConditions[0]);
            curedOnMount.current = true;
        }
    }, [cureableConditions, hasPhysiciansTouch, removeCondition]);

    if (curedCondition) {
        return (
            <div className="short-rest-section healing-cured-condition">
                <h4><i className="fas fa-shield-virus"></i> Condition Cleared</h4>
                <div>
                    <i className="fas fa-check-circle"></i> {curedCondition} removed from {targetName} (Physician&apos;s Touch)
                </div>
            </div>
        );
    }

    if (cureableConditions.length > 1) {
        return (
            <div className="short-rest-section">
                <h4><i className="fas fa-shield-virus"></i> Physician&apos;s Touch</h4>
                <p>Target has multiple conditions. Select one to remove:</p>
                <div className="healing-cure-options">
                    {[...new Set(cureableConditions)].map((condition, i) => (
                        <button key={`${condition}-${i}`} className="char-btn" onClick={() => removeCondition(condition)}>
                            <i className="fas fa-check-circle"></i> Remove {condition}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return null;
}

function HandOfHealingResultStage({ healName, result, monkName, campaignName, hasPhysiciansTouch, onClose }) {
    const rollValues = Array.isArray(result.rolls) ? result.rolls : [];
    return (
        <div className="short-rest-overlay no-print">
            <div className="short-rest-modal">
                <h3><i className="fas fa-hand-sparkles"></i> {healName}</h3>

                <div className="short-rest-section">
                    <h4>Healing{'\u2014'}{result.targetName} ({result.targetCurrentHp} / {result.targetMaxHp} HP)</h4>
                    <div className="healing-roll-details">
                        <span className="healing-formula">{result.formula}: </span>
                        <span className="healing-dice-rolled">{rollValues.join(' + ')}</span>
                        {result.bonus !== 0 && <span className="healing-bonus"> {result.bonus >= 0 ? '+' : ''}{result.bonus}</span>}
                        <span className="healing-total">= <strong>{result.healAmount}</strong> HP restored</span>
                    </div>
                </div>

                <PhysiciansTouchSection
                    targetName={result.targetName}
                    healName={healName}
                    monkName={monkName}
                    campaignName={campaignName}
                    hasPhysiciansTouch={hasPhysiciansTouch}
                />

                <div className="short-rest-actions">
                    <button className="char-btn" onClick={onClose}>
                        <i className="fa-solid fa-check"></i> Done
                    </button>
                </div>
            </div>
        </div>
    );
}

function HandOfHealingModal({ healName, formula, rolls, bonus, healAmount, monkName, targetName, targetCurrentHp, targetMaxHp, hasPhysiciansTouch, campaignName, pending, creatureTargets, confirmHeal, onClose }) {
    const [result, setResult] = React.useState(pending ? null : { targetName, formula, rolls, bonus, healAmount, targetCurrentHp, targetMaxHp });
    const [healError, setHealError] = React.useState(null);

    const runHeal = useCallback(async (name) => {
        try {
            const payload = await confirmHeal?.(name);
            if (!payload) {
                setHealError('Healing failed to resolve.');
                return;
            }
            setResult(payload);
        } catch (e) {
            console.error('[HandOfHealingModal] confirm heal failed:', e);
            setHealError('Healing failed to resolve.');
        }
    }, [confirmHeal]);

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
          };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (pending && !result) {
        if (healError) {
            return (
                <div className="short-rest-overlay no-print">
                    <div className="short-rest-modal">
                        <h3><i className="fas fa-hand-sparkles"></i> {healName}</h3>
                        <div className="short-rest-section">{healError}</div>
                        <div className="short-rest-actions">
                            <button className="char-btn" onClick={onClose}>
                                <i className="fa-solid fa-check"></i> Done
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <HandOfHealingPickerStage
                healName={healName}
                creatureTargets={creatureTargets || []}
                onPick={runHeal}
                onSkip={() => runHeal(monkName)}
            />
        );
    }

    return (
        <HandOfHealingResultStage
            healName={healName}
            result={result}
            monkName={monkName}
            campaignName={campaignName}
            hasPhysiciansTouch={hasPhysiciansTouch}
            onClose={onClose}
        />
    );
}

export default HandOfHealingModal;
