import { getCombatSummary } from '../../services/encounters/combatData.js'
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js'
import { getMonsterData } from '../../services/npcs/monsterUtils.js'
import { NPC_FORM_HANDLERS } from './npcClickFormHandlers.js'

/**
 * Builds the handleNpcClick handler for the initiative component.
 * Handles clicking on creatures to view their stat blocks (Wild Shape, Polymorph, Shapechange, etc.)
 */
// #843 presence law (fix#39 strict-presence + fix#124 guard-first, mirroring
// findNPCByName's `!npcName ||` guard): an identity match requires BOTH names
// present and non-empty — undefined === undefined must never bind a nameless
// roster entry to a nameless click (wrong-NPC popup).
function presentName(entry) {
    return String(entry?.name ?? '').trim()
}

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

        const clickedName = presentName(creature)
        // Case-folded exact comparison preserved (:22 semantics, test-1 pinned).
        const npc = campaignNpcs.find(n => {
            const name = presentName(n)
            return clickedName !== '' && name !== '' && name.toLowerCase() === clickedName.toLowerCase()
        })
        if (npc) {
            const formatted = npcToMonsterFormat(npc)
            if (formatted) {
                setViewingMonster(formatted)
                setViewingMonsterCreatureName(creature.name)
                return
            }
        }

        const combatSummary = getCombatSummary(campaignName)
        // Same presence law at the runtime seam; exact === semantics preserved (:33).
        const runtimeCreature = combatSummary?.creatures?.find(c => {
            const name = presentName(c)
            return clickedName !== '' && name !== '' && c.name === creature.name
        })
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
