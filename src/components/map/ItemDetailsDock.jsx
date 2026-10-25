// @maintained-by-ai
// Selected-item details dock (backlog 2026-10-25: placed-token delete was
// contextmenu-only). While a placed item is selected (left-click/tap OR the
// right-click menu), this DOM chrome surfaces the actions visibly so the
// delete affordance no longer hides behind a right-click.
//
// Single source of truth: the Delete button invokes the SAME handleDeleteItem
// the context-menu row uses (named window.confirm + placedItems filter +
// useMapLoader autosave persist) — no duplicated confirm/persist logic here.
// Renders ONLY while `item` is one of the still-placed items (Map.jsx passes
// the resolved item, null on select-none/delete), so no stale control is ever
// left on screen. The ✕ row dismisses the popover by deselecting.
import { placedItemLabel } from './hooks/usePlacedItems.js';

function ItemDetailsDock({ item, handleDeleteItem, onDismiss }) {
    if (!item) return null;

    const label = placedItemLabel(item);

    return (
        <div className="item-details-dock" role="dialog" aria-label={`Selected item: ${label}`}>
            <span className="item-details-dock-name">{label}</span>
            <button
                type="button"
                className="item-details-dock-btn"
                aria-label={`Delete "${label}"`}
                onClick={() => handleDeleteItem(item.id)}
            >
                <i className="fa-solid fa-trash-can" aria-hidden="true" /> Delete
            </button>
            <button
                type="button"
                className="item-details-dock-btn item-details-dock-close"
                aria-label="Dismiss item details"
                onClick={onDismiss}
            >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
        </div>
    );
}

export default ItemDetailsDock;
