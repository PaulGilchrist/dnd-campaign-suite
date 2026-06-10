import { useState } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { logHealingToSSE } from '../../services/automation/common/healingRoll.js';
import './CharSheet.css';

function HealingIllusionModal({ action, playerStats, campaignName, onClose }) {
    const [targetName, setTargetName] = useState(playerStats.name);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [customName, setCustomName] = useState('');

    const healAmount = playerStats.level || 1;

    const handleHeal = async () => {
        const name = targetName === 'custom' ? customName.trim() : targetName;
        if (!name) return;
        const currentHp = Number(getRuntimeValue(name, 'currentHitPoints', campaignName)) || 0;
        const maxHp = name === playerStats.name
            ? playerStats.hitPoints
            : (Number(getRuntimeValue(name, 'hitPoints', campaignName)) || 0);
        const newHp = Math.min(maxHp, currentHp + healAmount);
        await setRuntimeValue(name, 'currentHitPoints', newHp, campaignName);
        logHealingToSSE(campaignName, {
            targetName: name,
            sourceName: action.name,
            actualHeal: newHp - currentHp,
            newHp,
            maxHp,
        });
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        setResult(`Healing Illusion restored ${newHp - currentHp} HP to ${name} (Cleric level ${healAmount})`);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-heart"></i> Healing Illusion
                    </div>
                    <div className="sp-body">
                        <p>{result}</p>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-heart"></i> Healing Illusion
                </div>
                <div className="sp-body">
                    <p>The illusion has ended. Choose a target within 5 feet to regain {healAmount} HP:</p>
                    <div>
                        <label>
                            <input
                                type="radio"
                                name="healTarget"
                                value={playerStats.name}
                                checked={targetName === playerStats.name}
                                onChange={() => setTargetName(playerStats.name)}
                            />
                            {' '}{playerStats.name} (self)
                        </label>
                        <br />
                        <label>
                            <input
                                type="radio"
                                name="healTarget"
                                value="custom"
                                checked={targetName === 'custom'}
                                onChange={() => setTargetName('custom')}
                            />
                            {' '}Other:{' '}
                            <input
                                type="text"
                                value={customName}
                                onChange={e => { setCustomName(e.target.value); setTargetName('custom'); }}
                                placeholder="creature name"
                                disabled={targetName !== 'custom'}
                            />
                        </label>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleHeal}>
                        <i className="fa-solid fa-heart"></i> Heal
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default HealingIllusionModal;
