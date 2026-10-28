import { cloneDeep } from 'lodash'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { addEntry } from '../../services/ui/logService.js'
import { clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js'
import { clearCombat, setInitiative, renameNpc, setTarget, removeNpc, addNpc } from '../../services/encounters/initiativeService.js'
import { setSessionPhase } from '../../services/combat/sessionService.js'
import { autoAwardCombatRewards } from '../../services/items/autoRewardService.js'
import { maybeGrantThiefsReflexesSecondTurn } from '../../services/combat/thiefsReflexesService.js'
import { vanishSummonAtZeroHp } from '../../services/combat/summons/summonedCreatureService.js'
import { breakHypnoticPatternOnDamage } from '../../services/rules/features/hypnoticPatternService.js'
import { sweepNewCombatClocks } from '../../services/rules/effects/zoneDurationClock.js'

/**
 * Player HP edits live in the runtime store (server-first); a revival across 0
 * also clears the death-save state and any pending prompt.
 */
function writePlayerHp(creatureName, newValue, oldHp, campaignName) {
    setRuntimeValue(creatureName, 'currentHitPoints', newValue, campaignName)
    if (oldHp <= 0 && newValue > 0) {
        setRuntimeValue(creatureName, 'deathSaves', [false, false, false], campaignName)
        setRuntimeValue(creatureName, 'deathFailures', [false, false, false], campaignName)
        setRuntimeValue(creatureName, 'isDead', 0, campaignName)
        clearDeathSavePrompt(campaignName, creatureName)
    }
}

// Monster card HP ceiling: base maxHp + runtime Aid/Heroes-Feast increases
// (mirrors CreatureHp's effectiveMaxHp display). Null when the card carries no
// numeric max — bare placeholder rows (no maxHp) stay unclamped.
function monsterHpCap(creature) {
    const base = Number(creature.maxHp)
    if (!Number.isFinite(base)) return null
    const aid = Number(getRuntimeValue(creature.name, 'aidHpMaxIncrease')) || 0
    const feast = Number(getRuntimeValue(creature.name, 'heroesFeastHpMaxIncrease')) || 0
    return base + aid + feast
}

// bug-initiative-hp-input-no-range-clamp: monster commits clamp into
// [0, effective max]. Math.max(0, …) mirrors applyDamage's death floor, and
// currentHp <= 0 IS the app's monster death model (no separate dead flag).
// Max-edit payloads arrive pre-clamped by MaxHpInput against the NEW max, so
// the third-arg lane must not be re-clamped against the old cap. Players are
// never routed here (temp-HP overshoot is legitimate sheet state), and the
// clamp is UI-lane only: the server /combatSummary POST stays free-write
// for test rigs (playbook §124/§125 maxHp-stamp lanes).
function clampMonsterCommit(creature, committedHp, isMaxEdit) {
    if (isMaxEdit) return committedHp
    const cap = monsterHpCap(creature)
    if (cap == null) return committedHp
    return Math.max(0, Math.min(committedHp, cap))
}

// Threshold stamps mirror applyDamage's resolveHpThreshold/logDamageApplication
// (HpChangeEntry renders 'Defeated'/'Bloodied' from this byte).
function resolveOverrideThreshold(oldHp, newHp, maxHp) {
    if (oldHp > 0 && newHp <= 0) return 'dead'
    const half = Math.floor(maxHp / 2)
    if (oldHp > 0 && newHp > 0 && oldHp > half && newHp <= half) return 'bloodied'
    return null
}

/**
 * Audit channel for manual GM HP overrides (bug-initiative-hp-input-no-range-
 * clamp): every committed card edit writes an hp_change entry in the exact
 * damage/healing-lane shape (type/targetName/sourceName/delta/currentHp/
 * maxHp/isHealing/isUnconscious [+threshold]).
 */
function logManualHpOverride({ campaignName, creature, oldHp, newHp }) {
    const isPlayer = creature.type === 'player'
    const maxHp = isPlayer
        ? (getRuntimeValue(creature.name, 'hitPoints') ?? newHp)
        : creature.maxHp
    const delta = newHp - oldHp
    const entry = {
        type: 'hp_change',
        targetName: creature.name,
        sourceName: 'GM HP override',
        delta,
        currentHp: newHp,
        maxHp,
        isHealing: delta > 0,
        isUnconscious: !isPlayer && newHp <= 0,
        note: 'Manual GM edit from the initiative card.',
    }
    const threshold = resolveOverrideThreshold(oldHp, newHp, maxHp)
    if (threshold) entry.threshold = threshold
    addEntry(campaignName, entry)
        .catch((e) => { console.error('[handleCreatureHpChange] hp_change log failed:', e) })
}

/**
 * Creates creature operation handlers for the initiative component.
 */
export function createCreatureHandlers({
    combatSummary,
    campaignName,
    campaignNpcs,
    setNpcImages,
    overlays,
    setCombatSummary,
    setActiveCreatureName,
    characters,
    numOfNpc,
    isLocalhost,
}) {
    // SP-114: GM setting a spell-summon's HP to 0 makes it disappear.
    const writeNpcHp = function writeNpcHp(creature, newValue, oldHp, isMaxEdit, newMaxHp) {
        creature.currentHp = newValue
        if (isMaxEdit) creature.maxHp = newMaxHp
        if (oldHp > 0 && newValue <= 0 && creature.summonedBy && creature.summonSource === 'spell') {
            vanishSummonAtZeroHp(creature, combatSummary, campaignName)
        }
    }

    const handleCreatureHpChange = function handleCreatureHpChange(creatureName, committedHp, newMaxHp) {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature) return

        const isPlayer = creature.type === 'player'
        // #854: max-HP edits report (name, clampedCurrentHp, newBaseMax) from CreatureHp's
        // MaxHpInput — third arg present ⇒ base max is being re-stamped on the card.
        const isMaxEdit = typeof newMaxHp === 'number'
        const oldHp = isPlayer ? (getRuntimeValue(creature.name, 'currentHitPoints') ?? 0) : creature.currentHp
        // bug-initiative-hp-input-no-range-clamp: monsters clamp via clampMonsterCommit
        // (see helper); players stay UNCLAMPED (temp-HP overshoot is legitimate).
        const newValue = isPlayer ? committedHp : clampMonsterCommit(creature, committedHp, isMaxEdit)
        const delta = newValue - oldHp
        if (delta === 0 && !isMaxEdit) return

        // SP-069: a GM HP-input reduction is adjudicated damage — Hypnotic Pattern
        // ends for the affected creature if it takes any damage (per-creature, logged).
        // A max-HP edit clamping current down is NOT damage — skip the break lane.
        if (delta < 0 && !isMaxEdit) {
            breakHypnoticPatternOnDamage(creatureName, campaignName)
        }

        if (isPlayer) {
            writePlayerHp(creatureName, newValue, oldHp, campaignName)
        }
        else {
            writeNpcHp(creature, newValue, oldHp, isMaxEdit, newMaxHp)
        }
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        // Every automation must log: the manual override rides the hp_change
        // audit channel (repo rule; playbook §19 "judge by hp_change log delta").
        logManualHpOverride({ campaignName, creature, oldHp, newHp: newValue })
    }

    const handleClear = function handleClear() {
        if (window.confirm('Clear combat status for all creatures? This resets initiative and removes all monsters from the board. This action is irreversible.')) {
            // L5 §10.3: capture the closing roster BEFORE clear wipes it —
            // auto-rewards (flag-gated, off ⇒ zero writes) need the NPCs
            // that were on the tracker to compute loot + XP.
            const closingSummary = cloneDeep(combatSummary)
            const newSummary = clearCombat(characters, numOfNpc, (name) => name)
            storage.set('combatSummary', newSummary, campaignName)
            setCombatSummary(newSummary)
            // L5 §10.1: clearing combat returns the table to exploration.
            setSessionPhase({ campaignName, phase: 'exploration', changedBy: 'initiative tracker', reason: 'combat cleared' })
                .catch((e) => { console.error('[createCreatureHandlers] session phase exploration failed:', e) })
            const firstCreatureName = newSummary.creatures[0].name
            storage.set('activeCreatureName', firstCreatureName, campaignName)
            setActiveCreatureName(firstCreatureName)
            // CLA-100: Clear restarts combat (round back to 1) but preserves per-creature
            // runtime stores and dispatches no initiative-rolled event — reset the Dread
            // Ambush Ambusher's Leap once-per-combat latch so round-1 of the new
            // combat re-grants the speed_boost.
            for (const creature of newSummary.creatures) {
                if (creature.type === 'player') {
                    setRuntimeValue(creature.name, 'dreadAmbushSpeedActive', null, campaignName)
                }
            }
            // no-timers T4: Clear restarts combat — combat-scoped effects of
            // the old combat end here too (enforcement off ⇒ zero writes).
            sweepNewCombatClocks(campaignName)
                .catch((e) => { console.error('[handleClear:new-combat-sweep]', e) })
            // L5 §10.3: with enforcement.autoRewards on, the closed encounter
            // awards loot + split XP through normal character management.
            // Off ⇒ zero writes (the loot panel stays the only lane).
            autoAwardCombatRewards({ campaignName, combatSummary: closingSummary, characters })
                .catch((e) => { console.error('[handleClear:auto-rewards]', e) })
        }
    }

    const handleInitiativeChange = function handleInitiativeChange(creatureName, value) {
        if (!combatSummary) return
        // GM-only: initiative stamping is turn-admin (bug-player-clients-can-hijack-initiative) —
        // the card input is disabled for LAN clients; this guard closes the handler lane too.
        if (!isLocalhost) return
        setInitiative(combatSummary, creatureName, value)
        // L5 §10.1: initiative being stamped is the table entering combat —
        // the encounter phase engages here (action-driven; §10.2 makes it
        // AI-triggerable later). Same-phase ⇒ zero writes.
        setSessionPhase({ campaignName, phase: 'encounter', changedBy: 'initiative tracker', reason: `initiative recorded for ${creatureName}` })
            .catch((e) => { console.error('[createCreatureHandlers] session phase encounter failed:', e) })
        // CLA-360: Thief's Reflexes — GM-set initiative in round 1 grants the
        // holder's structural second turn at initiative − 10 (spends the use once).
        maybeGrantThiefsReflexesSecondTurn(combatSummary, creatureName, campaignName, characters)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleNameChange = function handleNameChange(oldName, newName) {
        if (!combatSummary) return
        // GM-only: renameNpc + full combatSummary POSTs are tracker authorship —
        // LAN clients render a plain name span (CardName), this guard closes the
        // handler lane (bug-player-clients-can-hijack-initiative).
        if (!isLocalhost) return
        renameNpc({ combatSummary, oldName, newName, campaignNpcs, setNpcImages, campaignName })
            .then(() => {
                storage.set('combatSummary', combatSummary, campaignName)
                setCombatSummary(cloneDeep(combatSummary))
            })
            .catch((e) => { console.error("[initiative] Error:", e); throw e; })
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleTargetChange = function handleTargetChange(creatureName, targetName) {
        if (!combatSummary) return
        if (targetName && targetName.startsWith('overlay-')) {
            const overlayId = targetName.slice('overlay-'.length)
            const overlay = overlays.find(o => o.id === overlayId)
            if (overlay) {
                setTarget(combatSummary, creatureName, targetName)
            }
        } else {
            setTarget(combatSummary, creatureName, targetName)
        }
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleRemoveNpc = function handleRemoveNpc(creatureName) {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature || creature.type === 'player') return

        const needsConfirmation = creature.currentHp > 0 || creature.initiative !== ''
        if (needsConfirmation) {
            const msg = creature.currentHp > 0
                ? `${creature.name} has ${creature.currentHp} HP. Remove anyway?`
                : `${creature.name} has initiative assigned. Remove anyway?`
            if (!window.confirm(msg)) return
        }

        removeNpc(combatSummary, creatureName)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleAddNpc = function handleAddNpc() {
        if (!combatSummary) return
        // Owner decision 2026-10-24: this lane stamps placeholder AC 10 / HP 10 (unlike the
        // NPC-page chip, which gates on authored stats) — name the defaults in a native
        // confirm before spawning so the spawn bar is explicit. Cancel ⇒ zero writes.
        if (!window.confirm('Add NPC with placeholder AC 10 / HP 10? Edit on the card.')) return
        addNpc(combatSummary)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    return {
        handleCreatureHpChange,
        handleClear,
        handleInitiativeChange,
        handleNameChange,
        handleTargetChange,
        handleRemoveNpc,
        handleAddNpc,
    }
}
