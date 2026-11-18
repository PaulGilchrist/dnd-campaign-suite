import { useRef, useState } from 'react';
import { applyBoonFateChoice } from '../../../services/automation/handlers/reactions/boonOfFateHandler.js';
import '../../common/SavePromptModal.css';
import { useOverlayEntranceFocus } from '../../../hooks/ui/useOverlayEntranceFocus.js';

function computeBoonFateBonus(lastAttack) {
    if (typeof lastAttack.bonus !== 'object') return lastAttack.bonus || 0;
    return lastAttack.bonus?.modifier || lastAttack.bonus?.total || 0;
}

function BoonFateModal({ action, playerStats, campaignName, roll2d4, lastAttack, attackerName: _attackerName, eventLabel, hitStatus, saveStatus, isAttack, isSave, isCheck: _isCheck, onClose }) {
    const [result, setResult] = useState(null);
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef);

    const bonusValue = computeBoonFateBonus(lastAttack);
    const originalTotal = (lastAttack.d20 || 0) + bonusValue;

    const handleChoice = async (mode) => {
        const res = await applyBoonFateChoice({ action, playerStats, campaignName, roll2d4, lastAttack, mode });
        setResult(res);
    };

    if (result) {
        return (
            <div className="sp-overlay" ref={overlayRef}>
                <div className="sp-modal">
                    <div className="sp-header">
                        <i className="fa-solid fa-hand"></i> {action.name || 'Improve Fate'}
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
                    <i className="fa-solid fa-hand"></i> {action.name || 'Improve Fate'}
                </div>
                <div className="sp-body">
                    <p><b>{eventLabel}</b></p>
                    <p>
                        Original roll: d20({lastAttack.d20}) + {bonusValue} = <b>{originalTotal}</b>
                    </p>
                    {isAttack && hitStatus && (
                        <p>vs AC {lastAttack.targetAc || lastAttack.effectiveAc || '—'} → <b>{hitStatus}</b></p>
                    )}
                    {isSave && saveStatus && (
                        <p>vs DC {lastAttack.saveDc || '—'} → <b>{saveStatus}</b></p>
                    )}
                    <p>Rolled 2d4: <span className="sp-dc">{roll2d4.total}</span></p>
                    <p>Choose how to apply the modifier:</p>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={() => handleChoice('bonus')}>
                        <i className="fa-solid fa-arrow-up"></i> Apply +{roll2d4.total} (Bonus)
                    </button>
                    <button className="sp-roll-btn" onClick={() => handleChoice('penalty')}>
                        <i className="fa-solid fa-arrow-down"></i> Apply -{roll2d4.total} (Penalty)
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default BoonFateModal;
