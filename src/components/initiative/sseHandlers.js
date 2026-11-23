import { cloneDeep } from 'lodash'
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getActiveCreatureName, getCombatSummary, setCombatSummaryCache } from '../../services/encounters/combatData.js'
import { sortCreaturesForBoard } from '../../services/combat/creaturePresence.js'
import { expireStaleEffects, applyTurnStartEffects, applyTurnEndConditionRemoval } from '../../services/rules/effects/expirations.js'
import { applyCommanderStrikeTurnEnd } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js'
import { isSecondTurnEntry } from '../../services/combat/thiefsReflexesService.js'

/**
 * SSE overlay event handler - manages spell-overlay events
 */
export function createOverlayHandler(campaignName) {
    return function handleOverlayEvent(event, setOverlays) {
        if (!event || !event.key || !event.key.startsWith('spell-overlay-')) return
        if (event.key !== `spell-overlay-${campaignName}`) return
        const { action, overlays: newOverlays, overlayId } = event.data || {}
        switch (action) {
            case 'add':
                if (newOverlays?.length) {
                    setOverlays(prev => {
                        const existingIds = new Set(prev.map(o => o.id))
                        const unique = newOverlays.filter(n => !existingIds.has(n.id))
                        return unique.length ? [...prev, ...unique] : prev
                    })
                }
                break
            case 'update':
                if (newOverlays?.length) {
                    setOverlays(prev => prev.map(o => {
                        const replacement = newOverlays.find(n => n.id === o.id)
                        return replacement || o
                    }))
                }
                break
            case 'remove':
                if (overlayId) {
                    setOverlays(prev => prev.filter(o => o.id !== overlayId))
                }
                break
            case 'clear':
                setOverlays([])
                break
            default:
                break
        }
    }
}

/**
 * Main SSE event handler - processes change-{campaignName}-* events
 */
