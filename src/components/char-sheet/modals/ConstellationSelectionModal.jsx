import { useState, useEffect } from 'react';
import { applyConstellationOption } from '../../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import '../CharSheet.css';

function ConstellationSelectionModal({ action, playerStats, campaignName, isTwinkled, onConfirm, onClose, applyOption = applyConstellationOption }) {
    const [selected, setSelected] = useState(null);
    const [result, setResult] = useState(null);

    const options = ['Archer', 'Chalice', 'Dragon'];

    useEffect(() => {
        const stored = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const starryBuff = activeBuffs.find(b => b.name === action.name && b.constellation);
        if (starryBuff) {
            setSelected(starryBuff.constellation);
        }
    }, [playerStats.name, campaignName, action.name]);

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyOption(action, playerStats, campaignName, selected);
        setResult(res);
        onConfirm(selected);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={(e) => {
        if (e.target.closest('.sp-modal')) return;
        onClose?.();
    }}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-star"></i> {action.name}
                    </div>
                    <div className="sp-body" dangerouslySetInnerHTML={{ __html: result.payload.description }}>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={onClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={(e) => {
        if (e.target.closest('.sp-modal')) return;
        onClose?.();
    }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-star"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose a constellation:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt) => {
                            const effects = [];
                            if (opt === 'Archer') {
                                const dice = isTwinkled ? '2d8' : '1d8';
                                effects.push(`Ranged Spell Attack: ${dice} + Wisdom Modifier Radiant damage`);
                            } else if (opt === 'Chalice') {
                                const dice = isTwinkled ? '2d8' : '1d8';
                                effects.push(`Healing Spell: ${dice} + Wisdom Modifier HP to ally within 30 feet`);
                            } else if (opt === 'Dragon') {
                                effects.push('Concentration: Treat d20 rolls of 9 or lower as 10');
                                if (isTwinkled) {
                                    effects.push('Fly Speed 20 feet (hover)');
                                }
                            }
                            const isSelected = selected === opt;
                            return (
                                <button
                                    key={opt}
                                    className="sp-roll-btn"
                                    style={{
                                        margin: '0 6px 8px 6px',
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                                        border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                        borderRadius: '6px',
                                    }}
                                    onClick={() => setSelected(opt)}
                                >
                                    <b>{opt}</b><br/>
                                    <span style={{ fontSize: '0.85em', opacity: 0.8 }}>{effects.join('. ')}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                    <button className="sp-roll-btn" disabled={!selected} onClick={handleApply}>Choose</button>
                </div>
            </div>
        </div>
    );
}

export default ConstellationSelectionModal;
