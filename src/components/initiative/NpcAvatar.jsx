

function NpcAvatar({ name, imageUrl, imagePath, onClick }) {
    const src = imagePath || imageUrl
    if (src) {
        return (
            <div className="npc-avatar" onClick={onClick}>
                <AvatarImage name={name} imagePath={src} size={150} />
            </div>
        )
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?'
    return (
        <div className="npc-avatar" onClick={onClick}>
            <span>{initial}</span>
        </div>
    )
}

import AvatarImage from '../common/AvatarImage.jsx'

export default NpcAvatar
