import React from 'react'
import { cloneDeep } from 'lodash'
import useSSEEqualityGuard from '../../hooks/runtime/useSSEEqualityGuard.js'
import utils from '../../services/ui/utils.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js'
import { rollExpression } from '../../services/dice/diceRoller.js'
import { getMonsterImageUrl, getMonsterData } from '../../services/npcs/monsterUtils.js'
import { getAbilityLabel, CONDITIONS } from '../../services/combat/conditions/conditionUtils.js'
import { loadNPCs } from '../../services/npcs/npcsService.js'
import { npcToMonsterFormat, npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js'
import { expireStaleEffects, applyTurnStartEffects } from '../../services/rules/effects/expirations.js'
import { loadCombatSummary, getCombatSummary, getActiveCreatureName, setCombatSummaryCache } from '../../services/encounters/combatData.js'
import { clearPerRoundMajestyTrackers } from '../../services/combat/auras/unbreakableMajesty.js'
import {
    setupCreatures,
    addNpc,
    removeNpc,
    getNextCreatureName,
    getPreviousCreatureName,
    isPreviousDisabled,
    setInitiative,
    renameNpc,
    setTarget,
    clearCombat,
    mergeCombatSummaryWithCharacters,
} from '../../services/encounters/initiativeService.js'
import {
    rollConditionSave,
    removeCondition,
    addCondition,
    buildConditionPopup,
} from '../../services/combat/conditions/conditionSaveService.js'
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js'
import {
    rollConcentrationSave,
    breakConcentration,
    addConcentration,
    buildConcentrationPopup,
} from '../../services/combat/concentration/concentrationService.js'
import {
    logConditionEvent,
    logConcentrationSave,
    logConditionSave,
} from '../../services/encounters/combatLoggingService.js'
import MonsterCardModal from '../encounter/MonsterCardModal.jsx'
import Subscriber from '../common/Subscriber.jsx'
import Popup from '../common/popup.jsx'
import DiceRollResult from '../char-sheet/DiceRollResult.jsx'
import CreatureCard from './CreatureCard.jsx'
import ConditionPicker from './ConditionPicker.jsx'
import ConcentrationPicker from './ConcentrationPicker.jsx'
import './initiative.css'

function Initiative({ characters, campaignName, onNpcsChange, isLocalhost, mapName }) {
    const [combatSummary, setCombatSummary] = React.useState(null)
    const setCombatSummaryG = useSSEEqualityGuard(setCombatSummary)
    const [numOfNpc, setNumOfNpc] = React.useState(4)
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
    const [viewingMonster, setViewingMonster] = React.useState(null)
    const [viewingMonsterCreatureName, setViewingMonsterCreatureName] = React.useState(null)
    const carouselRef = React.useRef(null)
    const combatSummaryRef = React.useRef(null)
    combatSummaryRef.current = combatSummary

    React.useEffect(() => {
        setCombatSummaryCache(combatSummary, campaignName)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combatSummary])

    const [conditionPickerTarget, setConditionPickerTarget] = React.useState(null)
    const [conditionPopup, setConditionPopup] = React.useState(null)
    const [conditionPickerDc, setConditionPickerDc] = React.useState(10)
    const [conditionPickerAbility, setConditionPickerAbility] = React.useState('con')
    const [conditionPickerSelected, setConditionPickerSelected] = React.useState(null)

    const [concentrationPickerTarget, setConcentrationPickerTarget] = React.useState(null)
    const [concentrationSpellName, setConcentrationSpellName] = React.useState('')
    const [concentrationDc, setConcentrationDc] = React.useState(10)

    const [campaignNpcs, setCampaignNpcs] = React.useState([])

    const [overlays, setOverlays] = React.useState([])

    const [turnStartTick, setTurnStartTick] = React.useState(0)

    const displayCreatures = React.useMemo(() => {
        if (!combatSummary || !combatSummary.creatures) return []
        return combatSummary.creatures.map(c => {
            const runtimeConditions = getRuntimeValue(c.name, 'activeConditions') || []
            const csConditions = c.conditions || []
            const conditions = runtimeConditions.map((key, i) => {
                const csMatch = csConditions.find(cs => String(cs.key).toLowerCase() === String(key).toLowerCase())
                return {
                    id: `runtime-${key}-${i}`,
                    key,
                    label: csMatch?.label || key.charAt(0).toUpperCase() + key.slice(1),
                    dc: csMatch?.dc || 0,
                    ability: csMatch?.ability || 'con',
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
            return {
                ...c,
                imagePath: character?.imagePath || '',
                ac: (stats?.armorClass ?? 10) + shieldOfFaithBonus,
                resistances: stats?.resistances || [],
                immunities: stats?.immunities || [],
                currentHp,
                maxHp,
                conditions,
            }
        })
    }, [combatSummary, characters, turnStartTick]) // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (!campaignName) return
        loadNPCs(campaignName).then(response => {
            const withStats = (response.npcs || []).filter(npcHasStatBlock)
            setCampaignNpcs(withStats)
        }).catch((e) => { console.error("[initiative] Error:", e); throw e; })
    }, [campaignName])

    const handleOverlayEvent = React.useCallback((event) => {
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
    }, [campaignName])

      /**
       * WARNING: SSE re-render loop risk
       * All setters in this handler use equality guards (useSSEEqualityGuard).
       */
    const handleEvent = React.useCallback((event) => {
        if (event.key == null || event.data == null) return

        if (event.key.startsWith('spell-overlay-')) {
            handleOverlayEvent(event)
            return
        }

        if (!event.key.startsWith(`change-${campaignName}-`)) return

        const dataKey = event.key.slice(`change-${campaignName}-`.length)
           if (dataKey === 'combatSummary') {
               if (!event.data?.creatures) return
               const prevRound = combatSummaryRef.current?.round ?? 1
               combatSummaryRef.current = event.data
              setCombatSummaryG(event.data)
              if (event.data.round !== prevRound) {
                  expireStaleEffects(campaignName)
              }
            } else if (dataKey === 'activeCreatureName') {
              const prevActive = activeCreatureNameRef.current
              activeCreatureNameRef.current = event.data
              setActiveCreatureNameG(event.data)
              expireStaleEffects(campaignName)
              // Only apply turn-start effects when the active creature actually changes
              // (not on SSE snapshot re-sync where the creature is the same)
              const lastApplied = lastAppliedTurnStartCreatureRef.current
              const shouldApply = prevActive !== event.data && lastApplied !== event.data
              if (shouldApply) {
                  lastAppliedTurnStartCreatureRef.current = event.data
                  // Persist to runtime store so it survives remount (sync access)
                  setRuntimeValue('__initiative__', 'lastAppliedTurnStartCreature', event.data, campaignName)
                  // Also persist to server so it syncs to all clients
                  storage.set('lastAppliedTurnStartCreature', event.data, campaignName)
                  const cs = combatSummaryRef.current
                  if (cs && cs.lastAppliedTurnStartCreature !== event.data) {
                      cs.lastAppliedTurnStartCreature = event.data
                      setCombatSummary(cloneDeep(cs))
                  }
                  const newActiveChar = characters.find(ch => utils.getName(ch.name) === utils.getName(event.data))
                  applyTurnStartEffects(event.data, newActiveChar?.computedStats || newActiveChar, campaignName, characters)
                  setTurnStartTick(t => t + 1)
              }
          }
        }, [campaignName, characters, handleOverlayEvent, setCombatSummaryG, setActiveCreatureNameG])

    React.useEffect(() => {
        if (!combatSummary) return
        const npcs = combatSummary.creatures.filter(c => c.type === 'npc')
        const promises = npcs.map(async (creature) => {
            if (creature.imagePath) return { name: creature.name, url: null }
            const url = await getMonsterImageUrl(creature.name, campaignNpcs)
            return { name: creature.name, url }
        })
        Promise.all(promises).then(results => {
            const newImages = {}
            results.forEach(({ name, url }) => { newImages[name] = url })
            setNpcImages(newImages)
        })
    }, [combatSummary, campaignNpcs])

    const handleAddNpc = React.useCallback(() => {
        if (!combatSummary) return
        const nextNum = addNpc(combatSummary)
        setNumOfNpc(nextNum)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }, [combatSummary, campaignName])

    const handleRemoveNpc = React.useCallback((creatureName) => {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature || creature.type !== 'npc') return

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
    }, [combatSummary, campaignName])

    const isPrevDisabled = isPreviousDisabled(combatSummary, activeCreatureName)

      const handleNextCreature = React.useCallback(() => {
           const cs = combatSummaryRef.current
           if (!cs) return
           const { newActiveName, roundIncrement } = getNextCreatureName(cs, activeCreatureName)
           if (!roundIncrement) {
              storage.set('activeCreatureName', newActiveName, campaignName)
              setActiveCreatureName(newActiveName)
             } else {
               cs.round++
               storage.set('combatSummary', cs, campaignName)
               setCombatSummary(cloneDeep(cs))
               storage.set('activeCreatureName', newActiveName, campaignName)
               setActiveCreatureName(newActiveName)
               for (const creature of cs.creatures) {
                   clearPerRoundMajestyTrackers(creature.name, campaignName)
               }
             }
             expireStaleEffects(campaignName)
           }, [activeCreatureName, campaignName])

    const handlePreviousCreature = React.useCallback(() => {
          if (isPrevDisabled) return
          const cs = combatSummaryRef.current
          if (!cs) return
           const { newActiveName, roundDecrement } = getPreviousCreatureName(cs, activeCreatureName)
          if (!roundDecrement) {
              storage.set('activeCreatureName', newActiveName, campaignName)
             setActiveCreatureName(newActiveName)
            } else {
              if (cs.round > 1) {
                  cs.round--
                 storage.set('combatSummary', cs, campaignName)
                 setCombatSummary(cloneDeep(cs))
                }
              storage.set('activeCreatureName', newActiveName, campaignName)
             setActiveCreatureName(newActiveName)
            }
             expireStaleEffects(campaignName)
            }, [activeCreatureName, campaignName, isPrevDisabled])

    React.useEffect(() => {
        let cancelled = false
        ;(async () => {
            const initialSummary = await loadCombatSummary(campaignName)

            if (initialSummary && initialSummary.creatures) {
                const merged = mergeCombatSummaryWithCharacters(initialSummary, characters, utils.getName)

                if (cancelled) return
                const npcCount = merged.creatures.filter(c => c.type === 'npc').length
                setNumOfNpc(npcCount)

                storage.set('combatSummary', merged, campaignName)
                setCombatSummary(merged)
                combatSummaryRef.current = merged

                if (!activeCreatureNameRef.current) {
                    const activeName = getActiveCreatureName(campaignName)
                    if (activeName) {
                        setActiveCreatureName(activeName)
                        activeCreatureNameRef.current = activeName
                    } else {
                        setActiveCreatureName(merged.creatures[0]?.name || null)
                        activeCreatureNameRef.current = merged.creatures[0]?.name || null
                    }
                }
            } else {
                if (cancelled) return
                const creatures = setupCreatures(characters, numOfNpc, utils.getName)
                const newSummary = { round: 1, creatures }
                storage.set('combatSummary', newSummary, campaignName)
                setCombatSummary(newSummary)
                combatSummaryRef.current = newSummary
                const firstName = creatures[0]?.name
                storage.set('activeCreatureName', firstName, campaignName)
                setActiveCreatureName(firstName)
                activeCreatureNameRef.current = firstName
            }
        })()
        return () => { cancelled = true }
    }, [campaignName]) // eslint-disable-line react-hooks/exhaustive-deps

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
              } else if (event.key === 'ArrowLeft' && !isPrevDisabled) {
                event.preventDefault()
                handlePreviousCreature()
              } else if (event.key === '+') {
                event.preventDefault()
                handleAddNpc()
              }
          }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
          }, [combatSummary, activeCreatureName]) // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (!carouselRef.current || !activeCreatureName) return
        const activeCard = carouselRef.current.querySelector('.creature-card.active')
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
        }
    }, [activeCreatureName])

    React.useEffect(() => {
        const handler = () => {
            const summary = getCombatSummary(campaignName)
            if (summary && JSON.stringify(summary) !== JSON.stringify(combatSummaryRef.current)) {
                combatSummaryRef.current = summary
                setCombatSummary(summary)
            }
            for (const creature of (summary?.creatures || [])) {
                if (creature.type === 'player') {
                    setRuntimeValue(creature.name, 'activeBuffs', [], campaignName)
                    setRuntimeValue(creature.name, 'invokeDuplicityAdvantageTargets', [], campaignName)
                }
            }
        }
        window.addEventListener('initiative-rolled', handler)
        window.addEventListener('combat-summary-updated', handler)
        return () => {
            window.removeEventListener('initiative-rolled', handler)
            window.removeEventListener('combat-summary-updated', handler)
          }
      }, [campaignName])

    React.useEffect(() => {
        const handler = (e) => {
            if (!combatSummary) return
            const creature = combatSummary.creatures.find(c =>
                c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
            )
            if (creature && !e.detail.success) {
                creature.concentration = null
                storage.set('combatSummary', combatSummary, campaignName)
                setCombatSummary(cloneDeep(combatSummary))
            }
        }
        window.addEventListener('concentration-result', handler)
        return () => window.removeEventListener('concentration-result', handler)
    }, [combatSummary, campaignName])

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

     const handleCreatureHpChange = React.useCallback((creatureName, newValue) => {
         if (!combatSummary) return
         const creature = combatSummary.creatures.find(c => c.name === creatureName)
         if (!creature) return

         const isPlayer = creature.type === 'player'
         const oldHp = isPlayer ? (getRuntimeValue(creature.name, 'currentHitPoints') ?? 0) : creature.currentHp
         const delta = newValue - oldHp
         if (delta === 0) return

          if (isPlayer) {
             setRuntimeValue(creature.name, 'currentHitPoints', newValue, campaignName)
             if (oldHp <= 0 && newValue > 0) {
                 setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName)
                 setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName)
                 clearDeathSavePrompt(campaignName, creature.name)
             }
          }
          else {
              creature.currentHp = newValue
          }
          storage.set('combatSummary', combatSummary, campaignName)
          setCombatSummary(cloneDeep(combatSummary))
      }, [combatSummary, campaignName])

    const handleClear = () => {
        if (window.confirm('Are you sure you want to clear all combat status?')) {
            const newSummary = clearCombat(characters, numOfNpc, utils.getName)
            storage.set('combatSummary', newSummary, campaignName)
            setCombatSummary(newSummary)
            const firstCreatureName = newSummary.creatures[0].name
            storage.set('activeCreatureName', firstCreatureName, campaignName)
            setActiveCreatureName(firstCreatureName)
        }
    }

    const handleInitiativeChange = (creatureName, value) => {
        if (!combatSummary) return
        setInitiative(combatSummary, creatureName, value)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleNameChange = (oldName, newName) => {
        if (!combatSummary) return
        renameNpc(combatSummary, oldName, newName, campaignNpcs, setNpcImages)
            .then(() => {
                storage.set('combatSummary', combatSummary, campaignName)
                setCombatSummary(cloneDeep(combatSummary))
            })
            .catch((e) => { console.error("[initiative] Error:", e); throw e; })
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleTargetChange = (creatureName, targetName) => {
        if (!combatSummary) return
        if (targetName && targetName.startsWith('overlay-')) {
            const overlayId = targetName.slice('overlay-'.length)
            const overlay = overlays.find(o => o.id === overlayId)
            if (overlay) {
                setTarget(combatSummary, creatureName, targetName)
                // AOE context is now managed via server/SSE only
            }
        } else {
            setTarget(combatSummary, creatureName, targetName)
        }
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleNpcClick = async (creature) => {
        if (!isLocalhost) return
        const npc = campaignNpcs.find(n => n.name?.toLowerCase() === creature.name?.toLowerCase())
        if (npc) {
            const formatted = npcToMonsterFormat(npc)
            if (formatted) {
                setViewingMonster(formatted)
                setViewingMonsterCreatureName(creature.name)
                return
            }
        }
        const monster = await getMonsterData(creature.name)
        if (monster) {
            setViewingMonster(monster)
            setViewingMonsterCreatureName(creature.name)
        }
    }

    const openConditionPicker = (creature) => {
        if (!isLocalhost) return
        setConditionPickerTarget(creature)
        setConditionPickerDc(10)
        setConditionPickerAbility('con')
        setConditionPickerSelected(null)
    }

    const handleApplyCondition = () => {
        if (!conditionPickerTarget || !conditionPickerSelected || !combatSummary) return
        const conditionDef = CONDITIONS.find(c => c.key === conditionPickerSelected)
        if (!conditionDef) return
        const targetCharacter = characters.find(c => utils.getName(c.name) === conditionPickerTarget.name)
        const targetStats = targetCharacter?.computedStats || targetCharacter
        addCondition(combatSummary, conditionPickerTarget.name, conditionDef, conditionPickerDc, conditionPickerAbility, getRuntimeValue, setRuntimeValue, campaignName, targetStats)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        setConditionPickerTarget(null)
        setConditionPickerSelected(null)
        logConditionEvent(campaignName, 'applied', conditionPickerTarget.name, conditionDef.label, conditionPickerDc, conditionPickerAbility)
    }

    const handleRollConditionSave = async (creatureName, condition) => {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature) return

        const { roll: r1, success, bonus, bonusDetail } = await rollConditionSave(
            creature, condition, characters, campaignNpcs, campaignName, mapName, utils.getName
        )

        if (success) {
            removeCondition(combatSummary, creatureName, condition, getRuntimeValue, setRuntimeValue, campaignName)
        }

        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))

        setConditionPopup(buildConditionPopup(r1, bonus, bonusDetail, getAbilityLabel(condition.ability), condition.label, condition.dc, success))

        logConditionSave(campaignName, creatureName, r1, bonus, bonusDetail, condition.label, getAbilityLabel(condition.ability), condition.dc, success)

        // Envenom Weapons: when target fails Poison save from Cunning Strike, apply 2d6 Poison damage ignoring resistance
        if (!success && condition.label?.toLowerCase() === 'poisoned' && condition.ability?.toLowerCase() === 'con') {
            const allTargetEffects = getRuntimeValue(campaignName, 'targetEffects') || []
            const poisonEffect = allTargetEffects.find(te =>
                te.target === creatureName &&
                te.condition === 'poisoned' &&
                te.saveType === 'CON' &&
                te.saveDc === condition.dc
            )
            if (poisonEffect) {
                const attackerName = poisonEffect.source
                const attackerCharacter = characters.find(c => utils.getName(c.name) === utils.getName(attackerName))
                const allFeatures = attackerCharacter?.computedStats?.allFeatures || attackerCharacter?.allFeatures || []
                const hasEnvenomWeapons = allFeatures.some(f => f?.name === 'Envenom Weapons')
                if (hasEnvenomWeapons) {
                    const rollResult = rollExpression('2d6')
                    const poisonDamage = rollResult?.total || 7
                    if (poisonDamage > 0) {
                        applyDamageToTarget(combatSummary, creatureName, poisonDamage, ['Poison'], campaignName, null, true, attackerName)
                    }
                }
            }
        }
    }

    const openConcentrationPicker = (creature) => {
        if (!isLocalhost) return
        setConcentrationPickerTarget(creature)
        setConcentrationSpellName('')
        setConcentrationDc(10)
    }

    const handleApplyConcentration = () => {
        if (!concentrationPickerTarget || !concentrationSpellName.trim() || !combatSummary) return
        // Can't concentrate while raging
        const targetBuffs = getRuntimeValue(concentrationPickerTarget.name, 'activeBuffs', campaignName);
        if (Array.isArray(targetBuffs) && targetBuffs.some(b => b.name === 'Rage')) return;
        addConcentration(combatSummary, concentrationPickerTarget.name, concentrationSpellName, concentrationDc)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        setConcentrationPickerTarget(null)
        setConcentrationSpellName('')
        setConcentrationDc(10)
        logConditionEvent(campaignName, 'concentration-started', concentrationPickerTarget.name, `Concentration: ${concentrationSpellName.trim()}`, concentrationDc, 'con')
    }

    const handleRollConcentrationSave = async (creatureName) => {
        if (!combatSummary) return
        const creature = combatSummary.creatures.find(c => c.name === creatureName)
        if (!creature || !creature.concentration) return

        const concentration = creature.concentration

        const { roll: r1, success, bonus, bonusDetail } = await rollConcentrationSave(
            creature, concentration, characters, campaignNpcs, campaignName, mapName, utils.getName
        )

        if (!success) {
            creature.concentration = null
        }

        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))

        setConditionPopup(buildConcentrationPopup(r1, bonus, bonusDetail, concentration.spell, concentration.dc, success))

        logConcentrationSave(campaignName, creatureName, r1, bonus, bonusDetail, concentration.spell, concentration.dc, success)
    }

    const handleBreakConcentration = (creatureName) => {
        if (!combatSummary) return
        const spell = breakConcentration(combatSummary, creatureName)
        if (!spell) return
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        logConditionEvent(campaignName, 'concentration-broken', creatureName, `Concentration: ${spell}`)
    }

    const handleAutoBreakCondition = (creatureName, condition) => {
        if (!isLocalhost || !combatSummary) return
        removeCondition(combatSummary, creatureName, condition, getRuntimeValue, setRuntimeValue, campaignName)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
        logConditionEvent(campaignName, 'broken', creatureName, condition.label)
    }

    return (
        <div className='initiative'>
            <Subscriber campaignName={campaignName} handleEvent={handleEvent} />
            {combatSummary && combatSummary.creatures ? (
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
                            key={creature.name}
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
                            onOpenConditionPicker={openConditionPicker}
                            onRollConcentrationSave={handleRollConcentrationSave}
                            onBreakConcentration={handleBreakConcentration}
                            onOpenConcentrationPicker={openConcentrationPicker}
                            allCreatures={combatSummary.creatures}
                            campaignName={campaignName}
                            hasTacticalShift={hasTacticalShift}
                            hasSpeedyOpportunityDisadvantage={hasSpeedyOpportunityDisadvantage}
                            hasSpeedyDifficultTerrainIgnore={hasSpeedyDifficultTerrainIgnore}
                            coronaDisadvantage={coronaDisadvantage}
                        />
                    )
                })}
            </div>
              <div className='combat-controls'>
                  <button className='clear-button' onClick={handleClear}>Clear</button>
                  <button onClick={handleAddNpc}>+ NPC</button>
                  <button onClick={handlePreviousCreature} disabled={isPrevDisabled}>← Prev</button>
                  <button onClick={handleNextCreature}>Next →</button>
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
            {conditionPickerTarget && (
                <ConditionPicker
                    targetName={conditionPickerTarget.name}
                    selected={conditionPickerSelected}
                    dc={conditionPickerDc}
                    ability={conditionPickerAbility}
                    onSelect={setConditionPickerSelected}
                    onDcChange={setConditionPickerDc}
                    onAbilityChange={setConditionPickerAbility}
                    onCancel={() => setConditionPickerTarget(null)}
                    onApply={handleApplyCondition}
                />
            )}
            {concentrationPickerTarget && (
                <ConcentrationPicker
                    targetName={concentrationPickerTarget.name}
                    spellName={concentrationSpellName}
                    dc={concentrationDc}
                    onSpellNameChange={setConcentrationSpellName}
                    onDcChange={setConcentrationDc}
                    onCancel={() => setConcentrationPickerTarget(null)}
                    onApply={handleApplyConcentration}
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
