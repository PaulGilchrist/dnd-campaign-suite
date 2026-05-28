import rules from './rules.js';
import { rules5e } from './race-rules/index.js';
import { rules2024 } from './race-rules/index.js';
import classRules from './classRules.js';
import classRules2024 from './classRules2024.js';

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

        return playerStats;
      }
};

export default rulesFactory;