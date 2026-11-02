// Guarded render of the shared AllySelectionModal for the tracker (Phase 3.2).
// The guard lives here (not as an && in Initiative) to keep the container
// within the complexity ratchet; props come from useAllyEditor.js.

import AllySelectionModal from '../common/AllySelectionModal.jsx'

export default function AllyEditorModal({ open, modalProps, onConfirm, onCancel }) {
    if (!open || !modalProps) return null
    return (
        <AllySelectionModal
            {...modalProps}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    )
}
