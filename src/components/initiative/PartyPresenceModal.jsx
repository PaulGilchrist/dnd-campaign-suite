import React from 'react'
import './PartyPresenceModal.css'

/**
 * Split-party tracker UI (plan initiative-split-party). A ticked box means the
 * PC is PRESENT with the encounter; unticking marks them away — their card
 * greys out, parks at the back of the board with no initiative slot, is
 * skipped by turn navigation, and disappears from target lists. Unticking an
 * away PC rejoins them, automatically landing at the end-of-round initiative
 * (the lowest present roll) — the GM can still edit the card input or let the
 * player roll. The write + audit lane lives in createCreatureHandlers
 * (handlePartyPresenceChange), shared with the per-card toggle button.
 */
export default function PartyPresenceModal({ players, onConfirm, onCancel }) {
    const [present, setPresent] = React.useState(() =>
        new Set(players.filter(p => p.away !== true).map(p => p.name))
    )

    const togglePlayer = (name) => {
        setPresent(prev => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    const confirm = () => {
        const presenceByName = {}
        for (const player of players) presenceByName[player.name] = !present.has(player.name)
        onConfirm(presenceByName)
    }

    const awayCount = players.length - present.size

    return (
        <div className="sp-overlay" role="dialog" aria-label="Split party">
            <div className="sp-modal party-presence-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-people-arrows"></i> Split Party
                </div>
                <div className="sp-body">
                    <p className="sp-note">
                        Tick who is with the encounter. Away heroes skip initiative
                        and cannot be targeted; rejoining lands them at the end of
                        the current round.
                    </p>
                    <div className="ally-selection-controls">
                        <button type="button" className="ally-select-btn" onClick={() => setPresent(new Set(players.map(p => p.name)))}>
                            <i className="fa-solid fa-check-double"></i> All Present
                        </button>
                        <button type="button" className="ally-select-btn" onClick={() => setPresent(new Set())}>
                            <i className="fa-solid fa-xmark"></i> All Away
                        </button>
                        <span className="ally-count">{awayCount} away</span>
                    </div>
                    <div className="secondary-target-list">
                        {players.map(player => {
                            const isPresent = present.has(player.name)
                            return (
                                <label
                                    key={player.name}
                                    className={`secondary-target-row ${isPresent ? '' : 'party-presence-row-away'}`}
                                >
                                    <input
                                        type="checkbox"
                                        aria-label={`Keep ${player.name} present`}
                                        checked={isPresent}
                                        onChange={() => togglePlayer(player.name)}
                                    />
                                    <span className="secondary-target-name">
                                        <strong>{player.name}</strong>
                                        {player.initiative !== '' && player.initiative != null && (
                                            <span className="secondary-target-size"> (Init {player.initiative})</span>
                                        )}
                                        {!isPresent && (
                                            <span className="party-presence-away-tag">
                                                <i className="fa-solid fa-person-walking"></i> away
                                            </span>
                                        )}
                                    </span>
                                </label>
                            )
                        })}
                        {players.length === 0 && (
                            <p className="sp-note">No players on the initiative board.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-roll-btn" onClick={confirm} type="button" disabled={players.length === 0}>
                        <i className="fa-solid fa-people-arrows"></i> Apply
                    </button>
                    <button className="sp-dismiss-btn" onClick={onCancel} type="button">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
