// @maintained-by-ai
// In-app keep/discard toll for the shared useReloadGuard dirty-draft guard
// (QA backlog 2026-11-24: retires the native window.confirm `Discard changes
// to "X"?` / reload-discard confirms across the six .ct-* CRUD lanes). Pure
// display wrapper over common/DeleteConfirmModal — Cancel/Escape/backdrop are
// the KEEP lane (cancel the discard: banner, editor, and draft stay fully
// inert, exactly what the retired native Cancel did) and `Yes, Discard`
// answers the caller's promise so it proceeds with the reload/close. The
// pending resolve lives in the hook; this component is stateless, mirroring
// the sibling row-delete wrappers (DeleteFactionModal et al.) that keep the
// destructive copy honest while the shared dialog owns the a11y tier.
import DeleteConfirmModal from './DeleteConfirmModal.jsx';

export default function DiscardDraftDialog({ message, onKeep, onDiscard }) {
    return (
        <DeleteConfirmModal
            titleId="reload-guard-discard-title"
            title="Discard Changes?"
            confirmLabel="Yes, Discard"
            onCancel={onKeep}
            onConfirm={onDiscard}
        >
            {message}
        </DeleteConfirmModal>
    );
}
