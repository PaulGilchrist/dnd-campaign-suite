import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../ui/logService.js'

// CLA-360: Thief's Reflexes (Rogue/Thief 2024) — take two turns in the first
// round of combat, the second at initiative − 10. Produces the second
// combatSummary entry; consumers (initiative walk, round wrap, cards) resolve
// the holder's real state via holderName. The name is suffixed (NOT a duplicate
// of the holder's) because navigationHandlers.getNextCreatureName, the
// turn-start gate key and React card keys all look creatures up by name — a
// duplicate name would make the Next-walk bounce back past the extra entry and
// collide card keys.
const SECOND_TURN_SUFFIX = ' (Second Turn)'
// Matches automationInfoBuilder/diverse.js: feature.name.toLowerCase() + 'Uses'.
const DEFAULT_RESOURCE_KEY = "thief'sreflexesUses"

function findThiefsReflexesAutomation(characters, characterName) {
    for (const ch of (characters || [])) {
        if (ch?.name !== characterName && ch?.computedStats?.name !== characterName) continue
        const stats = ch.computedStats || ch
        // The extra_action info lands under automation.actions (the diverse info
        // builder omits casting_time, so the router never sees 'passive').
        const buckets = [...(stats?.automation?.actions || []), ...(stats?.automation?.specialActions || [])]
        return buckets.find(a => a && a.type === 'extra_action' && a.firstRoundOnly) || null
    }
    return null
}

function resyncExistingSecondTurn(combatSummary, existing, init) {
    const wanted = String(init - 10)
    if (existing.initiative !== wanted) {
        existing.initiative = wanted
        combatSummary.creatures.sort((a, b) => b.initiative - a.initiative)
    }
    return false
}

function findHolderEntry(combatSummary, characterName) {
    const entry = combatSummary.creatures.find(c => c.type === 'player' && c.name === characterName)
    if (!entry || entry.initiative === '' || entry.initiative == null) return null
    const init = Number(entry.initiative)
    return Number.isFinite(init) ? init : null
}

function remainingTurns(characterName, resourceKey, usesMax, campaignName) {
    const uses = Number(getRuntimeValue(characterName, resourceKey, campaignName) ?? usesMax)
    return uses
}

/**
 * At initiative roll/set for round 1, grants the holder a second combatSummary
 * entry at initiative − 10, spends the feature use and logs an ability_use.
 * Mutates combatSummary in place (callers persist it). Idempotent: a repeated
 * initiative edit only re-syncs the second entry's initiative, never re-spends.
 * Returns true when a new second-turn entry was granted.
 */
export function maybeGrantThiefsReflexesSecondTurn(combatSummary, characterName, campaignName, characters) {
    if (!combatSummary?.creatures) return false
    if ((combatSummary.round ?? 1) !== 1) return false
    if (typeof characterName !== 'string' || characterName.endsWith(SECOND_TURN_SUFFIX)) return false
    const init = findHolderEntry(combatSummary, characterName)
    if (init === null) return false

    const secondName = `${characterName}${SECOND_TURN_SUFFIX}`
    const existing = combatSummary.creatures.find(c => c.name === secondName)
    if (existing) return resyncExistingSecondTurn(combatSummary, existing, init)

    const auto = findThiefsReflexesAutomation(characters, characterName)
    if (!auto) return false
    const resourceKey = auto.resourceKey || DEFAULT_RESOURCE_KEY
    const uses = remainingTurns(characterName, resourceKey, auto.uses || 1, campaignName)
    if (uses <= 0) return false

    combatSummary.creatures.push({
        name: secondName,
        type: 'player',
        initiative: String(init - 10),
        targetName: null,
        concentration: null,
        secondTurn: true,
        holderName: characterName,
    })
    combatSummary.creatures.sort((a, b) => b.initiative - a.initiative)

    setRuntimeValue(characterName, resourceKey, uses - 1, campaignName)
    const featureName = auto.name || "Thief's Reflexes"
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: featureName,
        description: `${characterName} used ${featureName}: gained a second turn at initiative ${init - 10} (${init} − 10) in round 1.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[thiefsReflexesService:log-error]', e) })
    return true
}

export function isSecondTurnEntry(creature) {
    return !!creature?.secondTurn
}
