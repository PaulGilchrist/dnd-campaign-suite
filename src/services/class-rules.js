import { cloneDeep, merge, uniqBy } from 'lodash';
import rules from './rules'
import { featuresToIgnore, actions, bonusActions, reactions, characterAdvancement } from './feature-categories-5e'

const classRules = {
    getClass: (allClasses, playerSummary) => {
         // Dependencies: None
        let characterClass = allClasses.find((characterClass) => characterClass.name === playerSummary.class.name);
        if (!characterClass) {
            console.warn(`Could not find class: ${playerSummary.class.name}`);
            return { class_levels: [] };
         }
        characterClass = merge(cloneDeep(characterClass), cloneDeep(playerSummary.class));
        let subclass = playerSummary.class.subclass ? characterClass.subclasses?.find((subclass) => subclass.name === playerSummary.class.subclass.name) : undefined;
        if (subclass) {
            characterClass.subclass = merge(cloneDeep(subclass), cloneDeep(playerSummary.class.subclass));
        } else {
            characterClass.subclass = null;
        }
        delete characterClass.subclasses; // We don't need these anymore
        if (characterClass.saving_throws) {
            characterClass.saving_throws = characterClass.saving_throws.map((savingThrow) => rules.getAbilityLongName(savingThrow));
        }
        return characterClass;
    },
    getDruidMaxWildShapeChallengeRating: (playerStats) => {
        let maxWildShapeChallengeRating = playerStats.class.class_levels[playerStats.level - 1].class_specific.wild_shape_max_cr;
        if (playerStats.class.subclass && playerStats.class.subclass.name === 'Moon' && playerStats.level > 1) {
            maxWildShapeChallengeRating = 1;
            if (playerStats.level > 5) {
                maxWildShapeChallengeRating = Math.floor(playerStats.level / 3);
         }
          }
        return maxWildShapeChallengeRating
    },
    getDruidWildShapeUses: (playerStats) => {
        // 5e Rules: Always 2 uses per day
        return 2;
    },
    getDruidBeastKnownForms: (playerStats) => {
        // 5e Rules: No limit on known forms (returns null or 0)
        return 0;
    },
    getDruidBeastFlySpeed: (playerStats) => {
        // 5e Rules: Use class_specific.wild_shape_fly
        return playerStats.class.class_levels[playerStats.level - 1].class_specific.wild_shape_fly === true;
    },
    addFeatures: (levels) => {
        const categorizedFeatures = {
                    actions: [],
                    bonusActions: [],
                    reactions: [],
                    specialActions: [],
                    characterAdvancement: []
                   }
                   // Go through levels highest to lowest so is an ability increases at higher levels, that is the one retained in the array
                for (let i = levels.length - 1; i >= 0; i--) {
                    levels[i].features.forEach(feature => {
                        const featureSummary = {
                            name: feature.name,
                            description: feature.desc,
                            details: feature.details
                           };
                           // featuresToIgnore prevents adding to any section
                           // characterAdvancement, actions, bonusActions, and reactions go to their respective sections
                        if (featuresToIgnore.includes(feature.name)) {
                              // Do nothing - this feature is ignored entirely
                           } else if (characterAdvancement.includes(feature.name) && !categorizedFeatures.characterAdvancement.some(f => f.name == feature.name)) {
                            categorizedFeatures.characterAdvancement.push(featureSummary);
                         } else if (actions.includes(feature.name) && !categorizedFeatures.actions.some(action => action.name == feature.name)) {
                            categorizedFeatures.actions.push(featureSummary);
                         } else if (bonusActions.includes(feature.name) && !categorizedFeatures.bonusActions.some(bonusAction => bonusAction.name == feature.name)) {
                            categorizedFeatures.bonusActions.push(featureSummary);
                         } else if (reactions.includes(feature.name) && !categorizedFeatures.reactions.some(reaction => reaction.name == feature.name)) {
                            categorizedFeatures.reactions.push(featureSummary);
                         } else if (!categorizedFeatures.specialActions.some(specialAction => specialAction.name == feature.name)) {
                            categorizedFeatures.specialActions.push(featureSummary);
                  }
                       });
                   }
                return categorizedFeatures;
    },
    getFeatures: (playerStats) => {
              // Dependencies: Class
            const classLevels = playerStats.class.class_levels.filter(classLevel => classLevel.level <= playerStats.level);
            let features = classRules.addFeatures(classLevels);
            if (playerStats.class.subclass) {
                const subClassLevels = playerStats.class.subclass.class_levels.filter(classLevel => classLevel.level <= playerStats.level);
                const subclassFeatures = classRules.addFeatures(subClassLevels);
                features = {
                    actions: uniqBy([...features.actions, ...subclassFeatures.actions], 'name'),
                    bonusActions: uniqBy([...features.bonusActions, ...subclassFeatures.bonusActions], 'name'),
                    reactions: uniqBy([...features.reactions, ...subclassFeatures.reactions], 'name'),
                    specialActions: uniqBy([...features.specialActions, ...subclassFeatures.specialActions], 'name'),
                    characterAdvancement: uniqBy([...features.characterAdvancement, ...subclassFeatures.characterAdvancement], 'name')
                  }
              }
            return features;
         },
    getHighestSubclassLevel: (playerStats) => {
            let subClassLevel = 0
            if (playerStats.class.subclass && playerStats.class.subclass.class_levels) {
                for (let i = 0; i < playerStats.class.subclass.class_levels.length; i++) {
                    if (playerStats.class.subclass.class_levels[i].level > playerStats.level) {
                        break;
                     } else {
                        subClassLevel = playerStats.class.subclass.class_levels[i];
                     }
                 }
             }
            return subClassLevel
         },
        getRogueSneakAttack: (playerStats) => {
             // 5e Rules: Get sneak attack from class_specific
            const classLevel = playerStats.class.class_levels[playerStats.level - 1];
            if (!classLevel || !classLevel.class_specific || !classLevel.class_specific.sneak_attack) {
                return { dice_count: 0, dice_value: 6 };
             }
            return classLevel.class_specific.sneak_attack;
         }
    }

export default classRules