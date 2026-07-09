
function AvatarImage({ name, imagePath, size = 60, onClick, campaignName }) {
    const cursorStyle = onClick ? { cursor: 'pointer' } : {};
    const src = campaignName && imagePath ? `campaigns/${campaignName}/${imagePath}` : imagePath;
    if (src) {
        return (
            <div className="avatar-wrapper" style={{ width: size, height: size, ...cursorStyle }} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}>
                <img src={src} alt={name} className="avatar-image" />
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
