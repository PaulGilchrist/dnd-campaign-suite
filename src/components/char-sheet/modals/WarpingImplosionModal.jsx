import React, { useState, useCallback } from 'react';
import { applyWarpingImplosion } from '../../../services/automation/handlers/class-sorcerer/warpingImplosionHandler.js';
import SaveAttackAoeModal from './shared/SaveAttackAoeModal.jsx';
import './WarpingImplosionModal.css';

function WarpingImplosionModal({
    action,
    playerStats,
    campaignName,
    saveDc,
    saveType,
    shape,
    rangeFeet,
    damageExpression,
    damageType,
    teleportRange,
    canRestore,
    restoreCost,
    hasRemaining,
    onClose,
}) {
    const [phase, setPhase] = useState('choice');
    const [message, setMessage] = useState(null);

    const handleConfirm = useCallback(async (restoreWithSP) => {
        const result = await applyWarpingImplosion(action, playerStats, campaignName, restoreWithSP);
        if (result?.type === 'popup') {
            setMessage(result.payload?.description || 'Unable to use this feature.');
            setPhase('message');
            return;
        }
        setPhase('aoe');
    }, [action, playerStats, campaignName]);

    const handleMessageClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    if (phase === 'aoe') {
        return (
            <SaveAttackAoeModal
                action={action}
                playerStats={playerStats}
                campaignName={campaignName}
                shape={shape}
                range={rangeFeet}
                damage={damageExpression}
                damageType={damageType}
                saveType={saveType}
                saveDc={saveDc}
                dcSuccess="none"
                pullMarkerEffect="pulled_toward"
                logSaveSuccess={true}
                onClose={onClose}
            />
        );
    }

    if (phase === 'message') {
        return (
            <div className="sp-overlay" onClick={(e) => {
                if (e.target.closest('.sp-modal')) return;
                onClose?.();
            }}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-arrow-right-arrow-left"></i> Warping Implosion
                    </div>
                    <div className="sp-body">
                        <p>{message}</p>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-roll-btn" onClick={handleMessageClose}>Done</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sp-overlay" onClick={(e) => {
            if (e.target.closest('.sp-modal')) return;
            onClose?.();
        }}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-arrow-right-arrow-left"></i> Warping Implosion
                </div>
                <div className="sp-body">
                    <p>Teleport to an unoccupied space within <strong>{teleportRange} feet</strong>. Each creature within <strong>{rangeFeet} feet</strong> of the space you leave makes a <strong>{saveType}</strong> saving throw (DC {saveDc}). On a failed save, a creature takes {damageExpression} {damageType} damage and is pulled toward the space you left.</p>
                    <p className="sp-note">{hasRemaining ? 'This use expends your 1 use of this feature (recharges on a Long Rest).' : `No uses remaining — spend ${restoreCost} Sorcery Points to restore and use it.`}</p>
                    <div className="warping-implosion-actions">
                        {hasRemaining && (
                            <button className="sp-roll-btn" onClick={() => handleConfirm(false)}>
                                <i className="fa-solid fa-person-running"></i> Teleport &amp; Implosion
                            </button>
                        )}
                        {!hasRemaining && canRestore && (
                            <button className="sp-roll-btn" onClick={() => handleConfirm(true)}>
                                <i className="fa-solid fa-dice-d20"></i> Restore &amp; Teleport — spend {restoreCost} Sorcery Points
                            </button>
                        )}
                        {!hasRemaining && !canRestore && (
                            <p className="sp-note">No remaining uses and not enough Sorcery Points to restore. Finish a Long Rest to regain.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default WarpingImplosionModal;
