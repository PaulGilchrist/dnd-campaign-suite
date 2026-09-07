import React from 'react'
import { cloneDeep } from 'lodash'
import useSSEEqualityGuard from '../../hooks/runtime/useSSEEqualityGuard.js'
import utils from '../../services/ui/utils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js'
import storage from '../../services/ui/storage.js'
import { getMonsterImageUrl } from '../../services/npcs/monsterUtils.js'
import { loadNPCs } from '../../services/npcs/npcsService.js'
import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js'
import { loadCombatSummary, getCombatSummary, getActiveCreatureName, setCombatSummaryCache } from '../../services/encounters/combatData.js'
import { cleanupConcentrationEffects } from '../../services/combat/concentration/concentrationService.js'
import { clearExpirationEffects } from '../../services/rules/effects/expirations.js'
import {
    setupCreatures,
    mergeCombatSummaryWithCharacters,
    isPreviousDisabled,
} from '../../services/encounters/initiativeService.js'
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
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js'
import { createCreatureHandlers } from './createCreatureHandlers.js'
import { createRollConditionSaveHandler } from './createRollConditionSaveHandler.js'
import { createConcentrationHandlers } from './createConcentrationHandlers.js'
import { createEffectAdderHandlers } from './createEffectAdderHandlers.js'
import { createAutoBreakConditionHandler } from './createAutoBreakConditionHandler.js'

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
    const [viewingMonster, setViewingMonster] = useSyncedState('campaign', 'combat-ui-viewingMonster', null, campaignName)
    const [viewingMonsterCreatureName, setViewingMonsterCreatureName] = useSyncedState('campaign', 'combat-ui-viewingMonsterCreatureName', null, campaignName)
    const carouselRef = React.useRef(null)
    const combatSummaryRef = React.useRef(null)
    const roundRef = React.useRef(combatSummary?.round ?? 1)
    combatSummaryRef.current = combatSummary
    roundRef.current = combatSummary?.round ?? roundRef.current

    React.useEffect(() => {
        setCombatSummaryCache(combatSummary, campaignName)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatSummary])

    const [conditionPopup, setConditionPopup] = React.useState(null)

    const [effectAdderTarget, setEffectAdderTarget] = useSyncedState('campaign', 'combat-ui-effectAdderTarget', null, campaignName)
    const [effectAdderTab, setEffectAdderTab] = React.useState('conditions')

    const [campaignNpcs, setCampaignNpcs] = React.useState([])

    const [overlays, setOverlays] = React.useState([])

    const [runtimeStateTick, setRuntimeStateTick] = React.useState(0)

    const displayCreatures = React.useMemo(() => {
        if (!combatSummary || !combatSummary.creatures) return []
        const creatures = combatSummary.creatures.map(c => {
            const runtimeConditions = getRuntimeValue(c.name, 'activeConditions') || []
            const conditionMeta = getRuntimeValue(c.name, 'activeConditionMeta') || {}
            const csConditions = c.conditions || []
            const conditions = runtimeConditions.map((key, i) => {
                const condKey = String(key).toLowerCase()
                const meta = conditionMeta[condKey]
                const csMatch = csConditions.find(cs => String(cs.key).toLowerCase() === condKey)
                return {
                    id: `runtime-${key}-${i}`,
                    key,
                    label: csMatch?.label || (key === 'speed_zero' ? 'Speed 0' : key.charAt(0).toUpperCase() + key.slice(1)),
                    dc: (meta?.dc ?? csMatch?.dc) || 0,
                    ability: (meta?.ability ?? csMatch?.ability) || 'con',
                }
            })
            if (c.type !== 'player') {
                return {
                    ...c,
                    conditions,
                }
            }
            const character = characters.find(ch => utils.getName(ch.name) === c.name)
            const stats = character?.computedStats || character
            const maxHp = getRuntimeValue(c.name, 'hitPoints') ?? stats?.hitPoints ?? 0
            const currentHp = getRuntimeValue(c.name, 'currentHitPoints') ?? maxHp
            const activeBuffs = getRuntimeValue(c.name, 'activeBuffs') || []
            const shieldOfFaithBonus = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith') ? 2 : 0
            const barkskinActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'barkskin')
            const circleFormsAC = c.wildShapeSource ? (getRuntimeValue(c.name, 'circleFormsAC') ?? null) : null
            const ac = circleFormsAC ?? (barkskinActive ? 17 : (stats?.armorClass ?? 10) + shieldOfFaithBonus)
            return {
                ...c,
                imagePath: character?.imagePath || '',
                ac,
                resistances: stats?.resistances || [],
                immunities: stats?.immunities || [],
                currentHp,
                maxHp,
                conditions,
            }
        })
        return creatures
    }, [combatSummary, characters])

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
        combatSummaryRef,
        activeCreatureNameRef,
        lastAppliedTurnStartCreatureRef,
        setCombatSummary,
        setCombatSummaryG,
        setActiveCreatureNameG,
        setRuntimeStateTick,
        setOverlays,
        handleOverlayEvent,
    }), [campaignName, characters, handleOverlayEvent, setCombatSummaryG, setActiveCreatureNameG])

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
        handleInitiativeChange,
        handleNameChange,
        handleTargetChange,
        handleRemoveNpc,
        handleAddNpc,
    } = React.useMemo(() => createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs,
        setNpcImages,
        overlays,
        setCombatSummary,
        setActiveCreatureName,
        characters,
        numOfNpc: combatSummary?.creatures?.filter(c => c.type === 'npc').length ?? 0,
        isLocalhost,
    }), [combatSummary, campaignName, campaignNpcs, overlays, isLocalhost, characters])

    const { handleNpcClick } = React.useMemo(() => ({
        handleNpcClick: createNpcClickHandler({
            isLocalhost,
            campaignNpcs,
            campaignName,
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [isLocalhost, campaignNpcs, campaignName, characters])

    const openEffectAdder = React.useCallback((creature, tab) => {
        if (!isLocalhost) return
        setEffectAdderTarget(creature)
        setEffectAdderTab(tab)
    }, [isLocalhost, setEffectAdderTarget])

    const { handleApplyEffect } = React.useMemo(() => {
        const handler = createEffectAdderHandlers({
            campaignName,
            characters,
            combatSummary,
            setEffectAdderTarget,
            setCombatSummary,
        })
        return handler
    }, [campaignName, characters, combatSummary, setEffectAdderTarget])

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

    // Concentration-result listener
    React.useEffect(() => {
        const handler = (e) => {
            if (!combatSummary) return
            const creature = combatSummary.creatures.find(c =>
                c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
            )
            if (creature && !e.detail.success) {
                const concentrationSpell = creature.concentration?.spell
                creature.concentration = null
                storage.set('combatSummary', combatSummary, campaignName)
                setCombatSummary(cloneDeep(combatSummary))
                cleanupConcentrationEffects(creature.name, concentrationSpell, campaignName)
            }
        }
        window.addEventListener('concentration-result', handler)
        return () => window.removeEventListener('concentration-result', handler)
    }, [combatSummary, campaignName])

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
            for (const creature of (summary?.creatures || [])) {
                if (creature.type === 'player') {
                    setRuntimeValue(creature.name, 'activeBuffs', [], campaignName)
                    setRuntimeValue(creature.name, 'invokeDuplicityAdvantageTargets', [], campaignName)
                    setRuntimeValue(creature.name, 'unbreakableMajestyActive', null, campaignName)
                    setRuntimeValue(creature.name, 'unbreakableMajestySaveDc', null, campaignName)
                    setRuntimeValue(creature.name, 'wrathOfTheSeaActive', null, campaignName)
                    setRuntimeValue(creature.name, 'wrathOfTheSeaDc', null, campaignName)
                    setRuntimeValue(creature.name, 'wrathOfTheSeaWisMod', null, campaignName)
                    setRuntimeValue(creature.name, 'wrathOfTheSeaSource', null, campaignName)
                    setRuntimeValue(creature.name, 'peerlessAthleteActive', null, campaignName)
                    setRuntimeValue(creature.name, 'elementalAttunementActive', null, campaignName)
                    setRuntimeValue(creature.name, 'elementalAttunementElement', null, campaignName)
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
                if (creature.concentration?.spell === "Hunter's Mark") {
                    creature.concentration = null
                    storage.set('combatSummary', summary, campaignName)
                    clearedHuntersMark = true
                }

                const dominateList = getRuntimeValue(creature.name, 'pendingExpirations')
                if (Array.isArray(dominateList) && dominateList.length > 0) {
                    for (const entry of dominateList) {
                        if (entry.effects && Array.isArray(entry.effects)) {
                            for (const effect of entry.effects) {
                                if (effect.type === 'dominated') {
                                    clearExpirationEffects([effect], entry.target, creature.name, campaignName)
                                }
                            }
                        }
                    }
                    const filteredExpirations = dominateList.filter(entry => {
                        if (!entry.effects || !Array.isArray(entry.effects)) return true
                        return entry.effects.every(e => e.type !== 'dominated')
                    })
                    setRuntimeValue(creature.name, 'pendingExpirations', filteredExpirations, campaignName)
                }
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
    }, [combatSummary, activeCreatureName])

    React.useEffect(() => {
        if (!carouselRef.current || !activeCreatureName) return
        activeCreatureNameRef.current = activeCreatureName
        const activeCard = carouselRef.current.querySelector('.creature-card.active')
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        }
    }, [activeCreatureName])

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            const initialSummary = await loadCombatSummary(campaignName)

            if (initialSummary && initialSummary.creatures) {
                const merged = mergeCombatSummaryWithCharacters(initialSummary, characters, utils.getName)

                if (cancelled) return

                storage.set('combatSummary', merged, campaignName)
                setCombatSummary(merged)
                combatSummaryRef.current = merged

                if (!activeCreatureNameRef.current) {
                    const activeName = getActiveCreatureName(campaignName)
                    if (activeName) {
                        setActiveCreatureName(activeName)
                        activeCreatureNameRef.current = activeName
                    } else {
                        const firstCreature = merged.creatures[0]?.name || null
                        setActiveCreatureName(firstCreature)
                        activeCreatureNameRef.current = firstCreature
                    }
                }
            } else {
                if (cancelled) return
                const creatures = setupCreatures(characters, 0, utils.getName)
                const newSummary = { round: 1, creatures }
                const firstName = creatures[0]?.name
                storage.set('combatSummary', newSummary, campaignName)
                setCombatSummary(newSummary)
                combatSummaryRef.current = newSummary
                storage.set('activeCreatureName', firstName, campaignName)
                setActiveCreatureName(firstName)
                activeCreatureNameRef.current = firstName
            }
        })()
        return () => { cancelled = true }
    }, [campaignName]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className='initiative'>
            <Subscriber campaignName={campaignName} handleEvent={handleEvent} />
            {combatSummary && combatSummary.creatures && characters.length > 0 ? (
             <>
             <h4>Initiative (round {combatSummary.round})</h4>
             <div className='carousel-container' ref={carouselRef}>
                  {displayCreatures?.map((creature) => {
                    const isActive = creature.name === activeCreatureName
                    const character = characters.find(ch => utils.getName(ch.name) === creature.name)
                    const stats = character?.computedStats || character
                    const hasTacticalShift = stats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'tactical_shift_no_oa')
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
                            hasTacticalShift={hasTacticalShift}
                            hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage}
                            hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore}
                            coronaDisadvantage={coronaDisadvantage}
                            characters={characters}
                            mapName={mapName}
                            onViewCharacter={onViewCharacter}
                        />
                    )
                })}
            </div>
              <div className='combat-controls'>
                  <button className='clear-button' onClick={handleClear}>Clear</button>
                  <button onClick={handleAddNpc}>+ NPC</button>
                  <button onClick={handlePreviousCreature} disabled={isPrevDisabledValue}>← Prev</button>
                  <button onClick={handleNextCreature}>Next →</button>
              </div>
              <div className='initiative-loot-section'>
                  <div className='initiative-loot-header'>
                      <i className="fa-solid fa-gem"></i>&nbsp; Loot
                      {(lootData.lootEntries.length > 0 || lootTextValue.length > 0) && (
                        <button
                          className='initiative-btn initiative-btn-secondary'
                          onClick={handleClearLoot}
                          title="Clear loot suggestions"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      )}
                  </div>
                  <button
                    className='initiative-btn initiative-btn-loot'
                    onClick={handleGenerateLoot}
                    disabled={generatingLoot}
                    title="Generate loot from defeated monsters in combat"
                  >
                    <i className="fa-solid fa-coins"></i>&nbsp; {generatingLoot ? 'Generating...' : 'Generate Loot'}
                  </button>
                  {(lootData.lootEntries.length > 0 || lootTextValue.length > 0) && (
                    <>
                      <textarea
                        className='initiative-loot-textarea'
                        value={lootTextValue || lootData.lootEntries.join('\n')}
                        onChange={(e) => setLootTextValue(e.target.value)}
                        placeholder="Loot will appear here..."
                        rows={6}
                      />
                      {lootData.totalEncounterXp > 0 && (
                        <div className='initiative-xp-summary'>
                          <span className='initiative-xp-label'>
                            <i className="fa-solid fa-star"></i>&nbsp; Encounter XP: {lootData.totalEncounterXp.toLocaleString()} total &middot; {Math.floor(lootData.totalEncounterXp / (characters && characters.length > 0 ? characters.length : 1))} per character
                          </span>
                          {showAwardLoot && (
                            <div className='initiative-award-loot-actions'>
                              <button
                                className='initiative-btn initiative-btn-complete'
                                onClick={handleAwardLoot}
                                disabled={awardingLoot}
                                title="Award loot and XP to party"
                              >
                                <i className="fa-solid fa-trophy"></i>{awardingLoot ? 'Awarding...' : 'Award Loot'}
                              </button>
                              <button
                                className='initiative-btn initiative-btn-secondary'
                                onClick={() => setShowAwardLoot(false)}
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {!showAwardLoot && lootTextValue.length > 0 && (
                            <button
                              className='initiative-btn initiative-btn-loot'
                              onClick={() => setShowAwardLoot(true)}
                              title="Award loot and XP to party"
                            >
                              <i className="fa-solid fa-trophy"></i>Award Loot
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
              </div>
            {viewingMonster && (
                <MonsterCardModal
                    monster={viewingMonster}
                    onClose={() => { setViewingMonster(null); setViewingMonsterCreatureName(null) }}
                    campaignName={campaignName}
                    creatures={combatSummary.creatures}
                    creatureName={viewingMonsterCreatureName}
                    mapName={mapName}
                    characters={characters}
                />
            )}
            {effectAdderTarget && (
                <EffectAdder
                    targetName={effectAdderTarget.name}
                    initialTab={effectAdderTab}
                    onCancel={() => setEffectAdderTarget(null)}
                    onApply={handleApplyEffect}
                    creatures={combatSummary?.creatures || []}
                />
            )}
            {conditionPopup && (
                <Popup onClickOrKeyDown={() => setConditionPopup(null)}>
                    <DiceRollResult
                        name={conditionPopup.condition ? `${conditionPopup.condition} — ${conditionPopup.name}` : conditionPopup.name}
                        type={conditionPopup.type}
                        rolls={conditionPopup.rolls}
                        bonus={conditionPopup.bonus}
                        targetName={conditionPopup.targetName}
                        targetAc={conditionPopup.targetAc}
                        hit={conditionPopup.hit}
                        forcedMode={conditionPopup.forcedMode}
                        starryDragonFloor={conditionPopup.starryDragonFloor}
                    >
                    </DiceRollResult>
                    <div className={`condition-save-result ${conditionPopup.success ? 'condition-save-success' : 'condition-save-failure'}`}>
                        {conditionPopup.success ? 'SAVE SUCCESSFUL' : 'SAVE FAILED'} (DC {conditionPopup.dc})
                    </div>
                </Popup>
            )}
            </>
            ) : null}
        </div>
    )
}

export default Initiative
