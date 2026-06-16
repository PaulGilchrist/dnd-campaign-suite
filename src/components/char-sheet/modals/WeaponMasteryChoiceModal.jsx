import { useState } from 'react';
import { applyWeaponMasteryChoice } from '../../../services/automation/index.js';
import '../CharSheet.css';

function WeaponMasteryChoiceModal({ action: _action, playerStats, campaignName, masteryProperties, onClose, onConfirm }) {
    const [selected, setSelected] = useState(null);
    const [result, setResult] = useState(null);

    const handleSelect = async () => {
        if (!selected) return;
        const res = await applyWeaponMasteryChoice(selected, playerStats, campaignName);
        setResult(res);
        if (onConfirm) onConfirm(selected);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-crosshairs"></i> Weapon Master
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
                    <i className="fa-solid fa-crosshairs"></i> Weapon Master — Choose Mastery
                </div>
                <div className="sp-body">
                    <p>Choose a mastery property to activate with your weapon attacks:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {masteryProperties.map((m, i) => {
                            const isSelected = selected === m;
                            return (
                                <label key={i} style={{
                                    display: 'block', padding: '8px 12px', margin: '4px 0',
                                    borderRadius: '6px', cursor: 'pointer',
                                    background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent',
                                    border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent',
                                }}>
                                    <input
                                        type="radio"
                                        name="weaponMasteryChoice"
                                        checked={isSelected}
                                        onChange={() => setSelected(m)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{m}</strong>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleSelect} disabled={!selected}>
                        <i className="fa-solid fa-check"></i> Select
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Skip</button>
                </div>
            </div>
        </div>
    );
}

export default WeaponMasteryChoiceModal;
