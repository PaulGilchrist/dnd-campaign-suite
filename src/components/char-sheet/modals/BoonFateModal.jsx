import { useState } from 'react';
import { applyBoonFateChoice } from '../../../services/automation/handlers/reactions/boonOfFateHandler.js';
import '../../common/savePromptModal.css';

function BoonFateModal({ action, playerStats, campaignName, roll2d4, lastAttack, attackerName: _attackerName, eventLabel, hitStatus, saveStatus, isAttack, isSave, isCheck: _isCheck, onClose }) {
    const [result, setResult] = useState(null);

    const bonusValue = typeof lastAttack.bonus === 'object' ? (lastAttack.bonus?.modifier || lastAttack.bonus?.total || 0) : (lastAttack.bonus || 0);
    const originalTotal = (lastAttack.d20 || 0) + bonusValue;

    const handleChoice = async (mode) => {
        const res = await applyBoonFateChoice(action, playerStats, campaignName, roll2d4, lastAttack, mode);
        setResult(res);
    };

    if (result) {
        return (
            <div className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
