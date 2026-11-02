// GM-only "Allies…" trigger on initiative cards (Phase 3.2). Self-gates to
// keep CreatureCard within the complexity ratchet (unconditional element,
// zero branches in the parent). Opens the shared AllySelectionModal via the
// container's useAllyEditor hook — allegiance stays one model (D4).

export default function AlliesButton({ creature, isLocalhost, onEditAllies }) {
    if (!isLocalhost || !onEditAllies) return null
    return (
        <button
            className='allies-edit-btn'
            onClick={() => onEditAllies(creature)}
            type='button'
            title={`Edit the ally list of ${creature.name} (who they protect, share auras with, and never auto-target)`}
            aria-label={`Edit allies of ${creature.name}`}
        >
            <i className='fa-solid fa-handshake'></i> Allies
        </button>
    )
}
