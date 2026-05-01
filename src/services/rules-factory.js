import rules5e from './rules.js';
import rules2024 from './rules-2024.js';
import raceRules5e from './race-rules.js';
import raceRules2024 from './race-rules-2024.js';
import classRules5e from './class-rules.js';
import classRules2024 from './class-rules-2024.js';

const rulesFactory = {
    getRules: (playerSummary, characterName = 'Unknown') => {
        const rulesType = playerSummary.rules || '5e';
        
        let selectedRules;
        switch (rulesType) {
            case '2024':
                selectedRules = {
                    rules: rules2024,
                    raceRules: raceRules2024,
                    classRules: classRules2024
                };
                break;
            case '5e':
            default:
                selectedRules = {
                    rules: rules5e,
                    raceRules: raceRules5e,
                    classRules: classRules5e
                };
                break;
        }
        
        return selectedRules;
    },
    
    getAbilityLongName: (shortName, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getAbilityLongName(shortName);
        return result;
    },
    
        getAbilities: async (playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = await selectedRules.rules.getAbilities(playerStats);
        return result;
    },
    
    getActions: (playerStats, playerSummary) => {
                const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getActions(playerStats);
        return result;
    },
    
    getArmorClass: (allEquipment, playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getArmorClass(allEquipment, playerStats);
        return result;
    },
    
    getAttacks: (allEquipment, allSpells, playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getAttacks(allEquipment, allSpells, playerStats);
        return result;
    },
    
    getHitPoints: (playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getHitPoints(playerStats);
        return result;
    },
    
    getLanguages: (playerStats, playerSummary) => {
                const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getLanguages(playerStats);
        return result;
    },
    
    getMagicItems: (allMagicItems, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getMagicItems(allMagicItems, playerSummary);
        return result;
    },
    
    getProficiencyChoiceCount: (playerStats, skills, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getProficiencyChoiceCount(playerStats, skills);
        return result;
    },
    
    getProficiencies: (playerStats, skill, playerSummary) => {
                const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getProficiencies(playerStats, skill);
        return result;
    },
    
    getSpellAbilities: (allSpells, playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getSpellAbilities(allSpells, playerStats);
        return result;
    },
    
    getSpellMaxLevel: (spellAbilities, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.rules.getSpellMaxLevel(spellAbilities);
        return result;
     },
    
        getDruidMaxWildShapeChallengeRating: (playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.classRules.getDruidMaxWildShapeChallengeRating(playerStats);
        return result;
      },
    
        getDruidWildShapeUses: (playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.classRules.getDruidWildShapeUses(playerStats);
        return result;
      },
    
    getDruidBeastKnownForms: (playerStats, playerSummary) => {
        const characterName = playerSummary.name || 'Unknown';
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const result = selectedRules.classRules.getDruidBeastKnownForms(playerStats);
        return result;
      },
    
    getDruidBeastFlySpeed: (playerStats, playerSummary) => {
            const characterName = playerSummary.name || 'Unknown';
            const selectedRules = rulesFactory.getRules(playerSummary, characterName);
            const result = selectedRules.classRules.getDruidBeastFlySpeed(playerStats);
            return result;
          },
    
        getRogueSneakAttack: (playerStats, playerSummary) => {
            const characterName = playerSummary.name || 'Unknown';
            const selectedRules = rulesFactory.getRules(playerSummary, characterName);
            const result = selectedRules.classRules.getRogueSneakAttack(playerStats);
            return result;
          },
    
    
        getPlayerStats: async (allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary) => {
            const characterName = playerSummary.name || 'Unknown';
        
        const selectedRules = rulesFactory.getRules(playerSummary, characterName);
        const { rules, raceRules, classRules } = selectedRules;
        
        const playerStats = await rules.getPlayerStats(allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary);
        
        playerStats.immunities = raceRules.getImmunities(playerSummary);
        playerStats.race = raceRules.getRace(allRaces, playerStats);
        playerStats.resistances = raceRules.getResistances(playerSummary);
        playerStats.senses = raceRules.getSenses(playerStats);
        
        playerStats.class = classRules.getClass(allClasses, playerStats);
        
        return playerStats;
     }
};

export default rulesFactory;