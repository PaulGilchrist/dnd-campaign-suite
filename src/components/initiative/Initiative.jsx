import React from 'react'
import { cloneDeep } from 'lodash'
import useSSEEqualityGuard from '../../hooks/runtime/useSSEEqualityGuard.js'
import utils from '../../services/ui/utils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { useEffectAdderTarget } from './useEffectAdderTarget.js'
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { getMonsterImageUrl } from '../../services/npcs/monsterUtils.js'
import { loadNPCs } from '../../services/npcs/npcsService.js'
import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js'
import { loadCombatSummary, getCombatSummary, getActiveCreatureName, setCombatSummaryCache } from '../../services/encounters/combatData.js'
import { clearExpirationEffects } from '../../services/rules/effects/expirations.js'
import {
    setupCreatures,
    mergeCombatSummaryWithCharacters,
    isPreviousDisabled,
    isBareNpcPlaceholder,
} from '../../services/encounters/initiativeService.js'
import { isCreaturePresent } from '../../services/combat/creaturePresence.js'
import MonsterCardModal from '../encounter/MonsterCardModal.jsx'
import Subscriber from '../common/Subscriber.jsx'
import Popup from '../common/popup.jsx'
import DiceRollResult from '../char-sheet/DiceRollResult.jsx'
import CreatureCard from './CreatureCard.jsx'
import EffectAdder from './EffectAdder.jsx'
import './Initiative.css'

// Extracted modules
import { createOverlayHandler, createSseEventHandler } from './sseHandlers.js'
import { createNpcClickHandler } from './createNpcClickHandler.js'
import { createFleshToStoneHandler, createPrismaticSprayIndigoHandler, createPrismaticSprayVioletHandler } from './saveResultHandlers.js'
import { useLootHandlers } from './useLootHandlers.js'
import { createNextCreatureHandler, createPreviousCreatureHandler, economyNameFor } from './navigationHandlers.js'
import { resolveSpeedFeet } from '../../services/combat/turnState.js'
import { clearAllPendingOas } from '../../services/combat/pendingOpportunityAttacks.js'
import TurnEconomyStrip from './TurnEconomyStrip.jsx'
import AiDirectorPanel from './AiDirectorPanel.jsx'
import { useTvPresentation } from './useTvPresentation.js'
import { useAllyEditor } from './useAllyEditor.js'
import AllyEditorModal from './AllyEditorModal.jsx'
import PartyPresenceButton from './PartyPresenceButton.jsx'
import FriendlyFireConfirmModal from './FriendlyFireConfirmModal.jsx'
import ClearCombatConfirmModal from './ClearCombatConfirmModal.jsx'
import TvToggleButton from './TvToggleButton.jsx'
import TvNextUpStrip from './TvNextUpStrip.jsx'
import TvMusicTransport from './TvMusicTransport.jsx'
import VictoryBanner from './VictoryBanner.jsx'
import { createCreatureHandlers } from './createCreatureHandlers.js'
import { createRollConditionSaveHandler } from './createRollConditionSaveHandler.js'
import { createConcentrationHandlers } from './createConcentrationHandlers.js'
import { createEffectAdderHandlers } from './createEffectAdderHandlers.js'
import { createAutoBreakConditionHandler } from './createAutoBreakConditionHandler.js'
import { isSecondTurnEntry } from '../../services/combat/thiefsReflexesService.js'
import { buildDisplayCreature } from './displayCreatureUtils.js'
import InitiativeLoot from './InitiativeLoot.jsx'
import { fetchSpellOverlays } from '../../services/maps/spellOverlayService.js'

