import { cloneDeep, merge } from 'lodash';
import utils from './utils.js'
import * as featureCategories from './featureCategories5e.js'
import { categorizeFeatures, mergeCategorizedFeatures } from './featureCategorizationUtils.js'

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
            characterClass.saving_throws = characterClass.saving_throws.map((savingThrow) => utils.getAbilityLongName(savingThrow));
        }
        return characterClass;
    },
    getDruidMaxWildShapeChallengeRating: (playerStats) => {
            const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
            let maxWildShapeChallengeRating = classLevel?.class_specific?.wild_shape_max_cr || 0;
            if (playerStats.class.subclass && playerStats.class.subclass.name === 'Moon' && playerStats.level > 1) {
                maxWildShapeChallengeRating = 1;
                if (playerStats.level > 5) {
                    maxWildShapeChallengeRating = Math.floor(playerStats.level / 3);
              }
               }
            return maxWildShapeChallengeRating
         },
     getDruidWildShapeUses: () => {
        // 5e Rules: Always 2 uses per day
        return 2;
    },
     getDruidBeastKnownForms: () => {
        // 5e Rules: No limit on known forms (returns null or 0)
        return 0;
    },
                getDruidBeastFlySpeed: (playerStats) => {
          // 5e Rules: Use class_specific.wild_shape_fly
         const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
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
          const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
             if (!classLevel || !classLevel.class_specific || !classLevel.class_specific.sneak_attack) {
                 return { dice_count: 0, dice_value: 6 };
              }
             return classLevel.class_specific.sneak_attack;
           },
      getClericFeatures: (playerStats) => {
           // 5e Rules: Get Cleric class features
           const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
          const maxChannelDivinity = classLevel?.class_specific?.channel_divinity_charges || 0;
          const destroyUndeadCR = classLevel?.class_specific?.destroy_undead_cr || null;
          return {
              maxChannelDivinity,
              destroyUndeadCR
          };
       },
      getDruidFeatures: (playerStats) => {
            const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
            const classSpecific = classLevel?.class_specific;
            const maxWildShapeChallengeRating = classRules.getDruidMaxWildShapeChallengeRating(playerStats);
            const maxWildShapeUses = 2;
            const beastKnownForms = 0;
            let wildShapeLimitations = 'walk only (no swim or fly)';
            if (classSpecific?.wild_shape_fly) {
                wildShapeLimitations = 'walk, swim, or fly';
             } else if (classSpecific?.wild_shape_swim) {
                wildShapeLimitations = 'walk or swim only (no fly)';
             }
            return {
                maxWildShapeUses,
                maxWildShapeChallengeRating,
                beastKnownForms,
                wildShapeLimitations
             };
          },
          getPaladinFeatures: (playerStats) => {
              const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
             const classSpecific = classLevel?.class_specific;
             const maxChannelDivinity = classSpecific?.channel_divinity_charges || 0;
             const auraRange = classSpecific?.aura_range || null;
             const extraAttacks = playerStats.level > 4 ? 1 : 0;
             return {
                 maxChannelDivinity,
                 auraRange,
                 extraAttacks
             };
         },
          getSorcererFeatures: (playerStats) => {
               const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
              const classSpecific = classLevel?.class_specific;
              const maxSorceryPoints = classSpecific?.sorcery_points || 0;
              const metamagicKnown = classSpecific?.metamagic_known || 0;
              const creatingSpellSlotCosts = classSpecific?.creating_spell_slots
                  ? classSpecific.creating_spell_slots.map(slot => slot.sorcery_point_cost)
                  : [];
              return {
                  maxSorceryPoints,
                  metamagicKnown,
                  creatingSpellSlotCosts
              };
          },
           getWarlockFeatures: (playerStats) => {
               const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
              const classSpecific = classLevel?.class_specific;
              const invocationsKnown = classSpecific?.invocations_known || 0;
              const hasArcanum = playerStats.level > 10;
              const arcanumLevels = hasArcanum ? {
                  level6: classSpecific?.mystic_arcanum_level_6 || 0,
                  level7: classSpecific?.mystic_arcanum_level_7 || 0,
                  level8: classSpecific?.mystic_arcanum_level_8 || 0,
                  level9: classSpecific?.mystic_arcanum_level_9 || 0
              } : {
                  level6: 0,
                  level7: 0,
                  level8: 0,
                  level9: 0
              };
              const arcanums = playerStats.class?.arcanums || [];
              return {
                  invocationsKnown,
                  hasArcanum,
                  arcanumLevels,
                  arcanums
              };
           },
           getWizardFeatures: (playerStats) => {
                const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                const arcaneRecoveryLevels = classLevel?.class_specific?.arcane_recovery_levels || 0;
               return {
                   arcaneRecoveryLevels,
                   showWizardFeatures: true
               };
            },
             getMonkFeatures: () => {
                return {
                    martialArtsDie: 4,
                    unarmoredMovementIncrease: 0,
                    maxFocusPoints: 0,
                    wisdomBonus: 0
                };
             },
             getRangerFeatures: (playerStats) => {
                 // 5e Rules: Ranger features
                 const favoredEnemies = 0;
                 const extraAttacks = playerStats.level > 4 ? 1 : 0;
                 return {
                     favoredEnemies,
                     extraAttacks
                 };
              },
              getRogueFeatures: (playerStats) => {
                  // 5e Rules: Get Rogue class features
                  const sneakAttack = classRules.getRogueSneakAttack(playerStats);
                  const expertise = playerStats.class?.expertise || [];
                  return { sneakAttack, expertise };
              },
              getBardFeatures: (playerStats) => {
         // 5e Rules: Get Bard class features
          const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
          const bardicDie = classLevel?.class_specific?.bardic_inspiration_die || 0;
         const songOfRestDie = classLevel?.class_specific?.song_of_rest_die ?? null;
         const magicalSecrets = classLevel?.class_specific?.magical_secrets_max_5 ?? null;
         let subclassMagicalSecrets = 0;
         if (playerStats.class?.subclass?.name === 'Lore' && playerStats.level > 2) {
             const highestSubclassLevel = classRules.getHighestSubclassLevel(playerStats);
             subclassMagicalSecrets = highestSubclassLevel?.subclass_specific?.additional_magical_secrets_max_lvl || 0;
         }
         return {
             bardicDie,
             songOfRestDie,
             magicalSecrets,
             subclassMagicalSecrets
         };
     }
     }

export default classRules