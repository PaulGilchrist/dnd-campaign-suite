import rules from './rules.js';
import { rules5e } from '../character/race-rules/index.js';
import { rules2024 } from '../character/race-rules/index.js';
import classRules from '../character/classRules.js';
import classRules2024 from '../character/classRules2024.js';
import { computeTrackedResources } from './trackedResources.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';

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

      // === DELEGATION WRAPPERS (preserve existing API for callers) ===

    getAbilityLongName: (shortName) => {
        return rules.getAbilityLongName(shortName);
      },

    getAbilities: async (playerStats, playerSummary) => {
        return rules.getAbilities(playerStats, playerSummary);
      },

    getActions: (playerStats, playerSummary) => {
        return rules.getActions(playerStats, playerSummary);
      },

    getArmorClass: (allEquipment, playerStats, playerSummary) => {
        return rules.getArmorClass(allEquipment, playerStats, playerSummary);
      },

    getAttacks: (allEquipment, allSpells, playerStats, playerSummary) => {
        return rules.getAttacks(allEquipment, allSpells, playerStats, playerSummary);
      },

    getHitPoints: (playerStats, playerSummary) => {
        return rules.getHitPoints(playerStats, playerSummary);
      },

    getLanguages: (playerStats, playerSummary) => {
        return rules.getLanguages(playerStats, playerSummary);
      },

    getMagicItems: (allMagicItems, playerSummary, playerStats) => {
        return rules.getMagicItems(allMagicItems, playerSummary, playerStats);
      },

    getProficiencyChoiceCount: (playerStats, skills, playerSummary) => {
        return rules.getProficiencyChoiceCount(playerStats, skills, playerSummary);
      },

    getProficiencies: (playerStats, skill, playerSummary) => {
        return rules.getProficiencies(playerStats, skill, playerSummary);
      },

    getSpellAbilities: (allSpells, playerStats, playerSummary) => {
        return rules.getSpellAbilities(allSpells, playerStats, playerSummary);
      },

    getSpellMaxLevel: (spellAbilities) => {
        return rules.getSpellMaxLevel(spellAbilities);
      },

      // Class rules delegation - raceRules-specific
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

      // Race rules delegation
    getImmunities: (playerSummary) => {
        const { raceRules: rr } = rulesFactory.getRules(playerSummary);
        return rr.getImmunities(playerSummary);
      },

    getResistances: (playerSummary) => {
        const { raceRules: rr } = rulesFactory.getRules(playerSummary);
        return rr.getResistances(playerSummary);
      },

    getSenses: (playerStats, playerSummary) => {
        const { raceRules: rr } = rulesFactory.getRules(playerSummary);
        return rr.getSenses(playerStats);
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

        const autoResistances = (playerStats.automation?.passives || [])
            .filter(p => p.type === 'resistance')
            .flatMap(p => p.damageTypes || []);
        if (autoResistances.length) {
            playerStats.resistances = [...new Set([
                ...(playerStats.resistances || []),
                ...autoResistances
            ])];
        }

        // Resolve passive_immunity damageResistance (e.g., Psychic Defenses)
        const passiveImmunityResistances = (playerStats.automation?.passives || [])
            .filter(p => p.type === 'passive_immunity' && Array.isArray(p.damageResistance))
            .flatMap(p => p.damageResistance);
        if (passiveImmunityResistances.length) {
            playerStats.resistances = [...new Set([
                ...(playerStats.resistances || []),
                ...passiveImmunityResistances
            ])];
        }

        // Resolve land_resistance automation (Circle of the Land Nature's Ward)
        const landResistances = (playerStats.automation?.passives || [])
            .filter(p => p.type === 'land_resistance')
            .flatMap(p => {
                const mappings = p.landMappings || {};
                const classData = playerStats.class || {};
                const landType = (classData.major?.type || classData.subclass?.type || '').toLowerCase().trim();
                return mappings[landType] ? [mappings[landType]] : [];
            });
        if (landResistances.length) {
            playerStats.resistances = [...new Set([
                ...(playerStats.resistances || []),
                ...landResistances
            ])];
        }

        // Resolve Elemental Affinity damage type resistance (2024 Draconic Sorcery)
        const elementalAffinityType = getRuntimeValue(playerStats.name, '_Elemental_Affinity_chosenType', playerSummary.campaignName);
        if (elementalAffinityType) {
            playerStats.resistances = [...new Set([
                ...(playerStats.resistances || []),
                elementalAffinityType
            ])];
        }

        // Resolve Fiendish Resilience damage type resistance (2024 Warlock Fiend Patron)
        const fiendishResilienceType = getRuntimeValue(playerStats.name, '_Fiendish_Resilience_chosenType', playerSummary.campaignName);
        if (fiendishResilienceType) {
            playerStats.resistances = [...new Set([
                ...(playerStats.resistances || []),
                fiendishResilienceType
            ])];
        }

        playerStats._trackedResources = computeTrackedResources(playerStats);

        return playerStats;
      }
};

export default rulesFactory;