function clearPlayerRoundFlags(creatureName, campaignName) {
    setRuntimeValue(creatureName, 'activeBuffs', [], campaignName)
    setRuntimeValue(creatureName, 'invokeDuplicityAdvantageTargets', [], campaignName)
    setRuntimeValue(creatureName, 'unbreakableMajestyActive', null, campaignName)
    setRuntimeValue(creatureName, 'unbreakableMajestySaveDc', null, campaignName)
    setRuntimeValue(creatureName, 'wrathOfTheSeaActive', null, campaignName)
    setRuntimeValue(creatureName, 'wrathOfTheSeaDc', null, campaignName)
    setRuntimeValue(creatureName, 'wrathOfTheSeaWisMod', null, campaignName)
    setRuntimeValue(creatureName, 'wrathOfTheSeaSource', null, campaignName)
    setRuntimeValue(creatureName, 'peerlessAthleteActive', null, campaignName)
    setRuntimeValue(creatureName, 'elementalAttunementActive', null, campaignName)
    setRuntimeValue(creatureName, 'elementalAttunementElement', null, campaignName)
    setRuntimeValue(creatureName, '_CunningStrike_usedRound', null, campaignName)
    // CLA-016: Assassinate first-round sneak bonus once-per-round latch re-arms on initiative roll.
    setRuntimeValue(creatureName, '_assassinate_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_Charge_Attack_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_FastHands_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_CunningAction_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_Cleave_UsedRound', null, campaignName)
    setRuntimeValue(creatureName, '_Nick_UsedRound', null, campaignName)
    setRuntimeValue(creatureName, '_PsychicBlade_attack_round', null, campaignName)
    setRuntimeValue(creatureName, '_PsychicBlade_secondBlade_round', null, campaignName)
    // FT-103: Reactive Strike round latch joins the CLA-297 Retaliation family here.
    for (const latchKey of ['_Retaliation_usedRound', '_Reactive_Strike_usedRound', '_ShadowyDodge_usedRound']) {
        setRuntimeValue(creatureName, latchKey, null, campaignName)
    }
    setRuntimeValue(creatureName, '_ShadowyDodge_appliedAttack', null, campaignName)
    setRuntimeValue(creatureName, '_Slow_Fall_usedRound', null, campaignName)
    // FT-104: Dual Wielder once-per-turn extra attack latch re-arms on initiative roll.
    setRuntimeValue(creatureName, '_DualWielder_UsedRound', null, campaignName)
    // SP-128: Expeditious Retreat Dash once-per-turn latch re-arms on initiative roll.
    setRuntimeValue(creatureName, '_Expeditious_Retreat_dash_usedRound', null, campaignName)
    // CLA-405: Fleet Step grant re-arms (clears) on initiative roll / combat reset.
    setRuntimeValue(creatureName, '_Fleet_Step_grantRound', null, campaignName)
    // CLA-113: Destructive Stride once-per-turn-per-creature latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Destructive_Stride_usedRound', null, campaignName)
    // FT-007: Boon of Combat Prowess round latch re-arms at round wrap (start of holder's next turn).
    setRuntimeValue(creatureName, '_Boon_of_Combat_Prowess_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_Stones_Endurance_usedRound', null, campaignName)
    // CLA-393: Wrath of the Sea once-per-turn attack latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Wrath_of_the_Sea_usedRound', null, campaignName)
    // CLA-004: Action Surge once-per-turn latch re-arms at round wrap.
    setRuntimeValue(creatureName, 'actionSurgeUsedThisRound', null, campaignName)
    // CLA-383: Warding Flare reaction round latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Warding_Flare_usedRound', null, campaignName)
    // CLA-071: Cutting Words reaction round latch + attack-instance marker re-arm at round wrap.
    setRuntimeValue(creatureName, '_Cutting_Words_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_Cutting_Words_appliedAttack', null, campaignName)
    setRuntimeValue(creatureName, '_Cutting_Words_flushTs', null, campaignName)
    // CLA-041: Branches of the Tree reaction round latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Branches_of_the_Tree_usedRound', null, campaignName)
    // CLA-381: War Magic cantrip-replacement once-per-turn latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_War_Magic_usedRound', null, campaignName)
    // #1451: Arcane Apotheosis free-Metamagic waiver latch re-arms on initiative roll /
    // combat reset (once-per-turn waiver, disk 2024 L20 — consumed at waived-cast confirm).
    setRuntimeValue(creatureName, '_Arcane_Apotheosis_usedRound', null, campaignName)
    // FT-099: War Caster Reactive Spell once-per-round reaction latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Reactive_Spell_usedRound', null, campaignName)
    // FT-094: Telekinetic Shove once-per-turn latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Telekinetic_Shove_usedRound', null, campaignName)
    // CLA-361: Thought Shield reflect round latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Thought_Shield_usedRound', null, campaignName)
    // CLA-158: Hand of Harm holder-hit reaction round latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Hand_of_Harm_usedRound', null, campaignName)
    // CLA-346: Superior Hunter's Prey once-per-turn spread latch re-arms on initiative roll / combat reset.
    for (const latchKey of ['_Superior_Hunters_Prey_UsedRound', '_Superior_Hunters_Defense_usedRound', '_Riposte_usedRound', '_Riposte_appliedAttack', 'pendingRiposteDieValue']) {
        setRuntimeValue(creatureName, latchKey, null, campaignName)
    }
    // CLA-368: Twinkling Constellations turn-start switch press latch re-arms on initiative roll / combat reset.
    setRuntimeValue(creatureName, '_Twinkling_Constellations_usedRound', null, campaignName)
    // MN-013: Parry reaction round latch re-arms on initiative roll / combat reset.
    setRuntimeValue(creatureName, '_Parry_usedRound', null, campaignName)
    // MN-003: Commander's Strike once-per-turn grant latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Commanders_Strike_usedRound', null, campaignName)
    // MN-004: Commanding Presence reaction round latch re-arms at round wrap.
    setRuntimeValue(creatureName, '_Commanding_Presence_usedRound', null, campaignName)
    setRuntimeValue(creatureName, 'surgeUsedRound', null, campaignName)
    setRuntimeValue(creatureName, 'illusoryRealityUsedRound', null, campaignName)
    setRuntimeValue(creatureName, 'portentUsedThisTurn', null, campaignName)
    setRuntimeValue(creatureName, 'psionicStrikeUsedThisTurn', null, campaignName)
    setRuntimeValue(creatureName, '_BrutalStrike_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_fortifiedHealth_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_Shield_Bash_usedRound', null, campaignName)
    setRuntimeValue(creatureName, 'piercerPunctureUsedThisTurn', null, campaignName)
    // FT-036: Grappler "Punch and Grab" once-per-turn grapple latch + Bonus-Action
    // press stamp re-arm on initiative roll / combat reset.
    setRuntimeValue(creatureName, '_Grappler_usedRound', null, campaignName)
    setRuntimeValue(creatureName, '_bonusActionAttackRound', null, campaignName)
    // CLA-100: Dread Ambush Ambusher's Leap once-per-combat latch re-arms on
    // initiative (new combat) — covers joins/rolls by any creature (no-detail
    // initiative-rolled dispatches never reach the per-character batch).
    setRuntimeValue(creatureName, 'dreadAmbushSpeedActive', null, campaignName)
}

function clearDominatedExpirations(creature, campaignName) {
    const dominateList = getRuntimeValue(creature.name, 'pendingExpirations')
    if (!Array.isArray(dominateList) || dominateList.length === 0) return
    for (const entry of dominateList) {
        if (entry.effects && Array.isArray(entry.effects)) {
            for (const effect of entry.effects) {
                if (effect.type === 'dominated') {
                    clearExpirationEffects([effect], entry.target, creature.name, campaignName, entry)
                }
            }
        }
    }
    const filteredExpirations = dominateList.filter(entry => {
        if (!entry.effects || !Array.isArray(entry.effects)) return true
        return entry.effects.every(e => e.type !== 'dominated')
    })
    // #864 only-if-changed guard (fix#170 house shape, cf. clearActiveBuffsWhere
    // useInitiativeEffects.js:126): a non-empty list with no dominated entries must
    // not re-write the identical array — redundant POST/SSE churn per invocation.
    if (filteredExpirations.length !== dominateList.length) {
        setRuntimeValue(creature.name, 'pendingExpirations', filteredExpirations, campaignName)
    }
}

