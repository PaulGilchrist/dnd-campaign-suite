import { useState } from 'react';
import { confirmDragonCompanion } from '../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js';
import '../CharSheet.css';

function DragonCompanionModal({ action, playerStats, campaignName, onClose }) {
    const [noConcentration, setNoConcentration] = useState(false);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleConfirm = async () => {
        const res = await confirmDragonCompanion(action, playerStats, campaignName, noConcentration);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-dragon"></i> {action.name}
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
                    <i className="fa-solid fa-dragon"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Cast <strong>Summon Dragon</strong> without material components or spell slot.</p>
                    <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={noConcentration}
                                onChange={e => setNoConcentration(e.target.checked)}
                            />
                            {' '}Skip Concentration (duration becomes 1 minute)
                        </label>
                        <p style={{ marginTop: '8px', opacity: 0.8, fontSize: '0.9em' }}>
                            {noConcentration
                                ? 'The dragon companion will not require Concentration and will last 1 minute.'
                                : 'The dragon companion will require Concentration and last up to 1 hour (normal Summon Dragon duration).'}
                        </p>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-dragon"></i> Summon Dragon
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default DragonCompanionModal;
