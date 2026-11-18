import { useRef, useState } from 'react';
import { confirmArcaneCharge } from '../../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js';
import '../../CharSheet.css';
import { useOverlayEntranceFocus } from '../../../../hooks/ui/useOverlayEntranceFocus.js';

function ArcaneChargeModal({ action, playerStats, campaignName, distance, onClose }) {
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef);

    const handleConfirm = async () => {
        const res = await confirmArcaneCharge(action, playerStats, campaignName);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" ref={overlayRef}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-wind"></i> {action.name}
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
        <div className="sp-overlay" ref={overlayRef}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-wind"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Teleport up to {distance} to an unoccupied space you can see.</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-wind"></i> Teleport
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ArcaneChargeModal;
