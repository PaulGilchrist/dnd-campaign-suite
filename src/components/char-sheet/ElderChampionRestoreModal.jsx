import { getRuntimeValue } from '../../hooks/useRuntimeState.js';
import './CharSheet.css';

function ElderChampionRestoreModal({ action, playerStats, campaignName, onConfirm, onClose }) {
    const playerName = playerStats.name;
    const level5Slots = Number(getRuntimeValue(playerName, 'spellSlotLevel5', campaignName) ?? 0);

    return (
        <div className="sp-overlay" onClick={onClose}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div className="sp-header">
                    <i className="fa-solid fa-fire"></i> {action.name}
                </div>
                <div className="sp-body">
                    <p>Elder Champion has already been used this long rest.</p>
                    <p>Restore its use by expending a level 5 spell slot? ({level5Slots} available)</p>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={onConfirm}
                        disabled={level5Slots <= 0}
                    >
                        <i className="fa-solid fa-xmark"></i> Expend Level 5 Slot
                    </button>
                    <button className="sp-dismiss-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ElderChampionRestoreModal;
