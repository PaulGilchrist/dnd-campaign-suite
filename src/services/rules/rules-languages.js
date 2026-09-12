import { is2024 } from './rules-helpers.js';

function applySubraceLanguages(playerStats, languages) {
    const subrace = playerStats.race.subrace;
    if (!subrace || !subrace.language_options) {
        return { languages, allowed: 0 };
    }
    const subraceLanguages = subrace.languages;
    if (!Array.isArray(subraceLanguages)) {
        console.error('rules: expected subrace.languages to be an array for', playerStats.name);
        throw new Error('Missing array: subrace.languages for ' + playerStats.name);
    }
    return {
        languages: [...new Set([...languages, ...subraceLanguages])],
        allowed: subrace.language_options.choose || 0,
    };
}

function classLanguageBonus(playerStats) {
    if (!playerStats.class?.language_choices) return 0;
    let bonus = playerStats.class.language_choices.choose || 0;
    if (playerStats.class.name === 'Ranger') {
        if (playerStats.level > 5) bonus += 1;
        if (playerStats.level > 13) bonus += 1;
    }
    return bonus;
}

// 5e: class.subclass.language_choices, 2024: class.major.language_choices
function subclassLanguageBonus(playerStats, playerSummary) {
    if (is2024(playerStats, playerSummary)) {
        return playerStats.class.major?.language_choices?.choose || 0;
    }
    return playerStats.class.subclass?.language_choices?.choose || 0;
}

/**
 * Get languages for a character (handles both rulesets internally).
 */
export function getLanguages(playerStats, playerSummary) {
    let languages = playerStats.race?.languages;
    if (!Array.isArray(languages)) {
        console.error('rules: expected race.languages to be an array for', playerStats.name);
        throw new Error('Missing array: race.languages for ' + playerStats.name);
    }
    languages = [...languages];
    let languagesAllowed = languages.length;
    languagesAllowed += 2; // Background languages

    if (playerStats.race.language_choices) {
        languagesAllowed += playerStats.race.language_choices.choose || 0;
    }

    const subrace = applySubraceLanguages(playerStats, languages);
    languages = subrace.languages;
    languagesAllowed += subrace.allowed;

    let classLanguages = playerStats.class?.languages || [];
    if (!Array.isArray(classLanguages)) {
        console.error('rules: expected class.languages to be an array for', playerStats.name);
        throw new Error('Missing array: class.languages for ' + playerStats.name);
    }
    languages = [...new Set([...languages, ...classLanguages])];

    languagesAllowed += classLanguageBonus(playerStats);
    languagesAllowed += subclassLanguageBonus(playerStats, playerSummary);

    if (playerStats.languages) {
        languages = [...new Set([...languages, ...playerStats.languages])];
    }

    return [languagesAllowed, languages.sort()];
}
