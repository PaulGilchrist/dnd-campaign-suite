// @maintained-by-ai
// Initiative-Clear confirm overlay (backlog 2026-11-08 EK): the tracker's
// native window.confirm migrated onto the shared DeleteConfirmModal chrome —
// the same role="dialog" + aria-modal + aria-labelledby tier the
// FriendlyFireConfirmModal set for its lane. Renders the retired native copy
// VERBATIM so the table sees the exact same ask; the confirm label differs
// from the "Clear" trigger button so role queries stay unique. Hosted once in
// Initiative.jsx, driven by a UI-local ephemeral boolean (useState, never the
// runtime store); it waits indefinitely (No-Game-Timers) and follows the
// modal family's convention that backdrop clicks and Escape do NOT dismiss —
// the user must choose an explicit button.
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

function ClearCombatConfirmModal({ pending, onCancel, onConfirm }) {
    if (!pending) return null;
    return (
        <DeleteConfirmModal
            titleId="clear-combat-confirm-title"
            title="Clear Initiative Board"
            confirmLabel="Yes, Clear Board"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            {'Clear combat status for all creatures? This resets initiative and removes all monsters from the board. This action is irreversible.'}
        </DeleteConfirmModal>
    );
}

export default ClearCombatConfirmModal;
