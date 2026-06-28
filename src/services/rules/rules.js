import { cloneDeep, uniqBy } from 'lodash';
import classRules from '../character/classRules.js';
import classRules2024 from '../character/classRules2024.js';
import { rules5e } from '../character/race-rules/index.js';
import { rules2024 } from '../character/race-rules/index.js';
import utils from '../ui/utils.js';
import { parseMagicItemName } from './core/attackCalc.js';
import * as proficiencyUtils from '../character/proficiencyUtils.js';
import * as proficiencyUtils2024 from '../character/proficiencyUtils2024.js';
import { getAbilities as getAbilities5e, getHitPoints as getHitPoints5e, getCarryingCapacity as getCarryingCapacity5e } from './core/abilityCalc.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadManeuvers } from '../ui/dataLoader.js';
import { getAbilities as getAbilities2024, getHitPoints as getHitPoints2024, getCarryingCapacity as getCarryingCapacity2024 } from './core/abilityCalc2024.js';
import { getElfisLineageSelection } from '../automation/handlers/class-other/elfishLineageHandler.js';
import { getSpellAbilities as getSpellAbilities5e } from './core/spellCalc.js';
import { getSpellAbilities as getSpellAbilities2024 } from './core/spellCalc2024.js';
import { getAttacks as getAttacks5e } from './core/attackCalc.js';
import { getAttacks as getAttacks2024 } from './core/attackCalc2024.js';
import { getSpellMaxLevel } from '../shared/spell-utils.js';
import { loadFeatData, loadSkills, loadBackgroundData } from '../ui/dataLoader.js';
import { computeAllFeatBuffs } from '../character/featBuffService.js';
import { getCategories } from '../character/featureCategories.js';
import {
    collectAutomationFromFeatures,
    collectSaveModifiers,
    collectTurnStartEffects,
    getConditionImmunities,
    getConditionalImmunities,
    getEvasionEffects,
    getAllSaveProficiencies,
    evaluateAutoExpression,
    buildAttackInfo,
} from '../combat/automation/automationService.js';

/**
 * Determine which ruleset to use. Checks playerStats.rules first,
 * then falls back to playerSummary.rules, then defaults to '5e'.
 */
function getRulesType(playerStats, playerSummary) {
    if (playerStats && playerStats.rules) return playerStats.rules;
    if (playerSummary && playerSummary.rules) return playerSummary.rules;
    return '5e';
}

function is2024(playerStats, playerSummary) {
    return getRulesType(playerStats, playerSummary) === '2024';
}

/**
 * Apply The Third Eye darkvision enhancement from active buffs.
 * Sets Darkvision to 120 ft if the Third Eye buff with darkvision_120 effect is active.
 */
function applyThirdEyeDarkvision(playerStats, senses, campaignName) {
    const stored = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const thirdEyeBuff = activeBuffs.find(b => b.name === 'The Third Eye' && b.effect === 'darkvision_120');
    if (!thirdEyeBuff) return senses;

    const darkvisionIndex = senses.findIndex(s => s.name === 'Darkvision');
    if (darkvisionIndex !== -1) {
        const currentFeet = extractDarkvisionFeet(senses[darkvisionIndex].value);
        if (currentFeet >= 120) return senses;
        senses[darkvisionIndex] = { ...senses[darkvisionIndex], value: '120 ft.' };
    } else {
        senses.push({ name: 'Darkvision', value: '120 ft.' });
    }

    return senses;
}

