import { useState } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { logHealingToSSE } from '../../../../services/automation/common/healingRoll.js';
import '../../CharSheet.css';

// Runtime store returns null for unset keys (useRuntimeState.js). Unresolved HP
// means the target state is unknown — parse to null and refuse, never fabricate 0
// (no-fallbacks convention: Math.min(0, currentHp + heal) wrote 0, killing targets).
function parseHp(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function HealingIllusionModal({ action, playerStats, campaignName, onClose }) {
    const [targetName, setTargetName] = useState(playerStats.name);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [customName, setCustomName] = useState('');

    const healAmount = playerStats.level || 1;

    const handleHeal = async () => {
        const name = targetName === 'custom' ? customName.trim() : targetName;
        if (!name) return;
        const storedCurrent = getRuntimeValue(name, 'currentHitPoints', campaignName);
        const storedMax = name === playerStats.name
            ? playerStats.hitPoints
            : getRuntimeValue(name, 'hitPoints', campaignName);
        const currentHp = parseHp(storedCurrent);
        const maxHp = parseHp(storedMax);
        if (currentHp == null || maxHp == null) {
            console.error(
                `[HealingIllusionModal] Refusing heal for ${name}: unresolved runtime HP values ` +
                `(currentHitPoints=${JSON.stringify(storedCurrent)}, maxHp=${JSON.stringify(storedMax)}). No write performed.`
            );
            return;
        }
        // Canonical heal clamp (applyHealingDirectly, healingRoll.js:58)
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
            <div className="sp-overlay">
                <div className="sp-modal">
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
        <div className="sp-overlay">
            <div className="sp-modal">
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
