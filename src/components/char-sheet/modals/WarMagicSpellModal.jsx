import { useState } from 'react';
import { confirmWarMagicSpell } from '../../../services/automation/handlers/class-fighter-rogue/warMagicSpellHandler.js';
import '../CharSheet.css';
import './WarMagicSpellModal.css';

function WarMagicSpellModal({ action, playerStats, campaignName, options, optionDetails, maxSpellLevel, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleConfirm = async () => {
        const res = await confirmWarMagicSpell(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-hat-wizard"></i> {action.name}
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
                    <i className="fa-solid fa-hat-wizard"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Replace one attack with a Wizard spell of level 1–{maxSpellLevel} (casting time: action):</p>
                    <div className="war-magic-spell-list">
                        {options.map(name => (
                            // Option row is a real <button>: the former plain div had no
                            // role (pin pass #271). Selection rides the .selected modifier
                            // class (fix#328 shield-bash-option.selected precedent; button-row
                            // house shape ObjectTransformModal .object-type-btn.selected).
                            <button
                                key={name}
                                type="button"
                                className={`war-magic-spell-option${selected === name ? ' selected' : ''}`}
                                onClick={() => setSelected(name)}
                            >
                                <strong>{name}</strong>
                                {optionDetails?.[name]?.level && (
                                    <span className="war-magic-spell-option-detail">Level {optionDetails?.[name]?.level}</span>
                                )}
                                {optionDetails?.[name]?.casting_time && (
                                    <span className="war-magic-spell-option-detail">({optionDetails?.[name]?.casting_time})</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn war-magic-spell-confirm"
                        disabled={!selected}
                        onClick={handleConfirm}
                    >
                        <i className="fa-solid fa-bolt"></i> Replace Attack
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default WarMagicSpellModal;
