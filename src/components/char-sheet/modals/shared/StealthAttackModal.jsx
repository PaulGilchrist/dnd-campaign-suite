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
            <div className="sp-overlay">
                <div className="sp-modal">
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

    // Sneak Attack dice faces are always d6 (RAW both rulesets): disk authors
    // class_specific.sneak_attack.dice_value: 6 for every Rogue level (5e) and omits
    // it in 2024, where the canonical accessors hardcode dice_value: 6
    // (classRules2024.js:269, classRules.js:103-105, contextBuilder-sync.js:539-541).
    // A previous read of a flattened sneak_attack_dice_value per-level key was removed
    // 2026-10-23: that key is authored nowhere in public/data or public/campaigns
    // (key census: 0 producers), so it always fell through to 6 — a fantasy-key read.
    // The real dice count arrives via the availableDice prop (stealthAttackHandler.js:9,:32).

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-eye-slash"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Activate Stealth Attack? This will cost <b>{costD6}d6</b> of your Sneak Attack dice ({availableDice}d6 available). Your Invisible condition will be preserved when you end your turn behind Three-Quarters Cover or Total Cover.</p>
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
