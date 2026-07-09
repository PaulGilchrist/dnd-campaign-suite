import { useEffect, useCallback } from 'react';

function AvatarModal({ name, imagePath, campaignName, onClose }) {
    const handleOnClose = useCallback(() => {
        document.removeEventListener("keydown", handleOnClose);
        onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener("keydown", handleOnClose);
        return () => {
            document.removeEventListener("keydown", handleOnClose);
        };
    }, [handleOnClose]);

    const src = campaignName && imagePath ? `campaigns/${campaignName}/${imagePath}` : imagePath;

    return (
        <div className="avatar-modal-overlay" data-testid="avatar-modal-overlay" role="presentation" onClick={handleOnClose}>
            <div className="avatar-modal" onClick={(e) => e.stopPropagation()}>
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
