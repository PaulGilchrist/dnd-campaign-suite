import { useState } from 'react';
import { applyConstellationOption } from '../../services/automation/handlers/starryFormHandler.js';
import './CharSheet.css';

function ConstellationSelectionModal({ action, playerStats, campaignName, isTwinkled, onConfirm, onClose }) {
    const [selected, setSelected] = useState(null);
    const [result, setResult] = useState(null);

    const options = ['Archer', 'Chalice', 'Dragon'];

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyConstellationOption(action, playerStats, campaignName, selected);
        setResult(res);
        onConfirm(selected);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
                            return (
                                <button
                                    key={opt}
                                    className="sp-roll-btn"
                                    style={{ margin: '0 6px 8px 6px', display: 'block', width: '100%', textAlign: 'left' }}
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
