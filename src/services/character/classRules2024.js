import { cloneDeep } from 'lodash';
import * as featureCategories from './featureCategories2024.js'
import { categorizeFeatures, mergeCategorizedFeatures } from './featureCategorizationUtils.js'
import utils from '../ui/utils.js';

const classRules = {
    getClass: (allClasses, playerSummary) => {
        let characterClass = cloneDeep(allClasses.find((characterClass) => characterClass.name === playerSummary.class.name));

        if (!characterClass) {
            console.warn(`Could not find class: ${playerSummary.class.name}`);
            return { class_levels: [] };
        }

            // Preserve class_levels before merging
        const classLevels = characterClass.class_levels || [];

           // Merge with player summary data
        if (playerSummary.class) {
            Object.assign(characterClass, playerSummary.class);
          }

           // Restore class_levels after merge (they may have been overwritten)
        characterClass.class_levels = classLevels;

           // Handle major (subclass in 2024)
           // Check for both 'major' (2024 format) and 'subclass' (legacy format)
        let majorName = playerSummary.class.major?.name || playerSummary.class.subclass?.name;
        if (majorName) {
            const major = characterClass.majors?.find((major) => major.name === majorName);
            if (major) {
                characterClass.major = cloneDeep(major);
               } else {
                characterClass.major = { name: majorName, features: [] };
               }
           } else {
            characterClass.major = null;
           }

        delete characterClass.majors;

           // Convert ability names (2024: saving_throw_proficiencies is now an array)
           // 2024 data may already have long names, so only convert if short names are found
        if (characterClass.saving_throw_proficiencies) {
                        characterClass.saving_throw_proficiencies = characterClass.saving_throw_proficiencies.map((savingThrow) => {
                const longName = utils.getAbilityLongName(savingThrow);
                return longName || savingThrow; // Keep original if not a short name
               });
           }

           // Convert string proficiencies to array format for consistency with rules engine
           // 2024 classes have weapon_proficiencies, armor_training, and tool_proficiencies as strings
        characterClass.proficiencies = [];

           // Parse weapon proficiencies
        if (characterClass.weapon_proficiencies) {
            const weaponMap = {
                   'Simple weapons': ['Simple Weapons'],
                   'Simple and Martial weapons': ['Simple Weapons', 'Martial Weapons'],
                   'Simple weapons and Martial weapons that have the Light property': ['Simple Weapons', 'Light Martial Weapons'],
                   'Simple weapons and Martial weapons that have the Finesse or Light property': ['Simple Weapons', 'Finesse Martial Weapons', 'Light Martial Weapons']
               };
            const weapons = weaponMap[characterClass.weapon_proficiencies] || [];
            characterClass.proficiencies = [...characterClass.proficiencies, ...weapons];
           }

           // Parse armor training
        if (characterClass.armor_training && characterClass.armor_training !== 'None') {
            const armorMap = {
                   'Light armor': ['Light Armor'],
                   'Light armor and Shields': ['Light Armor', 'Shields'],
                   'Light and Medium armor and Shields': ['Light Armor', 'Medium Armor', 'Shields'],
                   'Light, Medium, and Heavy armor and Shields': ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields']
               };
            const armor = armorMap[characterClass.armor_training] || [];
            characterClass.proficiencies = [...characterClass.proficiencies, ...armor];
           }

           // Parse tool proficiencies
             // If it starts with "Choose", the player has already selected their tools in character JSON
           // Otherwise, it's an automatic tool proficiency
        if (characterClass.tool_proficiencies) {
            if (!characterClass.tool_proficiencies.startsWith('Choose')) {
                characterClass.proficiencies = [...characterClass.proficiencies, characterClass.tool_proficiencies];
               }
           }

            // Parse skill proficiencies
              // If it starts with "Choose", the player has already selected their skills in character JSON
              // Otherwise, parse the skill list into "Skill: Name" format
         if (characterClass.skill_proficiencies || characterClass.skill_proficiencies_choices) {
             const skillString = characterClass.skill_proficiencies || characterClass.skill_proficiencies_choices;
             if (!skillString.startsWith('Choose')) {
                      // Parse skills like "History, Insight, Medicine, Persuasion, or Religion"
                 const skills = skillString.split(',').map(skill => skill.trim().replace(' or ', ''));
                 characterClass.proficiencies = [...characterClass.proficiencies, ...skills.map(skill => `Skill: ${skill}`)];
                }
            }

            // Divine Order: Protector grants Martial weapons and Heavy armor
            if (playerSummary.class?.divineOrder === 'Protector' && characterClass.name === 'Cleric') {
                characterClass.proficiencies = [...characterClass.proficiencies, 'Martial Weapons', 'Heavy Armor'];
            }

            // Primal Order: Warden grants Martial weapons and Medium armor
            if (playerSummary.class?.primalOrder === 'Warden' && characterClass.name === 'Druid') {
                characterClass.proficiencies = [...characterClass.proficiencies, 'Martial Weapons', 'Medium Armor'];
            }

            return characterClass;
       },
    getDruidMaxWildShapeChallengeRating(playerStats) {
             // 2024 Rules: Use beast_max_cr from class_levels
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        let maxWildShapeChallengeRating = classLevel?.beast_max_cr || 0;

        if (playerStats.class.major && playerStats.class.major.name === 'Moon' && playerStats.level > 1) {
            maxWildShapeChallengeRating = 1;
            if (playerStats.level > 5) {
                maxWildShapeChallengeRating = Math.floor(playerStats.level / 3);
            }
            }

        return maxWildShapeChallengeRating;
        },
    getDruidWildShapeUses(playerStats) {
          // 2024 Rules: Use wild_shape from class_levels
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        return classLevel?.wild_shape || 0;
        },
    getDruidBeastKnownForms(playerStats) {
           // 2024 Rules: Use beast_known_forms from class_levels
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        return classLevel?.beast_known_forms || 0;
        },
    getDruidBeastFlySpeed(playerStats) {
           // 2024 Rules: Use beast_fly_speed from class_levels ("Yes" or "No")
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        return classLevel?.beast_fly_speed === 'Yes';
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
                    // 2024 Rules: Process class and major features
             const classLevels = playerStats.class?.class_levels?.filter(classLevel => classLevel.level <= playerStats.level) || [];

              // When level >= 10, Heightened versions replace base versions
             const isHeightened = playerStats.level >= 10;
             const replacedByHeightened = isHeightened ? ['Flurry of Blows', 'Patient Defense', 'Step of the Wind'] : [];

             let features = classRules.addFeatures(classLevels);
             if (replacedByHeightened.length > 0) {
                 const toFilter = new Set(replacedByHeightened);
                 Object.keys(features).forEach(cat => {
                     features[cat] = features[cat].filter(f => !toFilter.has(f.name));
                  });
              }

             if (playerStats.class.major) {
                         // 2024 majors have features directly with level property, not class_levels
                 const majorFeaturesList = playerStats.class.major.features?.filter(feature => feature.level <= playerStats.level) || [];
                        // Create a dummy level structure for addFeatures
                 const majorLevels = [{ features: majorFeaturesList }];
                 const majorFeatures = classRules.addFeatures(majorLevels);

                 features = mergeCategorizedFeatures(features, majorFeatures);
                     }

             return features;
              },
    getHighestMajorLevel: (playerStats) => {
        let highestLevel = 0;

        if (playerStats.class.major) {
               // 2024 majors have features directly with level property, not class_levels
            const majorFeatures = playerStats.class.major.features || [];
            for (const feature of majorFeatures) {
                if (feature.level <= playerStats.level && feature.level > highestLevel) {
                    highestLevel = feature.level;
                   }
               }
            }

        return highestLevel;
       },
    getEnergy: (playerStats) => {
           // 2024 Rules: Get energy properties for Psi Warrior and other classes with energy dice
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        if (!classLevel || !classLevel.energy) {
            return null;
           }

           // Check if energy requires a specific major
        if (classLevel.energy.required_major && classLevel.energy.required_major !== playerStats.class.major?.name) {
            return null;
           }

        return classLevel.energy;
       },
    getSecondWind: (playerStats) => {
            // 2024 Rules: Get second wind uses for Fighter
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        if (!classLevel) {
            return 0;
           }
        return classLevel.second_wind || 0;
       },
    getWeaponMastery: (playerStats) => {
             // 2024 Rules: Get weapon mastery count for Fighter and Barbarian
             const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            if (!classLevel) {
                return 0;
            }
            return classLevel.weapon_mastery || 0;
        },
        getMartialArtsDie: (playerStats) => {
             // 2024 Rules: Get martial arts die for Monk
             const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            if (!classLevel) {
                return 4; // Default d4 if no level found
            }
            return classLevel.martial_arts_die || 4;
        },
        getFocusPoints: (playerStats) => {
             // 2024 Rules: Get focus points (formerly ki points) for Monk
             const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            if (!classLevel) {
                return 0;
            }
            return classLevel.focus_points || 0;
        },
        getUnarmoredMovementIncrease: (playerStats) => {
                       // 2024 Rules: Get unarmored movement increase for Monk
                     const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                    if (!classLevel) {
                        return 0;
                     }
                    return classLevel.unarmored_movement_increase || 0;
                 },
                getFavoredEnemy: (playerStats) => {
                                      // 2024 Rules: Get favored enemy count for Ranger
                                    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                                     if (!classLevel) {
                                         return 0;
                                        }
                                     return classLevel.favored_enemy || 0;
                                  },
                                getRogueSneakAttack: (playerStats) => {
                                                                       // 2024 Rules: Get sneak attack dice count for Rogue
                                                                    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
                                                                    if (!classLevel) {
                                                                        return { dice_count: 0, dice_value: 6 };
                                                                       }
                                                                    return { dice_count: classLevel.sneak_attack_num_d6 || 0, dice_value: 6 };
                                                                   },
                                                                getEldritchInvocations: (playerStats) => {
                                                                       // 2024 Rules: Get eldritch invocations count for Warlock
                                                                    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
                                                                    if (!classLevel) {
                                                                        return 0;
                                                                       }
                                                                    return classLevel.eldritch_invocations || 0;
                                                                     },
      getClericFeatures: (playerStats) => {
          // 2024 Rules: Get Cleric features
          const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
          const maxChannelDivinity = classLevel?.channel_divinity || 0;
          return {
              maxChannelDivinity,
              destroyUndeadCR: null
          };
      },
      getDruidFeatures(playerStats) {
          const maxWildShapeChallengeRating = this.getDruidMaxWildShapeChallengeRating(playerStats);
          const maxWildShapeUses = this.getDruidWildShapeUses(playerStats);
          const beastKnownForms = this.getDruidBeastKnownForms(playerStats);
          const canFly = this.getDruidBeastFlySpeed(playerStats);
          const wildShapeLimitations = canFly ? 'walk, swim, or fly' : 'walk or swim only (no fly)';
          return {
              maxWildShapeUses,
              maxWildShapeChallengeRating,
              beastKnownForms,
              wildShapeLimitations
          };
       },
        getPaladinFeatures(playerStats) {
            const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
            const maxChannelDivinity = classLevel?.channel_divinity || 0;
            const extraAttacks = playerStats.level > 4 ? 1 : 0;
            return {
                maxChannelDivinity,
                auraRange: null,
                extraAttacks
            };
        },
        getSorcererFeatures(playerStats) {
            const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
            const maxSorceryPoints = classLevel?.sorcery_points || 0;
            let metamagicKnown = 0;
            if (playerStats.level >= 17) {
                metamagicKnown = 6;
             } else if (playerStats.level >= 10) {
                metamagicKnown = 4;
             } else if (playerStats.level >= 3) {
                metamagicKnown = 2;
             }
            return {
                maxSorceryPoints,
                metamagicKnown,
                maxInnateSorcery: 2,
                creatingSpellSlotCosts: []
             };
         },
        getWarlockFeatures(playerStats) {
            const invocationsKnown = this.getEldritchInvocations(playerStats);
            return {
                invocationsKnown,
                hasArcanum: false,
                arcanumLevels: null,
                arcanums: playerStats.class?.eldritchInvocations || [],
                pactBoon: playerStats.class?.pactBoon || null,
                invocations: playerStats.class?.invocations || []
            };
        },
         getWizardFeatures() {
             return {
                 showWizardFeatures: false
             };
         },
         getMonkFeatures(playerStats) {
             const martialArtsDie = this.getMartialArtsDie(playerStats);
             const unarmoredMovementIncrease = this.getUnarmoredMovementIncrease(playerStats);
             const maxFocusPoints = this.getFocusPoints(playerStats);
             return {
                 martialArtsDie,
                 unarmoredMovementIncrease,
                 maxFocusPoints,
                 wisdomBonus: 0
             };
          },
          getRangerFeatures(playerStats) {
              const favoredEnemies = this.getFavoredEnemy(playerStats);
              const extraAttacks = playerStats.level > 4 ? 1 : 0;
              return {
                  favoredEnemies,
                  extraAttacks
              };
           },
           getRogueFeatures(playerStats) {
               const sneakAttack = this.getRogueSneakAttack(playerStats);
               const expertise = playerStats.class?.expertise || [];
               return { sneakAttack, expertise };
           },
           getBardFeatures: (playerStats) => {
         // 2024 Rules: Get Bard features
         const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
         const bardicDie = classLevel?.bardic_die || 0;
         const magicalSecrets = classLevel?.class_specific?.magical_secrets ?? null;
         let subclassMagicalSecrets = 0;
         // 2024 has no Additional Magical Secrets for subclasses
         return {
             bardicDie,
             songOfRestDie: null,
             magicalSecrets,
             subclassMagicalSecrets
         };
     }
};

export default classRules;