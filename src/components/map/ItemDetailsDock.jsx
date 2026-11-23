// @maintained-by-ai
// Selected-item details dock (backlog 2026-10-25: placed-token delete was
// contextmenu-only). While a placed item is selected (left-click/tap OR the
// right-click menu), this DOM chrome surfaces the actions visibly so the
// delete affordance no longer hides behind a right-click.
//
// Single source of truth: the Delete button invokes the SAME handleDeleteItem
// the context-menu row uses (staged named confirm via the shared
// DeleteFromMapModal + placedItems filter + useMapLoader autosave persist) —
// no duplicated confirm/persist logic here.
// Renders ONLY while `item` is one of the still-placed items (Map.jsx passes
// the resolved item, null on select-none/delete), so no stale control is ever
// left on screen. The ✕ row dismisses the popover by deselecting.
//
// Token art (deferred plan D): creature rows (npc/monster) also get an image
// upload + emoji fallback picker here (HTML chrome — the SVG context menu's
// fixed pixel math stays untouched). The upload reuses the portrait lane's
// shape: FileReader data URL → POST /token-image → the row keeps only the
// returned campaign-relative `imagePath` (map JSON never stores bytes).
import React from 'react';
import { placedItemLabel } from './hooks/usePlacedItems.js';
import './ItemDetailsDock.css';

// Curated quick-pick set for placeholder NPCs — one line, readable grid.
const EMOJI_CHOICES = [
    '🧙', '🧝', '🧟', '🐉', '🐺', '👹', '💀', '👻',
    '🧌', '🕷️', '🐍', '🦇', '👑', '🗡️', '🛡️', '🏹',
    '🔮', '🧪', '🪓', '🐴', '🦉', '🔥', '❄️', '⚡',
];

async function uploadTokenImage(campaignName, file) {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result); // event target, not reader.result (test-stub-safe)
        reader.onerror = () => reject(reader.error || new Error('file read failed'));
        reader.readAsDataURL(file);
    });
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/token-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, imageName: file.name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `upload refused (${res.status})`);
    return data.imagePath;
}

function TokenArtControls({ item, campaignName, onPatchItem }) {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    const onFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = ''; // re-picking the same file must re-fire change
        if (!file) return;
        setBusy(true); setError(null);
        try {
            const imagePath = await uploadTokenImage(campaignName, file);
            onPatchItem(item.id, { imagePath });
        } catch (err) {
            console.error('[token-art]', err);
            setError(`Upload failed: ${err.message}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="item-details-dock-art">
            <label className="item-details-dock-art-row">
                <span className="item-details-dock-btn">
                    <i className="fa-solid fa-image" aria-hidden="true" /> {busy ? 'Uploading…' : 'Set token art'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={onFile} />
                </span>
            </label>
            <div className="item-details-dock-emoji" role="group" aria-label="Emoji token art">
                {EMOJI_CHOICES.map(emoji => (
                    <button
                        key={emoji}
                        type="button"
                        className={`item-details-dock-emoji-btn ${item.emoji === emoji ? 'active' : ''}`}
                        onClick={() => onPatchItem(item.id, { emoji })}
                        aria-label={`Set ${emoji} token art`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
            {(item.imagePath || item.emoji) && (
                <button
                    type="button"
                    className="item-details-dock-btn"
                    onClick={() => onPatchItem(item.id, { imagePath: undefined, emoji: undefined })}
                >
                    <i className="fa-solid fa-eraser" aria-hidden="true" /> Remove art
                </button>
            )}
            {error && <span className="item-details-dock-art-error" role="alert">{error}</span>}
        </div>
    );
}

function ItemDetailsDock({ item, handleDeleteItem, onDismiss, campaignName, onPatchItem }) {
    if (!item) return null;

    const label = placedItemLabel(item);
    const isCreature = item.type === 'npc' || item.type === 'monster';

    return (
        // Modeless detail panel, NOT a modal: role="dialog" here mis-announced
        // it as modal and kept it in the [role="dialog"] tier (backlog
        // 2026-11-13 CF — probes resolving the dock instead of, or alongside,
        // the real DeleteConfirmModal). role="complementary" + aria-label
        // mirrors the app's labelled-dock pattern (FirstSessionChecklist) and
        // keeps the `Selected item: <label>` name; the shared DeleteFromMapModal
        // is the only dialog tier on this screen.
        <div className="item-details-dock" role="complementary" aria-label={`Selected item: ${label}`}>
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
            {isCreature && campaignName && onPatchItem && (
                <TokenArtControls item={item} campaignName={campaignName} onPatchItem={onPatchItem} />
            )}
        </div>
    );
}

export default ItemDetailsDock;
