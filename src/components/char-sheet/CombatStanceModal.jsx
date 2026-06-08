import { useState } from 'react';
import { applyStanceOption } from '../../services/automation/handlers/combatStanceHandler.js';
import './CharSheet.css';

function CombatStanceModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const options = action.automation?.options || [];

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyStanceOption(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-paw"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose a primal aspect of your Rage:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const effects = [];
                            if (opt.name === 'Bear') effects.push('Resistance to all damage except Force, Necrotic, Psychic, Radiant');
                            if (opt.name === 'Eagle') effects.push('Disengage and Dash as part of the bonus action; repeatable each turn while raging');
                            if (opt.name === 'Wolf') effects.push('Allies have Advantage on attack rolls against enemies within 5 ft of you');
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
                        <i className="fa-solid fa-paw"></i> Activate Rage
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default CombatStanceModal;
