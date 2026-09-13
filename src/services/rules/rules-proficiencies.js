import { is2024 } from './rules-helpers.js';
import { getSubModules } from './rules-core.js';
import { loadBackgroundData } from '../ui/dataLoader.js';

// Parse "Choose one kind of Artisan's Tools" → { choose, from } for a background tool proficiency.
function parseChooseToolProficiency(toolProficiencies) {
    const toolMatch = toolProficiencies.match(/Choose\s+(?:one|(\d+))\s+(?:kind\s+of\s+)?(.+?)(?:\s+of\s+your\s+choice)?\s*$/i);
    if (toolMatch) {
        const count = parseInt(toolMatch[1] || '1', 10);
        const toolName = toolMatch[2].trim();
        return { choose: count, from: [toolName] };
    }
    // Fallback: use the full string as the tool name
    return { choose: 1, from: [toolProficiencies.replace(/Choose\s+(?:one\s+(?:kind\s+of\s+)?)?/i, '').trim()] };
}

/**
 * Get proficiencies for a character (ruleset-specific).
 */
export function getProficiencies(playerStats, skill = true, playerSummary) {
    const { proficiencyUtils: pu } = getSubModules(playerStats, playerSummary);

    if (is2024(playerStats, playerSummary)) {
        return getProficiencies2024(playerStats, skill, pu);
    }

    return getProficiencies5e(playerStats, skill, pu);
}

function getProficiencies2024(playerStats, skill, pu) {
    // 2024: extract skill proficiencies from race trait descriptions and proficiency_choices
    const raceProficiencies = () => {
        const extra = [];
        const traits = playerStats.race?.traits;
        if (!Array.isArray(traits)) {
            console.error('rules: expected race.traits to be an array for', playerStats.name);
            throw new Error('Missing array: race.traits for ' + playerStats.name);
        }
        traits.forEach(trait => {
            // Skip traits with proficiency_choices (handled separately below)
            if (trait.proficiency_choices) {
                return;
            }
            // Parse specific skill names from description text
            if (trait.description) {
                const match = trait.description.match(/proficiency in the ([A-Z][a-z]+(?:,|[,\s]and[,\s]|[,\s]or[,\s]|,?)[A-Za-z,\s]+?)\s*skill/i);
                if (match) {
                    const skillsStr = match[1]
                        .replace(/\s+and\s+/g, ',')
                        .replace(/\s+or\s+/g, ',')
                        .replace(/,\s*,/g, ',')
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    skillsStr.forEach(sName => {
                        extra.push(`Skill: ${sName}`);
                    });
                }
            }
            // Merge skill proficiency_choices from traits (e.g., Human's Skillful)
            if (trait.proficiency_choices) {
                const pc = trait.proficiency_choices;
                if (pc.from && pc.from.length > 0) {
                    extra.push(...pc.from);
                }
            }
        });
       return extra;
   };

    // 2024: extract tool proficiencies from background
    const backgroundToolProficiencies = () => {
        const extra = [];
        const bgName = playerStats.background;
        if (bgName) {
            try {
                const backgrounds = loadBackgroundData('2024');
                if (backgrounds) {
                    const bg = backgrounds.find(b => b.name === bgName || b.index === bgName.toLowerCase());
                    if (bg && bg.tool_proficiencies && !bg.tool_proficiencies.startsWith('Choose')) {
                        extra.push(bg.tool_proficiencies);
                    }
                }
            } catch (_e) {
                // Background data not available yet, skip
                console.warn('[rules-proficiencies] Background data unavailable, skipping:', _e);
            }
        }
        return extra;
    };

    // 2024: extract tool proficiency CHOICES from background (e.g., "Choose one kind of Artisan's Tools")
    const backgroundToolProficiencyChoices = () => {
        const choices = [];
        const bgName = playerStats.background;
        if (bgName) {
            try {
                const backgrounds = loadBackgroundData('2024');
                if (backgrounds) {
                    const bg = backgrounds.find(b => b.name === bgName || b.index === bgName.toLowerCase());
                    if (bg && bg.tool_proficiencies && bg.tool_proficiencies.startsWith('Choose')) {
                        choices.push(parseChooseToolProficiency(bg.tool_proficiencies));
                    }
                }
            } catch (_e) {
                // Background data not available yet, skip
                console.warn('[rules-proficiencies] Background data unavailable, skipping:', _e);
            }
        }
        return choices;
    };

   return pu.getProficiencies(
       playerStats,
       skill,
       pu.getProficiencyChoiceCount,
        {
            raceProficiencies,
            bonusSource: (() => {
                const val = playerStats.class.major;
                if (val == null || typeof val !== 'object') {
                    console.error('rules: expected class.major to be an object for', playerStats.name);
                    throw new Error('Missing object: class.major for ' + playerStats.name);
                }
                return val;
            })(),
           backgroundToolProficiencies,
           backgroundToolProficiencyChoices,
        }
    );
}

function getProficiencies5e(playerStats, skill, pu) {
    // 5e: race proficiencies from traits/subrace, uses class.subclass
    return pu.getProficiencies(
        playerStats,
        skill,
        pu.getProficiencyChoiceCount,
         {
            raceProficiencies: (ps) => {
                const extra = [];
                ps.race.traits.forEach(trait => {
                    if (trait.proficiencies && trait.proficiencies.length > 0) {
                        extra.push(...trait.proficiencies);
                     }
                 });
                if (ps.race.subrace) {
                    extra.push(...(ps.race.subrace.starting_proficiencies));
                    if (!Array.isArray(ps.race.subrace.starting_proficiencies)) {
                        console.error('rules: expected starting_proficiencies to be an array for', ps.name);
                        throw new Error('Missing array: starting_proficiencies for ' + ps.name);
                    }
                    if (ps.race.subrace.racial_traits) {
                        ps.race.subrace.racial_traits.forEach(racial_trait => {
                            if (racial_trait.proficiencies && racial_trait.proficiencies.length > 0) {
                                extra.push(...racial_trait.proficiencies);
                             }
                         });
                     }
                 }
                return extra;
             },
            bonusSource: (() => {
                const val = playerStats.class.subclass;
                if (val == null || typeof val !== 'object') {
                    console.error('rules: expected class.subclass to be an object for', playerStats.name);
                    throw new Error('Missing object: class.subclass for ' + playerStats.name);
                }
                return val;
            })(),
         }
    );
}