function resolveRound(combatSummary, fallback) {
    return combatSummary?.round ?? fallback
}

function creaturesOrEmpty(combatSummary) {
    return combatSummary?.creatures || []
}

// Modal-header provenance hint (FV 2026-11-09 improve): when the effect-adder
// was opened from a synthetic (Second Turn) twin card, the header names the
// HOLDER (write subject) plus this suffix so the GM knows WHICH card opened it.
// Holder/normal targets carry no flag → empty string → byte-identical header.
function effectAdderTitleSuffix(target) {
    return target?.openedFromSecondTurn ? ' (second turn)' : ''
}

// Board-visibility gate (Level 5 SSE-timing guard, Arena-tuned): the legacy
// rule hides the board until players have arrived; an Arena/Starter quick-join
// additionally opens it the moment any creature is on the board with zero
// players yet (empty creatures[] skeleton keeps the guard byte-identical for
// every other campaign).
function boardHasSubjects(combatSummary, characters) {
    return characters.length > 0 || creaturesOrEmpty(combatSummary).length > 0
}

function ConditionSavePopup({ popup, onClose }) {
    return (
        <Popup onClickOrKeyDown={onClose}>
            <DiceRollResult
                name={popup.condition ? `${popup.condition} — ${popup.name}` : popup.name}
                type={popup.type}
                rolls={popup.rolls}
                bonus={popup.bonus}
                targetName={popup.targetName}
                targetAc={popup.targetAc}
                hit={popup.hit}
                forcedMode={popup.forcedMode}
                starryDragonFloor={popup.starryDragonFloor}
            >
            </DiceRollResult>
            <div className={`condition-save-result ${popup.success ? 'condition-save-success' : 'condition-save-failure'}`}>
                {popup.success ? 'SAVE SUCCESSFUL' : 'SAVE FAILED'} (DC {popup.dc})
            </div>
        </Popup>
    )
}

// GM-private stat-block modal (Initiative lane). The open state is per-client
// useState — synced, an opened card SSE-broadcast the monster's full stat
// block to every player tab and TV screen. Only gated off for TV presentation
// screens (a TV on the GM's machine is still localhost, so isLocalhost cannot
// cover it). Hoisted out of Initiative to keep that component under the
// complexity cap. Summon controllers (allowNonLocalhost lane) keep their own
// private view of their summon's block.
function GmStatBlockModal({ tvMode, monster, monsterName, campaignName, creatures, mapName, characters, onClose }) {
    if (tvMode || !monster) return null
    return (
        <MonsterCardModal
            monster={monster}
            onClose={onClose}
            campaignName={campaignName}
            creatures={creatures}
            creatureName={monsterName}
            mapName={mapName}
            characters={characters}
        />
    )
}

