import { cloneDeep } from 'lodash'
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getActiveCreatureName, getCombatSummary, setCombatSummaryCache } from '../../services/encounters/combatData.js'
import { expireStaleEffects, applyTurnStartEffects, applyTurnEndConditionRemoval } from '../../services/rules/effects/expirations.js'
import { applyCommanderStrikeTurnEnd } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js'

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
    setCombatSummary,
    setCombatSummaryG,
    setActiveCreatureNameG,
    setRuntimeStateTick,
    setOverlays,
    handleOverlayEvent,
}) {
    async function handleCombatSummaryChange(data) {
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
        combatSummaryRef.current = merged
        setCombatSummaryCache(merged, campaignName)
        setCombatSummaryG(merged)
        if (merged.round !== (combatSummaryRef.current?.round ?? 1)) {
            expireStaleEffects(campaignName, merged.activeCreatureName || null)
        }
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

    async function handleActiveCreatureNameChange(newActive) {
        // bug-zero-creature-initiative-null-name: a malformed object echo (e.g. a
        // legacy {} stored under this key) must never poison the round gate with
        // "[object Object]" or crash expireStaleEffects' toLowerCase. null/
        // undefined are legitimate "no active creature" sentinels — the dispatch
        // above already drops them (event.data == null) — so only truthy
        // non-strings are rejected here.
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
        expireStaleEffects(campaignName, newActive)

        const gateRound = (combatSummaryRef.current || getCombatSummary(campaignName))?.round ?? 1
        const gateKey = `${gateRound}:${newActive}`
        const shouldApply = prevActive !== newActive && lastAppliedTurnStartCreatureRef.current !== gateKey
        if (shouldApply) {
            await applyTurnStartPass(newActive, gateKey)
        }
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
        if (event.key == null || event.data == null) return

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
