import React from 'react'
import { useMonstersData } from '../../hooks/ui/useMonstersData.js'
import { useOverlayEntranceFocus } from '../../hooks/ui/useOverlayEntranceFocus.js'
import * as mapsService from '../../services/maps/mapsService.js'
// Reuse, never re-implement (roadmap Item 4): the tracker picker narrows the
// bestiary through the SAME pure helpers the Encounter Builder uses —
// name/type/subtype search, inclusive CR parsing and the bounded un-narrowed
// render cap all live in services/encounters/monsterBestiarySearch.js.
import { filterMonsters, isBestiaryNarrowed, capBestiaryRows, compareMonsters } from '../../services/encounters/monsterBestiarySearch.js'
import './QuickMonsterSpawn.css'

// Quick mob spawn (roadmap Item 4, 2026-11-19): "+ Monster" next to "+ NPC" on
// the initiative tracker. Type a published monster's name, pick the row, set a
// quantity, Spawn — N initiative-ready cards with the monster's REAL stat block
// and art arrive through the encounter→initiative join lane (parent handler →
// quickMonsterSpawn → addMonstersToInitiative). "5 goblins at the door" is two
// clicks after opening (row + Spawn; the query and the qty field are typed).
// Zero writes to npcs.json (bestiary-name invariant), and the whole flow works
// with NO active map — the cards arm targets through the tracker's own Target
// select and run their full stat block via the avatar modal.
//
// The open flag is per-client presentation (showModal category — local state
// law), never the runtime store. Escape closes (EffectAdder convention).
//
// Map-token opt-in (2026-11-20 CCC backlog): when an INDOOR map is ACTIVE
// (`mapName`, the App activeMapName prop the Initiative host already threads),
// the picker offers "Place a token near the party on the map" — default OFF
// (opt-in, mirroring the qty field's conservative default). With no active map
// the affordance never renders and the flow is byte-identical to before. The
// stamp itself is owned by services/encounters/quickMonsterSpawn.js.
//
// Outdoor gate (2026-11-21 DDD backlog): placedItems tokens only exist on
// indoor grid maps, so with an ACTIVE OUTDOOR map the checkbox is ABSENT too
// (same face as the no-map law) — the producer-side skip is loud but
// console-only, and a checkbox that silently no-ops is a lie. The type comes
// from the maps LIST lane (it carries `type` precisely so metadata renders
// never fetch whole documents — server maps.js list comment); any unresolved
// or failed type fetch fails CLOSED to absent (the producer's defensive
// outdoor guard stays the backstop lane).
function useActiveMapType(campaignName, mapName) {
    const [mapType, setMapType] = React.useState(null)
    React.useEffect(() => {
        if (!mapName) {
            setMapType(null)
            return
        }
        let live = true
        mapsService.loadMaps(campaignName).then(
            (data) => {
                if (!live) return
                const entry = (data.maps || []).find(m => m.slug === mapName || m.name === mapName)
                setMapType(entry?.type || null)
            },
            () => { if (live) setMapType(null) },
        )
        return () => { live = false }
    }, [campaignName, mapName])
    return mapType
}

