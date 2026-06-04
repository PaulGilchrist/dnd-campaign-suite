
import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js'
import useTrackedResource from '../../hooks/useTrackedResource.js'
import storage from '../../services/storage.js'
import { getTargetFromAttacker, getCombatContext } from '../../services/damageUtils.js'
import { applyHealingToTarget } from '../../services/applyHealing.js'
import { CONDITIONS } from '../../services/conditionUtils.js'
import utils from '../../services/utils.js'
import './CharSheet.css'

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

function HealingPoolModal({ playerStats, campaignName, alsoCures, cureCost, restoringTouchConditions, onClose }) {
    const layOnHandsPoolMax = 5 * (playerStats.level || 1);

    const { current: poolRemaining, max: poolMaxFromHook, update: setPoolRemaining } = useTrackedResource(
         'layOnHandsPool',
        playerStats.name,
          () => layOnHandsPoolMax,
          [playerStats],
        campaignName
       );
    const [healAmount, setHealAmount] = React.useState(1);
    const [log, setLog] = React.useState([]);
    const [selectedConditions, setSelectedConditions] = React.useState([]);
    const [combatSummary, setCombatSummary] = React.useState(null);

    const safePool = Number(poolRemaining) || 0;
    const safeMax = Number(poolMaxFromHook) || 0;

    React.useEffect(() => {
        getCombatContext(campaignName).then(cs => {
            if (cs) setCombatSummary(cs);
        });
    }, [campaignName]);
    const target = combatSummary ? getTargetFromAttacker(combatSummary, playerStats.name) : null;
    const targetName = target ? target.name : playerStats.name;
    const targetMaxHp = target ? target.maxHp : playerStats.hitPoints;
    const targetCurrentHp = (() => {
          if (target) {
            const stored = getRuntimeValue(target.name, 'currentHitPoints');
            if (stored != null && stored !== '') return Number(stored);
            if (target.type === 'npc') return target.currentHp;
            return targetMaxHp;
          }
          const stored = getRuntimeValue(playerStats.name, 'currentHitPoints');
          return stored != null && stored !== '' ? Number(stored) : playerStats.hitPoints;
        })();

    const getTargetConditions = React.useCallback(() => {
        const runtimeConditions = getRuntimeValue(targetName, 'activeConditions') || [];

        if (combatSummary) {
            try {
                if (combatSummary) {
                    const creature = combatSummary.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
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
    }, [targetName, combatSummary]);

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

        if (target && combatSummary) {
            const result = applyHealingToTarget(combatSummary, target.name, amount, campaignName);
            if (result) {
                setLog(prev => [...prev, { action: 'Heal', target: target.name, amount: result.actualHeal, poolAfter: newPool }]);
                setHealAmount(Math.min(healAmount, newPool));
            }
        } else {
            const newHp = Math.min(playerStats.hitPoints, targetCurrentHp + amount);
            setRuntimeValue(playerStats.name, 'currentHitPoints', newHp, campaignName);
            fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'hp_change',
                    targetName: playerStats.name,
                    delta: amount,
                    currentHp: newHp,
                    maxHp: playerStats.hitPoints,
                    isHealing: true,
                    isUnconscious: false,
                })
            }).catch(() => {});
            setLog(prev => [...prev, { action: 'Heal', target: playerStats.name, amount, poolAfter: newPool }]);
            setHealAmount(Math.min(healAmount, newPool));
        }
    };

    const applyCure = (condition) => {
        if (safePool < cureCost) return;
        const newPool = safePool - cureCost;
        setPoolRemaining(newPool);

        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
        const filtered = conditions.filter(c => !conditionMatches(c, condition));
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

        if (combatSummary && target && target.type === 'npc') {
            const creature = combatSummary.creatures?.find(c => c.name === targetName);
            if (creature && Array.isArray(creature.conditions)) {
                creature.conditions = creature.conditions.filter(c => !conditionMatches(c.key, condition));
                storage.set('combatSummary', combatSummary, campaignName);
                window.dispatchEvent(new CustomEvent('combat-summary-updated'));
            }
        }

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                characterName: targetName,
                condition: condition,
                action: 'broken',
                sourceName: playerStats.name,
                timestamp: Date.now(),
              })
          }).catch(() => {});

        setLog(prev => [...prev, { action: `Cure ${condition}`, target: targetName, amount: cureCost, poolAfter: newPool }]);
        setHealAmount(Math.min(healAmount, newPool));
     };

    const applyBatchCure = () => {
        if (selectedConditions.length === 0) return;
        const totalCost = selectedConditions.length * cureCost;
        if (safePool < totalCost) return;
        const newPool = safePool - totalCost;
        setPoolRemaining(newPool);

        selectedConditions.forEach((condition) => {
            const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
            const filtered = conditions.filter(c => !conditionMatches(c, condition));
            setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

            if (combatSummary && target && target.type === 'npc') {
                const creature = combatSummary.creatures?.find(c => c.name === targetName);
                if (creature && Array.isArray(creature.conditions)) {
                    creature.conditions = creature.conditions.filter(c => !conditionMatches(c.key, condition));
                    storage.set('combatSummary', combatSummary, campaignName);
                    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                }
            }

            fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'condition',
                    characterName: targetName,
                    condition: condition,
                    action: 'broken',
                    sourceName: playerStats.name,
                    timestamp: Date.now(),
                })
            }).catch(() => {});

            setLog(prev => [...prev, { action: `Cure ${condition}`, target: targetName, amount: cureCost, poolAfter: newPool }]);
        });

        setSelectedConditions([]);
    };

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const batchTotalCost = selectedConditions.length * cureCost;

    return (
        <div className="short-rest-overlay no-print" onClick={onClose}>
            <div className="short-rest-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fas fa-hands-helping"></i> Lay On Hands</h3>

                <div className="short-rest-section">
                    <p>Pool: <b>{safePool}</b> / {safeMax} HP</p>
                </div>

                <div className="short-rest-section">
                    <h4>Heal — {targetName} ({targetCurrentHp} / {targetMaxHp} HP)</h4>
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
                        <button className="char-btn" onClick={applyHeal} disabled={safePool <= 0 || healAmount <= 0}>
                            <i className="fas fa-heart"></i> Apply Heal
                        </button>
                    </div>
                </div>

                {hasRestoringTouch && curableEntries.length > 0 && (
                    <div className="short-rest-section">
                        <h4>Cure Conditions ({cureCost} HP each)</h4>
                        <p>Select conditions affecting {targetName} to cure:</p>
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
                    <button className="char-btn" onClick={onClose}>
                        <i className="fa-solid fa-check"></i> Done
                    </button>
                </div>
            </div>
        </div>
    );
}

export default HealingPoolModal
