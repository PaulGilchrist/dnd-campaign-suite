
import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js'
import { addEntry } from '../../../../services/ui/logService.js'
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js'
import { applyHealingToTarget } from '../../../../services/rules/combat/applyHealing.js'
import { CONDITIONS } from '../../../../services/combat/conditions/conditionUtils.js'
import utils from '../../../../services/ui/utils.js'
import SecondaryTargetModal from '../shared/SecondaryTargetModal.jsx'
import { resolveChannelDivinityCharges } from '../../../../services/automation/handlers/healing/healingPoolHandler.js'
import '../../CharSheet.css'

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

function mergeConditionKeys(runtimeConditions, creatureConditions) {
    const csKeys = creatureConditions.map(c => c.key);
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

function ConditionCureSections({ hasRestoringTouch, curableEntries, selectedConditions, toggleCondition, applyBatchCure, applyCure, safePool, batchTotalCost, resolvedTargetName, cureCost, alsoCures }) {
    return (
        <>
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
                        {[...new Set(alsoCures)].map((condition, i) => (
                            <button key={`${condition}-${i}`} className="char-btn" onClick={() => applyCure(condition)} disabled={safePool < cureCost}>
                                <i className="fas fa-shield-alt"></i> {condition}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

function HealingApplySection({ resolvedTargetName, targetCurrentHp, targetMaxHp, bloodiedOnly, isTargetBloodied, safePool, healAmount, setHealAmount, applyHeal }) {
    return (
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
    );
}

// Target-current-HP resolution shared by render (header/gate) and commit.
// MUST be called at COMMIT time too, not only at render: a mounted modal never
// re-renders when another writer (tab/AI-referee) changes the target's bucket,
// so committing from the render closure can overwrite a HIGHER current HP with
// a stale + roll value (bug-healing-pool-dice-commit-stale-closure-damages-hp).
// Mirrors the commit-time getRuntimeValue re-read in hpModifier.modifyHitPoints.
function resolveTargetCurrentHp(combatSummary, resolvedTargetName, playerStats) {
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
}

function resolveHealCapacity(targetMaxHp, targetCurrentHp, accumulatedTotal) {
    if (targetMaxHp <= 0) return null; // HP truth unavailable — keep the roll gate open
    return Math.max(0, targetMaxHp - targetCurrentHp - accumulatedTotal);
}

function resolveRestorableTotal(targetMaxHp, targetCurrentHp, accumulatedTotal) {
    if (targetMaxHp <= 0) return accumulatedTotal;
    return Math.min(accumulatedTotal, Math.max(0, targetMaxHp - targetCurrentHp));
}

function resolveDiceActualHeal(targetMax, targetCurrentHp, newHp, accumulatedTotal) {
    if (targetMax <= 0) return accumulatedTotal; // HP truth unavailable — legacy fallback
    return Math.max(0, newHp - targetCurrentHp);
}

function HealingDiceSection({ resolvedTargetName, targetCurrentHp, targetMaxHp, effectiveMaxDicePerUse, safePool, rolledFaces, restorableTotal, noHealCapacity, dieType, applyDiceHeal }) {
    return (
        <div className="short-rest-section">
            <h4>Roll Dice — {resolvedTargetName} ({targetCurrentHp} / {targetMaxHp} HP){effectiveMaxDicePerUse < Infinity && <span className="bloodied-badge"> (Max {effectiveMaxDicePerUse} dice)</span>}</h4>
            <div className="short-rest-dice-row">
                <button className="char-btn" onClick={applyDiceHeal} disabled={safePool <= 0 || (effectiveMaxDicePerUse < Infinity && rolledFaces.length >= effectiveMaxDicePerUse) || noHealCapacity}>
                    <i className="fas fa-dice-d12"></i> Roll a d{dieType}
                </button>
            </div>
            {noHealCapacity && (
                <p className="healing-restriction-note">
                    {rolledFaces.length === 0
                        ? `${resolvedTargetName} is already at full HP. No die spent.`
                        : `These rolls already fill ${resolvedTargetName} to maximum HP — further dice would restore nothing.`}
                </p>
            )}
            {rolledFaces.length > 0 && (
                <div className="healing-roll-details" style={{ marginTop: '8px' }}>
                    <span className="healing-formula">Rolled {rolledFaces.length}d{dieType}: </span>
                    <span className="healing-dice-rolled">{rolledFaces.join(' + ')}</span>
                    <span className="healing-total"> = <strong>{restorableTotal}</strong> HP to restore</span>
                    <div style={{ marginTop: '4px', fontSize: '0.9em', color: '#888' }}>
                        Remaining: {safePool} dice
                    </div>
                </div>
            )}
        </div>
    );
}

function HealingLogSection({ log }) {
    return (
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
    );
}

function HealingPoolMain({ loading, safePool, safeMax, isDicePool, dieType, resolvedTargetName, targetCurrentHp, targetMaxHp, bloodiedOnly, isTargetBloodied, healAmount, setHealAmount, applyHeal, effectiveMaxDicePerUse, rolledFaces, restorableTotal, noHealCapacity, applyDiceHeal, hasRestoringTouch, curableEntries, selectedConditions, toggleCondition, applyBatchCure, applyCure, batchTotalCost, cureCost, alsoCures, log, handleClose, featureName }) {
    return (
        // Dialog semantics per the shared DeleteConfirmModal-class tier
        // (backlog 2026-11-10 HD, ShortRestModal bc409413d pattern): the existing
        // borrowed .short-rest-modal shell IS the dialog root — role + aria-modal
        // + aria-labelledby → its visible <h3> heading. The .short-rest-overlay
        // backdrop above it stays role-free, mirroring ShortRestModal.
        <div
            className="short-rest-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="healing-pool-modal-title"
        >
            <h3 id="healing-pool-modal-title"><i className="fas fa-hands-helping"></i> {featureName}</h3>

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
                <HealingApplySection
                    resolvedTargetName={resolvedTargetName}
                    targetCurrentHp={targetCurrentHp}
                    targetMaxHp={targetMaxHp}
                    bloodiedOnly={bloodiedOnly}
                    isTargetBloodied={isTargetBloodied}
                    safePool={safePool}
                    healAmount={healAmount}
                    setHealAmount={setHealAmount}
                    applyHeal={applyHeal}
                />
            )}

            {isDicePool && (
                <HealingDiceSection
                    resolvedTargetName={resolvedTargetName}
                    targetCurrentHp={targetCurrentHp}
                    targetMaxHp={targetMaxHp}
                    effectiveMaxDicePerUse={effectiveMaxDicePerUse}
                    safePool={safePool}
                    rolledFaces={rolledFaces}
                    restorableTotal={restorableTotal}
                    noHealCapacity={noHealCapacity}
                    dieType={dieType}
                    applyDiceHeal={applyDiceHeal}
                />
            )}

            <ConditionCureSections
                hasRestoringTouch={hasRestoringTouch}
                curableEntries={curableEntries}
                selectedConditions={selectedConditions}
                toggleCondition={toggleCondition}
                applyBatchCure={applyBatchCure}
                applyCure={applyCure}
                safePool={safePool}
                batchTotalCost={batchTotalCost}
                resolvedTargetName={resolvedTargetName}
                cureCost={cureCost}
                alsoCures={alsoCures}
            />

            {log.length > 0 && <HealingLogSection log={log} />}

            <div className="short-rest-actions">
                <button className="char-btn" onClick={handleClose}>
                    <i className="fa-solid fa-check"></i> Done
                </button>
            </div>
            </>}
        </div>
    );
}

function resolveHealingPoolResourceKey(resourceKeyProp, isDicePool, featureName) {
    return resourceKeyProp || (isDicePool ? featureName.toLowerCase().replace(/\s+/g, '') + 'Pool' : 'layOnHandsPool');
}

function buildCurableEntries(alsoCures, restoringTouchConditions, targetConditions) {
    const allCurableEntries = [...(alsoCures || []), ...(restoringTouchConditions || [])];
    return allCurableEntries
        .map(name => ({ key: resolveConditionKey(name), label: conditionLabel(name) }))
        .filter(entry => entry.key && targetConditions.some(c => conditionMatches(c, entry.key)));
}

function computeCharismaMod(playerStats) {
    const chaScore = playerStats.abilities?.CHA || 10;
    return Math.floor((chaScore - 1) / 2);
}

function resolveEffectivePoolMax(isDicePool, poolMaxProp, level) {
    if (isDicePool) return poolMaxProp;
    return 5 * (level || 1);
}

function resolveMaxDicePerUse(maxDicePerUseProp, playerStats) {
    return maxDicePerUseProp ? computeCharismaMod(playerStats) : Infinity;
}

function hasRestoringTouchRow(restoringTouchConditions) {
    return !!restoringTouchConditions && restoringTouchConditions.length > 0;
}

function HealingPoolModal({ playerStats, campaignName, name: featureName = 'Lay On Hands', poolMax: poolMaxProp = 0, _poolExpression, isDicePool = false, dieType = null, resourceKey: resourceKeyProp, alsoCures, cureCost, restoringTouchConditions, bloodiedOnly = false, maxDicePerUse: maxDicePerUseProp = '', creatureTargets, resourceCost = '', onClose }) {
    const effectivePoolMax = resolveEffectivePoolMax(isDicePool, poolMaxProp, playerStats.level);
    const effectiveResourceKey = resolveHealingPoolResourceKey(resourceKeyProp, isDicePool, featureName);

    const { current: poolRemaining, max: poolMaxFromHook, update: setPoolRemaining } = useTrackedResource({
        storageKey: effectiveResourceKey,
        playerName: playerStats.name,
        maxGetter: () => effectivePoolMax,
        deps: [playerStats, isDicePool ? poolMaxProp : playerStats.level],
        campaignName,
        playerStats
    });
    const [healAmount, setHealAmount] = React.useState(1);
    const [log, setLog] = React.useState([]);
    const [selectedConditions, setSelectedConditions] = React.useState([]);
    const [combatSummary, setCombatSummary] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [accumulatedTotal, setAccumulatedTotal] = React.useState(0);
    const [rolledFaces, setRolledFaces] = React.useState([]);
    const [selectedTargetName, setSelectedTargetName] = React.useState(null);
    const [showTargetSelection, setShowTargetSelection] = React.useState(!!(creatureTargets && creatureTargets.length > 1));

    const effectiveMaxDicePerUse = resolveMaxDicePerUse(maxDicePerUseProp, playerStats);

    const safePool = Number(poolRemaining) || 0;
    const safeMax = Number(poolMaxFromHook) || 0;

    const channelDivinityConsumedRef = React.useRef(false);

    const consumeChannelDivinity = () => {
        if (resourceCost !== 'channel_divinity' || channelDivinityConsumedRef.current) return;
        channelDivinityConsumedRef.current = true;

        const { currentCharges, maxCharges } = resolveChannelDivinityCharges(playerStats);
        if (currentCharges <= 0) {
            console.error(`[HealingPoolModal] ${playerStats.name} has no Channel Divinity charges to expend for ${featureName}.`);
            return;
        }

        const newCharges = currentCharges - 1;
        setRuntimeValue(playerStats.name, 'channelDivinityCharges', newCharges, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: featureName,
            description: `${playerStats.name} expended 1 Channel Divinity to use ${featureName} (${newCharges}/${maxCharges} remaining).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[HealingPoolModal] Channel Divinity log error:", e); });
    };

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
    const targetCurrentHp = resolveTargetCurrentHp(combatSummary, resolvedTargetName, playerStats);

    const isTargetBloodied = targetCurrentHp > 0 && targetCurrentHp <= Math.floor(targetMaxHp / 2);

    // Dice-lane honesty: how much of the pending rolls can actually restore HP
    // (null = HP truth unknown, gate stays open). The "N HP to restore" copy is
    // clamped so it can never promise restoration the commit cannot deliver.
    const healCapacity = resolveHealCapacity(targetMaxHp, targetCurrentHp, accumulatedTotal);
    const noHealCapacity = healCapacity === 0;
    const restorableTotal = resolveRestorableTotal(targetMaxHp, targetCurrentHp, accumulatedTotal);

    const getTargetConditions = React.useCallback(() => {
        const runtimeConditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];

        if (combatSummary) {
            try {
                const creature = combatSummary.creatures?.find(c => utils.getName(c.name) === utils.getName(resolvedTargetName));
                if (creature && Array.isArray(creature.conditions)) {
                    return mergeConditionKeys(runtimeConditions, creature.conditions);
                }
            } catch { /* ignore */ }
        }

        return runtimeConditions;
    }, [resolvedTargetName, combatSummary]);

    const targetConditions = getTargetConditions();
    const curableEntries = buildCurableEntries(alsoCures, restoringTouchConditions, targetConditions);

    const hasRestoringTouch = hasRestoringTouchRow(restoringTouchConditions);

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
        consumeChannelDivinity();
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
            // Same commit-time re-read as the dice lane: never let a stale snapshot
            // overwrite an HP value another writer already raised.
            const stored = getRuntimeValue(resolvedTargetName, 'currentHitPoints');
            const freshCurrentHp = stored != null && stored !== '' ? Number(stored) : targetCurrentHp;
            const newHp = Math.min(playerStats.hitPoints, freshCurrentHp + amount);
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
        if (noHealCapacity) return;

        consumeChannelDivinity();
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

        let newPool = safePool;

        const targetCreature = combatSummary?.creatures?.find(c => c.name === resolvedTargetName);
        const targetMax = targetCreature ? (targetCreature.type === 'player' ? (getRuntimeValue(targetCreature.name, 'hitPoints') ?? 0) : targetCreature.maxHp) : playerStats.hitPoints;
        // Integrity: re-read the target's CURRENT HP at commit time — the modal can
        // dwell open across external bucket writes, and committing from the render
        // closure turned a "heal" into silent HP LOSS (stale 100 + rolls overwrote a
        // bucket another tab had already filled to max).
        const freshCurrentHp = resolveTargetCurrentHp(combatSummary, resolvedTargetName, playerStats);
        const newHp = Math.min(targetMax, freshCurrentHp + accumulatedTotal);
        const actualHeal = resolveDiceActualHeal(targetMax, freshCurrentHp, newHp, accumulatedTotal);
        // Ledger honesty mirroring the amount lane's `result.actualHeal` and the monk
        // lane's "Already at full HP … No use spent." refusal: only the HP that really
        // restores is written and logged, and dice that can restore nothing (target
        // filled by another tab after the rolls) are returned to the pool.
        if (actualHeal > 0) {
            setRuntimeValue(resolvedTargetName, 'currentHitPoints', newHp, campaignName);
        } else {
            newPool = safePool + rolledFaces.length;
            setPoolRemaining(newPool);
        }
        addEntry(campaignName, {
            type: 'healing_pool',
            sourceName: playerStats.name,
            featureName,
            targetName: resolvedTargetName,
            amount: actualHeal,
            diceUsed: rolledFaces.length,
            dieType: dieType,
            rolls: rolledFaces,
            poolAfter: newPool,
        }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });
        setLog(prev => [...prev, {
            action: `Roll ${rolledFaces.length}d${dieType}`,
            target: resolvedTargetName,
            amount: actualHeal,
            poolAfter: newPool,
            rolls: rolledFaces.join(' + ')
        }]);
        setAccumulatedTotal(0);
        setRolledFaces([]);
    }, [accumulatedTotal, safePool, rolledFaces, playerStats, campaignName, featureName, dieType, resolvedTargetName, combatSummary, setPoolRemaining]);

    const handleClose = () => {
        if (isDicePool && accumulatedTotal > 0) {
            applyAccumulatedHealing();
        }
        onClose();
    };

    const applyCure = (condition) => {
        if (safePool < cureCost) return;
        consumeChannelDivinity();
        const newPool = safePool - cureCost;
        setPoolRemaining(newPool);

        const conditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];
        const filtered = conditions.filter(c => !conditionMatches(c, condition));
        setRuntimeValue(resolvedTargetName, 'activeConditions', filtered, campaignName);

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
        consumeChannelDivinity();
        const newPool = safePool - totalCost;
        setPoolRemaining(newPool);

        // Display-layer running pool: each modal log row shows the pool after
        // ITS OWN cost (mirroring the amount lane's per-commit poolAfter), while
        // the store write stays the single full-batch setPoolRemaining above.
        // Computed per-index — the setLog functional updaters run deferred at
        // re-render, so a mutable captured counter would read its final value
        // in every row (witnessed live: React's eager-state path only fires for
        // the first updater, leaving the rest stale).
        selectedConditions.forEach((condition, index) => {
            const conditions = getRuntimeValue(resolvedTargetName, 'activeConditions') || [];
            const filtered = conditions.filter(c => !conditionMatches(c, condition));
            setRuntimeValue(resolvedTargetName, 'activeConditions', filtered, campaignName);

            addEntry(campaignName, {
                type: 'condition',
                characterName: resolvedTargetName,
                condition: condition,
                action: 'broken',
                sourceName: playerStats.name,
                featureName,
                timestamp: Date.now(),
            }).catch((e) => { console.error("[HealingPoolModal] Error:", e); });

            const poolAfter = safePool - cureCost * (index + 1);
            setLog(prev => [...prev, { action: `Cure ${condition}`, target: resolvedTargetName, amount: cureCost, poolAfter }]);
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

    if (showTargetSelection) {
        return (
            <div className="short-rest-overlay no-print">
                <div
                    className="short-rest-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="healing-pool-target-modal-title"
                >
                    <SecondaryTargetModal
                        title={`Choose target for ${featureName}`}
                        titleId="healing-pool-target-modal-title"
                        targets={creatureTargets}
                        onTargetSelected={handleTargetSelected}
                        onSkip={handleTargetSkip}
                        featureDescription={`Choose a creature within range to heal with ${featureName}.`}
                        confirmLabel="Heal"
                        confirmIcon="fa-hand-holding-heart"
                        showHp={true}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="short-rest-overlay no-print">
            <HealingPoolMain
                loading={loading}
                safePool={safePool}
                safeMax={safeMax}
                isDicePool={isDicePool}
                dieType={dieType}
                resolvedTargetName={resolvedTargetName}
                targetCurrentHp={targetCurrentHp}
                targetMaxHp={targetMaxHp}
                bloodiedOnly={bloodiedOnly}
                isTargetBloodied={isTargetBloodied}
                healAmount={healAmount}
                setHealAmount={setHealAmount}
                applyHeal={applyHeal}
                effectiveMaxDicePerUse={effectiveMaxDicePerUse}
                rolledFaces={rolledFaces}
                restorableTotal={restorableTotal}
                noHealCapacity={noHealCapacity}
                applyDiceHeal={applyDiceHeal}
                hasRestoringTouch={hasRestoringTouch}
                curableEntries={curableEntries}
                selectedConditions={selectedConditions}
                toggleCondition={toggleCondition}
                applyBatchCure={applyBatchCure}
                applyCure={applyCure}
                batchTotalCost={batchTotalCost}
                cureCost={cureCost}
                alsoCures={alsoCures}
                log={log}
                handleClose={handleClose}
                featureName={featureName}
            />
        </div>
    );
}

export default HealingPoolModal
