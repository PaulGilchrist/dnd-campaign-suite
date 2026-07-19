import { useState } from 'react';
import { applyDamageTypeChoice, skipTargetChoice } from '../../../services/automation/handlers/combat/destructiveStrideHandler.js';
import '../CharSheet.css';

const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

const DAMAGE_DATA = {
    Acid: { icon: 'fa-biohazard', description: 'Corrosive acid damage.' },
    Cold: { icon: 'fa-snowflake', description: 'Biting cold damage.' },
    Fire: { icon: 'fa-fire', description: 'Searing fire damage.' },
    Lightning: { icon: 'fa-bolt-lightning', description: 'Crackling lightning damage.' },
    Thunder: { icon: 'fa-volume-high', description: 'Deafening thunder damage.' },
};

function DestructiveStrideModal({ action, playerStats, campaignName, onConfirm, onClose }) {
    const [selected, setSelected] = useState(null);

    const handleApply = async () => {
        if (!selected) return;
        const result = await applyDamageTypeChoice(action, playerStats, campaignName, selected);
        if (result?.type === 'modal' && onConfirm) {
            onConfirm(result);
        } else if (result?.type === 'popup' && onConfirm) {
            onConfirm(result);
        }
    };

    const handleSkip = async () => {
        const result = await skipTargetChoice(action, playerStats, campaignName);
        if (result?.type === 'popup' && onConfirm) {
            onConfirm(result);
        }
        onClose();
    };

    return (
        <div className="sp-overlay" onClick={handleSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-person-running"></i> {action?.name || 'Destructive Stride'}
                </div>
                <div className="sp-body">
                    <p>Choose the damage type for Destructive Stride:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {DAMAGE_TYPES.map((type, i) => {
                            const isSelected = selected === type;
                            const data = DAMAGE_DATA[type];
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="destructiveStrideType"
                                        checked={isSelected}
                                        onChange={() => setSelected(type)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <i className={`fa-solid ${data.icon}`}></i> <strong>{type}</strong> — {data.description}
                                </label>
                            );
                        })}
                    </div>
                    <p style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '12px' }}>
                        Note: Choose a creature only if the monk comes within 5 ft. of them while striding.
                    </p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-crosshairs"></i> Choose Type
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleSkip}>
                        <i className="fa-solid fa-times"></i> Skip Target
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DestructiveStrideModal;
