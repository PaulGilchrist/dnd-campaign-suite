import { useEffect, useCallback, useRef } from 'react';
import { resolveAvatarSrc } from './avatarSrc.js';
import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';

function AvatarModal({ name, imagePath, campaignName, onClose }) {
    const panelRef = useRef(null);
    // Element that held focus when the zoom opened (the avatar that launched
    // it) — the focus-restore target on unmount.
    const openerRef = useRef(null);

    const handleOnClose = useCallback((event) => {
        // Ignore keydown events for keys other than Escape (button clicks
        // carry no `key`, so they always close).
        if (event && event.type === 'keydown' && event.key !== 'Escape') return;
        document.removeEventListener("keydown", handleOnClose);
        onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener("keydown", handleOnClose);
        return () => {
            document.removeEventListener("keydown", handleOnClose);
        };
    }, [handleOnClose]);

    // Backdrop dismiss lane (backlog 2026-11-16): a full-screen dim that answers
    // only × /Escape traps the user when anything occludes the ×. Reuses the
    // shared drag-guard: a mousedown started inside .avatar-modal (e.g. a text
    // selection dragged off the image) never dismisses — only a mousedown+click
    // fully on the backdrop closes. Escape stays on the document-level listener
    // even though the focus tier below now pulls focus into the panel: the card
    // re-key remount family can still strand activeElement outside the layer
    // (Popup's bug-roll-result-popup-escape-inert-when-opened-over-stat-modal
    // face), and a panel-scoped keydown would miss those — document level answers
    // Escape whether focus lives in the panel or behind the overlay.
    const { handleOverlayMouseDown, handleOverlayClick } =
        useModalDismiss(handleOnClose, { panelSelector: '.avatar-modal' });

    // Keyboard tier (backlog 2026-11-16 YG): a zoom opened with Enter on the
    // avatar used to keep focus on that avatar BEHIND the full-screen overlay —
    // a keyboard user could only Tab blindly toward the ×. Mirrors the shared
    // Popup's established tier (popup.jsx): tabIndex={-1} marks the container,
    // the open effect pulls focus into the panel, and a focusin RETENTION trap
    // keeps it there — initiative cards re-key on every runtime-state tick and
    // the remount's refocus used to yank activeElement back out (the same steal
    // Popup had to fix). Focus inside this overlay layer (×, future children)
    // is never fought. On unmount — every close lane (×, Escape, backdrop)
    // funnels through the consumer's open flag — focus returns to the capturing
    // opener; if it was unmounted with the host card (e.g. the stat modal's
    // full teardown) or another live surface already took focus, the tier
    // stands down exactly like Popup's close face (the browser's body focus
    // keeps Tab resuming from document start).
    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return undefined;
        const active = document.activeElement;
        if (active && active !== document.body && active !== document.documentElement
            && !panel.contains(active)) {
            openerRef.current = active;
        }
        if (!panel.contains(document.activeElement)) {
            panel.focus();
        }
        const reclaimFocus = () => {
            const current = document.activeElement;
            const insideZoomLayer = current && typeof current.closest === 'function'
                && current.closest('[data-testid="avatar-modal-overlay"]');
            if (!panel.contains(current) && !insideZoomLayer) {
                panel.focus({ preventScroll: true });
            }
        };
        document.addEventListener('focusin', reclaimFocus);
        return () => {
            document.removeEventListener('focusin', reclaimFocus);
            const opener = openerRef.current;
            openerRef.current = null;
            if (!opener || !opener.isConnected) return;
            // Never fight a live surface that took focus during this commit;
            // act only when focus fell out with the panel (or the panel itself
            // still holds it about to detach).
            const holder = document.activeElement;
            const contested = holder && holder !== document.body
                && holder !== document.documentElement
                && holder.isConnected && !panel.contains(holder);
            if (!contested) opener.focus();
        };
    }, []);

    const src = resolveAvatarSrc(imagePath, campaignName);

    return (
        <div
            className="avatar-modal-overlay"
            data-testid="avatar-modal-overlay"
            role="presentation"
            onMouseDown={handleOverlayMouseDown}
            onClick={handleOverlayClick}
        >
            <div className="avatar-modal" ref={panelRef} tabIndex={-1}>
                <button className="avatar-modal-close" onClick={handleOnClose} aria-label="Close">&times;</button>
                {src ? (
                    <img src={src} alt={name} className="avatar-modal-image" />
                ) : (
                    <div className="avatar-modal-initial">{name ? name.charAt(0).toUpperCase() : '?'}</div>
                )}
            </div>
        </div>
    );
}

export default AvatarModal;
