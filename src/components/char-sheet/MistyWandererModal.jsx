import { useState } from 'react';
import { confirmMistyWanderer } from '../../services/automation/handlers/class-warlock/mistyWandererHandler.js';
import './CharSheet.css';

function MistyWandererModal({ action, playerStats, campaignName, onClose }) {
    const [selectedAlly, setSelectedAlly] = useState(null);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleConfirm = async () => {
        const res = await confirmMistyWanderer(action, playerStats, campaignName, !!selectedAlly, selectedAlly);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-cloud"></i> {action.name}
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
                    <i className="fa-solid fa-cloud"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Cast <strong>Misty Step</strong> — teleport up to 30 feet to an unoccupied space you can see.</p>
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ marginBottom: '8px' }}>Bring a willing creature within 5 feet?</p>
                        <select
                            value={selectedAlly || ''}
                            onChange={e => setSelectedAlly(e.target.value || null)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid var(--color-link)',
                                background: 'var(--background-color-header-inner)',
                                color: 'var(--color-header-inner)',
                            }}
                        >
                            <option value="">None</option>
                        </select>
                        <p style={{ marginTop: '8px', opacity: 0.8, fontSize: '0.9em' }}>
                            The creature appears in an unoccupied space within 5 feet of your destination.
                        </p>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-cloud"></i> Cast Misty Step
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default MistyWandererModal;
