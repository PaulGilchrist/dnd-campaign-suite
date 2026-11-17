import { useEffect, useCallback } from 'react';
import { resolveAvatarSrc } from './avatarSrc.js';
import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';

function AvatarModal({ name, imagePath, campaignName, onClose }) {
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
    // above: focus remains on the opening avatar (no focus trap here), so a
    // panel-scoped keydown would miss it.
    const { handleOverlayMouseDown, handleOverlayClick } =
        useModalDismiss(handleOnClose, { panelSelector: '.avatar-modal' });

    const src = resolveAvatarSrc(imagePath, campaignName);

    return (
        <div
            className="avatar-modal-overlay"
            data-testid="avatar-modal-overlay"
            role="presentation"
            onMouseDown={handleOverlayMouseDown}
            onClick={handleOverlayClick}
        >
            <div className="avatar-modal">
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
