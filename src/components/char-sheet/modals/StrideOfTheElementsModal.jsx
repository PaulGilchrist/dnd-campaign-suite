import { useState } from 'react';
import { STRIDE_OPTIONS } from '../../../services/automation/handlers/combat/strideOfTheElementsHandler.js';
import '../CharSheet.css';

function StrideOfTheElementsModal({ action, _playerStats, _campaignName, onConfirm, onClose }) {
    const [selected, setSelected] = useState(null);

    const handleApply = () => {
        if (!selected) return;
        const strideOption = STRIDE_OPTIONS.find(o => o.name === selected);
        if (!strideOption) return;

        const buffEntry = { effect: strideOption.effect };
        if (strideOption.speedBonus) buffEntry.speedBonus = strideOption.speedBonus;
        if (strideOption.teleportDistance) buffEntry.teleportDistance = strideOption.teleportDistance;
        if (strideOption.flySpeed) buffEntry.flySpeed = strideOption.flySpeed;

        onConfirm(strideOption.label, buffEntry);
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-person-walking"></i> {action?.name || 'Stride of the Elements'}
                </div>
                <div className="sp-body">
                    <p>Choose a special movement type:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {STRIDE_OPTIONS.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="strideOption"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <i className={`fa-solid ${opt.icon}`}></i> <strong>{opt.label}</strong> — {opt.description}
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-person-walking"></i> Choose
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default StrideOfTheElementsModal;
