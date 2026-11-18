// @maintained-by-ai
// Friendly-fire confirm overlay (backlog 2026-11-04 CQ): the initiative lane's
// last native window.confirm migrated onto the shared DeleteConfirmModal chrome
// — the same role="dialog" + aria-modal + aria-labelledby tier and the
// non-delete reuse precedent SpellOverlayConfirmModal set. Renders the retired
// native copy VERBATIM so the table sees the exact same ask. Hosted once in
// Initiative.jsx, driven by a UI-local ephemeral pending pair (useState, never
// the runtime store); it waits indefinitely (No-Game-Timers). Dismiss follows
// the shared chrome's law (backlog 2026-11-13 AD, WAI-ARIA parity): Escape and
// a PURE backdrop click (mousedown+click both on the backdrop, drag-guarded —
// DeleteConfirmModal.jsx) route to onCancel, the inert Cancel lane that simply
// reverts the pending FF target-select with zero writes.
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

function FriendlyFireConfirmModal({ pending, onCancel, onConfirm }) {
    if (!pending) return null;
    return (
        <DeleteConfirmModal
            titleId="friendly-fire-confirm-title"
            title="Friendly Fire"
            confirmLabel="Yes, Arm Target"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            {`Friendly fire: ${pending.targetName} is on ${pending.creatureName}'s ally list. Arm them as the target anyway?`}
        </DeleteConfirmModal>
    );
}

export default FriendlyFireConfirmModal;
