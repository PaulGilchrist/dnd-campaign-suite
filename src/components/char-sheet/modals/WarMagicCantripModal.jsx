import { useState } from 'react';
import { confirmWarMagicCantrip } from '../../../services/automation/handlers/class-fighter-rogue/warMagicCantripHandler.js';
import '../CharSheet.css';

function WarMagicCantripModal({ action, playerStats, campaignName, options, optionDetails, onClose }) {
    const [selected, setSelected] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleConfirm = async () => {
        const res = await confirmWarMagicCantrip(action, playerStats, campaignName, selected);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-hat-wizard"></i> {action.name}
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
                    <i className="fa-solid fa-hat-wizard"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Replace one attack with a Wizard cantrip (casting time: action):</p>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {options.map(name => (
                            <div
                                key={name}
                                style={{
                                    padding: '8px 12px',
                                    margin: '4px 0',
                                    cursor: 'pointer',
                                    border: selected === name ? '2px solid #007bff' : '1px solid #ccc',
                                    borderRadius: '4px',
                                    backgroundColor: selected === name ? '#e8f0fe' : '#fff',
                                }}
                                onClick={() => setSelected(name)}
                            >
                                <strong>{name}</strong>
                                {optionDetails[name]?.casting_time && (
                                    <span style={{ marginLeft: '8px', color: '#666' }}>({optionDetails[name].casting_time})</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        disabled={!selected}
                        onClick={handleConfirm}
                        style={!selected ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                        <i className="fa-solid fa-bolt"></i> Replace Attack
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default WarMagicCantripModal;
