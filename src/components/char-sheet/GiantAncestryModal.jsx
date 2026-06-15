import { useState } from 'react';
import { confirmGiantAncestry, getGiantAncestryOptions } from '../../services/automation/handlers/class-other/giantAncestryHandler.js';
import './CharSheet.css';

const GIANT_OPTIONS = getGiantAncestryOptions();

function GiantAncestryModal({ action: _action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const res = await confirmGiantAncestry(playerStats, selected, campaignName);
        if (res) {
            onClose();
        }
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-mountain"></i> Giant Ancestry
                </div>
                <div className="sp-body">
                    <p>Choose a giant ancestry benefit. You can use the chosen benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {GIANT_OPTIONS.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="giantAncestryOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong><i className={`fa-solid ${opt.icon}`}></i> {opt.name}</strong>
                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {opt.description}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-check"></i> Select Ancestry
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default GiantAncestryModal;
