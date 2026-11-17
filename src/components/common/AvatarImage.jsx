import { useEffect, useState } from 'react';
import { resolveAvatarSrc } from './avatarSrc.js';

function AvatarImage({ name, imagePath, size = 60, onClick, campaignName }) {
    const cursorStyle = onClick ? { cursor: 'pointer' } : {};
    const src = resolveAvatarSrc(imagePath, campaignName);
    // Dangling imagePath (a DB row whose file was deleted) must converge onto the
    // same initials disc as an empty path, never a persistent broken <img>. The
    // browser fires error on a 404; the naturalWidth probe catches a zero-pixel
    // payload delivered as a "successful" load. Reset on src change so an upload
    // replacing the dead path repaints (mirrors CharSummary's modal-reset idiom).
    const [loadFailed, setLoadFailed] = useState(false);
    useEffect(() => { setLoadFailed(false); }, [src]);
    if (src && !loadFailed) {
        return (
            <div className="avatar-wrapper" style={{ width: size, height: size, ...cursorStyle }} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}>
                <img src={src} alt={name} className="avatar-image"
                    onError={() => setLoadFailed(true)}
                    onLoad={(e) => { if (e.target.naturalWidth === 0) setLoadFailed(true); }} />
            </div>
        );
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="avatar-wrapper avatar-initial" style={{ width: size, height: size, fontSize: size * 0.4, ...cursorStyle }} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}>
            <span>{initial}</span>
        </div>
    );
}

export default AvatarImage
