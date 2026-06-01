
import React from 'react'
import storage from '../../services/storage.js'
import useTrackedResource from '../../hooks/useTrackedResource.js'
import './CharSheet.css'

function HealingPoolModal({ playerStats, campaignName, poolMax, resourceKey, alsoCures, cureCost, onClose }) {
    const { current: poolRemaining, update: setPoolRemaining } = useTrackedResource(
        resourceKey,
        playerStats.name,
        () => poolMax,
        [playerStats],
        campaignName
    );
    const [healAmount, setHealAmount] = React.useState(1);
    const [log, setLog] = React.useState([]);

    const currentHp = storage.getProperty(playerStats.name, 'currentHitPoints', campaignName);
    const effectiveCurrentHp = currentHp != null && currentHp !== '' ? Number(currentHp) : playerStats.hitPoints;

    const applyHeal = () => {
        const amount = Math.min(healAmount, poolRemaining);
        if (amount <= 0) return;
        const newPool = poolRemaining - amount;
        setPoolRemaining(newPool);
        const newHp = Math.min(playerStats.hitPoints, effectiveCurrentHp + amount);
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
                isUnconscious: newHp <= 0,
            })
        }).catch(() => {});
        setLog(prev => [...prev, { action: 'Heal', amount, poolAfter: newPool }]);
    };

    const applyCure = (condition) => {
        if (poolRemaining < cureCost) return;
        const newPool = poolRemaining - cureCost;
        setPoolRemaining(newPool);
        setLog(prev => [...prev, { action: `Cure ${condition}`, amount: cureCost, poolAfter: newPool }]);
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
                    <p>Pool: <b>{poolRemaining}</b> / {poolMax} HP</p>
                    <p>Current HP: <b>{effectiveCurrentHp}</b> / {playerStats.hitPoints}</p>
                </div>

                <div className="short-rest-section">
                    <h4>Heal</h4>
                    <div className="short-rest-dice-row">
                        <label>
                            Amount:
                            <input
                                type="number"
                                min="1"
                                max={poolRemaining}
                                value={healAmount}
                                onChange={(e) => setHealAmount(Math.max(1, Math.min(poolRemaining, Number(e.target.value) || 1)))}
                                style={{ width: '62px', marginLeft: '6px' }}
                            />
                        </label>
                        <button className="char-btn" onClick={applyHeal} disabled={poolRemaining <= 0 || healAmount <= 0}>
                            <i className="fas fa-heart"></i> Apply Heal
                        </button>
                    </div>
                </div>

                {alsoCures && alsoCures.length > 0 && (
                    <div className="short-rest-section">
                        <h4>Cure Conditions ({cureCost} HP each)</h4>
                        <div className="short-rest-dice-row">
                            {alsoCures.map((condition) => (
                                <button key={condition} className="char-btn" onClick={() => applyCure(condition)} disabled={poolRemaining < cureCost}>
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
                                    <tr><th>Action</th><th>Cost</th><th>Pool After</th></tr>
                                </thead>
                                <tbody>
                                    {log.map((entry, i) => (
                                        <tr key={i}>
                                            <td>{entry.action}</td>
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
