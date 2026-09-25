import { useState } from 'react';

export default function CreateUndeadModal({ maxTargets, onConfirm, onClose }) {
    const [ghoulCount, setGhoulCount] = useState(1);

    const adjustGhoul = (delta) => {
        setGhoulCount(prev => Math.max(1, Math.min(maxTargets, prev + delta)));
    };

    const handleConfirm = () => {
        onConfirm({ ghoulCount });
    };

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-skull"></i> Create Undead
                </div>
                <div className="sp-body">
                    <p>You can create up to <b>{maxTargets}</b> ghoul(s). Choose how many to summon.</p>
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                                className="sp-dismiss-btn"
                                onClick={() => adjustGhoul(-1)}
                                type="button"
                                style={{ padding: '4px 10px', fontSize: '1em' }}
                            >
                                <i className="fa-solid fa-minus"></i>
                            </button>
                            <span style={{ width: '40px', textAlign: 'center', fontWeight: 'bold' }}>{ghoulCount}</span>
                            <button
                                className="sp-roll-btn"
                                onClick={() => adjustGhoul(1)}
                                type="button"
                                style={{ padding: '4px 10px', fontSize: '1em' }}
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                            <span style={{ fontWeight: 'bold' }}>Ghoul(s)</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.9em' }}>
                        <span>Total creatures: <b>{ghoulCount}</b> / {maxTargets}</span>
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        type="button"
                    >
                        <i className="fa-solid fa-skull"></i> Create Undead ({ghoulCount})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
