import { useState } from 'react';
import { applyRiderOption } from '../../services/automation/handlers/attackRiderHandler.js';
import './CharSheet.css';

function AttackRiderModal({ action, playerStats, campaignName, targetName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const options = action.automation?.options || [];

    const handleApply = async () => {
        if (!selected) return;
        const res = await applyRiderOption(action, playerStats, campaignName, targetName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-bolt"></i> {action.name}
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
                    <i className="fa-solid fa-bolt"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose an effect{targetName ? ` against <b>${targetName}</b>` : ''}:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const effects = [];
                            if (opt.effect === 'disadvantage_on_next_save') effects.push('Disadvantage on next save');
                            if (opt.noOpportunityAttacks) effects.push('Cannot make Opportunity Attacks');
                            if (opt.effect === 'next_attack_advantage') effects.push(`+${opt.value || '5'} to next attack`);
                            if (opt.effect === 'push_15ft') effects.push('Push 15 ft');
                            if (opt.effect === 'speed_reduction') effects.push('Speed reduced by 15 ft');
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: selected === opt.name ? 'rgba(255,255,255,0.15)' : 'transparent', border: selected === opt.name ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="riderOption"
                                        checked={selected === opt.name}
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
                        <i className="fa-solid fa-bolt"></i> Apply Effect
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default AttackRiderModal;
