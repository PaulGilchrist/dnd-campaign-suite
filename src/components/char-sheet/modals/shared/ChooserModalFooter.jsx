import { CHOOSER_FOOTER_LABELS } from './chooserFooterLabels.js';
import '../../CharSheet.css';

/**
 * Shared confirm+decline footer for the .sp-modal rider-chooser family
 * (AttackRiderModal / ShieldBashChoiceModal / OpenHandTechniqueModal).
 *
 * Byte-identical labels are owned by chooserFooterLabels.js — pass values
 * from CHOOSER_FOOTER_LABELS, never inline strings. Re-uses the global
 * .sp-actions / .sp-roll-btn / .sp-dismiss-btn conventions; no inline styles.
 *
 * `committed` is the DG paid-cost latch: once Apply has dispatched (the
 * handler has already spent the resource), both faces disable so a stray
 * re-click cannot pay twice and Cancel cannot abandon a committed effect;
 * the decline button explains why via `committedTitle`.
 */
function ChooserModalFooter({
    confirmLabel,
    confirmIcon,
    onConfirm,
    confirmDisabled = false,
    committed = false,
    committedTitle = CHOOSER_FOOTER_LABELS.paidCostCommittedTitle,
    declineLabel,
    declineDisabled = false,
    onDecline,
}) {
    return (
        <div className="sp-actions">
            <button
                className="sp-roll-btn"
                onClick={onConfirm}
                disabled={confirmDisabled || committed}
            >
                {confirmIcon ? <i className={`fa-solid ${confirmIcon}`}></i> : null} {confirmLabel}
            </button>
            <button
                className="sp-dismiss-btn"
                onClick={onDecline}
                disabled={declineDisabled || committed}
                title={committed ? committedTitle : undefined}
            >
                {declineLabel}
            </button>
        </div>
    );
}

export default ChooserModalFooter;
