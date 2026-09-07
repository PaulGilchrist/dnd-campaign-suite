import { cloneDeep } from 'lodash'
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { getNextCreatureName, getPreviousCreatureName } from '../../services/encounters/initiativeService.js'
import { clearPerRoundMajestyTrackers } from '../../services/combat/auras/unbreakableMajesty.js'
import { expireStaleEffects, applyTurnStartEffects, applyTurnEndConditionRemoval } from '../../services/rules/effects/expirations.js'
import { applySleepTurnEnd } from '../../services/rules/features/sleepService.js'
import { applyStinkingCloudTurnEnd } from '../../services/automation/handlers/spells/stinkingCloudHandler.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'

// Turn-start effects must re-apply each round, so the dedupe key is round-scoped.
function turnStartGateKey(round, creatureName) {
    return `${round}:${creatureName}`
}

/**
 * Creates the handleNextCreature handler.
 */
export function createNextCreatureHandler({
    combatSummaryRef,
    activeCreatureName,
    campaignName,
    characters,
    roundRef,
    lastAppliedTurnStartCreatureRef,
    setCombatSummary,
    setActiveCreatureName,
    setRuntimeStateTick,
}) {
    return async function handleNextCreature() {
        const cs = combatSummaryRef.current
        if (!cs) return
        const { newActiveName, roundIncrement } = getNextCreatureName(cs, activeCreatureName)
        // Round-wrap-only work: bump the round counter and clear per-round trackers.
        const roundToSet = (roundRef.current ?? 1) + (roundIncrement ? 1 : 0)
        const updatedSummary = cloneDeep(cs)
        if (roundIncrement) {
            updatedSummary.round = roundToSet
            setCombatSummary(updatedSummary)
            for (const creature of cs.creatures) {
                clearPerRoundMajestyTrackers(creature.name, campaignName)
                if (creature.type === 'player') {
                    setRuntimeValue(creature.name, '_cunningStrikeCostUsed', 0, campaignName)
                    setRuntimeValue(creature.name, '_CunningStrike_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Charge_Attack_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_FastHands_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_CunningAction_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Cleave_UsedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Nick_UsedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_PsychicBlade_attack_round', null, campaignName)
                    setRuntimeValue(creature.name, '_PsychicBlade_secondBlade_round', null, campaignName)
                    setRuntimeValue(creature.name, '_Retaliation_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_ShadowyDodge_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_ShadowyDodge_appliedAttack', null, campaignName)
                    setRuntimeValue(creature.name, '_Slow_Fall_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Stones_Endurance_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Riposte_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Riposte_appliedAttack', null, campaignName)
                    setRuntimeValue(creature.name, 'pendingRiposteDieValue', null, campaignName)
                    setRuntimeValue(creature.name, 'surgeUsedRound', null, campaignName)
                    setRuntimeValue(creature.name, 'illusoryRealityUsedRound', null, campaignName)
                    setRuntimeValue(creature.name, 'portentUsedThisTurn', null, campaignName)
                    setRuntimeValue(creature.name, 'psionicStrikeUsedThisTurn', null, campaignName)
                    setRuntimeValue(creature.name, '_BrutalStrike_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_fortifiedHealth_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, '_Shield_Bash_usedRound', null, campaignName)
                    setRuntimeValue(creature.name, 'piercerPunctureUsedThisTurn', null, campaignName)
                }
            }
        }
        storage.set('activeCreatureName', newActiveName, campaignName)
        setActiveCreatureName(newActiveName)
        // BUG CLA-307: run the OUTGOING owner's turn-END pass (Self-Restoration
        // condition_removal) BEFORE the new active creature's turn-start effects, so the
        // owner's Charmed/Frightened/Poisoned vanish at the end of their own turn, not at
        // their next turn start. Sync POST here (GM client is the writer of truth).
        if (activeCreatureName) {
            const outgoingChar = characters.find(ch => ch.name === activeCreatureName || ch.name.startsWith(activeCreatureName + ' '))
            applyTurnEndConditionRemoval(activeCreatureName, outgoingChar?.computedStats || outgoingChar, campaignName)
                .catch((e) => { console.error('[navigationHandlers] CLA-307 turn-end removal failed:', e) })
            // SP-107: staged Sleep targets repeat their WIS save at the end of their own turn —
            // success sheds Incapacitated, failure escalates to Unconscious for the duration.
            applySleepTurnEnd(campaignName, activeCreatureName)
                .catch((e) => { console.error('[navigationHandlers] SP-107 sleep turn-end save failed:', e) })
            // SP-111: Stinking Cloud Poisoned + action/bonus-action block last only
            // until the end of the OUTGOING creature's current turn.
            applyStinkingCloudTurnEnd(campaignName, activeCreatureName)
                .catch((e) => { console.error('[navigationHandlers] SP-111 stinking cloud turn-end cleanup failed:', e) })
        }
        expireStaleEffects(campaignName, newActiveName)
        // BUG CLA-198: turn-start effects must run for EVERY newly active creature, not just
        // the round-wrap creature at index 0 — owner-centric auras (Inner Radiance) tick on the
        // owner's own turn boundary. The round-scoped gate key keeps this to one application
        // per creature per round (mirrors the SSE echo path in sseHandlers.js).
        const gateKey = turnStartGateKey(roundToSet, newActiveName)
        const shouldApply = lastAppliedTurnStartCreatureRef.current !== gateKey
        let finalSummary = updatedSummary
        if (shouldApply) {
            lastAppliedTurnStartCreatureRef.current = gateKey
            setRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature', gateKey, campaignName)
            storage.set('lastAppliedTurnStartCreature', gateKey, campaignName)
            updatedSummary.lastAppliedTurnStartCreature = gateKey
            const newActiveChar = characters.find(ch => ch.name === newActiveName || ch.name.startsWith(newActiveName + ' '))
            await applyTurnStartEffects(newActiveName, newActiveChar?.computedStats || newActiveChar, campaignName, characters)
            // Turn-start effects may have persisted damaged copies to the cache —
            // persist the cache (round + damage) last so nothing stale overwrites it.
            finalSummary = getCombatSummary(campaignName) || updatedSummary
        }
        storage.set('combatSummary', finalSummary, campaignName)
        setCombatSummary(cloneDeep(finalSummary))
        if (shouldApply) {
            setRuntimeStateTick(t => t + 1)
        }
    }
}

/**
 * Creates the handlePreviousCreature handler.
 */
export function createPreviousCreatureHandler({
    combatSummaryRef,
    activeCreatureName,
    campaignName,
    characters,
    roundRef,
    lastAppliedTurnStartCreatureRef,
    setCombatSummary,
    setActiveCreatureName,
    setRuntimeStateTick,
    isPreviousDisabled,
}) {
    return async function handlePreviousCreature() {
        if (isPreviousDisabled) return
        const cs = combatSummaryRef.current
        if (!cs) return
        const { newActiveName, roundDecrement } = getPreviousCreatureName(cs, activeCreatureName)
        if (roundDecrement && (roundRef.current ?? 1) <= 1) return
        // Round-wrap-only work: decrement the round counter.
        const roundToSet = (roundRef.current ?? 1) - (roundDecrement ? 1 : 0)
        const updatedSummary = cloneDeep(cs)
        if (roundDecrement) {
            updatedSummary.round = roundToSet
            setCombatSummary(updatedSummary)
        }
        expireStaleEffects(campaignName, newActiveName)
        // BUG CLA-307: no turn-END pass here — rewinding is not a real turn end.
        // The owner's Self-Restoration removal already fired on the forward Next step
        // that passed this boundary; running it again on rewind would double-log.
        // BUG CLA-198: mirror the next-handler — turn-start effects run on every
        // turn step, deduped by the round-scoped gate key.
        const gateKey = turnStartGateKey(roundToSet, newActiveName)
        const shouldApply = lastAppliedTurnStartCreatureRef.current !== gateKey
        let finalSummary = updatedSummary
        if (shouldApply) {
            lastAppliedTurnStartCreatureRef.current = gateKey
            setRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature', gateKey, campaignName)
            storage.set('lastAppliedTurnStartCreature', gateKey, campaignName)
            updatedSummary.lastAppliedTurnStartCreature = gateKey
            const newActiveChar = characters.find(ch => ch.name === newActiveName || ch.name.startsWith(newActiveName + ' '))
            await applyTurnStartEffects(newActiveName, newActiveChar?.computedStats || newActiveChar, campaignName, characters)
            finalSummary = getCombatSummary(campaignName) || updatedSummary
        }
        storage.set('combatSummary', finalSummary, campaignName)
        setCombatSummary(cloneDeep(finalSummary))
        if (shouldApply) {
            setRuntimeStateTick(t => t + 1)
        }
        storage.set('activeCreatureName', newActiveName, campaignName)
        setActiveCreatureName(newActiveName)
        for (const creature of cs.creatures) {
            clearPerRoundMajestyTrackers(creature.name, campaignName)
        }
    }
}
