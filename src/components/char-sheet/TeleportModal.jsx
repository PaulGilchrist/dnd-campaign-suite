import { useState } from 'react';
import { confirmTeleport, isExtendedAvailable } from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';
import './CharSheet.css';

function TeleportModal({ action, playerStats, campaignName, onClose, triggeredByElementalStride }) {
    const auto = action.automation;
    const isSwap = auto?.effect === 'teleport_swap_with_illusion';
    const extendedAvailable = isExtendedAvailable(playerStats.name, campaignName);
    const [useExtended, setUseExtended] = useState(false);
    const [applied, setApplied] = useState(false);
    const [result, setResult] = useState(null);

    const elementalOption = triggeredByElementalStride
        ? (auto?.options || []).find(o => o.effect === 'teleport')
        : null;
    const elementalDistance = elementalOption?.teleportDistance || '30 ft';

    const handleConfirm = async () => {
        if (triggeredByElementalStride) {
            const description = `${action.name}: Teleported ${elementalDistance} to an unoccupied space you can see.`;
            setResult({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    automationType: auto.type,
                    description,
                    automation: auto,
                },
            });
            setApplied(true);
            return;
        }
        const res = await confirmTeleport(action, playerStats, campaignName, useExtended);
        setResult(res);
        setApplied(true);
    };

    if (applied && result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className={`fa-solid ${isSwap ? 'fa-arrows-rotate' : triggeredByElementalStride ? 'fa-wind' : 'fa-tree'}`}></i> {action.name}
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

    if (triggeredByElementalStride) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-wind"></i> {action.name} — Thunder
                    </div>
                    <div className="sp-body">
                        <p>Teleport up to {elementalDistance} to an unoccupied space you can see.</p>
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

    if (isSwap) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className="fa-solid fa-arrows-rotate"></i> {action.name}
                    </div>
                    <div className="sp-body">
                        <p>Swap places with your illusion (up to {auto.distance || '30 ft'}).</p>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={handleConfirm}>
                            <i className="fa-solid fa-arrows-rotate"></i> Swap
                        </button>
                        <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    const standardDistance = auto.distance || '60 ft';
    const extendedDistance = auto.extendedDistance || '150 ft';

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-tree"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Teleport to an unoccupied space you can see:</p>
                    <div style={{ textAlign: 'left', marginTop: '12px' }}>
                        <label style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: !useExtended ? 'rgba(255,255,255,0.15)' : 'transparent', border: !useExtended ? '1px solid var(--color-link)' : '1px solid transparent' }}>
                            <input
                                type="radio"
                                name="teleportRange"
                                checked={!useExtended}
                                onChange={() => setUseExtended(false)}
                                style={{ marginRight: '8px' }}
                            />
                            <strong>{standardDistance}</strong>
                            <span style={{ opacity: 0.8, marginLeft: '8px' }}>— Standard teleport</span>
                        </label>
                        <label style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: extendedAvailable ? 'pointer' : 'not-allowed', background: useExtended ? 'rgba(255,255,255,0.15)' : 'transparent', border: useExtended ? '1px solid var(--color-link)' : '1px solid transparent', opacity: extendedAvailable ? 1 : 0.5 }}>
                            <input
                                type="radio"
                                name="teleportRange"
                                checked={useExtended}
                                onChange={() => extendedAvailable && setUseExtended(true)}
                                disabled={!extendedAvailable}
                                style={{ marginRight: '8px' }}
                            />
                            <strong>{extendedDistance}</strong>
                            <span style={{ opacity: 0.8, marginLeft: '8px' }}>
                                {extendedAvailable ? '— Once per Rage' : '— Already used this Rage'}
                            </span>
                        </label>
                    </div>
                    {auto.bringAllies && auto.allyCount > 0 && (
                        <p style={{ marginTop: '12px', opacity: 0.8 }}>
                            <i className="fa-solid fa-users"></i> When using the extended teleport, you can bring up to {auto.allyCount} willing creatures within 10 ft of you. Each appears within {auto.teleportRange || '10 ft'} of your destination.
                        </p>
                    )}
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={handleConfirm}>
                        <i className="fa-solid fa-tree"></i> Teleport
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default TeleportModal;
