import { is2024 } from './rules-helpers.js';
import { getAbilities as getAbilities5e, getHitPoints as getHitPoints5e, getCarryingCapacity as getCarryingCapacity5e } from './core/abilityCalc.js';
import { getAbilities as getAbilities2024, getHitPoints as getHitPoints2024, getCarryingCapacity as getCarryingCapacity2024 } from './core/abilityCalc2024.js';
import { getSpellAbilities as getSpellAbilities5e } from './core/spellCalc.js';
import { getSpellAbilities as getSpellAbilities2024 } from './core/spellCalc2024.js';
import { getAttacks as getAttacks5e } from './core/attackCalc.js';
import { getAttacks as getAttacks2024 } from './core/attackCalc2024.js';
import * as proficiencyUtils from '../character/proficiencyUtils.js';
import * as proficiencyUtils2024 from '../character/proficiencyUtils2024.js';
import classRules from '../character/classRules.js';
import classRules2024 from '../character/classRules2024.js';
import { rules5e } from '../character/race-rules/index.js';
import { rules2024 } from '../character/race-rules/index.js';

/**
 * Get the appropriate sub-module imports for the ruleset.
 */
export function getSubModules(playerStats, playerSummary) {
    const use2024 = is2024(playerStats, playerSummary);
    return {
        abilityCalc: use2024
            ? { getAbilities: getAbilities2024, getHitPoints: getHitPoints2024, getCarryingCapacity: getCarryingCapacity2024 }
            : { getAbilities: getAbilities5e, getHitPoints: getHitPoints5e, getCarryingCapacity: getCarryingCapacity5e },
        spellCalc: use2024 ? { getSpellAbilities: getSpellAbilities2024 } : { getSpellAbilities: getSpellAbilities5e },
        attackCalc: use2024 ? getAttacks2024 : getAttacks5e,
        proficiencyUtils: use2024 ? proficiencyUtils2024 : proficiencyUtils,
        classRules: use2024 ? classRules2024 : classRules,
        raceRules: use2024 ? rules2024 : rules5e,
        use2024
     };
 }

