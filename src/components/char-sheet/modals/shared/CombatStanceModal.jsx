import { useState } from 'react';
import { applyStanceOption } from '../../../../services/automation/handlers/combat/combatStanceHandler.js';
import '../../CharSheet.css';

const STANCE_EFFECTS = {
    Bear: 'Resistance to all damage except Force, Necrotic, Psychic, Radiant',
    Eagle: 'Disengage and Dash as part of the bonus action; repeatable each turn while raging',
    Wolf: 'Allies have Advantage on attack rolls against enemies within 5 ft of you',
    Falcon: 'Fly Speed equal to your Speed while raging (no armor)',
    Lion: 'Enemies within 5 ft have Disadvantage on attacks against targets other than you',
    Ram: 'Melee hits cause Large or smaller creatures to have the Prone condition',
    Cold: 'Ice Walk: Walk across icy/water surfaces without checks; ignore ice/snow difficult terrain',
    Fire: (opt) => `Speed Boost: +${opt.speedBonus || 10} feet to Speed`,
    Lightning: 'Fly Speed equal to your Speed for 1 round',
    Thunder: (opt) => `Teleport up to ${opt.teleportDistance || '30 ft'} to an unoccupied space you can see`,
};

function stanceEffects(opt) {
    const effect = STANCE_EFFECTS[opt.name];
    if (!effect) return [];
    return [typeof effect === 'function' ? effect(opt) : effect];
}

function CombatStanceModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const options = action.automation?.options || [];

    const handleApply = async () => {
        if (!selected) return;
        try {
            const res = await applyStanceOption(action, playerStats, campaignName, selected);
            setResult(res);
            setApplied(true);
        } catch (e) {
            console.error(`${action.name} failed`, e);
            setError(`Failed to apply ${action.name}: ${e.message}`);
        }
    };

    if (applied && result?.payload?.description) {
        return (
            <div className="sp-overlay" onClick={(e) => {
                if (e.target.closest('.sp-modal')) return;
                onClose?.();
            }}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-paw"></i> {action.name}
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
                    <i className="fa-solid fa-paw"></i> {action.name}
                </div>
                <div className="sp-body">
                    {error && <p>{error}</p>}
                    <p>Choose {action.name === 'Rage' ? 'a primal aspect of your Rage' : 'an elemental movement type'}:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const effects = stanceEffects(opt);
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="stanceOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{opt.name}</strong>
                                    {effects.length > 0 && <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {effects.join(', ')}</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className={`fa-solid ${action.name === 'Rage' ? 'fa-paw' : 'fa-wind'}`}></i> {action.name === 'Rage' ? 'Activate Rage' : 'Activate ' + action.name}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default CombatStanceModal;
