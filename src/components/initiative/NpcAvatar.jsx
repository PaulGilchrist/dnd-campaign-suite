import AvatarImage from '../common/AvatarImage.jsx'

function NpcAvatar({ name, imageUrl, imagePath, onClick, campaignName }) {
    const src = imagePath || imageUrl
    if (src) {
        return (
            <div className="npc-avatar" onClick={onClick}>
                <AvatarImage name={name} imagePath={src} campaignName={campaignName} size={150} />
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

export default NpcAvatar
