// @maintained-by-ai
// Copy layer for the spell-overlay destructive lanes (backlog 2026-11-01 BA):
// renders a `pendingOverlayAction` descriptor from useSpellOverlay
// ({ kind: 'remove', label } | { kind: 'clear', count, confirm }) through the
// shared DeleteConfirmModal — the same role="dialog" a11y tier the
// token/prop/player removal lanes ride (DeleteFromMapModal is its sibling for
// map rows). The copy keeps the retired native window.confirm wording verbatim
// in spirit: `Remove this <shape> overlay?` for the per-item lane and
// `Clear all N spell overlay(s)? This removes overlays placed by everyone.`
// for the Clear-All lane (shared-collab board ruling 2026-10-30 — the
// count-noun gate stays: exactly 1 reads singular). Mounted once in Map.jsx,
// so the toolbar's per-item Remove and Clear All buttons both land here.
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

function SpellOverlayConfirmModal({ pending, onCancel, onConfirm }) {
    if (!pending) return null;
    if (pending.kind === 'clear') {
        return (
            <DeleteConfirmModal
                titleId="spell-overlay-clear-title"
                title="Clear All Overlays"
                confirmLabel="Yes, Clear All"
                onCancel={onCancel}
                onConfirm={onConfirm}
            >
                Clear all <strong>{pending.count}</strong> spell overlay{pending.count === 1 ? '' : 's'}?
                This removes overlays placed by everyone.
            </DeleteConfirmModal>
        );
    }
    return (
        <DeleteConfirmModal
            titleId="spell-overlay-remove-title"
            title="Remove Overlay"
            confirmLabel="Yes, Remove"
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            Remove this <strong>{pending.label}</strong> overlay?
        </DeleteConfirmModal>
    );
}

export default SpellOverlayConfirmModal;
