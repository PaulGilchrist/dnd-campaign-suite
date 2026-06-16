import { attackHandlers } from './automationInfoBuilder/attack.js'
import { bardicHandlers } from './automationInfoBuilder/bardic.js'
import { combatStanceHandlers } from './automationInfoBuilder/combatStance.js'
import { combatSuperiorityHandlers } from './automationInfoBuilder/combatSuperiority.js'
import { conditionalHandlers } from './automationInfoBuilder/conditional.js'
import { damageHandlers } from './automationInfoBuilder/damage.js'
import { diverseHandlers } from './automationInfoBuilder/diverse.js'
import { healingHandlers } from './automationInfoBuilder/healing.js'
import { initiativeHandlers } from './automationInfoBuilder/initiative.js'
import { miscHandlers } from './automationInfoBuilder/misc.js'
import { natureHandlers } from './automationInfoBuilder/nature.js'
import { passiveHandlers } from './automationInfoBuilder/passive.js'
import { primalHandlers } from './automationInfoBuilder/primal.js'
import { psionicHandlers } from './automationInfoBuilder/psionic.js'
import { reactionHandlers } from './automationInfoBuilder/reaction.js'
import { resourceHandlers } from './automationInfoBuilder/resource.js'
import { saveHandlers } from './automationInfoBuilder/save.js'
import { sorceryHandlers } from './automationInfoBuilder/sorcery.js'
import { spellHandlers } from './automationInfoBuilder/spell.js'
import { starryHandlers } from './automationInfoBuilder/starry.js'
import { tempHandlers } from './automationInfoBuilder/temp.js'

const DISPATCH = {
    ...attackHandlers,
    ...bardicHandlers,
    ...combatStanceHandlers,
    ...combatSuperiorityHandlers,
    ...conditionalHandlers,
    ...damageHandlers,
    ...diverseHandlers,
    ...healingHandlers,
    ...initiativeHandlers,
    ...miscHandlers,
    ...natureHandlers,
    ...passiveHandlers,
    ...primalHandlers,
    ...psionicHandlers,
    ...reactionHandlers,
    ...resourceHandlers,
    ...saveHandlers,
    ...sorceryHandlers,
    ...spellHandlers,
    ...starryHandlers,
    ...tempHandlers,
}

function buildAttackInfo(feature, playerStats) {
    const auto = feature.automation
    if (!auto) return null

    const handler = DISPATCH[auto.type]
    if (handler) return handler(feature, playerStats)
    return null
}

export { buildAttackInfo }
