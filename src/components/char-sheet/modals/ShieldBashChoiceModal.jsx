import { useState } from 'react';
import { applyShieldBashEffect } from '../../../services/combat/steps/features/shieldBash.js';
import '../CharSheet.css';

function ShieldBashChoiceModal({ action, playerStats, campaignName, targetName, saveDc, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleApply = async () => {
        if (!selected) return;

        try {
            const res = await applyShieldBashEffect({ action, playerStats, campaignName, targetName, chosenOption: selected, saveDc });
            setResult(res);
            setApplied(true);
        } catch (e) {
            console.error('Shield Bash failed', e);
            setError(`Failed to apply Shield Bash: ${e.message}`);
        }
    };

    if (applied && result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-shield-halved"></i> Shield Bash
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
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> Shield Bash
                </div>
                <div className="sp-body">
                    {error && <p>{error}</p>}
                    <p>Choose an effect for <b>{targetName}</b> on failed STR save (DC {saveDc}):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {[
                            { name: 'Push', effect: 'Push target 5 feet away from you' },
                            { name: 'Prone', effect: 'Target gains Prone condition' },
                        ].map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="shieldBashOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{opt.name}</strong>
                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {opt.effect}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-shield-halved"></i> Apply Effect
                    </button>
                    <button className="sp-dismiss-btn" onClick={() => { applyShieldBashEffect({ action, playerStats, campaignName, targetName, chosenOption: 'skip', saveDc }).catch((e) => console.error('Shield Bash skip failed', e)); onClose(); }}>Skip (do not consume use)</button>
                </div>
            </div>
        </div>
    );
}

export default ShieldBashChoiceModal;
