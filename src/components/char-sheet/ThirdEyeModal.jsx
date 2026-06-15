import { useState } from 'react';
import { applyThirdEye } from '../../services/automation/handlers/class-wizard/thirdEyeHandler.js';
import './CharSheet.css';

const THIRD_EYE_OPTIONS = [
    { name: 'Darkvision (120 feet)', description: 'You gain Darkvision out to a range of 120 feet.' },
    { name: 'Greater Comprehension', description: 'You can read any language.' },
    { name: 'See Invisibility', description: 'You can see invisible creatures and objects within 10 feet of you that are within line of sight.' },
];

function ThirdEyeModal({ action, playerStats, campaignName, onClose }) {
    const [selected, setSelected] = useState(THIRD_EYE_OPTIONS[0]?.name || null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleApply = () => {
        if (!selected) return;
        applyThirdEye(action, playerStats, campaignName, selected).then((res) => {
            setResult(res);
            setApplied(true);
        });
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-eye"></i> {action.name}
                    </div>
                    <div className="sp-body">
                        <div dangerouslySetInnerHTML={{ __html: result.payload.description }} />
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
                    <i className="fa-solid fa-eye"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Choose a benefit (lasts until start of Short or Long Rest):</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        {THIRD_EYE_OPTIONS.map((opt, i) => {
                            const isSelected = selected === opt.name;
                            return (
                                <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'rgba(255,255,255,0.15)' : 'transparent', border: isSelected ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                                    <input
                                        type="radio"
                                        name="thirdEye"
                                        checked={isSelected}
                                        onChange={() => setSelected(opt.name)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <strong>{opt.name}</strong>
                                    <span style={{ opacity: 0.8, marginLeft: '8px' }}>— {opt.description}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleApply} disabled={!selected}>
                        <i className="fa-solid fa-eye"></i> Use Bonus Action
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ThirdEyeModal;
