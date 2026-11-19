/**
 * Pure derivation helpers for the GM Screen party table.
 *
 * Every value derives from the single source of truth (PlayerStats, i.e.
 * computedCharacters / rulesFactory.getPlayerStats) — nothing here reads
 * the runtime store or holds state; the row components subscribe to the
 * store and call these at render (memoized).
 */

const ABILITY_ORDER = [
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma',
];

/** "+5" / "−2" display formatter (also used for saves and skill bonuses). */
export function formatBonus(bonus) {
    const n = Number(bonus) || 0;
    return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * The six saving-throw bonuses exactly as the sheet computes them
 * (PlayerStats abilities[].save already folds proficiency + expertise-
 * style modifiers into it at compute time).
 */
export function deriveSaves(stats) {
    const abilities = Array.isArray(stats.abilities) ? stats.abilities : [];
    return ABILITY_ORDER
        .map((name) => {
            const ability = abilities.find(a => a.name === name);
            if (!ability) return null;
            return {
                abbr: name.slice(0, 3).toUpperCase(),
                name,
                bonus: ability.save != null ? ability.save : ability.bonus,
                proficient: !!ability.proficient,
            };
        })
        .filter(Boolean);
}

/** Skills the character is proficient in, with their computed bonuses. */
export function deriveProficientSkills(stats) {
    const abilities = Array.isArray(stats.abilities) ? stats.abilities : [];
    const proficient = Array.isArray(stats.skillProficiencies) ? stats.skillProficiencies : [];
    const expertise = Array.isArray(stats.expertise) ? stats.expertise : [];
    const skills = [];
    abilities.forEach(ability => {
        (ability.skills || []).forEach(skill => {
            if (!proficient.includes(skill.name)) return;
            skills.push({
                name: skill.name,
                bonus: skill.bonus,
                expert: expertise.includes(skill.name),
            });
        });
    });
    return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Passive scores as computed into PlayerStats.senses by computePassiveSkills
 * ("Passive Perception" / "Passive Investigation" / "Passive Insight").
 */
export function derivePassives(stats) {
    const senses = Array.isArray(stats.senses) ? stats.senses : [];
    return senses
        .filter(sense => typeof sense.name === 'string' && sense.name.startsWith('Passive '))
        .map(sense => ({
            label: sense.name.replace('Passive ', ''),
            value: sense.value,
        }));
}

/** Compact "Fighter 3" label from the computed class object + level. */
export function deriveClassLabel(stats) {
    const className = stats.class?.name || '';
    return [className, stats.level].filter(v => v !== '' && v != null).join(' ');
}

/**
 * Normalize a runtime activeConditions entry (string key, or an object
 * carrying a key) to its display label — same capitalization contract as
 * the sheet's CharConditions badges.
 */
export function conditionLabel(key) {
    if (key === 'speed_zero') return 'Speed 0';
    return String(key).charAt(0).toUpperCase() + String(key).slice(1);
}

/** Unique condition keys from a runtime activeConditions array. */
export function normalizeConditionKeys(raw) {
    if (!Array.isArray(raw)) return [];
    return [...new Set(
        raw
            .map(entry => (typeof entry === 'string' ? entry : entry?.key))
            .filter(Boolean)
    )];
}
