import { useState } from 'react';
import { applyWeaponMasteryChoice } from '../../../services/automation/index.js';
import '../CharSheet.css';
import './WeaponMasteryChoiceModal.css';

function WeaponMasteryChoiceModal({ action: _action, playerStats, campaignName, masteryProperties, onClose, onConfirm }) {
    const [selected, setSelected] = useState(null);
    const [result, setResult] = useState(null);

    const handleSelect = async () => {
        if (!selected) return;
        const res = await applyWeaponMasteryChoice(selected, playerStats, campaignName);
        setResult(res);
        if (onConfirm) onConfirm(selected);
    };

    if (result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-crosshairs"></i> Weapon Master
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
                    <i className="fa-solid fa-crosshairs"></i> Weapon Master — Choose Mastery
                </div>
                <div className="sp-body">
                    <p>Choose a mastery property to activate with your weapon attacks:</p>
                    <div className="weapon-mastery-options">
                        {masteryProperties.map((m, i) => {
                            const isSelected = selected === m;
                            return (
                                // Static decoration is class-owned; the selected/unselected
                                // ternaries were enumerable state, so they ride the .selected
                                // modifier class (fix#328 shield-bash-option.selected precedent) —
                                // zero inline styles remain (pin pass #278).
                                <label key={i} className={`weapon-mastery-option${isSelected ? ' selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="weaponMasteryChoice"
                                        checked={isSelected}
                                        onChange={() => setSelected(m)}
                                        className="weapon-mastery-option-input"
                                    />
                                    <strong>{m}</strong>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleSelect} disabled={!selected}>
                        <i className="fa-solid fa-check"></i> Select
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default WeaponMasteryChoiceModal;
