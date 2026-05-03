/**
 * Shared utility for calculating character proficiencies.
 * This logic is common across both 5e and 2024 rule sets,
 * with rule-specific differences abstracted via a config object.
 */

/**
 * Calculate the allowed proficiencies and their choices for a character.
 *
 * @param {Object} playerStats - The player's statistics including class and race data
 * @param {boolean} skill - If true, calculate skill proficiencies; if false, calculate non-skill proficiencies
 * @param {Function} getProficiencyChoiceCount - Function that returns the number of proficiency choices allowed by class
 * @param {Object} config - Rule-specific configuration
 * @param {Function} config.raceProficiencies - Function(playerStats) => Array, returns additional proficiencies from race traits/subrace
 * @param {Object} config.bonusSource - Object containing bonus_skill_proficiencies and/or bonus_proficiencies (e.g., class.subclass or class.major)
 * @returns {Array} [proficienciesAllowed, proficiencies] - Allowed count and sorted array of proficiency names
 */
export const getProficiencies = (playerStats, skill = true, getProficiencyChoiceCount, config) => {
    let proficienciesAllowed = 0;

    // Base proficiencies from class and race starting proficiencies
    let proficiencies = [
        ...new Set([
            ...(playerStats.class.proficiencies || []),
            ...(playerStats.race.starting_proficiencies || [])
        ])
    ];

    // Add rule-specific race proficiencies (e.g., race.traits and race.subrace for 5e, empty for 2024)
    const raceProficiencies = config.raceProficiencies(playerStats);
    proficiencies = [...new Set([...proficiencies, ...raceProficiencies])];

    if (skill) {
        // Filter to only skill proficiencies and strip the 'Skill' prefix
        proficiencies = proficiencies
            .filter((proficiency) => proficiency.startsWith('Skill'))
            .map((proficiency) => proficiency.substring(7));

        // Background grants 2 skill proficiencies
        proficienciesAllowed = proficiencies.length + 2;

        // Add bonus skill proficiencies from subclass/major (e.g., Bard/Lore, Cleric/Knowledge)
        if (config.bonusSource && config.bonusSource.bonus_skill_proficiencies) {
            proficienciesAllowed += config.bonusSource.bonus_skill_proficiencies;
        }

        // Add class-based skill proficiency choices
        proficienciesAllowed += getProficiencyChoiceCount(playerStats, true);

        // Merge with already-selected skill proficiencies
        if (playerStats.skillProficiencies) {
            proficiencies = [...new Set([...proficiencies, ...playerStats.skillProficiencies])];
        }
    } else {
        // Filter to only non-skill proficiencies
        proficiencies = proficiencies.filter((proficiency) => !proficiency.startsWith('Skill'));

        // Add bonus proficiencies from subclass/major (e.g., Bard/Valor, Rogue/Assassin)
        if (config.bonusSource && config.bonusSource.bonus_proficiencies) {
            proficiencies = [...new Set([...proficiencies, ...config.bonusSource.bonus_proficiencies])];
        }

        // Calculate allowed count from existing proficiencies plus class choices
        proficienciesAllowed = proficiencies.length + getProficiencyChoiceCount(playerStats, false);

        // Merge with already-selected proficiencies
        if (playerStats.proficiencies) {
            proficiencies = [...new Set([...proficiencies, ...playerStats.proficiencies])];
        }
    }

    return [proficienciesAllowed, proficiencies.sort()];
};
