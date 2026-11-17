// @maintained-by-ai
// Campaign-NPC unarmed join-confirm overlay (backlog 2026-11-17 EG): the
// attack-less add-to-Initiative lane's native window.confirm had INVERTED
// semantics — the wording told the GM to pick the native Cancel button to
// proceed while OK meant bail. Migrated onto the shared DeleteConfirmModal role="dialog" tier (the
// same non-delete reuse precedent FriendlyFireConfirmModal and
// SpellOverlayConfirmModal set) with honest, explicit buttons: `Add anyway`
// proceeds with the Unarmed Strike fallback, `Cancel` adds nothing. Hosted by
// every lane that drives addNPCToInitiative (NPCs.jsx row + save-and-add,
// Sessions.jsx quick action), driven by UI-local ephemeral state (useState,
// never the runtime store); it waits indefinitely (No-Game-Timers).
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

function NpcUnarmedConfirmModal({ pending, onCancel, onConfirm }) {
    if (!pending) return null;
    return (
        <DeleteConfirmModal
            titleId="npc-unarmed-confirm-title"
            title="No Weapons or Attacks"
            confirmLabel="Add anyway"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            {`${pending.name} has no weapons or attacks. If you add them to Initiative now, they will fight with an Unarmed Strike.`}
        </DeleteConfirmModal>
    );
}

export default NpcUnarmedConfirmModal;
