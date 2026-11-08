import React from 'react'
import PartyPresenceModal from './PartyPresenceModal.jsx'

/**
 * Toolbar host for the split-party modal (plan initiative-split-party): a
 * GM-only button in the initiative control row opening the picker. Open state
 * is ephemeral UI-local (never the runtime store); every applied change flows
 * through createCreatureHandlers.handlePartyPresenceChange.
 */
export default function PartyPresenceButton({ creatures, onConfirm }) {
    const [open, setOpen] = React.useState(false)
    const players = creatures.filter(c => c.type === 'player')
    const awayCount = players.filter(p => p.away === true).length
    return (
        <>
            <button
                type="button"
                className={`split-party-button${awayCount ? ' split-party-button-active' : ''}`}
                onClick={() => setOpen(true)}
                title="Split party — choose which heroes are with the encounter"
            >
                <i className="fa-solid fa-people-arrows"></i> Split Party
                {awayCount > 0 && <span className="split-party-count">{awayCount} away</span>}
            </button>
            {open && (
                <PartyPresenceModal
                    players={players}
                    onConfirm={(presenceByName) => { setOpen(false); onConfirm(presenceByName) }}
                    onCancel={() => setOpen(false)}
                />
            )}
        </>
    )
}
