import { getCombatSummary } from '../../services/encounters/combatData.js'
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js'
import { getMonsterData } from '../../services/npcs/monsterUtils.js'
import { NPC_FORM_HANDLERS } from './npcClickFormHandlers.js'

/**
 * Builds the handleNpcClick handler for the initiative component.
 * Handles clicking on creatures to view their stat blocks (Wild Shape, Polymorph, Shapechange, etc.)
 */
export function createNpcClickHandler({
    isLocalhost,
    campaignNpcs,
    campaignName,
    characters,
    setViewingMonster,
    setViewingMonsterCreatureName,
}) {
    return async function handleNpcClick(creature, options = {}) {
        const { allowNonLocalhost = false } = options
        if (!isLocalhost && !allowNonLocalhost) return

        const npc = campaignNpcs.find(n => n.name?.toLowerCase() === creature.name?.toLowerCase())
        if (npc) {
            const formatted = npcToMonsterFormat(npc)
            if (formatted) {
                setViewingMonster(formatted)
                setViewingMonsterCreatureName(creature.name)
                return
            }
        }

        const combatSummary = getCombatSummary(campaignName)
        const runtimeCreature = combatSummary?.creatures?.find(c => c.name === creature.name)
        const context = { creature, runtimeCreature, campaignName, characters, setViewingMonster, setViewingMonsterCreatureName }

        for (const formHandler of NPC_FORM_HANDLERS) {
            if (formHandler.matches(runtimeCreature) && await formHandler.run(context)) return
        }

        // Fallback: external monster data
        const monster = await getMonsterData(creature.name)
        if (monster) {
            setViewingMonster(monster)
            setViewingMonsterCreatureName(creature.name)
        }
    }
}
