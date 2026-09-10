import { uniqBy } from 'lodash';
import { is2024 } from './rules-helpers.js';
import { loadBackgroundData, loadFeatData } from '../ui/dataLoader.js';
import { buildAttackInfo } from '../combat/automation/automationService.js';

/**
 * Build fighting style reaction features for 5e.
 */
export function applyFightingStyleReactions5e(playerStats) {
    // 5e-specific: Interception fighting style - add reaction feature
    if (!is2024(playerStats, null)) {
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
}

/**
 * Build fighting style reaction features for 2024.
 */
export function applyFightingStyleReactions2024(playerStats) {
    // 2024: Protection fighting style - add reaction feature
    if (is2024(playerStats, null)) {
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
    if (is2024(playerStats, null)) {
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
}

/**
 * Build fighting style special action features for 5e.
 */
export function applyFightingStyleSpecialActions5e(playerStats) {
    // 5e-specific: Thrown Weapon Fighting fighting style - add passive automation
    if (!is2024(playerStats, null)) {
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
     if (!is2024(playerStats, null)) {
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
}

/**
 * Build universal fighting style special action features.
 */
export function applyFightingStyleSpecialActionsUniversal(playerStats) {
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
                   description: 'You learn one maneuver of your choice from the Battle Master. You have one superiority die (d6) to fuel that maneuver. Use Combat Superiority during combat to deploy a maneuver.',
                   type: 'combat_superiority',
                    automation: {
                        type: 'combat_superiority',
                        dieExpression: '6',
                        uses_max: 1,
                        maxOptions: 1,
                        maxOptionsScaling: {},
                        saveDc: 'ability',
                        saveAbility: ['STR', 'DEX'],
                        hasAutomation: true,
                    },
                   hasAutomation: true,
               });
           }
       }
}

/**
 * Add fighting style feat features to allFeatures for automation processing (2024).
 */
export async function addFightingStyleFeatFeatures(playerStats, allFeatures) {
    if (is2024(playerStats, null) && playerStats.class?.fightingStyles?.length > 0) {
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
            console.warn('[rules-fightingStyles] Feat data unavailable, skipping:', _e);
        }
    }
}

/**
 * Add background features to automation (2024).
 */
export async function addBackgroundFeatures(playerStats, allFeatures) {
    if (is2024(playerStats, null) && playerStats.background) {
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
             console.warn('[rules-fightingStyles] Background data unavailable, skipping:', _e);
         }
     }
}

/**
 * Sort all action arrays.
 */
export function sortActionArrays(playerStats) {
     playerStats.actions = uniqBy(playerStats.actions, 'name').sort((a, b) => a.name.localeCompare(b.name));
     playerStats.bonusActions = uniqBy(playerStats.bonusActions, 'name').sort((a, b) => a.name.localeCompare(b.name));
     playerStats.reactions = uniqBy(playerStats.reactions, 'name').sort((a, b) => a.name.localeCompare(b.name));
     playerStats.specialActions = uniqBy(playerStats.specialActions, 'name').sort((a, b) => a.name.localeCompare(b.name));
     playerStats.characterAdvancement = uniqBy(playerStats.characterAdvancement, 'name').sort((a, b) => a.name.localeCompare(b.name));
}
