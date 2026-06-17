import { useState } from 'react';
import { confirmIllusoryReality } from '../../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js';
import '../../CharSheet.css';

function IllusoryRealityModal({ action, playerStats, campaignName, onClose }) {
    const [objectName, setObjectName] = useState('');
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const featureName = action?.featureName || 'Illusory Reality';

    const handleConfirm = async () => {
        const res = await confirmIllusoryReality(action, playerStats, campaignName, objectName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-eye"></i> {featureName}
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
                    <i className="fa-solid fa-eye"></i> {featureName}
                </div>
                <div className="sp-body">
                    <p>Choose one inanimate, nonmagical object that is part of an illusion spell you cast with a spell slot. The object becomes real for 1 minute.</p>
                    <p style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '4px' }}>The object cannot deal damage or impose any conditions.</p>
                    <div style={{ marginTop: '12px' }}>
                        <input
                            type="text"
                            placeholder="Enter object name (e.g., 'a 5-foot cube of stone')"
                            value={objectName}
                            onChange={e => setObjectName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '0.95em',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(0,0,0,0.3)',
                                color: '#fff',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm} disabled={!objectName.trim()}>
                        <i className="fa-solid fa-eye"></i> Make Object Real
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default IllusoryRealityModal;