function extractDarkvisionFeet(value) {
    if (!value) return 0;
    const match = String(value).match(/(\d+)\s*ft/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Apply Umbral Sight darkvision enhancement for Gloom Stalkers.
 * Adds 60 feet to existing Darkvision range, or sets Darkvision to 60ft if not present.
 */
function applyUmbralSightDarkvision(playerStats, senses) {
    const isGloomStalker = playerStats.class?.major?.name === 'Stalker';
    if (!isGloomStalker) return senses;

    const darkvisionIndex = senses.findIndex(s => s.name === 'Darkvision');
    const extractDarkvisionFeet = (value) => {
        if (!value) return 0;
        const match = String(value).match(/(\d+)\s*ft/i);
        return match ? parseInt(match[1], 10) : 0;
    };

    if (darkvisionIndex !== -1) {
        const currentFeet = extractDarkvisionFeet(senses[darkvisionIndex].value);
        const newFeet = currentFeet + 60;
        senses[darkvisionIndex] = { ...senses[darkvisionIndex], value: `${newFeet} ft.` };
    } else {
        senses.push({ name: 'Darkvision', value: '60 ft.' });
    }

    return senses;
}

/**
 * Apply Truesight from passive_buff automation (e.g., Boon of Truesight feat).
 * Adds Truesense with the specified range to player senses.
 */
function applyTruesightSenses(playerStats, senses) {
    const passives = playerStats.automation?.passives;
    if (!Array.isArray(passives)) {
        console.error('rules: expected passives to be an array for', playerStats.name);
        throw new Error('Missing array: passives for ' + playerStats.name);
    }
    const truesightPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'truesight');
    if (!truesightPassive) return senses;

    const rangeMatch = String(truesightPassive.range || '').match(/(\d+)\s*ft/i);
    const range = rangeMatch ? `${rangeMatch[1]} ft.` : '60 ft.';

    if (!senses.some(s => s.name === 'Truesight')) {
        senses.push({ name: 'Truesight', value: range });
    }

    return senses;
}

/**
 * Apply Elfish Lineage Wood Elf speed bonus.
 * Adds 5 ft. to base speed when Wood Elf lineage is selected.
 */
function applyElfisLineageSpeed(playerStats, playerSummary) {
    const lineage = getElfisLineageSelection(playerStats, playerSummary?.campaignName);
    if (lineage === 'Wood Elf' && playerStats.speed != null) {
        return playerStats.speed + 5;
    }
    return playerStats.speed;
}

/**
 * Apply speed increase bonuses from passive_buff features (e.g., Boon of Speed, Speedy feat).
 */
function applySpeedIncreasePassives(playerStats) {
    const passives = playerStats.automation?.passives;
    if (!Array.isArray(passives)) {
        console.error('rules: expected passives to be an array for', playerStats.name);
        throw new Error('Missing array: passives for ' + playerStats.name);
    }
    let bonus = 0;
    const equippedItems = playerStats.inventory?.equipped || [];
    const allEquipment = playerStats.equipment || [];
    let isWearingHeavyArmor = false;
    for (const itemName of equippedItems) {
        const parsedName = itemName.includes('(') ? itemName.substring(0, itemName.indexOf('(')).trim() : itemName;
        const item = allEquipment.find(eq => eq.name === parsedName || eq.name === itemName);
        if (item && item.armor_category === 'Heavy') {
            isWearingHeavyArmor = true;
            break;
        }
    }
    const isWearingArmor = allEquipment.some(eq => equippedItems.includes(eq.name) && eq.equipment_category === 'Armor');
    const isWieldingShield = equippedItems.some(name => {
        const parsedName = name.includes('(') ? name.substring(0, name.indexOf('(')).trim() : name;
        return parsedName === 'Shield';
    });
    for (const passive of passives) {
        if (passive.type === 'passive_buff' && passive.effect === 'speed_increase' && passive.bonusExpression) {
            const parsed = parseInt(passive.bonusExpression, 10);
            if (!isNaN(parsed)) bonus += parsed;
        }
        if (passive.type === 'passive_buff' && passive.effect === 'speed_bonus' && passive.bonusExpression) {
            const parsed = parseInt(passive.bonusExpression, 10);
            if (isNaN(parsed)) continue;
            if (passive.condition === 'no_heavy_armor') {
                if (!isWearingHeavyArmor) {
                    bonus += parsed;
                }
            } else if (passive.condition === 'no_armor_no_shield') {
                if (!isWearingArmor && !isWieldingShield) {
                    bonus += parsed;
                }
            } else {
                bonus += parsed;
            }
        }
    }
    if (bonus > 0 && playerStats.speed != null) {
        return playerStats.speed + bonus;
    }
    return playerStats.speed;
}

/**
 * Detect Powerful Build trait and set sizeMultiplier on playerStats.
 * Powerful Build: "count as one size larger when determining your carrying capacity."
 * One size larger = 2x carrying capacity.
 */
function applyPowerfulBuild(playerStats) {
    const traits = playerStats.race?.traits;
    if (!Array.isArray(traits)) {
        console.error('rules: expected race.traits to be an array for', playerStats.name);
        throw new Error('Missing array: race.traits for ' + playerStats.name);
    }
    const hasPowerfulBuild = traits.some(t => t.name === 'Powerful Build');
    if (hasPowerfulBuild) {
        playerStats.sizeMultiplier = 2;
    }
    return playerStats;
}

/**
 * Detect Halfling Nimbleness trait and set canMoveThroughCreatureSpace on playerStats.
 * Halfling Nimbleness: "You can move through the space of any creature that is a size larger than you,
 * but you can't stop in the same space."
 */
function applyHalflingNimbleness(playerStats) {
    const traits = playerStats.race?.traits;
    if (!Array.isArray(traits)) {
        console.error('rules: expected race.traits to be an array for', playerStats.name);
        throw new Error('Missing array: race.traits for ' + playerStats.name);
    }
    const hasHalflingNimbleness = traits.some(t => t.name === 'Halfling Nimbleness');
    if (hasHalflingNimbleness) {
        playerStats.canMoveThroughCreatureSpace = true;
    }
    return playerStats;
}

const rules = {
     // === SHARED METHODS (identical in both rulesets) ===

    getAbilityLongName: utils.getAbilityLongName,

    getSpellMaxLevel,

     /**
      * Get the appropriate sub-module imports for the ruleset.
      */
    getSubModules(playerStats, playerSummary) {
        const use2024 = is2024(playerStats, playerSummary);
        return {
            abilityCalc: use2024 ? { getAbilities: getAbilities2024, getHitPoints: getHitPoints2024 } : { getAbilities: getAbilities5e, getHitPoints: getHitPoints5e },
            spellCalc: use2024 ? { getSpellAbilities: getSpellAbilities2024 } : { getSpellAbilities: getSpellAbilities5e },
            attackCalc: use2024 ? getAttacks2024 : getAttacks5e,
            proficiencyUtils: use2024 ? proficiencyUtils2024 : proficiencyUtils,
            classRules: use2024 ? classRules2024 : classRules,
            raceRules: use2024 ? rules2024 : rules5e,
            use2024
         };
     },

     // === RULESET-SPECIFIC: getAbilities ===
    getAbilities: async (playerStats, playerSummary) => {
        if (is2024(playerStats, playerSummary)) {
            return getAbilities2024(playerStats);
         }
        return getAbilities5e(playerStats);
     },

      // === RULESET-SPECIFIC: getHitPoints ===
     getHitPoints: (playerStats, playerSummary) => {
         if (is2024(playerStats, playerSummary)) {
             return getHitPoints2024(playerStats);
          }
         return getHitPoints5e(playerStats);
      },

     // === SHARED: getCarryingCapacity ===
     getCarryingCapacity: (playerStats) => {
         if (is2024(playerStats, null)) {
             return getCarryingCapacity2024(playerStats);
          }
         return getCarryingCapacity5e(playerStats);
      },

     // === RULESET-SPECIFIC: getSpellAbilities ===
     getSpellAbilities: (allSpells, playerStats, playerSummary) => {
         if (is2024(playerStats, playerSummary)) {
             return getSpellAbilities2024(allSpells, playerStats, playerSummary);
          }
         return getSpellAbilities5e(allSpells, playerStats);
      },

     // === RULESET-SPECIFIC: getAttacks ===
    getAttacks: (allEquipment, allSpells, playerStats, playerSummary) => {
        if (is2024(playerStats, playerSummary)) {
            return getAttacks2024(allEquipment, allSpells, playerStats);
         }
        return getAttacks5e(allEquipment, allSpells, playerStats);
     },

     // === SHARED: getProficiencesChoiceCount (ruleset-specific) ===
    getProficiencyChoiceCount: (playerStats, skills, playerSummary) => {
        const { proficiencyUtils: pu } = rules.getSubModules(playerStats, playerSummary);
        return pu.getProficiencyChoiceCount(playerStats, skills);
     },

     // === RULESET-SPECIFIC: getProficiencies ===
     getProficiencies: (playerStats, skill = true, playerSummary) => {
         const { proficiencyUtils: pu } = rules.getSubModules(playerStats, playerSummary);

           if (is2024(playerStats, playerSummary)) {
                // 2024: extract skill proficiencies from race trait descriptions and proficiency_choices
               const raceProficiencies = () => {
                    const extra = [];
                    const traits = playerStats.race?.traits;
                    if (!Array.isArray(traits)) {
                        console.error('rules: expected race.traits to be an array for', playerStats.name);
                        throw new Error('Missing array: race.traits for ' + playerStats.name);
                    }
                    traits.forEach(trait => {
                        // Skip traits with proficiency_choices (handled separately below)
                        if (trait.proficiency_choices) {
                            return;
                        }
                        // Parse specific skill names from description text
                        if (trait.description) {
                            const match = trait.description.match(/proficiency in the ([A-Z][a-z]+(?:,|[,\s]and[,\s]|[,\s]or[,\s]|,?)[A-Za-z,\s]+?)\s*skill/i);
                            if (match) {
                                const skillsStr = match[1]
                                    .replace(/\s+and\s+/g, ',')
                                    .replace(/\s+or\s+/g, ',')
                                    .replace(/,\s*,/g, ',')
                                    .split(',')
                                    .map(s => s.trim())
                                    .filter(s => s.length > 0);
                                skillsStr.forEach(sName => {
                                    extra.push(`Skill: ${sName}`);
                                });
                            }
                        }
                        // Merge skill proficiency_choices from traits (e.g., Human's Skillful)
                        if (trait.proficiency_choices) {
                            const pc = trait.proficiency_choices;
                            if (pc.from && pc.from.length > 0) {
                                extra.push(...pc.from);
                            }
                        }
                    });
                   return extra;
               };

                // 2024: extract tool proficiencies from background
                const backgroundToolProficiencies = () => {
                    const extra = [];
                    const bgName = playerStats.background;
                    if (bgName) {
                        try {
                            const backgrounds = loadBackgroundData('2024');
                            if (backgrounds) {
                                const bg = backgrounds.find(b => b.name === bgName || b.index === bgName.toLowerCase());
                                if (bg && bg.tool_proficiencies && !bg.tool_proficiencies.startsWith('Choose')) {
                                    extra.push(bg.tool_proficiencies);
                                }
                            }
                        } catch (_e) {
                            // Background data not available yet, skip
                        }
                    }
                    return extra;
                };

                // 2024: extract tool proficiency CHOICES from background (e.g., "Choose one kind of Artisan's Tools")
                const backgroundToolProficiencyChoices = () => {
                    const choices = [];
                    const bgName = playerStats.background;
                    if (bgName) {
                        try {
                            const backgrounds = loadBackgroundData('2024');
                            if (backgrounds) {
                                const bg = backgrounds.find(b => b.name === bgName || b.index === bgName.toLowerCase());
                                if (bg && bg.tool_proficiencies && bg.tool_proficiencies.startsWith('Choose')) {
                                    // Parse "Choose one kind of Artisan's Tools" → extract the tool name
                                    const toolMatch = bg.tool_proficiencies.match(/Choose\s+(?:one|(\d+))\s+(?:kind\s+of\s+)?(.+?)(?:\s+of\s+your\s+choice)?\s*$/i);
                                    if (toolMatch) {
                                        const count = parseInt(toolMatch[1] || '1', 10);
                                        const toolName = toolMatch[2].trim();
                                        choices.push({ choose: count, from: [toolName] });
                                    } else {
                                        // Fallback: use the full string as the tool name
                                        choices.push({ choose: 1, from: [bg.tool_proficiencies.replace(/Choose\s+(?:one\s+(?:kind\s+of\s+)?)?/i, '').trim()] });
                                    }
                                }
                            }
                        } catch (_e) {
                            // Background data not available yet, skip
                        }
                    }
                    return choices;
                };

               return pu.getProficiencies(
                   playerStats,
                   skill,
                   pu.getProficiencyChoiceCount,
                    {
                        raceProficiencies,
                        bonusSource: (() => {
                            const val = playerStats.class.major;
                            if (val == null || typeof val !== 'object') {
                                console.error('rules: expected class.major to be an object for', playerStats.name);
                                throw new Error('Missing object: class.major for ' + playerStats.name);
                            }
                            return val;
                        })(),
                       backgroundToolProficiencies,
                       backgroundToolProficiencyChoices,
                    }
                );
           }

         // 5e: race proficiencies from traits/subrace, uses class.subclass
        return pu.getProficiencies(
            playerStats,
            skill,
            pu.getProficiencyChoiceCount,
             {
                raceProficiencies: (ps) => {
                    const extra = [];
                    ps.race.traits.forEach(trait => {
                        if (trait.proficiencies && trait.proficiencies.length > 0) {
                            extra.push(...trait.proficiencies);
                         }
                     });
                    if (ps.race.subrace) {
                        extra.push(...(ps.race.subrace.starting_proficiencies));
                        if (!Array.isArray(ps.race.subrace.starting_proficiencies)) {
                            console.error('rules: expected starting_proficiencies to be an array for', ps.name);
                            throw new Error('Missing array: starting_proficiencies for ' + ps.name);
                        }
                        if (ps.race.subrace.racial_traits) {
                            ps.race.subrace.racial_traits.forEach(racial_trait => {
                                if (racial_trait.proficiencies && racial_trait.proficiencies.length > 0) {
                                    extra.push(...racial_trait.proficiencies);
                                 }
                             });
                         }
                     }
                    return extra;
                 },
                bonusSource: (() => {
                    const val = playerStats.class.subclass;
                    if (val == null || typeof val !== 'object') {
                        console.error('rules: expected class.subclass to be an object for', playerStats.name);
                        throw new Error('Missing object: class.subclass for ' + playerStats.name);
                    }
                    return val;
                })(),
             }
         );
     },

     // === RULESET-SPECIFIC: getActions ===
    getActions: (playerStats, playerSummary) => {
        const { classRules: cr, raceRules: rr } = rules.getSubModules(playerStats, playerSummary);
        const features = cr.getFeatures(playerStats);
        const traits = rr.getTraits(playerStats);

        if (is2024(playerStats, playerSummary)) {
             // 2024: normalize string actions, include magic/utilize/craft actions
            const playerActions = playerStats.actions;
            if (!Array.isArray(playerActions)) {
                console.error('rules: expected actions to be an array for', playerStats.name);
                throw new Error('Missing array: actions for ' + playerStats.name);
            }
            const playerActionsMapped = playerActions.map(action =>
                typeof action === 'string' ? { name: action, description: '', details: null } : action
            );

            const actions = uniqBy([
                 ...playerActionsMapped,
                 ...features.actions,
                 ...traits.actions,
                 ...(playerStats.magicActions ? playerStats.magicActions : []),
                 ...(playerStats.utilizeActions ? playerStats.utilizeActions : []),
                 ...(playerStats.craftActions ? playerStats.craftActions : [])
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const bonusActions = uniqBy([
                 ...(playerStats.bonusActions ? playerStats.bonusActions : []),
                 ...features.bonusActions,
                 ...traits.bonusActions
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const reactions = uniqBy([
                 ...(playerStats.reactions ? playerStats.reactions : []),
                 ...features.reactions,
                 ...traits.reactions
             ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const playerSpecialActions = playerStats.specialActions;
            if (!Array.isArray(playerSpecialActions)) {
                console.error('rules: expected specialActions to be an array for', playerStats.name);
                throw new Error('Missing array: specialActions for ' + playerStats.name);
            }
            const playerSpecialActionsMapped = playerSpecialActions.map(action =>
                typeof action === 'string' ? { name: action, description: '', details: null } : action
            );

             const specialActions = uniqBy([
                   ...features.specialActions,
                   ...traits.specialActions,
                   ...playerSpecialActionsMapped,
                  ...(playerStats.magicSpecialActions ? playerStats.magicSpecialActions : []),
                  ...(playerStats.utilizeSpecialActions ? playerStats.utilizeSpecialActions : []),
                  ...(playerStats.craftSpecialActions ? playerStats.craftSpecialActions : [])
              ], 'name').sort((a, b) => a.name.localeCompare(b.name));

            const characterAdvancement = uniqBy([...features.characterAdvancement, ...traits.characterAdvancement], 'name').sort((a, b) => a.name.localeCompare(b.name));

            return [actions, bonusActions, reactions, specialActions, characterAdvancement];
         }

         // 5e: original action handling
        const actions = playerStats.actions;
        if (!Array.isArray(actions)) {
            console.error('rules: expected actions to be an array for', playerStats.name);
            throw new Error('Missing array: actions for ' + playerStats.name);
        }
        const bonusActions = playerStats.bonusActions;
        if (!Array.isArray(bonusActions)) {
            console.error('rules: expected bonusActions to be an array for', playerStats.name);
            throw new Error('Missing array: bonusActions for ' + playerStats.name);
        }
        const reactions = playerStats.reactions;
        if (!Array.isArray(reactions)) {
            console.error('rules: expected reactions to be an array for', playerStats.name);
            throw new Error('Missing array: reactions for ' + playerStats.name);
        }
        const specialActions = playerStats.specialActions;
        if (!Array.isArray(specialActions)) {
            console.error('rules: expected specialActions to be an array for', playerStats.name);
            throw new Error('Missing array: specialActions for ' + playerStats.name);
        }
        const actionsResult = uniqBy([...actions, ...features.actions, ...traits.actions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const bonusActionsResult = uniqBy([...bonusActions, ...features.bonusActions, ...traits.bonusActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const reactionsResult = uniqBy([...reactions, ...features.reactions, ...traits.reactions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const specialActionsResult = uniqBy([...specialActions, ...features.specialActions, ...traits.specialActions], 'name').sort((a, b) => a.name.localeCompare(b.name));
        const characterAdvancement = uniqBy([...features.characterAdvancement, ...traits.characterAdvancement], 'name').sort((a, b) => a.name.localeCompare(b.name));

        return [actionsResult, bonusActionsResult, reactionsResult, specialActionsResult, characterAdvancement];
     },

     // === SHARED: getArmorClass (mostly shared, 5e-specific features at bottom) ===
    getArmorClass: (allEquipment, playerStats, playerSummary) => {
        const constitution = playerStats.abilities.find((ability) => ability.name === 'Constitution');
        const dexterity = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        const wisdom = playerStats.abilities.find((ability) => ability.name === 'Wisdom');
        const charisma = playerStats.abilities.find((ability) => ability.name === 'Charisma');

        let armorName = playerStats.inventory.equipped.find(itemName => {
            let item = allEquipment.find((item) => item.name === parseMagicItemName(itemName).baseName);
            if (item) {
                return item.equipment_category === 'Armor' && item.armor_category !== 'Shield';
             }
            return false;
         });

        let addedBonus = 0;
        let contributions = [];

        if (playerStats.class.name === 'Monk') {
            addedBonus += wisdom.bonus;
            contributions.push(`Monk Wisdom Bonus (${wisdom.bonus})`);
         }

           // 5e-specific: Defense fighting style
           if (!is2024(playerStats, playerSummary)) {
               if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Defense') && armorName) {
                   addedBonus += 1;
                   contributions.push(`Fighting Style Defense (1)`);
                }
            }

            // Unarmed Fighting fighting style - +2 AC when unarmed and not holding anything in both hands
            const hasUnarmedFighting = playerStats.class?.fightingStyles && playerStats.class.fightingStyles.includes('Unarmed Fighting');
            if (hasUnarmedFighting) {
                const equippedItems = playerStats.inventory?.equipped || [];
                const hasAnyWeapon = equippedItems.some(equipName => {
                    const { baseName } = parseMagicItemName(equipName);
                    const item = allEquipment.find(e => e.name === baseName);
                    return item && item.equipment_category === 'Weapon';
                });
                const hasShield = equippedItems.some(equipName => {
                    const { baseName } = parseMagicItemName(equipName);
                    return baseName === 'Shield';
                });
                const isUnarmed = !hasAnyWeapon && !hasShield;
                if (isUnarmed) {
                    addedBonus += 2;
                    contributions.push(`Fighting Style Unarmed (2)`);
                }
            }

        let armorClass;
        if (armorName) {
            let parsedArmor = parseMagicItemName(armorName);
            contributions.push(`Armor Magic Bonus (${parsedArmor.magicBonus})`);
            let armor = allEquipment.find((item) => item.name === parsedArmor.baseName);
            armorClass = armor.armor_class.base + addedBonus + parsedArmor.magicBonus;
            contributions.push(`Armor (${armor.armor_class.base})`);
            if (armor.armor_class.dex_bonus) {
                let armorBonus = dexterity.bonus;
                contributions.push(`Dexterity Bonus (${dexterity.bonus})`);
                if (armor.armor_class.max_bonus) {
                    armorBonus = Math.min(armor.armor_class.max_bonus, armorBonus);
                 }
                armorClass = armor.armor_class.base + armorBonus + addedBonus + parsedArmor.magicBonus;
             }
         } else {
            armorClass = 10 + dexterity.bonus + addedBonus;
            contributions.push(`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus})`);
         }

        let shield = playerStats.inventory.equipped.find(item => parseMagicItemName(item).baseName === 'Shield');
        if (shield) {
            const parsedShield = parseMagicItemName(shield);
            armorClass += 2 + parsedShield.magicBonus;
            contributions.push(`Shield (2) + Shield Magic Bonus (${parsedShield.magicBonus})`);
         } else if (playerStats.inventory.equipped.find(item => item === 'Shield')) {
            armorClass += 2;
            contributions.push(`Shield (2)`);
         }

         // 5e-specific: Cloak and Ring of Protection
        if (!is2024(playerStats, playerSummary)) {
            if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Cloak of Protection')) {
                armorClass += 1;
                contributions.push(`Cloak of Protection (1)`);
             }
            if (playerStats.inventory.magicItems && playerStats.inventory.magicItems.some(item => item.name === 'Ring of Protection')) {
                armorClass += 1;
                contributions.push(`Ring of Protection (1)`);
             }
         }

        // 5e-specific: Barbarian and Draconic Sorcerer unarmored defense
        if (!is2024(playerStats, playerSummary)) {
            if (playerStats.class.name === 'Barbarian') {
                const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
                if (barbarianAc > armorClass) {
                    armorClass = barbarianAc;
                    contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`];
                 }
             } else if (playerStats.class.subclass && playerStats.class.subclass.name === 'Draconic') {
                const sorcererAc = 13 + dexterity.bonus;
                if (sorcererAc > armorClass) {
                    armorClass = sorcererAc;
                    contributions = [`Unarmored AC (13) + Dexterity Bonus (${dexterity.bonus})`];
                 }
             }
         }

          // 2024: College of Dance unarmored defense (AC = 10 + DEX + CHA, no armor or shield)
          // 2024: Draconic Sorcery unarmored defense (AC = 10 + DEX + CHA, no armor)
          if (is2024(playerStats, playerSummary)) {
              if (playerStats.class.subclass && playerStats.class.subclass.name === 'College of Dance' && !armorName && !shield) {
                  const danceAc = 10 + dexterity.bonus + charisma.bonus;
                  if (danceAc > armorClass) {
                      armorClass = danceAc;
                      contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Charisma Bonus (${charisma.bonus})`];
                   }
               }
               if (playerStats.class.major && playerStats.class.major.name === 'Draconic Sorcery' && !armorName) {
                  const draconicAc = 10 + dexterity.bonus + charisma.bonus;
                  if (draconicAc > armorClass) {
                      armorClass = draconicAc;
                      contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Charisma Bonus (${charisma.bonus})`];
                   }
               }
                if (playerStats.class.name === 'Barbarian' && !armorName) {
                   const barbarianAc = 10 + dexterity.bonus + constitution.bonus;
                   if (barbarianAc > armorClass) {
                       armorClass = barbarianAc;
                       contributions = [`Unarmored AC (10) + Dexterity Bonus (${dexterity.bonus}) + Constitution Bonus (${constitution.bonus})`];
                    }
                }
            }

          // 2024: Apply ac_bonus from passive_buff automation (e.g., Defense feat)
          if (is2024(playerStats, playerSummary)) {
               const passives = playerStats.automation?.passives;
               if (!Array.isArray(passives)) {
                   console.error('rules: expected passives to be an array for', playerStats.name);
                   throw new Error('Missing array: passives for ' + playerStats.name);
               }
               for (const passive of passives) {
                  if (passive.type === 'passive_buff' && passive.effect === 'ac_bonus' && passive.bonus) {
                      const bonus = typeof passive.bonus === 'number' ? passive.bonus : parseInt(passive.bonus, 10);
                      if (!isNaN(bonus) && bonus > 0) {
                          const condition = passive.condition || '';
                          if (condition === 'wearing_light_medium_or_heavy_armor') {
                              if (armorName) {
                                  const armor = allEquipment.find(item => item.name === parseMagicItemName(armorName).baseName);
                                  if (armor && ['Light', 'Medium', 'Heavy'].includes(armor.armor_category)) {
                                      armorClass += bonus;
                                      contributions.push(`${passive.name || 'Defense'} (+${bonus})`);
                                  }
                              }
                          } else if (!condition) {
                              armorClass += bonus;
                              contributions.push(`${passive.name || 'Passive Buff'} (+${bonus})`);
                          }
                      }
                  }
              }

              // 2024: Medium Armor Master – increase medium armor dex bonus cap from 2 to 3 when Dex >= 16
              const mediumArmorMasterPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'medium_armor_dex_bonus_increase');
              if (mediumArmorMasterPassive && armorName) {
                  const armor = allEquipment.find(item => item.name === parseMagicItemName(armorName).baseName);
                  if (armor && armor.armor_category === 'Medium' && dexterity.totalScore >= 16) {
                      const dexMod = dexterity.bonus;
                      const currentMaxBonus = armor.armor_class.max_bonus != null ? armor.armor_class.max_bonus : 99;
                      const bonusToAdd = parseInt(mediumArmorMasterPassive.bonusExpression || mediumArmorMasterPassive.bonus || '1', 10);
                      const newMaxBonus = currentMaxBonus + bonusToAdd;
                      const actualBonus = Math.min(dexMod, newMaxBonus);
                      const originalBonus = Math.min(dexMod, currentMaxBonus);
                      if (actualBonus > originalBonus) {
                          armorClass += (actualBonus - originalBonus);
                          contributions.push(`Medium Armor Master (+${actualBonus - originalBonus})`);
                      }
                  }
              }
          }

          return [armorClass, contributions.join(' + ')];
     },

     // === SHARED: getLanguages (handles both rulesets internally) ===
     getLanguages: (playerStats, playerSummary) => {
         let languages = playerStats.race?.languages;
         if (!Array.isArray(languages)) {
             console.error('rules: expected race.languages to be an array for', playerStats.name);
             throw new Error('Missing array: race.languages for ' + playerStats.name);
         }
         languages = [...languages];
         let languagesAllowed = languages.length;
         languagesAllowed += 2; // Background languages

         if (playerStats.race.language_choices) {
             languagesAllowed += playerStats.race.language_choices.choose || 0;
          }

         if (playerStats.race.subrace && playerStats.race.subrace.language_options) {
             let subraceLanguages = playerStats.race.subrace.languages;
             if (!Array.isArray(subraceLanguages)) {
                 console.error('rules: expected subrace.languages to be an array for', playerStats.name);
                 throw new Error('Missing array: subrace.languages for ' + playerStats.name);
             }
             languages = [...new Set([...languages, ...subraceLanguages])];
             languagesAllowed += playerStats.race.subrace.language_options.choose || 0;
          }

         let classLanguages = playerStats.class?.languages || [];
         if (!Array.isArray(classLanguages)) {
             console.error('rules: expected class.languages to be an array for', playerStats.name);
             throw new Error('Missing array: class.languages for ' + playerStats.name);
         }
         languages = [...new Set([...languages, ...classLanguages])];

        if (playerStats.class?.language_choices) {
            let rangerLanguageBonus = playerStats.class.language_choices.choose || 0;
            languagesAllowed += rangerLanguageBonus;
            if (playerStats.class.name === 'Ranger') {
                if (playerStats.level > 5) languagesAllowed += 1;
                if (playerStats.level > 13) languagesAllowed += 1;
             }
         }

         // 5e: class.subclass.language_choices, 2024: class.major.language_choices
        const use2024 = is2024(playerStats, playerSummary);
        if (use2024) {
            if (playerStats.class.major && playerStats.class.major.language_choices) {
                languagesAllowed += playerStats.class.major.language_choices.choose || 0;
             }
         } else {
            if (playerStats.class.subclass && playerStats.class.subclass.language_choices) {
                languagesAllowed += playerStats.class.subclass.language_choices.choose || 0;
             }
         }

        if (playerStats.languages) {
            languages = [...new Set([...languages, ...playerStats.languages])];
         }

        return [languagesAllowed, languages.sort()];
     },

     // === SHARED: getMagicItems (handles both rulesets internally) ===
     getMagicItems: (allMagicItems, playerSummary, playerStats) => {
         const inventoryMagicItems = playerSummary.inventory?.magicItems;
         if (!Array.isArray(inventoryMagicItems)) {
             console.error('rules: expected inventory.magicItems to be an array for', playerSummary.name || 'unknown');
             throw new Error('Missing array: inventory.magicItems for ' + (playerSummary.name || 'unknown'));
         }

        if (!allMagicItems || inventoryMagicItems.length === 0) {
             // 2024 returns [], 5e returns null
            if (is2024(playerStats, playerSummary)) {
                return [];
             }
            return null;
         }

        const processedItems = inventoryMagicItems.map(itemNameOrObj => {
            let itemName = typeof itemNameOrObj === 'string' ? itemNameOrObj : itemNameOrObj.name;
            const magicItem = allMagicItems.find(m => m.name === itemName);

            if (!magicItem) {
                if (is2024(playerStats, playerSummary)) {
                    return null; // 2024 filters out nulls
                 }
                return { ...itemNameOrObj }; // 5e keeps the item even if not found
             }

            if (magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
                return { ...magicItem, details: magicItem.description, description: itemNameOrObj.spell || itemNameOrObj.description };
             }

            const result = { ...magicItem };
            if (typeof itemNameOrObj === 'object' && itemNameOrObj.quantity) {
                result.quantity = itemNameOrObj.quantity;
             }
            if (typeof itemNameOrObj === 'object' && itemNameOrObj.rarity) {
                result.rarity = itemNameOrObj.rarity;
             }

            return result;
         });

         // 2024 filters out nulls, 5e does not
        if (is2024(playerStats, playerSummary)) {
            return processedItems.filter(item => item !== null);
         }

        return processedItems;
     },

     // === SHARED: getPlayerStats (handles both rulesets internally) ===
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
        const playerStats = cloneDeep(playerSummary);

         // Preserve rules type for downstream dispatch
        playerStats.rules = playerSummary.rules || '5e';

        playerStats.proficiency = Math.floor((playerSummary.level - 1) / 4 + 2);

        const { classRules: cr, raceRules: rr } = rules.getSubModules(playerStats, playerSummary);

         playerStats.class = cr.getClass(allClasses, playerSummary);
         playerStats.wildMagicSurgeTable = playerStats.class?.wild_magic_surge_table || null;
         playerStats.race = rr.getRace(allRaces, playerSummary);
          applyPowerfulBuild(playerStats);
          applyHalflingNimbleness(playerStats);
          playerStats.inventory.magicItems = rules.getMagicItems(allMagicItems, playerSummary, playerStats);

         // 2024-specific: set senses early, store equipment
        if (is2024(playerStats, playerSummary)) {
            playerStats.senses = [];
            playerStats.equipment = allEquipment;
         }

        playerStats.actions = playerStats.actions || [];
        playerStats.bonusActions = playerStats.bonusActions || [];
        playerStats.reactions = playerStats.reactions || [];
        playerStats.specialActions = playerStats.specialActions || [];
        playerStats.characterAdvancement = playerStats.characterAdvancement || [];
        playerStats.expertise = playerStats.expertise || [];

            [playerStats.actions, playerStats.bonusActions, playerStats.reactions, playerStats.specialActions, playerStats.characterAdvancement] = rules.getActions(playerStats, playerSummary);

          // 5e-specific: Interception fighting style - add reaction feature
           if (!is2024(playerStats, playerSummary)) {
               if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Interception')) {
                   const existingInterception = playerStats.reactions.find(r => r.name === 'Interception');
                   if (!existingInterception) {
                       playerStats.reactions.push({
                           name: 'Interception',
                           description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You can then reduce the damage the target takes by 1d10 + your proficiency bonus. You must be holding a shield to use this feature.',
                           type: 'interception',
                           automation: {
                               type: 'interception',
                               trigger: 'ally_within_5ft_attacked',
                               range: '5_ft',
                               damageExpression: '1d10',
                               damageType: '',
                               damageBonusExpression: 'proficiency_bonus',
                               requiresShield: true,
                               casting_time: '1 reaction',
                               hasAutomation: true,
                           },
                           hasAutomation: true,
                       });
                   }
               }

                // Protection fighting style - add reaction feature
                if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Protection')) {
                    const existingProtection = playerStats.reactions.find(r => r.name === 'Protection');
                    if (!existingProtection) {
                        playerStats.reactions.push({
                            name: 'Protection',
                            description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
                            type: 'protection',
                            automation: {
                                type: 'reaction_debuff',
                                trigger: 'creature_attacks_ally_within_5ft_while_holding_shield',
                                effect: 'disadvantage_on_attacks_vs_ally',
                                duration: 'until_start_of_next_turn',
                                requiresShield: true,
                                casting_time: '1 reaction',
                                hasAutomation: true,
                            },
                            hasAutomation: true,
                        });
                    }
                  }
              }

            // 2024: Protection fighting style - add reaction feature
            if (is2024(playerStats, playerSummary)) {
                if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Protection')) {
                    const existingProtection = playerStats.reactions.find(r => r.name === 'Protection');
                    if (!existingProtection) {
                        playerStats.reactions.push({
                            name: 'Protection',
                            description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can take a Reaction to interpose your Shield if you\'re holding one. You impose Disadvantage on the triggering attack roll and all other attack rolls against the target until the start of your next turn if you remain within 5 feet of the target.',
                            type: 'protection',
                            automation: {
                                type: 'reaction_debuff',
                                trigger: 'creature_attacks_ally_within_5ft_while_holding_shield',
                                effect: 'disadvantage_on_attacks_vs_ally',
                                duration: 'until_start_of_next_turn',
                                requiresShield: true,
                                casting_time: '1 reaction',
                                hasAutomation: true,
                            },
                            hasAutomation: true,
                        });
                    }
                }
            }

            // 2024: Interception fighting style - add reaction feature
            if (is2024(playerStats, playerSummary)) {
                if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Interception')) {
                    const existingInterception = playerStats.reactions.find(r => r.name === 'Interception');
                    if (!existingInterception) {
                        playerStats.reactions.push({
                            name: 'Interception',
                            description: 'When a creature you can see hits another creature within 5 feet of you with an attack roll, you can take a Reaction to reduce the damage dealt to the target by 1d10 plus your Proficiency Bonus. You must be holding a Shield or a Simple or Martial weapon to use this Reaction.',
                            type: 'interception',
                            automation: {
                                type: 'interception',
                                trigger: 'creature_hits_ally_within_5ft',
                                range: '5_ft',
                                damageExpression: '1d10',
                                damageType: '',
                                damageBonusExpression: 'proficiency_bonus',
                                requiresShieldOrWeapon: true,
                                casting_time: '1 reaction',
                                hasAutomation: true,
                            },
                            hasAutomation: true,
                        });
                    }
                }
            }

            // 5e-specific: Thrown Weapon Fighting fighting style - add passive automation
            if (!is2024(playerStats, playerSummary)) {
                if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Thrown Weapon Fighting')) {
                    const existingThrownWeapon = playerStats.specialActions.find(a => a.name === 'Thrown Weapon Fighting');
                    if (!existingThrownWeapon) {
                        playerStats.specialActions.push({
                            name: 'Thrown Weapon Fighting',
                            description: 'You can treat any short sword that you hold with one hand as if it had the thrown property, and you can make ranged attacks with a short sword as if you had the light property with it. When you make a ranged attack roll with a thrown weapon, you add your proficiency bonus to the attack roll.',
                            type: 'thrown_weapon_fighting',
                            automation: {
                                type: 'passive_rule',
                                effect: 'thrown_weapon_fighting',
                                hasAutomation: true,
                            },
                            hasAutomation: true,
                        });
                    }
                }
            }

             // 5e-specific: Two-Weapon Fighting fighting style - add passive automation
             if (!is2024(playerStats, playerSummary)) {
                 if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Two-Weapon Fighting')) {
                     const existingTwoWeapon = playerStats.specialActions.find(a => a.name === 'Two-Weapon Fighting');
                     if (!existingTwoWeapon) {
                         playerStats.specialActions.push({
                             name: 'Two-Weapon Fighting',
                             description: 'If you are wielding a light melee weapon that you are holding in one hand, a light melee weapon that you are holding in the other hand, and no armor shields, you can add your ability modifier to the damage of the second attack.',
                             type: 'two_weapon_fighting',
                             automation: {
                                 type: 'passive_rule',
                                 effect: 'two_weapon_fighting',
                                 hasAutomation: true,
                             },
                             hasAutomation: true,
                         });
                     }
                 }
             }

              // Blessed Warrior fighting style - add passive automation (+2 melee attack rolls)
              if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Blessed Warrior')) {
                  const existingBlessedWarrior = playerStats.specialActions.find(a => a.name === 'Blessed Warrior');
                  if (!existingBlessedWarrior) {
                      playerStats.specialActions.push({
                          name: 'Blessed Warrior',
                          description: 'You gain a +2 bonus to attack rolls you make with melee weapons.',
                          type: 'blessed_warrior',
                          automation: {
                              type: 'passive_rule',
                              effect: 'blessed_warrior',
                              hasAutomation: true,
                          },
                          hasAutomation: true,
                      });
                  }
              }

               // Druidic Warrior fighting style - add passive automation (+2 melee damage rolls)
               if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Druidic Warrior')) {
                   const existingDruidicWarrior = playerStats.specialActions.find(a => a.name === 'Druidic Warrior');
                   if (!existingDruidicWarrior) {
                       playerStats.specialActions.push({
                           name: 'Druidic Warrior',
                           description: 'You gain a +2 bonus to damage rolls you make with melee weapons.',
                           type: 'druidic_warrior',
                           automation: {
                               type: 'passive_rule',
                               effect: 'druidic_warrior',
                               hasAutomation: true,
                           },
                           hasAutomation: true,
                       });
                   }
               }

               // Superior Technique fighting style - add Combat Superiority special action
               if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Superior Technique')) {
                   const existingSuperiorTechnique = playerStats.specialActions.find(a => a.name === 'Combat Superiority');
                   if (!existingSuperiorTechnique) {
                       playerStats.specialActions.push({
                           name: 'Combat Superiority',
                           description: 'You learn one maneuver of your choice from the Battle Master. You can use your superiority dice to fuel that maneuver. Use Combat Superiority during combat to deploy a maneuver.',
                           type: 'combat_superiority',
                           automation: {
                               type: 'combat_superiority',
                               dieExpression: 'superiority_die',
                               uses_max: 4,
                               maxOptions: 3,
                               maxOptionsScaling: { 7: 1, 10: 1, 15: 1 },
                               hasAutomation: true,
                           },
                           hasAutomation: true,
                       });
                   }
               }

             const allFeatures = [
            ...playerStats.actions,
            ...playerStats.bonusActions,
            ...playerStats.reactions,
            ...playerStats.specialActions,
            ...playerStats.characterAdvancement,
          ];

         // 2024: add background features to automation (e.g., Hermit's Wit)
         if (is2024(playerStats, playerSummary) && playerStats.background) {
             try {
                 const backgrounds = loadBackgroundData('2024');
                 if (backgrounds) {
                     const bg = backgrounds.find(b => b.name === playerStats.background || b.index === playerStats.background.toLowerCase());
                     if (bg && bg.features && Array.isArray(bg.features)) {
                         bg.features.forEach(feature => {
                             if (feature.automation) {
                                 const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation];
                                 automations.forEach(auto => {
                                     const info = buildAttackInfo({ ...feature, automation: auto }, playerStats);
                                     if (info && (info.type === 'passive_buff' || info.type === 'passive_rule')) {
                                         allFeatures.push({ name: feature.name, description: feature.description || '', automation: auto, hasAutomation: true });
                                     }
                                 });
                             }
                         });
                      }
                  }
              } catch (_e) {
                  // Background data not available yet, skip
              }
          }

          // 2024: Add fighting style feat features to allFeatures so their passive_buff automation is collected
          if (is2024(playerStats, playerSummary) && playerStats.class?.fightingStyles?.length > 0) {
              try {
                  const feats = await loadFeatData('2024');
                  if (feats) {
                      const fightingStyleFeats = feats.filter(f =>
                          f.prerequisites && f.prerequisites.feature === 'Fighting Style'
                      );
                       fightingStyleFeats.forEach(feat => {
                           const normalizedFeatName = feat.name.replace(/[-\s]/g, '');
                           if (playerStats.class.fightingStyles.some(s => s.replace(/[-\s]/g, '') === normalizedFeatName) && feat.benefits) {
                               feat.benefits.forEach(benefit => {
                                   if (benefit.name === 'Great Weapon Fighting' || benefit.name === 'Damage Die Reroll') {
                                       allFeatures.push({ name: 'Great Weapon Fighting', description: benefit.description || feat.description || '', automation: { type: 'great_weapon_fighting' }, hasAutomation: true });
                                   } else if (benefit.name && benefit.name.includes('Extra Attack Damage')) {
                                       allFeatures.push({ name: 'Two Weapon Fighting', description: benefit.description || feat.description || '', automation: { type: 'two_weapon_fighting' }, hasAutomation: true });
                                   } else if (benefit.automation) {
                                       const automations = Array.isArray(benefit.automation) ? benefit.automation : [benefit.automation];
                                       automations.forEach(auto => {
                                           const info = buildAttackInfo({ ...benefit, automation: auto }, playerStats);
                                           if (info && (info.type === 'passive_buff' || info.type === 'passive_rule')) {
                                               allFeatures.push({ name: feat.name, description: feat.description || '', automation: auto, hasAutomation: true });
                                           }
                                       });
                                   }
                               });
                          }
                      });
                  }
              } catch (_e) {
                  // Feat data not available yet, skip
              }
          }

           playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
         playerStats.saveModifiers = collectSaveModifiers(allFeatures);
        playerStats.evasionEffects = getEvasionEffects(allFeatures);
        playerStats.automationConditionImmunities = getConditionImmunities(allFeatures);
        playerStats.automationConditionalImmunities = getConditionalImmunities(allFeatures);
        playerStats.turnStartEffects = collectTurnStartEffects(allFeatures);
        playerStats.saveProficiencies = getAllSaveProficiencies(allFeatures, playerStats);
          [playerStats.languagesAllowed, playerStats.languages] = rules.getLanguages(playerStats, playerSummary);
          [playerStats.proficienciesAllowed, playerStats.proficiencies] = rules.getProficiencies(playerStats, false, playerSummary);
          [playerStats.skillProficienciesAllowed, playerStats.skillProficiencies] = rules.getProficiencies(playerStats, true, playerSummary);

        // Apply feat buffs to ability featIncrease before computing abilities
        const featData = await loadFeatData(is2024(playerStats, playerSummary) ? '2024' : '5e');
        const featBuffs = computeAllFeatBuffs(playerStats, featData);
        featBuffs.abilityScoreIncreases.forEach(inc => {
            if (inc.name && inc.name !== 'any') {
                const ability = playerStats.abilities.find(
                    a => a.name.toLowerCase() === inc.name.toLowerCase()
                );
                if (ability) {
                    ability.featIncrease = (ability.featIncrease || 0) + inc.amount;
                }
            }
        });

        // Apply all_skills proficiency feat buffs to skillProficiencies
        const allSkillProfs = featBuffs.proficiencies.filter(p => p.name === 'all_skills' && p.type === 'skill');
        if (allSkillProfs.length > 0) {
            const skills = await loadSkills();
            const allSkillNames = skills.map(s => s.name);
            playerStats.skillProficiencies = [...new Set([...playerStats.skillProficiencies, ...allSkillNames])];
        }

        // Apply proficiency choice feat buffs (e.g., Crafter's 3 Artisan's Tools)
        const featProficiencyChoices = featBuffs.proficiencies.filter(p => p.type === 'proficiency' && p.isChoice);
        if (featProficiencyChoices.length > 0) {
            let profs = playerStats.proficiencies;
            if (!Array.isArray(profs)) {
                console.error('rules: expected proficiencies to be an array for', playerStats.name);
                throw new Error('Missing array: proficiencies for ' + playerStats.name);
            }
            const existingProfs = new Set(profs);
            featProficiencyChoices.forEach(fp => {
                if (fp.choose && fp.from) {
                    const listName = fp.from[0];
                    const profName = `${fp.choose} from: ${listName}`;
                    if (!existingProfs.has(profName)) {
                        playerStats.proficiencies = [...profs, profName];
                        existingProfs.add(profName);
                    }
                }
            });
        }

        // Apply expertise feat buffs (e.g., Keen Mind Lore Knowledge, Observant's Keen Observer)
        // When a player has a proficiency choice from a feat that grants expertise,
        // mark any selected skill from that choice list as expertise
        if (is2024(playerStats, playerSummary)) {
            let expertiseProfs = playerStats.expertise;
            if (!Array.isArray(expertiseProfs)) {
                console.error('rules: expected expertise to be an array for', playerStats.name);
                throw new Error('Missing array: expertise for ' + playerStats.name);
            }
            const expertiseSkills = new Set(expertiseProfs);
            // Also support expertSkills field (wizard form field name)
            if (playerStats.expertSkills && Array.isArray(playerStats.expertSkills)) {
                playerStats.expertSkills.forEach(s => {
                    if (typeof s === 'string' && s.length > 0) expertiseSkills.add(s);
                });
            }
            featProficiencyChoices.forEach(fp => {
                if (!fp.grantsExpertise) return;
                if (fp.from) {
                    const listName = fp.from[0];
                    const profName = `${fp.choose} from: ${listName}`;
                    const profs = playerStats.proficiencies;
                    if (!Array.isArray(profs)) {
                        console.error('rules: expected proficiencies to be an array for', playerStats.name);
                        throw new Error('Missing array: proficiencies for ' + playerStats.name);
                    }
                    const existingProfIdx = profs.indexOf(profName);
                    if (existingProfIdx !== -1) {
                        const chosenSkills = profs.filter(s => {
                            if (typeof s !== 'string') return false;
                            const match = s.match(/^(\d+) from: (.+)$/);
                            if (!match) return false;
                            return match[2] === listName;
                        });
                        chosenSkills.forEach(chosenSkill => {
                            const skillMatch = chosenSkill.match(/^\d+ from: (.+)$/);
                            if (skillMatch) {
                                const skillName = skillMatch[1].trim();
                                if (!expertiseSkills.has(skillName)) {
                                    expertiseSkills.add(skillName);
                                }
                            }
                        });
                    }
                }
            });
            playerStats.expertise = Array.from(expertiseSkills);
        }

        // Apply non-choice, non-skill proficiency feat buffs (e.g., Heavily Armored → Heavy Armor)
        const featNonChoiceProfs = featBuffs.proficiencies.filter(p => p.type === 'proficiency' && !p.isChoice);
        if (featNonChoiceProfs.length > 0) {
            let profs = playerStats.proficiencies;
            if (!Array.isArray(profs)) {
                console.error('rules: expected proficiencies to be an array for', playerStats.name);
                throw new Error('Missing array: proficiencies for ' + playerStats.name);
            }
            const existingProfs = new Set(profs);
            featNonChoiceProfs.forEach(fp => {
                if (fp.name && !existingProfs.has(fp.name)) {
                    playerStats.proficiencies = [...profs, fp.name];
                    existingProfs.add(fp.name);
                }
            });
        }

        // Add feat features to their proper action arrays based on casting_time for display
        // Feat names are stored in the character's JSON and are sufficient to compute
        // automation when playerStats are computed - feat features are NOT stored in
        // formData.specialActions during character creation
        const featFeatures = featBuffs.features;
        if (!Array.isArray(featFeatures)) {
            console.error('rules: expected features to be an array for', playerStats.name);
            throw new Error('Missing array: features for ' + playerStats.name);
        }
        if (featFeatures.length > 0) {
            for (const featFeature of featFeatures) {
                if (!featFeature.name) continue;

                const featEntry = {
                    name: featFeature.name,
                    description: featFeature.description || '',
                    type: featFeature.type || 'passive',
                    source: 'feat',
                    automation: featFeature.automation,
                };

                const featureCategories = getCategories(playerStats.rules || '5e');

                // Categorize by automation.casting_time
                let castingTime = featFeature.automation?.casting_time;
                if (castingTime) {
                    const ct = castingTime;
                    if (ct === '1 action' && !playerStats.actions.some(f => f.name === featFeature.name)) {
                        playerStats.actions = [...playerStats.actions, featEntry];
                    } else if (ct === '1 bonus action' && !playerStats.bonusActions.some(f => f.name === featFeature.name)) {
                        playerStats.bonusActions = [...playerStats.bonusActions, featEntry];
                    } else if (ct === '1 reaction' && !playerStats.reactions.some(f => f.name === featFeature.name)) {
                        playerStats.reactions = [...playerStats.reactions, featEntry];
                    } else if (ct === 'passive' && featureCategories.characterAdvancement.includes(featFeature.name) && !playerStats.characterAdvancement.some(f => f.name === featFeature.name)) {
                        playerStats.characterAdvancement = [...playerStats.characterAdvancement, featEntry];
                    } else {
                        playerStats.specialActions = [...playerStats.specialActions, featEntry];
                    }
                } else {
                    // No automation.casting_time — go to specialActions unless name matches a category
                    if (featureCategories.characterAdvancement.includes(featFeature.name) && !playerStats.characterAdvancement.some(f => f.name === featFeature.name)) {
                        playerStats.characterAdvancement = [...playerStats.characterAdvancement, featEntry];
                    } else if (featureCategories.actions.includes(featFeature.name) && !playerStats.actions.some(f => f.name === featFeature.name)) {
                        playerStats.actions = [...playerStats.actions, featEntry];
                    } else if (featureCategories.bonusActions.includes(featFeature.name) && !playerStats.bonusActions.some(f => f.name === featFeature.name)) {
                        playerStats.bonusActions = [...playerStats.bonusActions, featEntry];
                    } else if (featureCategories.reactions.includes(featFeature.name) && !playerStats.reactions.some(f => f.name === featFeature.name)) {
                        playerStats.reactions = [...playerStats.reactions, featEntry];
                    } else if (!playerStats.specialActions.some(f => f.name === featFeature.name)) {
                        playerStats.specialActions = [...playerStats.specialActions, featEntry];
                    }
                }
            }

            // Re-sort all action arrays after feat features are merged
            playerStats.actions = uniqBy(playerStats.actions, 'name').sort((a, b) => a.name.localeCompare(b.name));
            playerStats.bonusActions = uniqBy(playerStats.bonusActions, 'name').sort((a, b) => a.name.localeCompare(b.name));
            playerStats.reactions = uniqBy(playerStats.reactions, 'name').sort((a, b) => a.name.localeCompare(b.name));
            playerStats.specialActions = uniqBy(playerStats.specialActions, 'name').sort((a, b) => a.name.localeCompare(b.name));
            playerStats.characterAdvancement = uniqBy(playerStats.characterAdvancement, 'name').sort((a, b) => a.name.localeCompare(b.name));
        }

        // Add feat features to allFeatures for automation processing
        if (featFeatures.length > 0) {
            featFeatures.forEach(featFeature => {
                if (!featFeature.name) return;
                allFeatures.push({
                    name: featFeature.name,
                    description: featFeature.description || '',
                    type: featFeature.type || 'passive',
                    source: 'feat',
                    automation: featFeature.automation,
                });
            });
            // Re-process automation with feat features included
          playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);

         try {
             const maneuverSelection = getRuntimeValue(playerStats.name, 'BattleMasterManeuvers_selection', playerSummary.campaignName);
             const knownNames = Array.isArray(maneuverSelection) ? maneuverSelection : [];
             if (knownNames.length > 0) {
                 const maneuvers = await loadManeuvers(playerStats.rules || '2024');
                 const bonusActionManeuvers = maneuvers.filter(m => knownNames.includes(m.name) && m.actionType === 'bonus_action');
                  if (bonusActionManeuvers.length > 0) {
                      bonusActionManeuvers.forEach(m => {
                          allFeatures.push({
                              name: m.name,
                              description: m.description || '',
                              automation: {
                                  type: 'combat_superiority_bonus_action',
                                  maneuverName: m.name,
                                  actionType: 'bonus_action',
                                  effect: m.effect,
                                  saveType: m.saveType || null,
                                  saveAbility: m.saveAbility || null,
                                  conditionInflicted: m.conditionInflicted || null,
                                  value: m.value || null,
                                  range: m.range || null,
                                  damageBonus: m.damageBonus || false,
                                  dieExpression: m.dieExpression || 'superiority_die',
                                  hasAutomation: true,
                              },
                              hasAutomation: true,
                          });
                      });
                      playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
                  }

                  const reactionManeuvers = maneuvers.filter(m => knownNames.includes(m.name) && m.actionType === 'reaction');
                  if (reactionManeuvers.length > 0) {
                      reactionManeuvers.forEach(m => {
                          allFeatures.push({
                              name: m.name,
                              description: m.description || '',
                              automation: {
                                  type: 'combat_superiority_reaction',
                                  maneuverName: m.name,
                                  actionType: 'reaction',
                                  trigger: m.trigger || null,
                                  effect: m.effect,
                                  modifierAbility: m.modifierAbility || null,
                                  damageBonus: m.damageBonus || false,
                                  dieExpression: m.dieExpression || 'superiority_die',
                                  hasAutomation: true,
                              },
                              hasAutomation: true,
                          });
                      });
                      playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
                  }

                  const grantAttackManeuvers = maneuvers.filter(m => knownNames.includes(m.name) && m.actionType === 'grant_attack');
                  if (grantAttackManeuvers.length > 0) {
                      grantAttackManeuvers.forEach(m => {
                          allFeatures.push({
                              name: m.name,
                              description: m.description || '',
                              automation: {
                                  type: 'combat_superiority_grant_attack',
                                  maneuverName: m.name,
                                  actionType: 'grant_attack',
                                  trigger: m.trigger || null,
                                  effect: m.effect,
                                  damageBonus: m.damageBonus || false,
                                  dieExpression: m.dieExpression || 'superiority_die',
                                  range: m.range || '30_ft',
                                  oncePerTurn: true,
                                  hasAutomation: true,
                              },
                              hasAutomation: true,
                          });
                      });
                      playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
                  }

                   const movementManeuvers = maneuvers.filter(m => knownNames.includes(m.name) && m.actionType === 'movement');
                   if (movementManeuvers.length > 0) {
                       movementManeuvers.forEach(m => {
                           allFeatures.push({
                               name: m.name,
                               description: m.description || '',
                               automation: {
                                   type: 'combat_superiority_movement',
                                   maneuverName: m.name,
                                   actionType: 'movement',
                                   trigger: m.trigger || null,
                                   effect: m.effect,
                                   damageBonus: m.damageBonus || false,
                                   dieExpression: m.dieExpression || 'superiority_die',
                                   range: m.range || '5_ft',
                                   hasAutomation: true,
                               },
                               hasAutomation: true,
                           });
                       });
                       playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
                   }

                    const skillCheckManeuvers = maneuvers.filter(m => knownNames.includes(m.name) && m.actionType === 'skill_check');
                    if (skillCheckManeuvers.length > 0) {
                        skillCheckManeuvers.forEach(m => {
                            allFeatures.push({
                                name: m.name,
                                description: m.description || '',
                                automation: {
                                    type: 'combat_superiority_skill_check',
                                    maneuverName: m.name,
                                    actionType: 'skill_check',
                                    skills: m.skills || [],
                                    ability: m.ability || null,
                                    initiativeBonus: m.initiativeBonus || false,
                                    damageBonus: m.damageBonus || false,
                                    dieExpression: m.dieExpression || 'superiority_die',
                                    hasAutomation: true,
                                },
                                hasAutomation: true,
                            });
                            if (m.reactionSaveType) {
                                allFeatures.push({
                                    name: m.name + ' (Reaction)',
                                    description: m.description || '',
                                    automation: {
                                        type: 'combat_superiority_commanding_presence_reaction',
                                        maneuverName: m.name,
                                        reactionSaveType: m.reactionSaveType,
                                        reactionEffect: m.reactionEffect || 'disadvantage_next_attack',
                                        reactionDuration: m.reactionDuration || 'until_end_of_next_turn',
                                        reactionRange: m.reactionRange || '30_ft',
                                        saveDc: 'ability',
                                        saveAbility: 'CHA',
                                        hasAutomation: true,
                                    },
                                    hasAutomation: true,
                                });
                            }
                        });
                        playerStats.automation = collectAutomationFromFeatures(allFeatures, playerStats);
                    }
               }
          } catch (_e) {
             // Maneuver data not available, skip
         }
            playerStats.saveModifiers = collectSaveModifiers(allFeatures);
        }

        playerStats.allFeatures = allFeatures;

        playerStats.abilities = await rules.getAbilities(playerStats, playerSummary);
        playerStats.hitPoints = rules.getHitPoints(playerStats, playerSummary);
        playerStats.carryingCapacity = rules.getCarryingCapacity(playerStats);
        playerStats.speed = applyElfisLineageSpeed(playerStats, playerSummary);
        playerStats.speed = applySpeedIncreasePassives(playerStats);
        const dexAbility = playerStats.abilities.find((ability) => ability.name === 'Dexterity');
        playerStats.initiative = dexAbility.bonus;
        // Add Dread Ambush initiative bonus (WIS modifier) for Gloom Stalkers
        const dreadAmbushPassive = (playerStats.automation?.passives ?? []).find(
            p => p.type === 'passive_rule' && p.effect === 'dread_ambush_initiative'
        );
        if (dreadAmbushPassive) {
            const wisAbility = playerStats.abilities.find((ability) => ability.name === 'Wisdom');
            playerStats.initiative += (wisAbility?.bonus || 0);
        }
        // Add initiative_bonus from passive_buff (e.g., Alert feat)
        const initiativeBonusPassives = (playerStats.automation?.passives ?? []).filter(
            p => p.type === 'passive_buff' && p.effect === 'initiative_bonus'
        );
        for (const passive of initiativeBonusPassives) {
            const bonus = evaluateAutoExpression(passive.bonusExpression || '0', playerStats);
            if (typeof bonus === 'number' && !isNaN(bonus)) {
                playerStats.initiative += bonus;
            }
        }
        playerStats.initiativeAdvantage = (playerStats.automation?.passives ?? []).some(
            p => p.type === 'passive_rule' && p.effect === 'initiative_advantage'
        );
        // Alert: can't be surprised while conscious
        playerStats.noSurprise = (playerStats.automation?.passives ?? []).some(
            p => p.type === 'passive_buff' && p.effect === 'no_surprise'
        );
        // Alert: unseen attackers don't gain advantage on attacks against you
        playerStats.unseenAttackerAdvantageNegate = (playerStats.automation?.passives ?? []).some(
            p => p.type === 'passive_buff' && p.effect === 'unseen_attacker_advantage_negate'
        );
         [playerStats.armorClass, playerStats.armorClassFormula] = rules.getArmorClass(allEquipment, playerStats, playerSummary);
        playerStats.spellAbilities = rules.getSpellAbilities(allSpells, playerStats, playerSummary);
         playerStats.attacks = rules.getAttacks(allEquipment, allSpells, playerStats, playerSummary);

          // Add Hunter's Prey: Horde Breaker bonus action attack if the player has the Hunter class
          // The actual choice (Colossus Slayer vs Horde Breaker) is checked at runtime in CharActions.jsx
           const passivesForHunter = playerStats.automation?.passives;
           if (!Array.isArray(passivesForHunter)) {
               console.error('rules: expected passives to be an array for', playerStats.name);
               throw new Error('Missing array: passives for ' + playerStats.name);
           }
           const hasHunterPrey = passivesForHunter.some(
              p => p.type === 'hunter_prey' && p.name === "Hunter's Prey"
          );
          if (hasHunterPrey) {
              const rangerFeatures = cr.getRangerFeatures(playerStats);
              if (rangerFeatures.extraAttacks > 0) {
                  // Build a proper melee attack entry for Horde Breaker bonus action
                  const dex = playerStats.abilities.find(a => a.name === 'Dexterity');
                  const str = playerStats.abilities.find(a => a.name === 'Strength');
                  const abilityBonus = Math.max(str?.bonus || 0, dex?.bonus || 0);
                  const abilityName = str?.bonus >= dex?.bonus ? 'Strength' : 'Dexterity';
                  const prof = playerStats.proficiency || 0;
                  playerStats.attacks.push({
                      name: "Horde Breaker",
                      damage: `1d4`,
                      damageType: 'Slashing',
                      hitBonus: abilityBonus + prof,
                      hitBonusFormula: `To Hit Bonus = ${abilityName} Bonus (${abilityBonus}) + Proficiency (${prof})`,
                      range: 5,
                      type: 'Bonus Action',
                      weaponType: 'melee',
                      isHordeBreaker: true,
                  });
              }
          }


          // 2024-specific: senses set later (override), 5e-specific: immunities/resistances
          if (is2024(playerStats, playerSummary)) {
               playerStats.senses = rr.getSenses(playerStats);
               // Apply Umbral Sight darkvision enhancement for Gloom Stalkers
               playerStats.senses = applyUmbralSightDarkvision(playerStats, playerStats.senses);
               // Apply The Third Eye darkvision enhancement from active buffs
               playerStats.senses = applyThirdEyeDarkvision(playerStats, playerStats.senses, playerSummary.campaignName);
               // Apply Truesight from passive_buff automation (e.g., Boon of Truesight)
               playerStats.senses = applyTruesightSenses(playerStats, playerStats.senses);
            } else {
               playerStats.immunities = rr.getImmunities(playerSummary);
               playerStats.resistances = rr.getResistances(playerSummary);
               playerStats.senses = rr.getSenses(playerStats);
               // Apply The Third Eye darkvision enhancement from active buffs (5e)
               playerStats.senses = applyThirdEyeDarkvision(playerStats, playerStats.senses, playerSummary.campaignName);
               // Apply Truesight from passive_buff automation (e.g., Boon of Truesight)
               playerStats.senses = applyTruesightSenses(playerStats, playerStats.senses);
            }

        return playerStats;
     }
};

export default rules;