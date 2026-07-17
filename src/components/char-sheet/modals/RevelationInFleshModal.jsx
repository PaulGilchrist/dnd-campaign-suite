import { useState } from 'react';
import { applyRevelationOptions } from '../../../services/automation/handlers/class-warlock/revelationInFleshHandler.js';
import { addEntry } from '../../../services/ui/logService.js';
import '../CharSheet.css';

function RevelationInFleshModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState([]);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const options = action.automation?.options || [];

    const toggleOption = (optionName) => {
        setSelected(prev =>
            prev.includes(optionName)
                ? prev.filter(n => n !== optionName)
                : [...prev, optionName]
        );
    };

    const handleApply = async () => {
        if (selected.length === 0) return;
        const res = await applyRevelationOptions(action, playerStats, campaignName, selected);
        if (res?.logEntries) {
            for (const entry of res.logEntries) {
                await addEntry(campaignName, entry).catch(() => {});
            }
        }
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dna"></i> {action.name}
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
                    <i className="fa-solid fa-dna"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose bodily alterations (costs 1 Sorcery Point each):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {options.map((opt, i) => {
                            const isSelected = selected.includes(opt.name);
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleOption(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{opt.name}</strong>
                                    {opt.description && <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {opt.description}</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={selected.length === 0}>
                        <i className="fa-solid fa-dna"></i> Activate {action.name}
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default RevelationInFleshModal;
