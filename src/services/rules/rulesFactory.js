import rules from './rules.js';
import { rules5e } from '../character/race-rules/index.js';
import { rules2024 } from '../character/race-rules/index.js';
import classRules from '../character/classRules.js';
import classRules2024 from '../character/classRules2024.js';
import { computeTrackedResources } from './trackedResources.js';
import { getChosenRuntimeValue } from '../automation/common/choiceStorage.js';

const rulesFactory = {
      /**
       * Get the appropriate rule modules for the given ruleset.
       */
    getRules(playerSummary) {
        const rulesType = playerSummary.rules || '5e';
        const use2024 = rulesType === '2024';

        return {
            rules,
            raceRules: use2024 ? rules2024 : rules5e,
            classRules: use2024 ? classRules2024 : classRules
          };
      },

      /**
       * Get the full ruleset name from a player summary.
       */
    getRulesType(playerSummary) {
        return playerSummary.rules || '5e';
      },

      // Class rules delegation - dispatches to classRules which varies by ruleset
    getDruidMaxWildShapeChallengeRating: (playerStats, playerSummary) => {
        const { classRules: cr } = rulesFactory.getRules(playerSummary);
        return cr.getDruidMaxWildShapeChallengeRating(playerStats);
      },

    getDruidWildShapeUses: (playerStats, playerSummary) => {
        const { classRules: cr } = rulesFactory.getRules(playerSummary);
        return cr.getDruidWildShapeUses(playerStats);
      },

    getDruidBeastKnownForms: (playerStats, playerSummary) => {
        const { classRules: cr } = rulesFactory.getRules(playerSummary);
        return cr.getDruidBeastKnownForms(playerStats);
      },

    getDruidBeastFlySpeed: (playerStats, playerSummary) => {
        const { classRules: cr } = rulesFactory.getRules(playerSummary);
        return cr.getDruidBeastFlySpeed(playerStats);
      },

    getRogueSneakAttack: (playerStats, playerSummary) => {
        const { classRules: cr } = rulesFactory.getRules(playerSummary);
        return cr.getRogueSneakAttack(playerStats);
      },

    getSenses: (playerStats, playerSummary) => {
        const { raceRules: rr } = rulesFactory.getRules(playerSummary);
        const senses = rr.getSenses(playerStats);
        // Apply Truesight from passive_buff automation (e.g., Boon of Truesight)
        const passives = playerStats.automation?.passives;
        if (!Array.isArray(passives)) {
            console.error('rulesFactory.getSenses: expected passives array');
            throw new Error('Expected passives to be an array');
        }
        const truesightPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'truesight');
        if (truesightPassive && !senses.some(s => s.name === 'Truesight')) {
            const rangeMatch = String(truesightPassive.range || '').match(/(\d+)\s*ft/i);
            const range = rangeMatch ? `${rangeMatch[1]} ft.` : '60 ft.';
            senses.push({ name: 'Truesight', value: range });
        }
        // Apply Blindsight from passive_buff automation (e.g., Skulker feat)
        const blindsightPassive = passives.find(p => p.type === 'passive_buff' && p.effect === 'blindsight');
        if (blindsightPassive && !senses.some(s => s.name === 'Blindsight')) {
            const rangeMatch = String(blindsightPassive.range || '').match(/(\d+)\s*ft/i);
            const range = rangeMatch ? `${rangeMatch[1]} ft.` : '10 ft.';
            senses.push({ name: 'Blindsight', value: range });
        }
        return senses;
      },

      // Master method - delegates to unified rules
    getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
        const playerStats = await rules.getPlayerStats(allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary);

        const { classRules: cr, raceRules: rr } = rulesFactory.getRules(playerSummary);

          // Re-read class/race from the appropriate ruleset after playerStats is built
         // because rules.getPlayerStats may have set them differently
        playerStats.class = cr.getClass(allClasses, playerStats);
        playerStats.race = rr.getRace(allRaces, playerStats);
        playerStats.immunities = rr.getImmunities(playerStats);
        playerStats.resistances = rr.getResistances(playerStats);

        const passives = playerStats.automation?.passives;
        if (!Array.isArray(passives)) {
            console.error('rulesFactory.getPlayerStats: expected passives array');
            throw new Error('Expected passives to be an array');
        }
        const autoResistances = passives
            .filter(p => p.type === 'resistance')
            .flatMap(p => {
                const damageTypes = p.damageTypes;
                if (!Array.isArray(damageTypes)) {
                    console.error('rulesFactory.getPlayerStats: expected damageTypes array');
                    throw new Error('Expected damageTypes to be an array');
                }
                return damageTypes;
            });
        if (autoResistances.length) {
            const resistances = playerStats.resistances;
            if (!Array.isArray(resistances)) {
                console.error('rulesFactory.getPlayerStats: expected resistances array');
                throw new Error('Expected resistances to be an array');
            }
            playerStats.resistances = [...new Set([
                ...resistances,
                ...autoResistances
            ])];
        }

        // Resolve passive_immunity damageResistance (e.g., Psychic Defenses)
        const passiveImmunityResistances = passives
            .filter(p => p.type === 'passive_immunity' && Array.isArray(p.damageResistance))
            .flatMap(p => p.damageResistance);
        if (passiveImmunityResistances.length) {
            const resistances = playerStats.resistances;
            if (!Array.isArray(resistances)) {
                console.error('rulesFactory.getPlayerStats: expected resistances array');
                throw new Error('Expected resistances to be an array');
            }
            playerStats.resistances = [...new Set([
                ...resistances,
                ...passiveImmunityResistances
            ])];
        }

        // Resolve land_resistance automation (Circle of the Land Nature's Ward)
        const landResistances = passives
            .filter(p => p.type === 'land_resistance')
            .flatMap(p => {
                const mappings = p.landMappings;
                if (mappings == null || typeof mappings !== 'object') {
                    console.error('rulesFactory.getPlayerStats: expected landMappings object');
                    throw new Error('Expected landMappings to be an object');
                }
                const classData = playerStats.class;
                if (classData == null || typeof classData !== 'object') {
                    console.error('rulesFactory.getPlayerStats: expected class object');
                    throw new Error('Expected class to be an object');
                }
                const landType = (classData.major?.type || classData.subclass?.type || '').toLowerCase().trim();
                return mappings[landType] ? [mappings[landType]] : [];
            });
        if (landResistances.length) {
            const resistances = playerStats.resistances;
            if (!Array.isArray(resistances)) {
                console.error('rulesFactory.getPlayerStats: expected resistances array');
                throw new Error('Expected resistances to be an array');
            }
            playerStats.resistances = [...new Set([
                ...resistances,
                ...landResistances
            ])];
        }

        // Resolve land_resistance conditionImmunity (Nature's Ward: poisoned condition immunity)
        const landConditionImmunities = passives
            .filter(p => p.type === 'land_resistance' && p.conditionImmunity)
            .map(p => p.conditionImmunity);
        if (landConditionImmunities.length) {
            const immunities = playerStats.immunities;
            if (!Array.isArray(immunities)) {
                console.error('rulesFactory.getPlayerStats: expected immunities array');
                throw new Error('Expected immunities to be an array');
            }
            playerStats.immunities = [...new Set([
                ...immunities,
                ...landConditionImmunities
            ])];
        }

        // Resolve Elemental Affinity damage type resistance (2024 Draconic Sorcery)
        const elementalAffinityType = getChosenRuntimeValue(playerStats, 'Elemental Affinity', 'chosenType');
        if (elementalAffinityType) {
            const resistances = playerStats.resistances;
            if (!Array.isArray(resistances)) {
                console.error('rulesFactory.getPlayerStats: expected resistances array');
                throw new Error('Expected resistances to be an array');
            }
            playerStats.resistances = [...new Set([
                ...resistances,
                elementalAffinityType
            ])];
        }

        // Resolve Fiendish Resilience damage type resistance (2024 Warlock Fiend Patron)
        const fiendishResilienceType = getChosenRuntimeValue(playerStats, 'Fiendish Resilience', 'chosenType');
        if (fiendishResilienceType) {
            const resistances = playerStats.resistances;
            if (!Array.isArray(resistances)) {
                console.error('rulesFactory.getPlayerStats: expected resistances array');
                throw new Error('Expected resistances to be an array');
            }
            playerStats.resistances = [...new Set([
                ...resistances,
                fiendishResilienceType
            ])];
        }

        // Resolve Boon Of Energy Resistance damage type resistances (2024 Epic Boon)
        const boonEnergyResistances = getChosenRuntimeValue(playerStats, 'Boon Of Energy Resistance', 'chosenTypes');
        if (Array.isArray(boonEnergyResistances) && boonEnergyResistances.length > 0) {
            const resistances = playerStats.resistances;
            if (!Array.isArray(resistances)) {
                console.error('rulesFactory.getPlayerStats: expected resistances array');
                throw new Error('Expected resistances to be an array');
            }
            playerStats.resistances = [...new Set([
                ...resistances,
                ...boonEnergyResistances
            ])];
        }

        playerStats._trackedResources = computeTrackedResources(playerStats);

        return playerStats;
      }
};

export default rulesFactory;