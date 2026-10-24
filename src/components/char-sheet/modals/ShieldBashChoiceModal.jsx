import { useState } from 'react';
import { applyShieldBashEffect } from '../../../services/combat/steps/features/shieldBash.js';
import '../CharSheet.css';
import './ShieldBashChoiceModal.css';

function ShieldBashChoiceModal({ action, playerStats, campaignName, targetName, saveDc, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // RAW default distance is 5 feet (public/data/2024/feats.json:2633/:2646,
    // Shield Bash: "push the target 5 feet from you or cause it to have the
    // Prone condition (your choice)"). Choice copy derives from caller
    // action.options when present (every current caller passes value: 5 —
    // shieldBash.js:158); 5 feet is the rules-defined fallback. `action` is
    // still forwarded verbatim to apply/skip lanes below (:15/:76-era).
    const RAW_PUSH_FEET = 5;
    const choiceOptions = (action?.options?.length ? action.options : [{ name: 'Push' }, { name: 'Prone' }])
        .map((opt) => ({
            name: opt.name,
            effect: opt.name === 'Push'
                ? `Push target ${typeof opt.value === 'number' ? opt.value : RAW_PUSH_FEET} feet away from you`
                : 'Target gains Prone condition',
        }));

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
                    <div className="shield-bash-options">
                        {choiceOptions.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} className={`shield-bash-option${isSelected ? ' selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="shieldBashOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        className="shield-bash-option-input"
                                    />
                                    <strong>{opt.name}</strong>
                                    <span className="shield-bash-option-effect">— {opt.effect}</span>
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
