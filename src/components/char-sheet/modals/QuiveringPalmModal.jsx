import { useState } from 'react';
import { applyQuiveringPalmShockwave, applyQuiveringPalmRelease } from '../../../services/automation/handlers/class-monk/quiveringPalmHandler.js';
import '../CharSheet.css';

function QuiveringPalmModal({ action, playerStats, campaignName, targetName, isRelease, onClose }) {
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleShockwave = async () => {
        setLoading(true);
        const res = await applyQuiveringPalmShockwave(action, playerStats, campaignName, targetName);
        setResult(res);
        setLoading(false);
    };

    const handleRelease = async () => {
        setLoading(true);
        const res = await applyQuiveringPalmRelease(action, playerStats, campaignName, targetName);
        setResult(res);
        setLoading(false);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-hand-fist"></i> {action.name}
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

    if (isRelease) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-hand-fist"></i> {action.name}
                    </div>
                    <div className="sp-body">
                        <p>Vibrations are set in <b>{targetName}</b>.</p>
                        <p>Choose an option:</p>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={handleRelease} disabled={loading}>
                            <i className="fa-solid fa-hand"></i> Release the Harmless Vibrations
                        </button>
                        <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-hand-fist"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Vibrations are set in <b>{targetName}</b>.</p>
                    <p>Choose an option:</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleShockwave} disabled={loading}>
                        <i className="fa-solid fa-bolt"></i> Trigger the Lethal Shockwave
                    </button>
                    <button className="sp-dismiss-btn" onClick={handleRelease} disabled={loading}>
                        <i className="fa-solid fa-hand"></i> Release the Harmless Vibrations
                    </button>
                </div>
            </div>
        </div>
    );
}

export default QuiveringPalmModal;