export function createSseEventHandler({
    campaignName,
    characters,
    isLocalhost = false,
    combatSummaryRef,
    activeCreatureNameRef,
    lastAppliedTurnStartCreatureRef,
    lastExpirySweepCreatureRef = { current: null },
    setCombatSummary,
    setCombatSummaryG,
    setActiveCreatureNameG,
    setRuntimeStateTick,
    setOverlays,
    handleOverlayEvent,
}) {
    async function handleCombatSummaryChange(data) {
        // Cleared-key echo (admin clear-change-data / full-reset publish
        // change-<c>-combatSummary:null — campaigns-admin.js — and the wildcard
        // key DELETE publishes null the same way): the server board is GONE.
        // Retire the mounted board exactly like the companion spell-overlay
        // {action:'clear'} retires mounted map geometry. Nulling the state
        // renders the "No one is on the initiative board yet" empty state;
        // nulling the refs and evicting the module cache makes the stale board
        // un-POSTable — pre-fix the dispatcher dropped this echo, the board
        // kept rendering, and the next Next/Prev turn-walk re-persisted the
        // whole cleared combatSummary (admin clear silently undone).
        // ZERO writes on this lane — a retirement must not re-create any
        // cleared key. The raw setter guarantees the state retires even when
        // the equality guard's ref never saw a board (the mount merge adopts
        // via the raw setter, and valuesEqual(undefined, null) is true, which
        // would otherwise swallow the first guarded null); the guarded setter
        // keeps the guard ref in sync so a byte-identical re-seed board echoed
        // later is still adopted (raw-only would leave the guard holding the
        // old board and silently skip it, parking the tab on the empty state).
        if (data === null) {
            combatSummaryRef.current = null
            activeCreatureNameRef.current = null
            lastAppliedTurnStartCreatureRef.current = null
            lastExpirySweepCreatureRef.current = null
            setCombatSummaryCache(null, campaignName)
            setCombatSummary(null)
            setCombatSummaryG(null)
            setActiveCreatureNameG(null)
            return
        }
        if (!data?.creatures) return
        const merged = cloneDeep(data)
        if (!merged.activeCreatureName) {
            const activeName = getActiveCreatureName(campaignName)
            if (activeName) {
                merged.activeCreatureName = activeName
            }
        }
        const prevRound = combatSummaryRef.current?.round ?? 1
        if (merged.round < prevRound) {
            return
        }
        // FW 2026-11-09 improve (board-order law): the card row IS the turn
        // tracker, so an adopted board must render in the order the Next-walk
        // steps through. Order is decided ONCE here at the adoption seam with the
        // SAME authoritative sort the mount merge uses (initiativeService
        // mergeCombatSummaryWithCharacters → sortCreaturesForBoard: present-first,
        // initiative DESC, blank = −1, ties name-asc). Before this, a full-store
        // cs POST onto a settled tab stored the POSTed array order while the
        // mount-merged mirrors walked initiative-DESC — the pointer visibly
        // skipped a card drawn between two others. View (displayCreatures) and
        // walker (getNextCreatureName) read this one array, so no second sort
        // exists to diverge from.
        if (Array.isArray(merged.creatures)) {
            sortCreaturesForBoard(merged)
        }
        combatSummaryRef.current = merged
        setCombatSummaryCache(merged, campaignName)
        setCombatSummaryG(merged)
        // No expiry sweep on the combatSummary echo (bug-turn-start-zone-saves-
        // double-arm-via-echo-mirror): the branch that used to live here compared
        // merged.round against combatSummaryRef.current AFTER :94 overwrote the ref
        // with merged — provably dead, it could never fire. The echo-side expiry
        // sweep is owned DELIBERATELY by the activeCreatureName echo lane in
        // applyEchoBoundaryPasses, deduped against the GM tab's own local sweep by
        // the round-scoped lastExpirySweepCreatureRef gate. A round wrap always
        // walks the turn onto a new creature, so its sweep rides that lane.
    }

    // Only apply turn-start effects when the active creature actually changes.
    // The dedupe key is round-scoped so effects re-apply each new round.
    // GM-authority guard: bug-turn-start-automation-double-fires-with-second-client —
    // the GM's Next click POSTs the new activeCreatureName BEFORE its stamped
    // combatSummary lands, so every other client's SSE echo passed its own
    // (stale) round gate and ran the whole turn-start pass — duplicating
    // non-idempotent effects once per viewing client and letting visitor
    // devices POST GM-authority keys (__initiative__ gate stamps, character
    // buckets, log rows). Visitors still mirror the boundary + adopt the
    // executor's effect writes via the ordinary SSE lanes. Same GM/localhost
    // ownership guard idiom as createCreatureHandlers/createAutoBreakConditionHandler.
    async function applyTurnStartPass(newActive, gateKey) {
        if (!isLocalhost) return
        lastAppliedTurnStartCreatureRef.current = gateKey
        setRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature', gateKey, campaignName)
        const cs = combatSummaryRef.current
        if (cs) {
            cs.lastAppliedTurnStartCreature = gateKey
            setCombatSummaryCache(cs, campaignName)
            setCombatSummary(cloneDeep(cs))
        }
        const newActiveChar = characters.find(ch => ch.name === newActive || ch.name.startsWith(newActive + ' '))
        await applyTurnStartEffects(newActive, newActiveChar?.computedStats || newActiveChar, campaignName, characters)
        // Effects may have persisted damaged copies (e.g. aura damage) —
        // adopt the cache so the UI and any follow-up writes carry the damage.
        const afterEffects = getCombatSummary(campaignName)
        if (afterEffects && afterEffects !== combatSummaryRef.current) {
            combatSummaryRef.current = afterEffects
            setCombatSummary(cloneDeep(afterEffects))
        }
        setRuntimeStateTick(t => t + 1)
    }

    // Turn-boundary mirror for the activeCreatureName echo, extracted to keep the
    // dispatch handler inside the complexity ceiling.
    // CLA-360 ST-seam law (mirrors the walk gate in navigationHandlers and the
    // holder resolution in assertCanAct.js readActiveCreature): a (Second Turn)
    // row never receives turn-start/expiry echo passes — the holder's own passes
    // fired at the holder seam and resolving the twin here would double-tick.
    // Without this guard the echo's expireStaleEffects mirror read seeds a
    // phantom `<Holder> (Second Turn)` char bucket ({pendingExpirations:[]}) on
    // every mounted client (phantom-bucket family 583d078ff/930393775/d55d4160a)
    // and a second GM tab can re-stamp the round gate under the synthetic label.
    async function applyEchoBoundaryPasses(prevActive, newActive, cs) {
        const echoRow = Array.isArray(cs?.creatures)
            ? cs.creatures.find(c => c && c.name === newActive)
            : null
        const secondTurnEcho = isSecondTurnEntry(echoRow)
        // BUG CLA-307: mirror the owner turn-END pass for the OUTGOING creature
        // (Self-Restoration condition_removal). skipSync=true — the GM client already
        // POSTed the removal; re-POSTing here would SSE-echo-loop.
        if (prevActive && prevActive !== newActive) {
            const outgoingChar = characters.find(ch => ch.name === prevActive || ch.name.startsWith(prevActive + ' '))
            applyTurnEndConditionRemoval(prevActive, outgoingChar?.computedStats || outgoingChar, campaignName, true)
                .catch((e) => { console.error('[sseHandlers] CLA-307 turn-end removal failed:', e) })
            // MN-003: mirror the outgoing-creature Commander's Strike lapse clear
            // (skipSync=true — GM client already POSTed; re-POST would echo-loop).
            applyCommanderStrikeTurnEnd(campaignName, prevActive, true)
                .catch((e) => { console.error('[sseHandlers] MN-003 commander strike turn-end lapse failed:', e) })
        }
        // Expiry-sweep dedupe (bug-turn-start-zone-saves-double-arm-via-echo-mirror):
        // the GM tab's OWN activeCreatureName echo re-enters this seam right after
        // handleNextCreature already ran expireStaleEffects synchronously — every
        // zone carrier (Grease/Sleet/Stinking Cloud/Web, Phases 3–6) then armed its
        // recurring turn-start save a second time per Next press. Same round-scoped
        // dedupe doctrine as the turn-start pass below: the local Next/Prev handlers
        // stamp lastExpirySweepCreatureRef before POSTing the name, so only the first
        // client to reach a seam this round sweeps. The stamp is written SYNCHRONOUSLY
        // before the async sweep so the echo can never slip past mid-flight. Visitors
        // keep mirroring the sweep: the ref is page-local (never persisted/hydrated),
        // so their fresh gate always differs — byte-identical to the CLA doctrine that
        // kept visitor mirror lanes untouched.
        const gateRound = (combatSummaryRef.current || getCombatSummary(campaignName))?.round ?? 1
        const gateKey = `${gateRound}:${newActive}`
        if (!secondTurnEcho && lastExpirySweepCreatureRef.current !== gateKey) {
            lastExpirySweepCreatureRef.current = gateKey
            expireStaleEffects(campaignName, newActive)
        }
        if (prevActive !== newActive && !secondTurnEcho && lastAppliedTurnStartCreatureRef.current !== gateKey) {
            await applyTurnStartPass(newActive, gateKey)
        }
    }

    async function handleActiveCreatureNameChange(newActive) {
        // bug-zero-creature-initiative-null-name: a malformed object echo (e.g. a
        // legacy {} stored under this key) must never poison the round gate with
        // "[object Object]" or crash expireStaleEffects' toLowerCase. null/
        // undefined are legitimate "no active creature" sentinels — the dispatch
        // above drops them for every key except the combatSummary cleared-key
        // lane — so only truthy non-strings are rejected here.
        if (newActive && typeof newActive !== 'string') {
            console.error('[sseHandlers] Ignoring malformed activeCreatureName echo:', newActive)
            return
        }
        const prevActive = activeCreatureNameRef.current
        activeCreatureNameRef.current = newActive
        const cs = combatSummaryRef.current || getCombatSummary(campaignName)
        if (cs) {
            cs.activeCreatureName = newActive
            setCombatSummaryCache(cs, campaignName)
        }
        setActiveCreatureNameG(newActive)
        await applyEchoBoundaryPasses(prevActive, newActive, cs)
    }

    const noop = async () => {}
    // Ordered dispatch table — evaluation order mirrors the original if/else chain.
    const dataKeyHandlers = {
        combatSummary: handleCombatSummaryChange,
        // lastAttack is now a root-level key — no in-memory cache needed
        lastAttack: noop,
        activeCreatureName: handleActiveCreatureNameChange,
    }

    return async function handleEvent(event) {
        if (event.key == null) return
        // A null payload on the combatSummary key is the cleared-key broadcast —
        // let exactly that one through to the retirement branch above (mirror of
        // the root-Subscriber discriminator in App.jsx handleRuntimeEvent). Every
        // other null stays dropped: the stored activeCreatureName null is the
        // per-board "no active creature" sentinel (bug-zero-creature-initiative-
        // null-name — passing it would run the echo seam on a null and crash
        // expireStaleEffects), and character-bucket nulls are already mirrored
        // into the campaign store by the root App subscriber.
        if (event.data == null && event.key !== `change-${campaignName}-combatSummary`) return

        if (event.key.startsWith('spell-overlay-')) {
            // Thread the owner's setter (Initiative.jsx passes setOverlays here) —
            // calling handleOverlayEvent without it threw "setOverlays is not a
            // function" on the add/update/remove/clear branches (swallowed by
            // sseClient's per-handler try/catch as "[SSE] handler error:"), so
            // Initiative-lane overlay state never synced while the board was open.
            handleOverlayEvent(event, setOverlays)
            return
        }

        if (!event.key.startsWith(`change-${campaignName}-`)) return

        const dataKey = event.key.slice(`change-${campaignName}-`.length)
        const handler = Object.hasOwn(dataKeyHandlers, dataKey) ? dataKeyHandlers[dataKey] : null
        if (handler) {
            await handler(event.data)
        } else if (!['log', 'spell-overlay'].includes(dataKey)) {
            // Any character-level change triggers a re-render
            setRuntimeStateTick(t => t + 1)
        }
    }
}
