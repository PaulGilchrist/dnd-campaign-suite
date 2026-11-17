import AvatarImage from '../common/AvatarImage.jsx'

// Keyboard tier (visitor avatar zoom, backlog 2026-11-17): the .npc-avatar
// wrapper is the ONLY activation surface for the visitor's AvatarModal zoom
// and for the GM/summoned stat-modal open, yet it was a plain div — the zoom
// was keyboard-unreachable on this surface, and AvatarModal's opener focus-
// restore stood down because nothing focusable was captured at open (focus
// landed on body at close). Mirrors AvatarImage's established interactive
// tier (role/tabIndex + content-derived accessible name, exactly like the
// GM header's .mc-header-avatar [role=button]) — the img alt or the initial
// span IS the accessible name, no separate aria-label convention. Space gets
// preventDefault so activating the button never scrolls the page (the reason
// the visitor div cannot just inherit AvatarImage's keydown verbatim).
function NpcAvatar({ name, imageUrl, imagePath, onClick, campaignName }) {
    const keyboardProps = onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            },
        }
        : {}
    const src = imagePath || imageUrl
    return (
        <div className="npc-avatar" onClick={onClick} {...keyboardProps}>
            {src ? (
                <AvatarImage name={name} imagePath={src} campaignName={campaignName} size={150} />
            ) : (
                <span>{name ? name.charAt(0).toUpperCase() : '?'}</span>
            )}
        </div>
    )
}

export default NpcAvatar
