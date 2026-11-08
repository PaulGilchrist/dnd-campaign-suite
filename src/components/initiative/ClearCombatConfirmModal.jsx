// @maintained-by-ai
// Initiative-Clear confirm overlay (backlog 2026-11-08 EK): the tracker's
// native window.confirm migrated onto the shared DeleteConfirmModal chrome —
// the same role="dialog" + aria-modal + aria-labelledby tier the
// FriendlyFireConfirmModal set for its lane. Hosted once in Initiative.jsx,
// driven by a UI-local ephemeral boolean (useState, never the runtime store);
// it waits indefinitely (No-Game-Timers) and follows the modal family's
// convention that backdrop clicks and Escape do NOT dismiss — the user must
// choose an explicit button.
// Copy honesty fix (backlog 2026-11-08 EP): the retired native string promised
// it "removes all monsters from the board", but clearCombat re-seeds every
// bare "+NPC" placeholder (isBareNpcPlaceholder carry-over, test-pinned by
// design, playbook §9) — so the body now says the placeholders are kept.
// Button labels and dialog contract are unchanged.
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
            {'Clear combat status for all creatures? This resets initiative and removes monsters from the board — bare +NPC placeholder slots are kept and re-seeded. This action is irreversible.'}
        </DeleteConfirmModal>
    );
}

export default ClearCombatConfirmModal;
