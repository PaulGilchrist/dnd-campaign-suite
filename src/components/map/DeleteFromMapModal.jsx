// @maintained-by-ai
// Copy layer for the indoor map editor's in-app named confirm (backlog
// 2026-11-01 AZ2): renders a `pendingDelete` descriptor from usePlacedItems
// ({ action?, label, confirm }) through the shared DeleteConfirmModal — the
// MapsManager "Delete Map" dialog tier (role=dialog + aria-modal + labelled
// heading + focus inside). The copy keeps the retired native window.confirm
// wording verbatim in spirit: `Delete "<label>" from the map?` for placed
// item/token rows (label = the ONE placedItemLabel source) and
// `Remove "<name>" from the map?` for the player-token lane (action verb
// carried on the descriptor). Mounted once in Map.jsx, so BOTH the SVG
// context-menu Delete and the ItemDetailsDock Delete ride the same dialog.
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';

function DeleteFromMapModal({ pending, onCancel, onConfirm }) {
    if (!pending) return null;
    const action = pending.action || 'Delete';
    return (
        <DeleteConfirmModal
            titleId="map-delete-confirm-title"
            title={`${action} from Map`}
            confirmLabel={`Yes, ${action}`}
            onCancel={onCancel}
            onConfirm={onConfirm}
        >
            {action} &quot;<strong>{pending.label}</strong>&quot; from the map?
        </DeleteConfirmModal>
    );
}

export default DeleteFromMapModal;
