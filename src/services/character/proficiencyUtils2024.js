export { getProficiencies } from './proficiencyUtils.js';

/**
 * Calculate the number of proficiency choices allowed by class and race (2024 rules).
 * @param {Object} playerStats
 * @param {boolean} skills
 * @returns {number}
 */
export function getProficiencyChoiceCount(playerStats, skills = true) {
  let proficiencyChoiceCount = 0;
  if (skills && playerStats.class.skill_proficiency_choices) {
    const match = playerStats.class.skill_proficiency_choices.match(/Choose\s+(\d+)/);
    if (match) {
      proficiencyChoiceCount = parseInt(match[1], 10);
     }
   }

  if (playerStats.race.starting_proficiency_options && ((skills && playerStats.race.starting_proficiency_options.from[0].startsWith('Skill: ')) || (!skills && !playerStats.race.starting_proficiency_options.from[0].startsWith('Skill: ')))) {
    proficiencyChoiceCount += playerStats.race.starting_proficiency_options.choose;
   }

  // Count proficiency choices from race traits (e.g., Human's Skillful)
  if (playerStats.race?.traits) {
    playerStats.race.traits.forEach(trait => {
      if (trait.proficiency_choices) {
        const pc = trait.proficiency_choices;
        if (pc.from && pc.from.length > 0) {
          const isSkillChoice = pc.from[0].startsWith('Skill: ');
          if ((skills && isSkillChoice) || (!skills && !isSkillChoice)) {
            proficiencyChoiceCount += pc.choose;
          }
        }
      }
    });
  }

  // Count proficiency choices from subclass/major (e.g., Battle Master's Student of War)
  if (playerStats.class.major?.proficiency_choices) {
    playerStats.class.major.proficiency_choices.forEach(pc => {
      if (pc.from && pc.from.length > 0) {
        const isSkillChoice = pc.from[0].startsWith('Skill: ');
        if ((skills && isSkillChoice) || (!skills && !isSkillChoice)) {
          proficiencyChoiceCount += pc.choose;
        }
      }
    });
   }

  return proficiencyChoiceCount;
}
