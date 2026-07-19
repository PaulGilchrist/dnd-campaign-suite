import { useState } from 'react';
import { applyResistanceChoice } from '../../../services/automation/handlers/combat/elementalEpitomeHandler.js';
import '../CharSheet.css';

const RESISTANCE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

const RESISTANCE_DATA = {
    Acid: { icon: 'fa-biohazard', description: 'Corrosive acid damage resistance.' },
    Cold: { icon: 'fa-snowflake', description: 'Biting cold damage resistance.' },
    Fire: { icon: 'fa-fire', description: 'Searing fire damage resistance.' },
    Lightning: { icon: 'fa-bolt-lightning', description: 'Crackling lightning damage resistance.' },
    Thunder: { icon: 'fa-volume-high', description: 'Deafening thunder damage resistance.' },
};

function ElementalEpitomeModal({ action, playerStats, campaignName, currentResistance, onConfirm, onClose }) {
    const [selected, setSelected] = useState(currentResistance || null);

    const handleApply = async () => {
        if (!selected) return;
        const result = await applyResistanceChoice(action, playerStats, campaignName, selected);
        if (result?.type === 'popup' && onConfirm) {
            onConfirm(result.payload);
        }
        onClose();
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-shield-halved"></i> {action?.name || 'Elemental Epitome'}
                </div>
                <div className="sp-body">
                    <p>Choose your damage resistance type:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {RESISTANCE_TYPES.map((type, i) => {
                            const isSelected = selected === type;
                            const data = RESISTANCE_DATA[type];
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="epitomeResistance"
                                        checked={isSelected}
                                        onChange={() => setSelected(type)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <i className={`fa-solid ${data.icon}`}></i> <strong>{type}</strong> — {data.description}
                                </label>
                            );
                        })}
                    </div>
                    {currentResistance && (
                        <p style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '8px' }}>
                            Current resistance: <strong>{currentResistance}</strong>
                        </p>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-shield-halved"></i> Choose
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ElementalEpitomeModal;
