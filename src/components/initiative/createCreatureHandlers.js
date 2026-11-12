import { cloneDeep } from 'lodash'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { getAllyList } from '../../hooks/useAllySelection.js'
import storage from '../../services/ui/storage.js'
import { addEntry } from '../../services/ui/logService.js'
import { clearDeathSavePrompt, sendDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js'
import utils from '../../services/ui/utils.js'
import { clearCombat, setInitiative, renameNpc, setTarget, removeNpc, addNpc, mergeCombatSummaryWithCharacters } from '../../services/encounters/initiativeService.js'
import { applyPresenceChanges, isCreaturePresent } from '../../services/combat/creaturePresence.js'
import { loadCombatSummary, setCombatSummaryCache } from '../../services/encounters/combatData.js'
import { setSessionPhase } from '../../services/combat/sessionService.js'
import { autoAwardCombatRewards } from '../../services/items/autoRewardService.js'
import { maybeGrantThiefsReflexesSecondTurn } from '../../services/combat/thiefsReflexesService.js'
import { vanishSummonAtZeroHp } from '../../services/combat/summons/summonedCreatureService.js'
import { breakHypnoticPatternOnDamage } from '../../services/rules/features/hypnoticPatternService.js'
import { getCreatureController } from '../../services/encounters/creatureControl.js'
import { sweepNewCombatClocks } from '../../services/rules/effects/zoneDurationClock.js'
import { clearAllPendingOas, prunePendingOas } from '../../services/combat/pendingOpportunityAttacks.js'

/**
 * Player HP edits live in the runtime store (server-first); a revival across 0
 * also clears the death-save state and any pending prompt, and a drop to 0
 * engages the death-save lane exactly like the damage lane's alive→down
 * crossing (applyDamage handlePlayerZeroHpAndConcentration + :1258 reset).
 */
function writePlayerHp(creatureName, newValue, oldHp, campaignName) {
    setRuntimeValue(creatureName, 'currentHitPoints', newValue, campaignName)
    if (oldHp <= 0 && newValue > 0) {
        setRuntimeValue(creatureName, 'deathSaves', [false, false, false], campaignName)
        setRuntimeValue(creatureName, 'deathFailures', [false, false, false], campaignName)
        setRuntimeValue(creatureName, 'isDead', 0, campaignName)
        clearDeathSavePrompt(campaignName, creatureName)
    }
    // bug-gm-hp-input-negative-player-hp: a GM override dropping a living PC to
    // 0 must not leave the table without adjudication — reset this KO's fresh
    // death-save counters and open the death-save prompt on every tab.
    if (oldHp > 0 && newValue <= 0) {
        setRuntimeValue(creatureName, 'deathSaves', [false, false, false], campaignName)
        setRuntimeValue(creatureName, 'deathFailures', [false, false, false], campaignName)
        sendDeathSavePrompt(campaignName, { promptId: utils.guid(), targetName: creatureName })
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

// Guarded board-write result classification (storage.js combatSummary opts
// lane): a plain-object { ok, status } arrives only from opted-in writers;
// undefined/true (legacy mocks, un-awaited fire-and-forget semantics) is
// success, `false` the honest transport-failure signal (26ffb4aa5 contract).
function writeConflict(result) {
    return !!result && typeof result === 'object' && result.ok === false && result.status === 409
}

function writeFailed(result) {
    return result === false || (!!result && typeof result === 'object' && result.ok === false)
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
        // Mirrors logDamageApplication: isUnconscious: newHp <= 0 for BOTH lanes
        // (the old !isPlayer exclusion contradicted the dead threshold stamp and
        // the card's creature-unconscious styling — bug-gm-hp-input-negative-player-hp).
        isUnconscious: newHp <= 0,
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
    showToast = () => {},
    // Friendly-fire overlay bridge (backlog 2026-11-04 CQ): the host component
    // (Initiative.jsx) injects a callback that opens the React confirm modal
    // with the pending { creatureName, targetName } pair. Replaces the last
    // native window.confirm on this core combat lane; hosts without the
    // callback fail closed (see handleTargetChange).
    requestFriendlyFireConfirm = null,
    // Initiative-Clear confirm bridge (backlog 2026-11-08 EK): same seam as
    // requestFriendlyFireConfirm — the host injects its pending-prompt setter
    // (both bridges are useState setters: friendly-fire carries the
    // { creatureName, targetName } pair, clear carries `true` = armed).
    // Replaces the native window.confirm; hosts without the callback fail
    // closed (see handleClear).
    requestClearConfirm = null,
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
        // (see helper); players keep the UNCLAMPED ceiling (temp-HP overshoot is
        // legitimate sheet state) but share the damage lane's death floor
        // (applyDamage :473/:491 Math.max(0, …)) — negative HP is never canonical
        // runtime state (bug-gm-hp-input-negative-player-hp).
        const newValue = isPlayer ? Math.max(0, committedHp) : clampMonsterCommit(creature, committedHp, isMaxEdit)
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

    // Clear-confirm (migrated off native window.confirm 2026-11-08 EK, the
    // friendly-fire precedent): the click only opens the host's role="dialog"
    // prompt. Nothing writes until the host resumes via confirmClear —
    // accept runs the retired lane's body byte-for-byte; cancel is inert
    // because the host simply never calls it.
    const handleClear = function handleClear() {
        if (!requestClearConfirm) {
            // Fail closed: never wipe the board when no confirm UI is wired
            // (every production host injects one).
            console.error('[handleClear] clear-confirm host not wired — initiative board not cleared')
            return
        }
        // Setter-payload bridge: `true` arms the host's role="dialog" prompt.
        requestClearConfirm(true)
    }

    const confirmClear = function confirmClear() {
        if (!combatSummary) return
        // L5 §10.3: capture the closing roster BEFORE clear wipes it —
        // auto-rewards (flag-gated, off ⇒ zero writes) need the NPCs
        // that were on the tracker to compute loot + XP.
        const closingSummary = cloneDeep(combatSummary)
        // TV-mode victory banner: stamp the outcome into the runtime store
        // BEFORE the roster is wiped (combat UI state, AGENTS server-first
        // allowlist). Every client — including the TV tab — celebrates the
        // seam until dismissed; "defeated" is kills only (hp ≤ 0), anything
        // else fled and pays nothing. UI presentation only — no game rule
        // reads this key.
        const foeRows = closingSummary.creatures.filter(c => c.type === 'npc')
        const defeatedFoes = foeRows.filter(c => (c.currentHp ?? 0) <= 0).length
        const playerRows = closingSummary.creatures.filter(c => c.type === 'player')
        const survivors = playerRows.filter(c =>
            (getRuntimeValue(c.name, 'currentHitPoints') ?? c.currentHp ?? 1) > 0
        ).length
        setRuntimeValue('campaign', 'lastCombatResult', {
            stamp: Date.now(),
            rounds: closingSummary.round ?? 1,
            foes: foeRows.length,
            defeated: defeatedFoes,
            survivors,
            partySize: playerRows.length,
            wipe: playerRows.length > 0 && survivors === 0,
        }, campaignName)
        const newSummary = clearCombat(characters, numOfNpc, (name) => name)
        storage.set('combatSummary', newSummary, campaignName)
        setCombatSummary(newSummary)
        // L5 §10.1: clearing combat returns the table to exploration.
        setSessionPhase({ campaignName, phase: 'exploration', changedBy: 'initiative tracker', reason: 'combat cleared' })
            .catch((e) => { console.error('[createCreatureHandlers] session phase exploration failed:', e) })
        // Zero-character campaigns (Arena/Starter quick-create — the table
        // cleared before any hero joined) leave an empty roster: re-arm no
        // active creature instead of crashing on creatures[0].
        const firstCreatureName = newSummary.creatures[0]?.name ?? null
        if (firstCreatureName) {
            storage.set('activeCreatureName', firstCreatureName, campaignName)
            setActiveCreatureName(firstCreatureName)
        }
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
        // Pending-OA drop law: the board is wiped, so every pending trigger
        // marker retires with it (spent reactions are not refunded). Zero
        // writes when nothing is pending.
        clearAllPendingOas(campaignName)
        // L5 §10.3: with enforcement.autoRewards on, the closed encounter
        // awards loot + split XP through normal character management.
        // Off ⇒ zero writes (the loot panel stays the only lane).
        autoAwardCombatRewards({ campaignName, combatSummary: closingSummary, characters })
            .catch((e) => { console.error('[handleClear:auto-rewards]', e) })
    }

    const handleInitiativeChange = function handleInitiativeChange(creatureName, value) {
        if (!combatSummary) return
        // GM-only: initiative stamping is turn-admin (bug-player-clients-can-hijack-initiative) —
        // the card input is disabled for LAN clients; this guard closes the handler lane too.
        if (!isLocalhost) return
        // Split-party law (creaturePresence.js): an AWAY row holds NO initiative slot —
        // its initiative is wiped on split and the card parks at the back. The card's
        // input is disabled for away rows; this guard closes the handler lane so a stale
        // blur can never write initiative back onto the wiped row, un-park the card, or
        // arm Thief's Reflexes for a creature holding no slot (bug-away-card-initiative-
        // input-resurrects-slot). The GM rejoins the hero first (toggle / Split Party).
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (creature && !isCreaturePresent(creature)) {
            console.error(`[handleInitiativeChange] ${creatureName} is away from the party — initiative slot not claimed (rejoin first)`)
            return
        }
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

    // Friendly-fire gate predicate (Phase 3.2 betrayal): an armed target that
    // is on the attacker's OWN ally list needs confirmation. Overlay (AoE)
    // arming rides its own per-save careful-spell flow, and self-targets are
    // exempt — every other face arms silently (byte-unchanged).
    const isFriendlyFireTarget = function isFriendlyFireTarget(creatureName, targetName) {
        return !!(targetName && !targetName.startsWith('overlay-') && targetName !== creatureName
            && getAllyList(creatureName).includes(targetName))
    }

    // Shared write tail — plain and confirmed-friendly lanes arm identically
    // (setTarget + board write + React republish). Scoped write (backlog
    // 2026-11-04 CR): arming changes exactly one creature's targetName, so the
    // wire carries only `{creatures:[{name,targetName}]}` via storage.patch —
    // the server PATCH lane (campaigns-changedata.js) merges it into current
    // board truth by creature name and broadcasts the FULL merged board on the
    // normal change-<campaign>-combatSummary SSE channel, so cross-tab
    // adoption is byte-identical to the old full POST and no stale-mirror
    // snapshot can clobber other combatants' fields. Every other board lane
    // (HP, initiative, join, remove) keeps the full-replace storage.set law.
    const applyTargetSelection = function applyTargetSelection(creatureName, targetName) {
        if (targetName && targetName.startsWith('overlay-')) {
            const overlayId = targetName.slice('overlay-'.length)
            const overlay = overlays.find(o => o.id === overlayId)
            if (!overlay) {
                // Unknown overlay id — nothing armed (the legacy lane still
                // re-POSTed an unchanged full-board snapshot here; the scoped
                // lane honestly writes nothing, only republishes the mirror so
                // the controlled select restores its previous value).
                setCombatSummary(cloneDeep(combatSummary))
                return
            }
        }
        setTarget(combatSummary, creatureName, targetName)
        // Unknown creatures never arm (setTarget is inert for them too) — the
        // server patch lane would skip such a record with a warning anyway.
        if (combatSummary.creatures.some(c => c.name === creatureName)) {
            storage.patch('combatSummary', { creatures: [{ name: creatureName, targetName: targetName || null }] }, campaignName)
        }
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleTargetChange = function handleTargetChange(creatureName, targetName) {
        if (!combatSummary) return
        // Friendly-fire confirm (Phase 3.2 betrayal, migrated off native
        // window.confirm 2026-11-04 CQ): arming an ally-listed target routes
        // through the host's React overlay (role=dialog, waits indefinitely —
        // UI-local ephemeral state, never the runtime store). The engine still
        // resolves the attack normally once confirmed (allegiance is an intent
        // signal, not a hard block); a cancel reverts because nothing writes —
        // the controlled target-select restores from the untouched combatSummary.
        if (isFriendlyFireTarget(creatureName, targetName)) {
            if (!requestFriendlyFireConfirm) {
                // Fail closed: never silently arm an ally target when no
                // confirm UI is wired (every production host injects one).
                console.error('[handleTargetChange] friendly-fire confirm host not wired — ally target not armed')
                return
            }
            requestFriendlyFireConfirm({ creatureName, targetName })
            return
        }
        applyTargetSelection(creatureName, targetName)
    }

    // Overlay-confirm seam: Initiative.jsx invokes this after the user accepts
    // the FriendlyFireConfirmModal prompt. Audit row + arm bytes match the
    // retired native-confirm lane exactly (repo log rule).
    const confirmFriendlyFireTarget = function confirmFriendlyFireTarget(creatureName, targetName) {
        if (!combatSummary) return
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: creatureName,
            abilityName: 'Target Selection',
            description: `${creatureName} armed ${targetName} as a target — ${targetName} is on ${creatureName}'s ally list (friendly fire confirmed).`,
            friendlyFire: true,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[initiative] friendly-fire arming log failed:', e) })
        applyTargetSelection(creatureName, targetName)
    }

    // Phase 2 — control delegation. GM hands an NPC/monster to a player (their
    // device opens and rolls its card through the same monster-action lanes)
    // or releases it back (derived lanes — summon/wild-shape — re-assert).
    // Tracker authorship is GM-only (bug-player-clients-can-hijack-initiative
    // family), and every assignment logs to the campaign log (repo rule).
    const handleControllerChange = function handleControllerChange(creatureName, controllerName) {
        if (!isLocalhost || !combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature || creature.type === 'player') return
        if (controllerName) {
            const isValidPlayer = combatSummary.creatures.some(c => c.type === 'player' && c.name === controllerName)
            if (!isValidPlayer) {
                console.error(`[handleControllerChange] ${controllerName} is not a player on the tracker — control not assigned`)
                return
            }
            creature.controller = controllerName
        } else {
            delete creature.controller
            // Owner law (2026-11-11): a release NEVER leaves an armed target behind —
            // clear the released creature's `targetName` on the SAME full-board write
            // (one SSE echo carries both), so the GM or a later re-delegation always
            // starts unarmed. Absent renders the card select unarmed (`|| ''`).
            delete creature.targetName
        }
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        const fallback = controllerName ? null : getCreatureController(creature, combatSummary.creatures, [])
        addEntry(campaignName, {
            type: 'automation',
            characterName: creature.name,
            automationType: controllerName ? 'control_assigned' : 'control_released',
            name: 'Control',
            description: controllerName
                ? `${creature.name} handed to ${controllerName} — their device can run its card (roll, target, saves) until released.`
                : `${creature.name} returned to the GM${fallback ? ` (auto-controlled by ${fallback})` : ''}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[handleControllerChange] control log failed:', e) })
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

    // ── Split-party presence (plan initiative-split-party) ──────────────────
    // Tracker authorship is GM-only (same gate family as initiative stamping).
    // `presenceByName` maps player row names → wantAway booleans; unchanged
    // names are inert. applyPresenceChanges owns the mutation semantics
    // (split wipes initiative and parks the card at the back; rejoin lands at
    // the end-of-round slot) — the card toggle and the bulk modal share this
    // exact write + audit lane.
    const handlePartyPresenceChange = function handlePartyPresenceChange(presenceByName) {
        if (!isLocalhost || !combatSummary) return
        const changes = applyPresenceChanges(combatSummary, presenceByName || {})
        if (changes.length === 0) return
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        for (const change of changes) {
            addEntry(campaignName, {
                type: 'automation',
                automationType: change.away ? 'party_split' : 'party_rejoined',
                characterName: change.name,
                name: change.away ? 'Split Party' : 'Rejoin',
                description: change.away
                    ? `${change.name} split from the party — removed from the initiative tracker (their card rests at the back until they rejoin).`
                    : change.holderName
                        ? `${change.name} rejoined the party — re-anchored to ${change.holderName}'s second-turn slot (initiative ${change.initiative}).`
                        : change.initiative
                            ? `${change.name} rejoined the party — initiative set to ${change.initiative} (end of the round).`
                            : `${change.name} rejoined the party — initiative not yet rolled.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[handlePartyPresenceChange] presence log failed:', e) })
        }
        // Pending-OA drop law: a marker's mover leaving the encounter (away)
        // evicts that marker — no pending-resolution target exists anymore
        // (reaction stays spent). Zero writes when nothing is pending/stale.
        prunePendingOas(campaignName, combatSummary)
    }

    const handleToggleAway = function handleToggleAway(creatureName) {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.type === 'player' && c.name === creatureName)
        if (!creature) return
        handlePartyPresenceChange({ [creatureName]: !(creature.away === true) })
    }

    // bug-initiative-concurrent-npc-spawn-lost-update: the board is a FULL-REPLACE
    // store. A read-modify-write of the locally mirrored summary lost the
    // last-writer race silently — two GM tabs clicking +NPC converged on ONE
    // "NPC 1" with zero toast/log/console output (both names derived from each
    // tab's local count, so the loss was visually indistinguishable). The spawn is
    // now a guarded read-modify-write, mirroring the EB-join doctrine (26ffb4aa5)
    // and the .ct-* lanes' jsonEntityCrud 409 guard:
    //   • strict fresh read — a transport failure aborts honestly (never a silent
    //     normalize of a possibly-live board);
    //   • NPC numbering derives from that FRESH board, so racing tabs stamp
    //     distinct names instead of duplicating "NPC 1";
    //   • characters re-merge into the fresh board (client-side PCs are canonical
    //     from the roster — same write shape the local mirror used to carry);
    //   • the mutation applies to a fresh clone, leaving the prop mirror pristine
    //     until the server accepts (no phantom card for sync cache readers);
    //   • the POST carries the boardVersion its base was built from (storage opts
    //     lane); a stale base 409s and the loser re-applies ONCE onto the fresh
    //     board — a second conflict, or any transport/HTTP failure, is a named
    //     toast. No timers, no silent retry beyond the single re-apply.
    const spawnNpc = async function spawnNpc(attempt) {
        let fresh
        try {
            fresh = await loadCombatSummary(campaignName, { strict: true })
        } catch (e) {
            console.error('[handleAddNpc] initiative board read failed:', e)
            showToast('Failed to add NPC — could not read the initiative board', true)
            return
        }
        const source = fresh && Array.isArray(fresh.creatures) ? fresh : combatSummary
        const baseVersion = Number(source.boardVersion) || 0
        const base = mergeCombatSummaryWithCharacters(source, characters, utils.getName)
        base.boardVersion = baseVersion + 1
        const nextNum = addNpc(base)
        const npcName = `NPC ${nextNum}`
        const result = await storage.set('combatSummary', base, campaignName, { baseVersion })
        if (writeConflict(result)) {
            if (attempt === 0) return spawnNpc(1)
            console.error(`[handleAddNpc] ${npcName} write rejected — the initiative board kept changing in another tab (409)`)
            showToast('Another tab kept changing the initiative board — your NPC was not added, try again', true)
            return
        }
        if (writeFailed(result)) {
            const status = result && typeof result === 'object' ? result.status : 'network'
            console.error(`[handleAddNpc] combatSummary board write failed (${status}) — ${npcName} never reached the server`)
            showToast(`Failed to add ${npcName}`, true)
            return
        }
        // Board accepted — publish the spawned truth to sync cache readers and React
        // state (same ack-then-publish order as addMonstersToInitiative).
        setCombatSummaryCache(base, campaignName)
        setCombatSummary(cloneDeep(base))
    }

    const handleAddNpc = function handleAddNpc() {
        if (!combatSummary) return
        // Owner decision 2026-10-24: this lane stamps placeholder AC 10 / HP 10 (unlike the
        // NPC-page chip, which gates on authored stats) — name the defaults in a native
        // confirm before spawning so the spawn bar is explicit. Cancel ⇒ zero writes.
        // The 409 re-apply (spawnNpc(1)) never re-prompts: the user already accepted.
        if (!window.confirm('Add NPC with placeholder AC 10 / HP 10? Edit on the card.')) return
        return spawnNpc(0)
    }

    return {
        handleCreatureHpChange,
        handleClear,
        confirmClear,
        handleInitiativeChange,
        handleNameChange,
        handleTargetChange,
        confirmFriendlyFireTarget,
        handleControllerChange,
        handleRemoveNpc,
        handleAddNpc,
        handlePartyPresenceChange,
        handleToggleAway,
    }
}
