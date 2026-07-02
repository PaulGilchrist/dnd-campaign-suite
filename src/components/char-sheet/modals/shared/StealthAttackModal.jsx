import { useState } from 'react';
import { applyStealthAttack } from '../../../../services/automation/handlers/class-fighter-rogue/stealthAttackHandler.js';
import '../../CharSheet.css';

function StealthAttackModal({ action, playerStats, campaignName, costD6, availableDice, onClose }) {
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = async () => {
        const res = await applyStealthAttack(action, playerStats, campaignName, costD6);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-eye-slash"></i> {action.name}
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

    const sneakAttackDiceValue = (playerStats.class?.class_levels?.[playerStats.level - 1]?.sneak_attack_dice_value || 6);

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-eye-slash"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Activate Stealth Attack? This will cost <b>{costD6}d6</b> of your Sneak Attack dice ({availableDice}d{sneakAttackDiceValue} available). Your Invisible condition will be preserved when you end your turn behind Three-Quarters Cover or Total Cover.</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply}>
                        <i className="fa-solid fa-eye-slash"></i> Activate Stealth Attack
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default StealthAttackModal;
