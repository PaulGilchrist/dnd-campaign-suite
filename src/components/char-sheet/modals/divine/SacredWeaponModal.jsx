import { useState } from 'react';
import { applyDamageTypeChoice } from '../../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js';
import '../../CharSheet.css';
import './SacredWeaponModal.css';

function SacredWeaponModal({ action, playerStats, campaignName, onClose, onCancel }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const options = action.automation?.options || [];

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyDamageTypeChoice(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            onClose?.();
        }
    };

    if (applied && result) {
        return (
            <div className="sp-overlay">
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-sun"></i> {action.name}
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
                    <i className="fa-solid fa-sun"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose the damage type for Sacred Weapon:</p>
                    <div className="sacred-weapon-options">
                        {options.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} className={`sacred-weapon-option${isSelected ? ' selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="sacredWeaponOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                    />
                                    <strong>{opt.name}</strong>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-sun"></i> Activate Sacred Weapon
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleCancel}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default SacredWeaponModal;
