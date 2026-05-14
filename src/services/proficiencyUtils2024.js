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

  return proficiencyChoiceCount;
}
