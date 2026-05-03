import { cloneDeep, merge, uniqBy } from 'lodash';
import rules from './rules'
import * as featureCategories from './feature-categories-5e'
import { categorizeFeatures, mergeCategorizedFeatures } from './feature-categorization-utils'

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
            const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
            let maxWildShapeChallengeRating = classLevel?.class_specific?.wild_shape_max_cr || 0;
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
        const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
        const wildShapeFly = classLevel?.class_specific?.wild_shape_fly;
        if (wildShapeFly === true) return true;
        if (wildShapeFly === false) return false;
        return undefined;
       },
        addFeatures: (levels) => {
        // Flatten all features from all levels, maintaining reverse order (highest level first)
        const allFeatures = [];
        for (let i = levels.length - 1; i >= 0; i--) {
            allFeatures.push(...(levels[i].features || []));
        }
        return categorizeFeatures(allFeatures, featureCategories, { descriptionField: 'description' });
     },
        getFeatures: (playerStats) => {
               // Dependencies: Class
            const classLevels = playerStats.class.class_levels.filter(classLevel => classLevel.level <= playerStats.level);
            let features = classRules.addFeatures(classLevels);
            if (playerStats.class.subclass) {
                const subClassLevels = playerStats.class.subclass.class_levels.filter(classLevel => classLevel.level <= playerStats.level);
                const subclassFeatures = classRules.addFeatures(subClassLevels);
                features = mergeCategorizedFeatures(features, subclassFeatures);
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
            const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
            if (!classLevel || !classLevel.class_specific || !classLevel.class_specific.sneak_attack) {
                return { dice_count: 0, dice_value: 6 };
             }
            return classLevel.class_specific.sneak_attack;
         }
    }

export default classRules