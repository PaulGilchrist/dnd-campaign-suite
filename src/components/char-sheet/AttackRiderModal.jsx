import { useState } from 'react';
import { applyRiderOption } from '../../services/automation/handlers/attackRiderHandler.js';
import './CharSheet.css';

function AttackRiderModal({ action, playerStats, campaignName, targetName, onClose }) {
    const [selected, setSelected] = useState(null);
    const [selectedMulti, setSelectedMulti] = useState([]);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const options = action.automation?.options || [];
    const maxEffects = action.automation?.maxEffects || 1;
    const multiSelect = maxEffects > 1;

    const handleApply = async () => {
        if (multiSelect) {
            if (selectedMulti.length === 0) return;
            const res = await applyRiderOption(action, playerStats, campaignName, targetName, selectedMulti);
            setResult(res);
            setApplied(true);
        } else {
            if (!selected) return;
            const res = await applyRiderOption(action, playerStats, campaignName, targetName, selected ? [selected] : []);
            setResult(res);
            setApplied(true);
        }
    };

    const toggleMultiSelect = (optName) => {
        setSelectedMulti(prev => {
            if (prev.includes(optName)) return prev.filter(n => n !== optName);
            if (prev.length >= maxEffects) return prev;
            return [...prev, optName];
        });
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

    const labelText = multiSelect
        ? `Choose up to ${maxEffects} effect${maxEffects > 1 ? 's' : ''}${targetName ? ` against <b>${targetName}</b>` : ''}:`
        : `Choose an effect${targetName ? ` against <b>${targetName}</b>` : ''}:`;

    const canApply = multiSelect ? selectedMulti.length > 0 : !!selected;

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-bolt"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p dangerouslySetInnerHTML={{ __html: labelText }}></p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const effects = [];
                            if (opt.effect === 'disadvantage_on_next_save') effects.push('Disadvantage on next save');
                            if (opt.noOpportunityAttacks) effects.push('Cannot make Opportunity Attacks');
                            if (opt.effect === 'next_attack_advantage') effects.push(`+${opt.value || '5'} to next attack`);
                            if (opt.effect === 'push_15ft') effects.push('Push 15 ft');
                            if (opt.effect === 'speed_reduction') effects.push('Speed reduced by 15 ft');
                            const isSelected = multiSelect ? selectedMulti.includes(opt.name) : selected === opt.name;
                            const inputType = multiSelect ? 'checkbox' : 'radio';
                            const inputChecked = isSelected;
                            const handleChange = multiSelect
                                ? () => toggleMultiSelect(opt.name)
                                : () => setSelected(opt.name);
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type={inputType}
                                        name={multiSelect ? `riderOption_${i}` : 'riderOption'}
                                        checked={inputChecked}
                                        onChange={handleChange}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{opt.name}</strong>
                                    {effects.length > 0 && <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {effects.join(', ')}</span>}
                                </label>
                            );
                        })}
                    </div>
                    {multiSelect && (
                        <p style={{ opacity: 0.7, fontSize: '0.85em', marginTop: '8px' }}>
                            {selectedMulti.length}/{maxEffects} selected
                        </p>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!canApply}>
                        <i className="fa-solid fa-bolt"></i> Apply Effect{multiSelect ? 's' : ''}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default AttackRiderModal;
