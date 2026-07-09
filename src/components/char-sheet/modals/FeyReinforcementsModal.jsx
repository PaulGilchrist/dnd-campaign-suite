import { useState } from 'react';
import { confirmFeyReinforcement } from '../../../services/automation/handlers/class-warlock/feyReinforcementsHandler.js';
import '../CharSheet.css';

function FeyReinforcementsModal({ action, playerStats, campaignName, onClose }) {
    const [noConcentration, setNoConcentration] = useState(false);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const handleConfirm = async () => {
        const res = await confirmFeyReinforcement(action, playerStats, campaignName, noConcentration);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-leaf"></i> {action.name}
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
                    <i className="fa-solid fa-leaf"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Cast <strong>Summon Fey</strong> without material components or spell slot. This use does not consume a spell slot.</p>
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
                                ? 'The fey reinforcements will not require Concentration and will last 1 minute.'
                                : 'The fey reinforcements will require Concentration and last up to 1 hour (normal Summon Fey duration).'}
                        </p>
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-leaf"></i> Summon Fey
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default FeyReinforcementsModal;
