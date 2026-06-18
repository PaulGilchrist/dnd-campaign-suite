import { useState } from 'react';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../../../services/automation/index.js';
import '../../CharSheet.css';

function BreathWeaponShapeModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(null);

    const handleChoose = async () => {
        if (!selected) return;
        const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
        await setRuntimeValue(playerStats.name, optionKey, selected, campaignName);
        onClose();
        const result = await executeHandler(action, playerStats, campaignName, null);
        if (result) {
            window.dispatchEvent(new CustomEvent('automation-result', { detail: result }));
        }
    };

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-dragon"></i> {action?.name || 'Breath Weapon'}
                </div>
                <div className="sp-body">
                    <p>Choose the shape of your breath weapon:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        <label style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: selected === 'cone' ? 'rgba(255,255,255,0.15)' : 'transparent', border: selected === 'cone' ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                            <input
                                type="radio"
                                name="breathWeaponShape"
                                checked={selected === 'cone'}
                                onChange={() => setSelected('cone')}
                                style={{ marginRight: '8px' }}
                            />
                            <strong>15-foot Cone</strong> — Each creature in a 15-foot cone must make a DEX save. On a failed save, they take 1d10 damage. On a success, half damage.
                        </label>
                        <label style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: selected === 'line' ? 'rgba(255,255,255,0.15)' : 'transparent', border: selected === 'line' ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                            <input
                                type="radio"
                                name="breathWeaponShape"
                                checked={selected === 'line'}
                                onChange={() => setSelected('line')}
                                style={{ marginRight: '8px' }}
                            />
                            <strong>30-foot Line (5 feet wide)</strong> — Each creature in a 30-foot line 5 feet wide must make a DEX save. On a failed save, they take 1d10 damage. On a success, half damage.
                        </label>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleChoose} disabled={!selected}>
                        <i className="fa-solid fa-dragon"></i> Choose Shape
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default BreathWeaponShapeModal;