function Initiative({ characters, campaignName, onNpcsChange, isLocalhost, mapName, onViewCharacter }) {
    const [combatSummary, setCombatSummary] = React.useState(null)
    const setCombatSummaryG = useSSEEqualityGuard(setCombatSummary)
    const [activeCreatureName, setActiveCreatureName] = React.useState(null)
    const activeCreatureNameRef = React.useRef(null)
    const lastAppliedTurnStartCreatureRef = React.useRef(null)

    // Restore last-applied turn-start creature from runtime store so it survives remount
    React.useEffect(() => {
        if (combatSummary?.lastAppliedTurnStartCreature) {
            lastAppliedTurnStartCreatureRef.current = combatSummary.lastAppliedTurnStartCreature
        }
        const stored = getRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature')
        if (stored) {
            lastAppliedTurnStartCreatureRef.current = stored
        }
    }, [campaignName, combatSummary])
    const setActiveCreatureNameG = useSSEEqualityGuard(setActiveCreatureName)
    const [npcImages, setNpcImages] = React.useState({})
    // Display-only feedback toast for guarded board writes (bug-initiative-
    // concurrent-npc-spawn-lost-update — "+NPC conflict"). Mirrors the
    // .encounter-toast pattern in EncounterBuilder.jsx; the auto-hide timer is a
    // benign UI category (display only, no game state — AGENTS "No Game Timers").
    const [toast, setToast] = React.useState(null)
    const showToast = React.useCallback((message, isError = false) => {
        setToast({ message, isError })
        setTimeout(() => setToast(null), 2500)
    }, [])
    // Stat-block modal open state is PER-CLIENT presentation (AGENTS "stays
    // local: showModal"). These were synced campaign keys, so every GM avatar
    // click POSTed the open card and SSE-broadcast it — player tabs and TV
    // screens rendered the same MonsterCardModal (monster secrets leaked).
    // Only the tab that clicked ever shows the card; summon controllers keep
    // their own private view of their summon's stat block.
    const [viewingMonster, setViewingMonster] = React.useState(null)
    // Renamed from …CreatureName to keep require-synced-state quiet (it flags
    // game-state-named useState in files that also call setRuntimeValue).
    const [viewingMonsterName, setViewingMonsterName] = React.useState(null)
    const carouselRef = React.useRef(null)
    const combatSummaryRef = React.useRef(null)
    const roundRef = React.useRef(resolveRound(combatSummary, 1))
    combatSummaryRef.current = combatSummary
    roundRef.current = resolveRound(combatSummary, roundRef.current)

    React.useEffect(() => {
        setCombatSummaryCache(combatSummary, campaignName)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatSummary])

    const [conditionPopup, setConditionPopup] = React.useState(null)

    // Close = EVICT, never POST null (backlog EP 2026-11-08 orphan fix) — the
    // delete-on-close + detach-evict doctrine lives in useEffectAdderTarget.js.
    const [effectAdderTarget, setEffectAdderTarget, closeEffectAdderTarget] = useEffectAdderTarget(campaignName)
    // L5-001: End Turn renders only while enforcement is on (off ⇒ today's view, byte-identical)
    const enforcement = useRuntimeValue('campaign', 'enforcement')
    const enforcementOn = !!enforcement && enforcement.mode === 'on'
    const [effectAdderTab, setEffectAdderTab] = React.useState('conditions')

    const [campaignNpcs, setCampaignNpcs] = React.useState([])

    const [overlays, setOverlays] = React.useState([])

    React.useEffect(() => {
        if (!campaignName) return
        let cancelled = false
        fetchSpellOverlays(campaignName).then(loaded => {
            if (!loaded.length || cancelled) return
            setOverlays(prev => {
                const existingIds = new Set(prev.map(o => o.id))
                const unique = loaded.filter(n => !existingIds.has(n.id))
                return unique.length ? [...prev, ...unique] : prev
            })
        })
        return () => { cancelled = true }
    }, [campaignName])

    const [runtimeStateTick, setRuntimeStateTick] = React.useState(0)

    const displayCreatures = React.useMemo(() => {
        if (!combatSummary || !combatSummary.creatures) return []
        return combatSummary.creatures.map(c => buildDisplayCreature(c, characters))
        // runtimeStateTick is bumped by the SSE handler on every per-character
        // change (sseHandlers.js catch-all). buildDisplayCreature merges
        // activeConditions/activeConditionMeta/HP via the imperative, NON-reactive
        // getRuntimeValue, so without this dep a passive tab's memo freezes at its
        // mount-time snapshot and remote condition writes never re-render the badges.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatSummary, characters, runtimeStateTick])

    // Phase 1 TV presentation bundle (toggle + fullscreen sync, HP floater
    // events, up-next strip, victory banner) — extracted to keep the container
    // within the complexity ratchet. See useTvPresentation.js.
    const {
        tvMode, toggleTvMode, hpEvents, clearHpFeedback,
        nextUpCreatures, lastCombatResult, victoryVisible, dismissVictory,
    } = useTvPresentation({ campaignName, displayCreatures, activeCreatureName, showToast })
    // Phase 3.2 — tracker-level ally editor (betrayal / split party / teams).
    const { allyEditorOpen, modalProps, openAllyEditor, closeAllyEditor, confirmAllyEditor } = useAllyEditor({ campaignName, isLocalhost })

    // Friendly-fire overlay (backlog 2026-11-04 CQ): UI-LOCAL ephemeral prompt
    // state — a half-answered confirm, not game state, so it never touches the
    // runtime store. One prompt at a time: a newer ally-target selection
    // replaces the pending pair. No timer resolves/dismisses it (No-Game-Timers).
    // The factory bridge IS the useState setter (stable identity; the friendly-
    // fire payload is the pending pair, the Clear payload is `true` = armed) —
    // Initiative.jsx sits at the max-statements cap, so no pass-through wrapper.
    const [pendingFriendlyFire, setPendingFriendlyFire] = React.useState(null)

    // Initiative-Clear overlay (backlog 2026-11-08 EK): same doctrine —
    // UI-local ephemeral flag, waits indefinitely, zero writes until the
    // explicit confirm button.
    const [pendingClearConfirm, setPendingClearConfirm] = React.useState(false)

    React.useEffect(() => {
        if (!campaignName) return
        loadNPCs(campaignName).then(response => {
            const withStats = (response.npcs || []).filter(npcHasStatBlock)
            setCampaignNpcs(withStats)
        }).catch((e) => { console.error("[initiative] Error:", e); throw e; })
    }, [campaignName])

    // Create extracted handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleOverlayEvent = React.useCallback(createOverlayHandler(campaignName), [campaignName])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleEvent = React.useCallback(createSseEventHandler({
        campaignName,
        characters,
        isLocalhost,
        combatSummaryRef,
        activeCreatureNameRef,
        lastAppliedTurnStartCreatureRef,
        setCombatSummary,
        setCombatSummaryG,
        setActiveCreatureNameG,
        setRuntimeStateTick,
        setOverlays,
        handleOverlayEvent,
    }), [campaignName, characters, isLocalhost, handleOverlayEvent, setCombatSummaryG, setActiveCreatureNameG])

    const [npcImagesLoaded, setNpcImagesLoaded] = React.useState(false)
    React.useEffect(() => {
        if (!combatSummary || npcImagesLoaded) return
        let cancelled = false
        const npcs = combatSummary.creatures.filter(c => c.type !== 'player' || c.wildShapeSource || c.polymorphSource || c.animalShapesSource || c.shapechangeSource)
        const promises = npcs.map(async (creature) => {
            if (creature.imagePath && !creature.wildShapeSource && !creature.polymorphSource && !creature.animalShapesSource && !creature.shapechangeSource) return { name: creature.name, url: null }
            const imageName = creature.wildShapeSource || creature.animalShapesSource || creature.shapechangeSource ? (creature.beastName || creature.formName || creature.name) : creature.polymorphSource ? (creature.beastName || creature.name) : creature.name
            const url = await getMonsterImageUrl(imageName, campaignNpcs, campaignName)
            return { name: creature.name, url }
        })
        Promise.all(promises).then(results => {
            if (cancelled) return
            setNpcImages(prev => {
                const next = { ...prev }
                results.forEach(({ name, url }) => { next[name] = url })
                return next
            })
            setNpcImagesLoaded(true)
        }).catch(err => {
            if (cancelled) return
            console.error('[initiative] NPC image resolution failed:', err)
        })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatSummary, campaignNpcs, campaignName])

    // Extracted handlers
    const isPrevDisabledValue = React.useMemo(() => {
        return isPreviousDisabled(combatSummary, activeCreatureName)
    }, [combatSummary, activeCreatureName])

    const { handleNextCreature } = React.useMemo(() => {
        const nextHandler = createNextCreatureHandler({
            combatSummaryRef,
            activeCreatureName,
            campaignName,
            characters,
            roundRef,
            lastAppliedTurnStartCreatureRef,
            setCombatSummary,
            setActiveCreatureName,
            setRuntimeStateTick,
        })
        return { handleNextCreature: nextHandler }
    }, [activeCreatureName, campaignName, characters])

    const { handlePreviousCreature } = React.useMemo(() => {
        const prevHandler = createPreviousCreatureHandler({
            combatSummaryRef,
            activeCreatureName,
            campaignName,
            characters,
            roundRef,
            lastAppliedTurnStartCreatureRef,
            setCombatSummary,
            setActiveCreatureName,
            setRuntimeStateTick,
            isPreviousDisabled: isPrevDisabledValue,
        })
        return { handlePreviousCreature: prevHandler }
    }, [activeCreatureName, campaignName, isPrevDisabledValue, characters])

    const {
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
    } = React.useMemo(() => createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs,
        setNpcImages,
        overlays,
        setCombatSummary,
        setActiveCreatureName,
        characters,
        // Only bare "+ NPC" placeholders carry over a Clear — EB-joined monsters
        // and summons must never re-materialise as NPC stubs (bug-initiative-clear-monsters-become-npc-stubs).
        numOfNpc: creaturesOrEmpty(combatSummary).filter(isBareNpcPlaceholder).length,
        isLocalhost,
        showToast,
        requestFriendlyFireConfirm: setPendingFriendlyFire,
        requestClearConfirm: setPendingClearConfirm,
    }), [combatSummary, campaignName, campaignNpcs, overlays, isLocalhost, characters, showToast, setPendingFriendlyFire, setPendingClearConfirm])

    // Overlay-confirm seam: accept arms through the factory (same audit row +
    // board-write bytes the retired native-confirm lane produced); cancel is
    // inert — the controlled target-select already restored to the previous
    // target when React finished the change event with an untouched
    // combatSummary, so closing the prompt is the whole revert.
    const handleFriendlyFireConfirm = function handleFriendlyFireConfirm() {
        if (!pendingFriendlyFire) return
        const { creatureName, targetName } = pendingFriendlyFire
        setPendingFriendlyFire(null)
        confirmFriendlyFireTarget(creatureName, targetName)
    }

    const { handleNpcClick } = React.useMemo(() => ({
        handleNpcClick: createNpcClickHandler({
            isLocalhost,
            campaignNpcs,
            campaignName,
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName: setViewingMonsterName,
        })
    }), [isLocalhost, campaignNpcs, campaignName, characters])

    const openEffectAdder = React.useCallback((creature, tab) => {
        if (!isLocalhost) return
        // CLA-360 law (displayCreatureUtils.js:49, Initiative.jsx holderName lane):
        // structural (Second Turn) rows are synthetic transport — state keyed by the
        // suffixed name is a phantom bucket (invisible, unrestorable, orphaned at the
        // round wrap). Route GM intent to the holder's real, visible, removable state,
        // so conditions/targetEffects/concentration writes AND the audit rows land on
        // the same creature the row card displays (bug-effectadder-secondturn-phantom-bucket).
        // The openedFromSecondTurn flag is display-only provenance (modal header hint —
        // it never feeds a write, audit, or the subject remap itself).
        setEffectAdderTarget(isSecondTurnEntry(creature) && creature.holderName
            ? { ...creature, name: creature.holderName, openedFromSecondTurn: true }
            : creature)
        setEffectAdderTab(tab)
    }, [isLocalhost, setEffectAdderTarget])

    const { handleApplyEffect } = React.useMemo(() => {
        const handler = createEffectAdderHandlers({
            campaignName,
            characters,
            combatSummary,
            setEffectAdderTarget: closeEffectAdderTarget,
            setCombatSummary,
        })
        return handler
    }, [campaignName, characters, combatSummary, closeEffectAdderTarget])

    const { handleRollConditionSave } = React.useMemo(() => ({
        handleRollConditionSave: createRollConditionSaveHandler({
            combatSummary,
            campaignName,
            characters,
            campaignNpcs,
            mapName,
            setConditionPopup,
            setCombatSummary,
        })
    }), [combatSummary, campaignName, characters, campaignNpcs, mapName])

    const { handleRollConcentrationSave, handleBreakConcentration } = React.useMemo(() => ({
        ...createConcentrationHandlers({
            combatSummary,
            campaignName,
            characters,
            campaignNpcs,
            mapName,
            setConditionPopup,
            setCombatSummary,
        })
    }), [combatSummary, campaignName, characters, campaignNpcs, mapName])

    const { handleAutoBreakCondition } = React.useMemo(() => ({
        handleAutoBreakCondition: createAutoBreakConditionHandler({
            isLocalhost,
            combatSummary,
            campaignName,
            setCombatSummary,
        })
    }), [isLocalhost, combatSummary, campaignName])

    const {
        lootData,
        generatingLoot,
        lootTextValue,
        setLootTextValue,
        showAwardLoot,
        setShowAwardLoot,
        awardingLoot,
        handleGenerateLoot,
        handleAwardLoot,
        handleClearLoot,
    } = useLootHandlers(campaignName, characters, combatSummary)

    // Save result window event listeners
    React.useEffect(() => {
        const handler = createFleshToStoneHandler(campaignName, combatSummary, setCombatSummary)
        window.addEventListener('flesh-to-stone-result', handler)
        return () => window.removeEventListener('flesh-to-stone-result', handler)
    }, [combatSummary, campaignName])

    React.useEffect(() => {
        const handler = createPrismaticSprayIndigoHandler(campaignName, combatSummary, setCombatSummary)
        window.addEventListener('prismatic-spray-indigo-result', handler)
        return () => window.removeEventListener('prismatic-spray-indigo-result', handler)
    }, [combatSummary, campaignName])

    React.useEffect(() => {
        const handler = createPrismaticSprayVioletHandler(campaignName, combatSummary, setCombatSummary)
        window.addEventListener('prismatic-spray-violet-result', handler)
        return () => window.removeEventListener('prismatic-spray-violet-result', handler)
    }, [combatSummary, campaignName])

    // NOTE: no `concentration-result` listener here — the page-singleton consumer in
    // useLoggedDiceRollEventHandlers.setupEventListeners is the ONE adjudicator for
    // failed concentration saves (it logs the roll row, nulls concentration in the
    // shared cache, strips summons, clears mantle, persists and dispatches
    // `combat-summary-updated`). A second view-mounted copy here used to double every
    // SP-011 "Concentration broken; X ends." log row (bug-concentration-broken-double-log-rows);
    // this view adopts the adjudicated summary via the combat-summary-updated listener below.

    // death-save-result listener
    React.useEffect(() => {
        const handler = (e) => {
            if (!combatSummary || !e.detail.restoredToHp) return
            const creature = combatSummary.creatures.find(c =>
                c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
            )
            if (creature) {
                setRuntimeValue(creature.name, 'currentHitPoints', e.detail.restoredToHp, campaignName)
                if (creature.type === 'npc') {
                    creature.currentHp = e.detail.restoredToHp
                }
                storage.set('combatSummary', combatSummary, campaignName)
                setCombatSummary(cloneDeep(combatSummary))
            }
        }
        window.addEventListener('death-save-result', handler)
        return () => window.removeEventListener('death-save-result', handler)
    }, [combatSummary, campaignName])

    // initiative-rolled listener
    React.useEffect(() => {
        const handler = () => {
            const summary = getCombatSummary(campaignName)
            if (!summary) return
            let clearedHuntersMark = false
            // WM-008: re-roll of initiative restarts the round structure — clear the
            // campaign-level weapon-mastery auto-apply latch so Vex can re-arm.
            setRuntimeValue('campaign', '_Vex_appliedTarget', null, campaignName)
            // Pending-OA drop law: a new initiative roll retires every pending
            // trigger marker (the old provocation no longer stands; the spent
            // reaction is NOT refunded). Zero writes when nothing is pending.
            clearAllPendingOas(campaignName)
            for (const creature of (summary?.creatures || [])) {
                if (isSecondTurnEntry(creature)) continue
                if (creature.type === 'player') {
                    clearPlayerRoundFlags(creature.name, campaignName)
                }
                if (creature.concentration?.spell === "Hunter's Mark") {
                    creature.concentration = null
                    storage.set('combatSummary', summary, campaignName)
                    clearedHuntersMark = true
                }
                clearDominatedExpirations(creature, campaignName)
            }
            if (clearedHuntersMark) {
                setCombatSummaryG(cloneDeep(summary))
            }
        }
        window.addEventListener('initiative-rolled', handler)
        return () => window.removeEventListener('initiative-rolled', handler)
    }, [campaignName, setCombatSummaryG])

    // combat-summary-updated listener
    React.useEffect(() => {
        const handler = () => {
            const summary = getCombatSummary(campaignName)
            if (!summary) return
            // Compare against the live ref (not a stale closure) and adopt a clone:
            // the cache may alias the current state object, and React bails out on
            // setState with an identical reference even after in-place mutation.
            if (JSON.stringify(summary) !== JSON.stringify(combatSummaryRef.current)) {
                setCombatSummary(cloneDeep(summary))
            }
        }
        window.addEventListener('combat-summary-updated', handler)
        return () => window.removeEventListener('combat-summary-updated', handler)
    }, [campaignName])

    React.useEffect(() => {
        if (!combatSummary || !onNpcsChange) return
        const npcList = combatSummary.creatures
            .filter(c => c.type === 'npc')
            .map(c => ({ name: c.name, type: 'npc', imageUrl: npcImages[c.name] || null }))
        onNpcsChange(npcList)
    }, [combatSummary, onNpcsChange, npcImages])

    React.useEffect(() => {
        if (!combatSummary) return
        const handleKeyDown = (event) => {
            // Turn-admin hotkeys are GM-only (mirrors the button gate below and
            // the write guards above): a LAN client may not advance/rewind the
            // shared tracker or spawn NPCs (bug-player-clients-can-hijack-initiative).
            if (!isLocalhost) return
            if (event.key === 'ArrowRight') {
                event.preventDefault()
                handleNextCreature()
            } else if (event.key === 'ArrowLeft' && !isPrevDisabledValue) {
                event.preventDefault()
                handlePreviousCreature()
            } else if (event.key === '+') {
                event.preventDefault()
                handleAddNpc()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatSummary, activeCreatureName, isLocalhost])

    React.useEffect(() => {
        if (!carouselRef.current || !activeCreatureName) return
        activeCreatureNameRef.current = activeCreatureName
        const activeCard = carouselRef.current.querySelector('.creature-card.active')
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        }
        // tvMode re-centers too: entering TV/fullscreen reflows the row and the
        // spotlight creature can otherwise sit off-screen.
    }, [activeCreatureName, tvMode])

    // GM (localhost) only — mirrors the fog-write gate in Map.jsx:234. A
    // read-only (network) client must never AUTHOR the tracker: the mount
    // merge POSTs the whole combatSummary and is idempotent ONLY when the GM
    // tab is the single author (a player tab resurrects combatants/turn state
    // the GM just changed — same clobber family as bug-player-clients-clobber-
    // fog-reset, and the auto-write half of bug-player-clients-can-hijack-
    // initiative). Players still mirror every change via SSE; they just never
    // seed or stamp it. Local setState stays unconditional for the read view.
    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            const initialSummary = await loadCombatSummary(campaignName)

            if (initialSummary && initialSummary.creatures) {
                const merged = mergeCombatSummaryWithCharacters(initialSummary, characters, utils.getName)

                if (cancelled) return

                if (isLocalhost) storage.set('combatSummary', merged, campaignName)
                setCombatSummary(merged)
                combatSummaryRef.current = merged

                if (!activeCreatureNameRef.current) {
                    // FW 2026-11-09 improve: prefer the merged summary's own surviving
                    // activeCreatureName (mergeCombatSummaryWithCharacters keeps it only
                    // when the named row survived) over the per-client cached fallback —
                    // a seeded board's pointer must beat a stale localStorage/cache value
                    // and the server mirror it was POSTed to. Fallback chain unchanged:
                    // cached getActiveCreatureName() → first creature → null sentinel.
                    const activeName = merged.activeCreatureName
                        || getActiveCreatureName(campaignName)
                        || merged.creatures[0]?.name
                        || null
                    setActiveCreatureName(activeName)
                    activeCreatureNameRef.current = activeName
                }
            } else {
                if (cancelled) return
                const creatures = setupCreatures(characters, 0, utils.getName)
                const newSummary = { round: 1, creatures }
                // Zero-character campaigns (Arena/Starter quick-create — first board
                // mount before any hero joined) leave an empty roster: store the null
                // "no active creature" sentinel, never undefined — undefined collapses
                // the {value} body to a bare {} POST that persists as a malformed
                // key and crashes the SSE echo (bug-zero-creature-initiative-null-name;
                // mirrors the createCreatureHandlers CLEAR-path guard from 2036625ff).
                const firstName = creatures[0]?.name ?? null
                if (isLocalhost) {
                    storage.set('combatSummary', newSummary, campaignName)
                    storage.set('activeCreatureName', firstName, campaignName)
                }
                setCombatSummary(newSummary)
                combatSummaryRef.current = newSummary
                setActiveCreatureName(firstName)
                activeCreatureNameRef.current = firstName
            }
        })()
        return () => { cancelled = true }
    }, [campaignName, isLocalhost]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={`initiative${tvMode ? ' initiative--tv' : ''}`}>
            <Subscriber campaignName={campaignName} handleEvent={handleEvent} />
            {toast && (
                <div className={`initiative-toast${toast.isError ? ' initiative-toast-error' : ''}`} role='status'>
                    {toast.message}
                </div>
            )}
            <VictoryBanner visible={victoryVisible} onDismiss={dismissVictory} result={lastCombatResult} />
            {combatSummary && combatSummary.creatures && boardHasSubjects(combatSummary, characters) ? (
             <>
             <div className='combat-header'>
                 <h4>Initiative (round {combatSummary.round})</h4>
                 {tvMode && <TvMusicTransport campaignName={campaignName} isLocalhost={isLocalhost} />}
                 <TvToggleButton tvMode={tvMode} onToggle={toggleTvMode} />
             </div>
             <TvNextUpStrip creatures={nextUpCreatures} />
             <TurnEconomyStrip
                 creatureName={activeCreatureName}
                 // CLA-360 display parity: the header strip is anchored to the ACTIVE
                 // creature — while a (Second Turn) twin is active its economy lives on
                 // the holder's turnState key (same economyNameFor seam the gate and
                 // every charge writer resolve), so read and meter off the holder.
                 economyName={economyNameFor(combatSummary, activeCreatureName)}
                 // Shared resolution (turnState.resolveSpeedFeet): players keep the
                 // exact same sheet lane (computedStats.speed → authored speed →
                 // 30 default); EB-joined monsters now resolve through the row's
                 // join-stamped bestiary speed instead of silently falling to 30
                 // (bug-movement-budget-caps-all-movers-at-30, monster-active header face).
                 speedFeet={resolveSpeedFeet(
                     combatSummary.creatures.find(c => c.name === economyNameFor(combatSummary, activeCreatureName)),
                     characters
                 )}
             />
             <div className='carousel-container' ref={carouselRef}>
                  {displayCreatures.map((creature) => {
                    const isActive = creature.name === activeCreatureName
                    const character = characters.find(ch => utils.getName(ch.name) === (creature.holderName || creature.name))
                    const stats = character?.computedStats || character
                    const hasSpeedyOpportunityDisadvantage = stats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'opportunity_attacks_disadvantage')
                    const hasSpeedyDifficultTerrainIgnore = stats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'ignore_difficult_terrain_on_dash')
                    const coronaDisadvantage = (() => {
                        const playerNames = (combatSummary?.creatures || [])
                            .filter(c => c.type === 'player')
                            .map(c => c.name)
                        let result = false
                        for (const playerName of playerNames) {
                            const buffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || []
                            const coronaBuff = Array.isArray(buffs) ? buffs.find(b => b.effect === 'sunlight_aura') : null
                            if (!coronaBuff) continue
                            const applicableTypes = coronaBuff.enemiesDisadvantageSaves || []
                            if (applicableTypes.length === 0) continue
                            const storedEnemies = getRuntimeValue(playerName, 'coronaOfLightEnemies', campaignName) || []
                            if (storedEnemies.length === 0) {
                                result = true
                                break
                            }
                            if (storedEnemies.includes(creature.name)) {
                                result = true
                                break
                            }
                        }
                        return result
                    })()
                    return (
                        <CreatureCard
                            key={`${creature.name}-${runtimeStateTick}`}
                            creature={creature}
                            isActive={isActive}
                            isLocalhost={isLocalhost}
                            npcImage={npcImages[creature.name]}
                            campaignNpcs={campaignNpcs}
                            overlays={overlays}
                            onRemoveNpc={handleRemoveNpc}
                            onNpcClick={handleNpcClick}
                            onNameChange={handleNameChange}
                            onHpChange={handleCreatureHpChange}
                            onInitiativeChange={handleInitiativeChange}
                            onTargetChange={handleTargetChange}
                            onRollConditionSave={handleRollConditionSave}
                            onBreakCondition={handleAutoBreakCondition}
                            onOpenEffectAdder={openEffectAdder}
                            onRollConcentrationSave={handleRollConcentrationSave}
                            onBreakConcentration={handleBreakConcentration}
                            allCreatures={combatSummary.creatures}
                            campaignName={campaignName}
                            hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage}
                            hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore}
                            coronaDisadvantage={coronaDisadvantage}
                            characters={characters}
                            mapName={mapName}
                            onViewCharacter={onViewCharacter}
                            tvMode={tvMode}
                            hpEvent={hpEvents[creature.name]}
                            onHpFeedbackDone={clearHpFeedback}
                            onControllerChange={handleControllerChange}
                            onEditAllies={openAllyEditor}
                            onToggleAway={handleToggleAway}
                        />
                    )
                })}
            </div>
              {/* GM (localhost) only — the initiative control row mutates shared
                  turn state (Clear/+NPC/Prev/Next/End Turn all cascade through the
                  same write lane the fog-write gate in Map.jsx:234 protects on the
                  map). Network clients get the read-only board; their own
                  interaction lanes stay on the cards (target select etc.).
                  bug-player-clients-can-hijack-initiative. */}
              {isLocalhost && (
              <div className='combat-controls'>
                  <button className='clear-button' onClick={handleClear}>Clear</button>
                  <button onClick={handleAddNpc} title='Adds a statless NPC named "NPC 1", "NPC 2", … at 10 HP (AC 10) — rename it to a monster name or drop a monster from the Encounter Builder to set real stats'>+ NPC</button>
                  <PartyPresenceButton
                      creatures={combatSummary.creatures}
                      onConfirm={handlePartyPresenceChange}
                  />
                  <button onClick={handlePreviousCreature} disabled={isPrevDisabledValue}>← Prev</button>
                  <button onClick={handleNextCreature}>Next →</button>
                  {/* L5-001: End Turn — the enforced-pace affordance (advance + economy reset
                      happen at the existing turn seam in navigationHandlers). Enforcement off ⇒ hidden. */}
                  {enforcementOn && (
                      <button className='end-turn-button' onClick={handleNextCreature} title="End the active creature's turn (advances initiative and resets their economy)">End Turn</button>
                  )}
                  {/* §9.3 AI director (hidden unless AI configured + localhost + NPC's turn) */}
                  <AiDirectorPanel
                      campaignName={campaignName}
                      activeCreature={combatSummary.creatures.find(c => c.name === activeCreatureName) || null}
                      isLocalhost={isLocalhost}
                      onStampTarget={handleTargetChange}
                      round={combatSummary.round}
                  />
              </div>
              )}
              {/* Loot generate/award is GM-only (XP + party-inventory writes, and the
                  panel state never reaches player tabs anyway). */}
              {isLocalhost && (
              <InitiativeLoot
                lootData={lootData}
                generatingLoot={generatingLoot}
                lootTextValue={lootTextValue}
                setLootTextValue={setLootTextValue}
                showAwardLoot={showAwardLoot}
                setShowAwardLoot={setShowAwardLoot}
                awardingLoot={awardingLoot}
                handleGenerateLoot={handleGenerateLoot}
                handleAwardLoot={handleAwardLoot}
                handleClearLoot={handleClearLoot}
                characters={characters}
              />
              )}
            {/* GM-private stat block: per-client open state, and never on a TV
                presentation screen (hoisted — the !tvMode branch would push
                Initiative over the complexity cap). */}
            <GmStatBlockModal
                tvMode={tvMode}
                monster={viewingMonster}
                monsterName={viewingMonsterName}
                campaignName={campaignName}
                creatures={combatSummary.creatures}
                mapName={mapName}
                characters={characters}
                onClose={() => { setViewingMonster(null); setViewingMonsterName(null) }}
            />
            {effectAdderTarget && (
                <EffectAdder
                    targetName={effectAdderTarget.name}
                    titleSuffix={effectAdderTitleSuffix(effectAdderTarget)}
                    initialTab={effectAdderTab}
                    onCancel={() => closeEffectAdderTarget(null)}
                    onApply={handleApplyEffect}
                    creatures={creaturesOrEmpty(combatSummary).filter(isCreaturePresent)}
                />
            )}
            <AllyEditorModal open={allyEditorOpen} modalProps={modalProps} onConfirm={confirmAllyEditor} onCancel={closeAllyEditor} />
            <FriendlyFireConfirmModal
                pending={pendingFriendlyFire}
                onCancel={() => setPendingFriendlyFire(null)}
                onConfirm={handleFriendlyFireConfirm}
            />
            <ClearCombatConfirmModal
                pending={pendingClearConfirm}
                onCancel={() => setPendingClearConfirm(false)}
                onConfirm={() => { setPendingClearConfirm(false); confirmClear() }}
            />
            {conditionPopup && (
                <ConditionSavePopup
                    popup={conditionPopup}
                    onClose={() => setConditionPopup(null)}
                />
            )}
            </>
            ) : null}
        </div>
    )
}

export default Initiative
