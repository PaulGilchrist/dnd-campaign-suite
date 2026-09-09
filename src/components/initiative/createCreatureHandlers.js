import { cloneDeep } from 'lodash'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import storage from '../../services/ui/storage.js'
import { clearDeathSavePrompt } from '../../services/combat/conditions/savePromptService.js'
import { clearCombat, setInitiative, renameNpc, setTarget, removeNpc, addNpc } from '../../services/encounters/initiativeService.js'
import { maybeGrantThiefsReflexesSecondTurn } from '../../services/combat/thiefsReflexesService.js'
import { vanishSummonAtZeroHp } from '../../services/combat/summons/summonedCreatureService.js'

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
    _isLocalhost,
}) {
    const handleCreatureHpChange = function handleCreatureHpChange(creatureName, newValue) {
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
                setRuntimeValue(creature.name, 'isDead', 0, campaignName)
                clearDeathSavePrompt(campaignName, creature.name)
            }
        }
        else {
            creature.currentHp = newValue
            // SP-114: GM setting a spell-summon's HP to 0 makes it disappear.
            if (oldHp > 0 && newValue <= 0 && creature.summonedBy && creature.summonSource === 'spell') {
                vanishSummonAtZeroHp(creature, combatSummary, campaignName)
            }
        }
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleClear = function handleClear() {
        if (window.confirm('Are you sure you want to clear all combat status?')) {
            const newSummary = clearCombat(characters, numOfNpc, (name) => name)
            storage.set('combatSummary', newSummary, campaignName)
            setCombatSummary(newSummary)
            const firstCreatureName = newSummary.creatures[0].name
            storage.set('activeCreatureName', firstCreatureName, campaignName)
            setActiveCreatureName(firstCreatureName)
        }
    }

    const handleInitiativeChange = function handleInitiativeChange(creatureName, value) {
        if (!combatSummary) return
        setInitiative(combatSummary, creatureName, value)
        // CLA-360: Thief's Reflexes — GM-set initiative in round 1 grants the
        // holder's structural second turn at initiative − 10 (spends the use once).
        maybeGrantThiefsReflexesSecondTurn(combatSummary, creatureName, campaignName, characters)
        storage.set('combatSummary', combatSummary, campaignName)
        setCombatSummary(cloneDeep(combatSummary))
    }

    const handleNameChange = function handleNameChange(oldName, newName) {
        if (!combatSummary) return
        renameNpc(combatSummary, oldName, newName, campaignNpcs, setNpcImages, campaignName)
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
