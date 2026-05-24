
function AvatarImage({ name, imagePath, size = 60 }) {
    if (imagePath) {
        return (
            <div className="avatar-wrapper" style={{ width: size, height: size }}>
                <img src={imagePath} alt={name} className="avatar-image" />
            </div>
        );
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="avatar-wrapper avatar-initial" style={{ width: size, height: size, fontSize: size * 0.4 }}>
            <span>{initial}</span>
        </div>
    );
}

export default AvatarImage
