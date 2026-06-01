
import React from 'react'
import storage from '../../services/storage.js'
import useTrackedResource from '../../hooks/useTrackedResource.js'
import { getTargetFromAttacker, getCombatContext } from '../../services/damageUtils.js'
import { applyHealingToTarget } from '../../services/applyHealing.js'
import './CharSheet.css'

function HealingPoolModal({ playerStats, campaignName, poolMax, alsoCures, cureCost, onClose }) {
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

    const safePool = Number(poolRemaining) || 0;
    const safeMax = Number(poolMaxFromHook) || 0;

    const combatSummary = getCombatContext();
    const combatTarget = combatSummary ? getTargetFromAttacker(combatSummary, playerStats.name) : null;
    const targetName = combatTarget ? combatTarget.name : playerStats.name;
    const targetMaxHp = combatTarget ? combatTarget.maxHp : playerStats.hitPoints;
    const targetCurrentHp = (() => {
          if (combatTarget) {
            const stored = storage.getProperty(combatTarget.name, 'currentHitPoints', campaignName);
            if (stored != null && stored !== '') return Number(stored);
            return combatTarget.currentHp;
          }
          const stored = storage.getProperty(playerStats.name, 'currentHitPoints', campaignName);
          return stored != null && stored !== '' ? Number(stored) : playerStats.hitPoints;
        })();

    const applyHeal = () => {
        const amount = Math.min(healAmount, safePool);
        if (amount <= 0) return;
        const newPool = safePool - amount;
        setPoolRemaining(newPool);

        if (combatTarget && combatSummary) {
            const result = applyHealingToTarget(combatSummary, combatTarget.name, amount, campaignName);
            if (result) {
                setLog(prev => [...prev, { action: 'Heal', target: combatTarget.name, amount: result.actualHeal, poolAfter: newPool }]);
                setHealAmount(Math.min(healAmount, newPool));
            }
        } else {
            const newHp = Math.min(playerStats.hitPoints, targetCurrentHp + amount);
            storage.setProperty(playerStats.name, 'currentHitPoints', newHp, campaignName);
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
        setLog(prev => [...prev, { action: `Cure ${condition}`, target: targetName, amount: cureCost, poolAfter: newPool }]);
        setHealAmount(Math.min(healAmount, newPool));
    };

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

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

                {alsoCures && alsoCures.length > 0 && (
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