function MonsterPickerModal({ onClose, onSpawn, mapName, campaignName }) {
    const { monsters, loading } = useMonstersData()
    const [searchQuery, setSearchQuery] = React.useState('')
    const [selected, setSelected] = React.useState(null)
    const [qty, setQty] = React.useState('1')
    const [placeToken, setPlaceToken] = React.useState(false)
    const [error, setError] = React.useState('')
    const [spawning, setSpawning] = React.useState(false)
    const activeMapType = useActiveMapType(campaignName, mapName)
    // Entrance focus + stranded-close restore (shared overlay hook).
    const overlayRef = React.useRef(null)
    useOverlayEntranceFocus(overlayRef)

    // Escape closes from anywhere in the modal (benign UI dismissal, mirrors
    // EffectAdder; nothing has been written until the Spawn press).
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    const narrowed = isBestiaryNarrowed({ searchQuery })

    const visibleMonsters = React.useMemo(() => {
        const filtered = filterMonsters(monsters, { searchQuery })
        filtered.sort((a, b) => compareMonsters(a, b, 'name', 'asc', selected ? [selected] : []))
        const capped = capBestiaryRows(filtered, selected ? [selected] : [], narrowed)
        return { capped, hiddenCount: filtered.length - capped.length }
    }, [monsters, searchQuery, selected, narrowed])

    const count = Math.max(1, parseInt(qty, 10) || 1)

    const handleSelect = (monster) => {
        setSelected(monster)
        setError('')
    }

    const handleSpawn = async () => {
        if (!selected || spawning) return
        setSpawning(true)
        const spawned = await onSpawn(selected, count, { placeToken })
        setSpawning(false)
        // Failure keeps the picker open for an honest retry; the parent handler
        // already named the failure in a toast + console.
        if (spawned) onClose()
        else setError(`Spawn failed — ${selected.name} never reached the board. Try again.`)
    }

    return (
        <div className='qms-overlay' ref={overlayRef} role='dialog' aria-modal='true' aria-labelledby='qms-title'>
            <div className='qms-modal'>
                <h3 id='qms-title'>
                    <i className='fa-solid fa-dragon' aria-hidden='true'></i> Spawn monsters
                </h3>
                {loading && (
                    <div className='qms-note'>
                        <i className='fa-solid fa-spinner fa-spin' aria-hidden='true'></i> Loading bestiary...
                    </div>
                )}
                {!loading && (
                    <>
                        <input
                            type='text'
                            className='qms-search'
                            placeholder='Search by name, type, or subtype...'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label='Search monsters'
                        />
                        <div className='qms-scroll'>
                            {visibleMonsters.capped.map(monster => (
                                <button
                                    type='button'
                                    key={monster.index}
                                    className={`qms-row${selected?.index === monster.index ? ' qms-row--selected' : ''}`}
                                    aria-pressed={selected?.index === monster.index}
                                    onClick={() => handleSelect(monster)}
                                >
                                    <span className='qms-row-name'>{monster.name}</span>
                                    <span className='qms-row-meta'>
                                        CR {monster.challenge_rating ?? 'None'} · {monster.type}
                                    </span>
                                </button>
                            ))}
                            {visibleMonsters.capped.length === 0 && (
                                <div className='qms-note'>
                                    <i className='fa-solid fa-search' aria-hidden='true'></i> No monsters found
                                </div>
                            )}
                            {visibleMonsters.hiddenCount > 0 && (
                                <div className='qms-note qms-cap-notice' data-testid='qms-cap-notice'>
                                    Showing first {visibleMonsters.capped.length} of {visibleMonsters.capped.length + visibleMonsters.hiddenCount} — type to narrow
                                </div>
                            )}
                        </div>
                        {error && <div className='qms-error' role='alert'>{error}</div>}
                        <div className='qms-controls'>
                            <label className='qms-qty-label' htmlFor='qms-qty'>
                                Qty&nbsp;
                                <input
                                    id='qms-qty'
                                    className='qms-qty'
                                    type='number'
                                    min='1'
                                    step='1'
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    disabled={!selected}
                                />
                            </label>
                            <button
                                type='button'
                                className='qms-spawn-btn'
                                onClick={handleSpawn}
                                disabled={!selected || spawning}
                            >
                                <i className='fa-solid fa-skull' aria-hidden='true'></i>
                                {selected ? ` Spawn ${count}× ${selected.name}` : ' Spawn'}
                            </button>
                            <button type='button' className='qms-cancel-btn' onClick={onClose}>Cancel</button>
                        </div>
                        {mapName && activeMapType === 'indoor' && (
                            <label className='qms-token-label' htmlFor='qms-place-token'>
                                <input
                                    id='qms-place-token'
                                    type='checkbox'
                                    checked={placeToken}
                                    onChange={(e) => setPlaceToken(e.target.checked)}
                                />
                                Place a token near the party on the map
                            </label>
                        )}
                        <p className='qms-hint'>
                            Real stat block and art from the bestiary — nothing is saved to the
                            NPCs list, and combat runs entirely in the tracker: no map required.
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}

export default function QuickMonsterSpawn({ onSpawn, mapName, campaignName }) {
    const [open, setOpen] = React.useState(false)
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                title='Search the bestiary and spawn N instances with real stats and initiative rolled — works without a map; nothing is written to the NPCs list'
            >+ Monster</button>
            {open && <MonsterPickerModal onClose={() => setOpen(false)} onSpawn={onSpawn} mapName={mapName} campaignName={campaignName} />}
        </>
    )
}
