import { cloneDeep, merge } from 'lodash';
import utils from '../../ui/utils.js'
import { getCategories } from '../featureCategories.js'
import { mergeCategorizedFeatures } from '../featureCategorizationUtils.js'
import { addTraits as sharedAddTraits } from './addTraits.js';
import { computePassiveSkills } from '../../shared/computePassiveSkills.js'
import { deduplicateAndSort } from '../../shared/deduplicateAndSort.js'

const featureCategories = getCategories('5e');

const raceRules = {
    getImmunities: (playerSummary) => {
           // Dependencies: None
        let immunities = [];
        if(playerSummary.race.name === "Elf") {
            immunities.push("Magical Sleep"); // Fey Ancestry
           }
        if(playerSummary.class.name === "Monk" && playerSummary.level > 9) {
            immunities.push("Disease"); // Purity of Body
            immunities.push("Poison"); // Purity of Body
           }
        if(playerSummary.class.name === "Paladin" && playerSummary.level > 2) {
            immunities.push("Disease"); // Divine Health
           }
         if(playerSummary.immunities) {
             immunities = deduplicateAndSort([...immunities, ...playerSummary.immunities]);
            }
        return immunities.sort();
        },
    getRace: (allRaces, playerSummary) => {
        const foundRace = allRaces.find((race) => race.name === playerSummary.race.name);
        if (!foundRace) {
            return undefined;
         }
        const race = merge(cloneDeep(foundRace), cloneDeep(playerSummary.race));
        if (race.ability_bonuses) {
        race.ability_bonuses = race.ability_bonuses.map((ability_bonus) => {
            ability_bonus.ability_score = utils.getAbilityLongName(ability_bonus.ability_score);
            return ability_bonus;
           });
              }
        const subrace = playerSummary.race.subrace
                        ? race.subraces?.find((subrace) => subrace.name === playerSummary.race.subrace.name)
                        : null;
        if (subrace) {
            race.subrace = merge(cloneDeep(subrace), cloneDeep(playerSummary.subrace));
           } else {
            race.subrace = null;
           }
        delete race.subraces; // We don't need these anymore
        if (race.subrace && race.subrace.ability_bonuses) {
                    race.subrace.ability_bonuses = race.subrace.ability_bonuses.map((ability_bonus) => {
            ability_bonus.ability_score = utils.getAbilityLongName(ability_bonus.ability_score);
                        return ability_bonus;
                        });
                    }
        return race;
        },
        getRacialBonus: (playerStats, abilityName) => {
             // Dependencies: Race
        let racialBonus = 0;
        if (playerStats.race.ability_bonuses) {
            let ability_bonus = playerStats.race.ability_bonuses.find((ability_bonus) => ability_bonus.ability_score == abilityName);
            if (ability_bonus) {
                racialBonus += ability_bonus.bonus;
                  }
              }
                if (playerStats.race.subrace && playerStats.race.subrace.ability_bonuses) {
                    let subrace_ability_bonus = playerStats.race.subrace.ability_bonuses.find((ab) => ab.ability_score == abilityName);
                    if (subrace_ability_bonus) {
                        racialBonus += subrace_ability_bonus.bonus;
                     }
                       }
        return racialBonus;
        },
    getResistances: (playerSummary) => {
            // Dependencies: None
        let resistances = [];
        if(playerSummary.race.name === "Dwarf") {
            resistances.push("Poison"); // Dwarven Resilience
        } else if(playerSummary.race.subrace && playerSummary.race.subrace.damage_resistance) {
            resistances.push(playerSummary.race.subrace.damage_resistance);
         } else if(playerSummary.race.name === "Elf") {
            resistances.push("Charm"); // Fey Ancestry
         } else if(playerSummary.race.name === "Halfling") {
            resistances.push("Frightened"); // Brave
            if(playerSummary.race.subrace && playerSummary.race.subrace.name === "Scout Halfling") {
                resistances.push("Poison"); // Scout Resilience
           }
        } else if(playerSummary.race.name === "Tiefling") {
            resistances.push("Fire"); // Hellish Resistance
        }
         if(playerSummary.resistances) {
             resistances = deduplicateAndSort([...resistances, ...playerSummary.resistances]);
            }
        return resistances.sort();
        },
    getSenses: (playerStats) => {
            // Dependencies: Race, Class
         const passiveSenses = computePassiveSkills(playerStats);
         const darkvisionInSenses = passiveSenses.some((sense) => sense.name === 'Darkvision');
         const darkvisionRace = playerStats.race.traits.some((trait) => trait.name === 'Darkvision');
         if (darkvisionRace && !darkvisionInSenses) {
             passiveSenses.push({ name: 'Darkvision', value: '60 ft.' });
            }
         const feralSensesExists = hasFeralSenses(playerStats);
         if (feralSensesExists && !passiveSenses.some((sense) => sense.name === 'Feral Senses')) {
             passiveSenses.push({ name: 'Feral Senses', value: '' });
            }
         return passiveSenses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          },
        addTraits: (traits) => sharedAddTraits(traits, featureCategories),
        getTraits: (playerStats) => {
            // Dependencies: Race
        let traits = raceRules.addTraits(playerStats.race.traits);
        if(playerStats.race.subrace && playerStats.race.subrace.racial_traits) {
            const subraceTraits = raceRules.addTraits(playerStats.race.subrace.racial_traits);
            traits = mergeCategorizedFeatures(traits, subraceTraits);
            }
        return traits;
        }
};

function hasFeralSenses(playerStats) {
    const classLevels = playerStats.class?.class_levels || [];
    for (const classLevel of classLevels) {
        const features = classLevel?.features || [];
        if (features.some((f) => f.name === 'Feral Senses')) {
            return true;
        }
    }
    return false;
}

export default raceRules;
