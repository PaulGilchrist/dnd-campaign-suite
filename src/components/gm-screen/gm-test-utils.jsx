// Shared fixtures/helpers for the GM Screen view tests (mirrors the
// log-test-utils.jsx precedent in ./../log). Pure test scaffolding —
// never imported by app code.
import { getStore } from '../../hooks/runtime/useRuntimeState.js';
import { setCombatSummaryCache } from '../../services/encounters/combatData.js';

export const CAMPAIGN = 'test-campaign';

/**
 * A minimal-but-realistic PlayerStats shape (exactly what
 * rulesFactory.getPlayerStats produces for the fields the GM Screen reads:
 * armorClass, six abilities with computed saves + skill bonuses,
 * skillProficiencies, expertise, hitPoints, race speed).
 */
export function makeStats(overrides = {}) {
    return {
        name: 'Aragorn',
        level: 3,
        rules: '5e',
        class: { name: 'Fighter' },
        armorClass: 18,
        armorClassFormula: '18 (plate)',
        hitPoints: 30,
        race: { name: 'Human', speed: 30 },
        resistances: [],
        immunities: [],
        skillProficiencies: ['Athletics', 'Perception'],
        expertise: [],
        abilities: [
            { name: 'Strength', bonus: 3, save: 5, proficient: true, skills: [{ name: 'Athletics', ability: 'Strength', bonus: 5 }] },
            { name: 'Dexterity', bonus: 1, save: 1, proficient: false, skills: [{ name: 'Acrobatics', ability: 'Dexterity', bonus: 1 }, { name: 'Stealth', ability: 'Dexterity', bonus: 1 }] },
            { name: 'Constitution', bonus: 2, save: 2, proficient: false, skills: [] },
            { name: 'Intelligence', bonus: 0, save: 0, proficient: false, skills: [{ name: 'Investigation', ability: 'Intelligence', bonus: 0 }] },
            { name: 'Wisdom', bonus: 2, save: 3, proficient: true, skills: [{ name: 'Perception', ability: 'Wisdom', bonus: 4 }, { name: 'Insight', ability: 'Wisdom', bonus: 2 }] },
            { name: 'Charisma', bonus: -1, save: -1, proficient: false, skills: [{ name: 'Intimidation', ability: 'Charisma', bonus: -1 }] },
        ],
        ...overrides,
    };
}

/** A computedCharacters entry ({ ...character, computedStats }). */
export function makePartyMember(overrides = {}, statsOverrides = {}) {
    const stats = makeStats({ ...overrides, ...statsOverrides });
    return { name: stats.name, computedStats: stats };
}

/** Seed a character's runtime store bucket (SSE-hydration stand-in). */
export function seedCharStore(name, entries) {
    const store = getStore(name);
    for (const [key, value] of Object.entries(entries)) store.set(key, value);
}

/** Remove every runtime lane a GM Screen test may have touched. */
export function clearGMScreenStores(names = []) {
    for (const name of names) getStore(name).clear();
    getStore('combatSummary').clear();
    getStore('campaign').delete('targetEffects');
    getStore('campaign').delete('activeCreatureName');
    setCombatSummaryCache(null, CAMPAIGN);
}
