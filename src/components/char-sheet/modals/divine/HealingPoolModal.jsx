
import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js'
import { addEntry } from '../../../../services/ui/logService.js'
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js'
import { applyHealingToTarget } from '../../../../services/rules/combat/applyHealing.js'
import { CONDITIONS } from '../../../../services/combat/conditions/conditionUtils.js'
import utils from '../../../../services/ui/utils.js'
import SecondaryTargetModal from '../shared/SecondaryTargetModal.jsx'
import '../../CharSheet.css'

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

function resolveConditionKey(name) {
    const lower = typeof name === 'string' ? name.toLowerCase().trim() : '';
    for (const c of CONDITIONS) {
        if (c.key.toLowerCase() === lower || c.label.toLowerCase() === lower) {
            return c.key;
        }
    }
    return typeof name === 'string' ? lower : name;
}

function conditionLabel(name) {
    const key = resolveConditionKey(name);
    for (const c of CONDITIONS) {
        if (c.key === key) return c.label;
    }
    return name;
}

function HealingPoolModal({ playerStats, campaignName, name: featureName = 'Lay On Hands', poolMax: poolMaxProp = 0, _poolExpression, isDicePool = false, dieType = null, resourceKey: resourceKeyProp, alsoCures, cureCost, restoringTouchConditions, bloodiedOnly = false, maxDicePerUse: maxDicePerUseProp = '', creatureTargets, onClose }) {
    const layOnHandsPoolMax = 5 * (playerStats.level || 1);
    const effectivePoolMax = isDicePool ? poolMaxProp : layOnHandsPoolMax;
    const effectiveResourceKey = resourceKeyProp || (isDicePool ? featureName.toLowerCase().replace(/\s+/g, '') + 'Pool' : 'layOnHandsPool');

    const { current: poolRemaining, max: poolMaxFromHook, update: setPoolRemaining } = useTrackedResource(
        effectiveResourceKey,
        playerStats.name,
        () => effectivePoolMax,
        [playerStats, isDicePool ? poolMaxProp : playerStats.level],
        campaignName,
        playerStats
    );
    const [healAmount, setHealAmount] = React.useState(isDicePool ? 1 : 1);
    const [log, setLog] = React.useState([]);
    const [selectedConditions, setSelectedConditions] = React.useState([]);
    const [combatSummary, setCombatSummary] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [accumulatedTotal, setAccumulatedTotal] = React.useState(0);
    const [rolledFaces, setRolledFaces] = React.useState([]);
    const [selectedTargetName, setSelectedTargetName] = React.useState(null);
    const [showTargetSelection, setShowTargetSelection] = React.useState(!!(creatureTargets && creatureTargets.length > 1));

    const chaMod = (() => {
        const chaScore = playerStats.abilities?.CHA || 10;
        return Math.floor((chaScore - 1) / 2);
    })();
    const effectiveMaxDicePerUse = maxDicePerUseProp ? chaMod : Infinity;

    const safePool = Number(poolRemaining) || 0;
    const safeMax = Number(poolMaxFromHook) || 0;

    React.useEffect(() => {
        setLoading(true);
        getCombatContext(campaignName).then(cs => {
            if (cs) setCombatSummary(cs);
            setLoading(false);
        });
    }, [campaignName]);

    const handleTargetSelected = (targetName) => {
        setSelectedTargetName(targetName);
        setShowTargetSelection(false);
    };

    const handleTargetSkip = () => {
        setSelectedTargetName(playerStats.name);
        setShowTargetSelection(false);
    };

    const resolvedTargetName = selectedTargetName || playerStats.name;
    const targetMaxHp = (() => {
        const creature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);
        if (creature) {
            return creature.type === 'player' ? (getRuntimeValue(creature.name, 'hitPoints') ?? 0) : creature.maxHp;
        }
        return playerStats.hitPoints;
    })();
    const targetCurrentHp = (() => {
        const creature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);
        if (creature) {
            if (creature.type === 'player') {
                const stored = getRuntimeValue(creature.name, 'currentHitPoints');
                if (stored != null && stored !== '') return Number(stored);
            } else {
                return creature.currentHp;
            }
        }
        const stored = getRuntimeValue(playerStats.name, 'currentHitPoints');
        return stored != null && stored !== '' ? Number(stored) : playerStats.hitPoints;
    })();

    const isTargetBloodied = targetCurrentHp > 0 && targetCurrentHp <= Math.floor(targetMaxHp / 2);

    const getTargetConditions = React.useCallback(() => {
        const runtimeConditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];

        if (combatSummary) {
            try {
                if (combatSummary) {
                    const creature = combatSummary.creatures?.find(c => utils.getName(c.name) === utils.getName(resolvedTargetName));
                    if (creature && Array.isArray(creature.conditions)) {
                        const csKeys = creature.conditions.map(c => c.key);
                        const seen = new Set(runtimeConditions.map(c => String(c).toLowerCase()));
                        const merged = [...runtimeConditions];
                        for (const key of csKeys) {
                            if (!seen.has(key.toLowerCase())) {
                                merged.push(key);
                                seen.add(key.toLowerCase());
                            }
                        }
                        return merged;
                    }
                }
            } catch { /* ignore */ }
        }

        return runtimeConditions;
    }, [resolvedTargetName, combatSummary]);

    const targetConditions = getTargetConditions();
    const allCurableEntries = [...(alsoCures || []), ...(restoringTouchConditions || [])];
    const curableEntries = allCurableEntries
        .map(name => ({ key: resolveConditionKey(name), label: conditionLabel(name) }))
        .filter(entry => entry.key && targetConditions.some(c => conditionMatches(c, entry.key)));

    const hasRestoringTouch = restoringTouchConditions && restoringTouchConditions.length > 0;

    React.useEffect(() => {
        const validKeys = new Set(curableEntries.map(e => e.key));
        setSelectedConditions(prev => {
            const valid = prev.filter(k => validKeys.has(k));
            return valid.length === prev.length ? prev : valid;
        });
    }, [curableEntries]);

    const toggleCondition = (conditionKey) => {
        setSelectedConditions(prev =>
            prev.includes(conditionKey)
                ? prev.filter(c => c !== conditionKey)
                : [...prev, conditionKey]
        );
    };

    const applyHeal = () => {
        const amount = Math.min(healAmount, safePool);
        if (amount <= 0) return;
        const newPool = safePool - amount;
        setPoolRemaining(newPool);

        const targetCreature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);
        if (targetCreature && combatSummary) {
            const result = applyHealingToTarget(combatSummary, resolvedTargetName, amount, campaignName);
            if (result) {
                addEntry(campaignName, {
                    type: 'healing_pool',
                    sourceName: playerStats.name,
                    featureName,
                    targetName: resolvedTargetName,
                    amount: result.actualHeal,
                    poolAfter: newPool,
                }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });
                setLog(prev => [...prev, { action: 'Heal', target: resolvedTargetName, amount: result.actualHeal, poolAfter: newPool }]);
                setHealAmount(Math.min(healAmount, newPool));
            }
        } else {
            const newHp = Math.min(playerStats.hitPoints, targetCurrentHp + amount);
            setRuntimeValue(resolvedTargetName, 'currentHitPoints', newHp, campaignName);
            addEntry(campaignName, {
                type: 'healing_pool',
                sourceName: playerStats.name,
                featureName,
                targetName: resolvedTargetName,
                amount,
                poolAfter: newPool,
            }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });
            setLog(prev => [...prev, { action: 'Heal', target: resolvedTargetName, amount, poolAfter: newPool }]);
            setHealAmount(Math.min(healAmount, newPool));
        }
    };

    const applyDiceHeal = () => {
        if (safePool <= 0) return;
        if (effectiveMaxDicePerUse < Infinity && rolledFaces.length >= effectiveMaxDicePerUse) return;

        const roll = Math.floor(Math.random() * dieType) + 1;
        const newPool = safePool - 1;
        setPoolRemaining(newPool);

        const newFaces = [...rolledFaces, roll];
        const newTotal = accumulatedTotal + roll;
        setRolledFaces(newFaces);
        setAccumulatedTotal(newTotal);
    };

    const applyAccumulatedHealing = React.useCallback(() => {
        if (accumulatedTotal <= 0) return;

        const newPool = safePool;

        const targetCreature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);
        const targetMax = targetCreature ? (targetCreature.type === 'player' ? (getRuntimeValue(targetCreature.name, 'hitPoints') ?? 0) : targetCreature.maxHp) : playerStats.hitPoints;
        const newHp = Math.min(targetMax, targetCurrentHp + accumulatedTotal);
        setRuntimeValue(resolvedTargetName, 'currentHitPoints', newHp, campaignName);
        addEntry(campaignName, {
            type: 'healing_pool',
            sourceName: playerStats.name,
            featureName,
            targetName: resolvedTargetName,
            amount: accumulatedTotal,
            diceUsed: rolledFaces.length,
            dieType: dieType,
            rolls: rolledFaces,
            poolAfter: newPool,
        }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });
        setLog(prev => [...prev, {
            action: `Roll ${rolledFaces.length}d${dieType}`,
            target: resolvedTargetName,
            amount: accumulatedTotal,
            poolAfter: newPool,
            rolls: rolledFaces.join(' + ')
        }]);
        setAccumulatedTotal(0);
        setRolledFaces([]);
    }, [accumulatedTotal, safePool, rolledFaces, playerStats.hitPoints, targetCurrentHp, playerStats.name, campaignName, featureName, dieType, resolvedTargetName, combatSummary]);

    const handleClose = () => {
        if (isDicePool && accumulatedTotal > 0) {
            applyAccumulatedHealing();
        }
        onClose();
    };

    const applyCure = (condition) => {
        if (safePool < cureCost) return;
        const newPool = safePool - cureCost;
        setPoolRemaining(newPool);

        const conditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];
        const filtered = conditions.filter(c => !conditionMatches(c, condition));
        setRuntimeValue(resolvedTargetName, 'activeConditions', filtered, campaignName);

        const targetCreature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);
        if (combatSummary && targetCreature && targetCreature.type === 'npc') {
            const creature = combatSummary.creatures?.find(c => c.name === resolvedTargetName);
            if (creature && Array.isArray(creature.conditions)) {
                const conditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];
                const filtered = conditions.filter(c => !conditionMatches(String(c).toLowerCase(), condition.toLowerCase()));
                setRuntimeValue(resolvedTargetName, 'activeConditions', filtered, campaignName);
            }
        }

            addEntry(campaignName, {
                type: 'condition',
                characterName: resolvedTargetName,
                condition: condition,
                action: 'broken',
                sourceName: playerStats.name,
                featureName,
                timestamp: Date.now(),
              }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });

            setLog(prev => [...prev, { action: `Cure ${condition}`, target: resolvedTargetName, amount: cureCost, poolAfter: newPool }]);
            setHealAmount(Math.min(healAmount, newPool));
         };

    const applyBatchCure = () => {
        if (selectedConditions.length === 0) return;
        const totalCost = selectedConditions.length * cureCost;
        if (safePool < totalCost) return;
        const newPool = safePool - totalCost;
        setPoolRemaining(newPool);

        const targetCreature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);

        selectedConditions.forEach((condition) => {
            const conditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];
            const filtered = conditions.filter(c => !conditionMatches(c, condition));
            setRuntimeValue(resolvedTargetName, 'activeConditions', filtered, campaignName);

            if (combatSummary && targetCreature && targetCreature.type === 'npc') {
                const creature = combatSummary.creatures?.find(c => c.name === resolvedTargetName);
                if (creature && Array.isArray(creature.conditions)) {
                    const conditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];
                    const filtered = conditions.filter(c => !conditionMatches(String(c).toLowerCase(), condition.toLowerCase()));
                    setRuntimeValue(resolvedTargetName, 'activeConditions', filtered, campaignName);
                }
            }

            addEntry(campaignName, {
                type: 'condition',
                characterName: resolvedTargetName,
                condition: condition,
                action: 'broken',
                sourceName: playerStats.name,
                featureName,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });

            setLog(prev => [...prev, { action: `Cure ${condition}`, target: resolvedTargetName, amount: cureCost, poolAfter: newPool }]);
        });

        setSelectedConditions([]);
    };

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                if (isDicePool && accumulatedTotal > 0) {
                    applyAccumulatedHealing();
                }
                onClose();
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose, accumulatedTotal, isDicePool, applyAccumulatedHealing]);

    const batchTotalCost = selectedConditions.length * cureCost;

    return (
        <div className="short-rest-overlay no-print" onClick={handleClose}>
            {showTargetSelection ? (
                <div className="short-rest-modal" onClick={(e) => e.stopPropagation()}>
                    <SecondaryTargetModal
                        title={`Choose target for ${featureName}`}
                        targets={creatureTargets}
                        onTargetSelected={handleTargetSelected}
                        onSkip={handleTargetSkip}
                        featureDescription={`Choose a creature within range to heal with ${featureName}.`}
                        confirmLabel="Heal"
                        confirmIcon="fa-hand-holding-heart"
                        showHp={true}
                    />
                </div>
            ) : (
            <div className="short-rest-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fas fa-hands-helping"></i> {featureName}</h3>

                {loading && (
                    <div className="short-rest-section" style={{ textAlign: 'center', padding: '1em' }}>
                        <i className="fas fa-spinner fa-spin"></i> Loading...
                    </div>
                )}

                {!loading && <>
                <div className="short-rest-section">
                    <p>Pool: <b>{safePool}</b> / {safeMax} {isDicePool ? `d${dieType}` : 'HP'}</p>
                </div>

                {!isDicePool && (
                    <div className="short-rest-section">
                        <h4>Heal — {resolvedTargetName} ({targetCurrentHp} / {targetMaxHp} HP){bloodiedOnly && <span className="bloodied-badge"> (Bloodied only)</span>}</h4>
                        <div className="short-rest-dice-row">
                            <label>
                                Amount:
                                <input
                                    type="number"
                                    min="0"
                                    max={safePool}
                                    value={Math.min(healAmount, safePool)}
                                    onChange={(e) => {
                                        const raw = Number(e.target.value);
                                        setHealAmount(raw >= 0 ? raw : 0);
                                    }}
                                    style={{ width: '62px', marginLeft: '6px' }}
                                />
                            </label>
                            <button className="char-btn" onClick={applyHeal} disabled={safePool <= 0 || healAmount <= 0 || (bloodiedOnly && !isTargetBloodied)}>
                                <i className="fas fa-heart"></i> Apply Heal
                            </button>
                        </div>
                        {bloodiedOnly && !isTargetBloodied && (
                            <p className="healing-restriction-note">This feature can only heal Bloodied creatures (at half HP or less).</p>
                        )}
                    </div>
                )}

                {isDicePool && (
                    <div className="short-rest-section">
                        <h4>Roll Dice — {resolvedTargetName} ({targetCurrentHp} / {targetMaxHp} HP){effectiveMaxDicePerUse < Infinity && <span className="bloodied-badge"> (Max {effectiveMaxDicePerUse} dice)</span>}</h4>
                        <div className="short-rest-dice-row">
                            <button className="char-btn" onClick={applyDiceHeal} disabled={safePool <= 0 || (effectiveMaxDicePerUse < Infinity && rolledFaces.length >= effectiveMaxDicePerUse)}>
                                <i className="fas fa-dice-d12"></i> Roll a d{dieType}
                            </button>
                        </div>
                        {rolledFaces.length > 0 && (
                            <div className="healing-roll-details" style={{ marginTop: '8px' }}>
                                <span className="healing-formula">Rolled {rolledFaces.length}d{dieType}: </span>
                                <span className="healing-dice-rolled">{rolledFaces.join(' + ')}</span>
                                <span className="healing-total"> = <strong>{accumulatedTotal}</strong> HP to restore</span>
                                <div style={{ marginTop: '4px', fontSize: '0.9em', color: '#888' }}>
                                    Remaining: {safePool} dice
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {hasRestoringTouch && curableEntries.length > 0 && (
                    <div className="short-rest-section">
                        <h4>Cure Conditions ({cureCost} HP each)</h4>
                        <p>Select conditions affecting {resolvedTargetName} to cure:</p>
                        <div className="healing-cure-options">
                            {curableEntries.map((entry) => {
                                const isSelected = selectedConditions.includes(entry.key);
                                return (
                                    <button
                                        key={entry.key}
                                        className={`char-btn${isSelected ? ' cure-btn-active' : ''}`}
                                        onClick={() => toggleCondition(entry.key)}
                                    >
                                        <i className={`fa-solid fa-${isSelected ? 'check-circle' : 'circle'}`}></i> {entry.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="short-rest-dice-row">
                            <button
                                className="char-btn"
                                onClick={applyBatchCure}
                                disabled={selectedConditions.length === 0 || safePool < batchTotalCost}
                            >
                                <i className="fas fa-shield-alt"></i> Cure Selected ({selectedConditions.length} for {batchTotalCost} HP)
                            </button>
                            {selectedConditions.length > 0 && safePool >= batchTotalCost && (
                                <span className="short-rest-total">
                                    Pool after: {safePool - batchTotalCost} HP
                                </span>
                            )}
                            {selectedConditions.length > 0 && safePool < batchTotalCost && (
                                <span className="short-rest-total short-rest-warning">
                                    Not enough pool! Need {batchTotalCost - safePool} more HP
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {!hasRestoringTouch && alsoCures && alsoCures.length > 0 && (
                    <div className="short-rest-section">
                        <h4>Cure Conditions ({cureCost} HP each)</h4>
                        <div className="short-rest-dice-row">
                            {alsoCures.map((condition) => (
                                <button key={condition} className="char-btn" onClick={() => applyCure(condition)} disabled={safePool < cureCost}>
                                    <i className="fas fa-shield-alt"></i> {condition}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {log.length > 0 && (
                    <div className="short-rest-section">
                        <h4>Log</h4>
                        <div className="short-rest-roll-log">
                            <table>
                                <thead>
                                    <tr><th>Action</th><th>Target</th><th>Pool Used</th><th>Pool Left</th></tr>
                                </thead>
                                <tbody>
                                    {log.map((entry, i) => (
                                        <tr key={i}>
                                            <td>{entry.action}</td>
                                            <td>{entry.target}</td>
                                            <td>{entry.amount}</td>
                                            <td>{entry.poolAfter}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="short-rest-actions">
                    <button className="char-btn" onClick={handleClose}>
                        <i className="fa-solid fa-check"></i> Done
                    </button>
                </div>
                </>}
            </div>
            )}
        </div>
    );
}

export default HealingPoolModal
