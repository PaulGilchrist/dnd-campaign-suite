// @maintained-by-ai
/**
 * rules-hunterPrey.js PRODUCER lane — owns the Horde Breaker marker (family
 * canon: superiorHuntersPrey.integration.test.js:19 cites THIS file as the
 * marker owner; hunterPreyHandler.test.js owns the choice prompt; the
 * superiorHuntersPrey lanes own the spread + latch). No Hunter's Mark spell
 * math and no extra-damage dice live here: addHunterPreyAttack computes NO
 * damage — it pushes one inert marker attack whose static '1d4' string is
 * display fallback, overridden downstream by CharBonusActions.jsx (its own
 * lane) with the weapon actually used. Crit stance: N/A here — no dice are
 * rolled in this module.
 *
 * Grant is programmatic-from-disk in BOTH rulesets: classes.json:8971/:8986
 * and 2024/classes.json:9012/:9016 carry the Hunter's Prey row
 * (automation.type 'hunter_prey', casting_time 'passive'), name matched
 * byte-exact with a STRAIGHT apostrophe (0x27, verified on disk);
 * core-handlers.js:262-269 rebuilds the passive as {type, name, casting_time,
 * hasAutomation} — the fixture below mirrors that production shape.
 *
 * Pins: full-shape toEqual (exact key set, length via array toEqual),
 * hitBonus = Math.max(str,dex) + proficiency both-sides + tie→Strength quirk
 * (rules-hunterPrey.js:19 '>=' favors Strength), and-in the-gate negatives
 * (real disk near-miss rows only: Superior Hunter's Prey 2024/:9030,
 * hunter_lore 2024/:9002/:9007, subfeature labels classes.json:8978-8980,
 * curly-apostrophe decoy), guarded throw + console.error:9 (rules-hunterPrey.js:6-11)
 * vs the golden UNGUARDED attacks.push TypeError (:21, console-untouched).
 * Zero mocks except console spy (log-pin + contrast). Module never reads
 * 'level' (grep of disk bytes: 0 hits) — the old level-3 test verified
 * nothing and is deleted. No clocks anywhere: the marker has no expiry bytes.
 * Pure-object lane: no store, no network, synchronous.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { addHunterPreyAttack } from './rules-hunterPrey.js';

// Production byte-fidelity: core-handlers.js:262-269 output for the disk row
// classes.json:8971/:8986 === 2024/classes.json:9012/:9016 (straight 0x27).
const PREY_PASSIVE = {
    type: 'hunter_prey',
    name: "Hunter's Prey",
    casting_time: 'passive',
    hasAutomation: true,
};

function createStats(passives = [PREY_PASSIVE], overrides = {}) {
    return {
        name: 'TestRanger',
        abilities: [
            { name: 'Strength', bonus: 1 },
            { name: 'Dexterity', bonus: 3 },
        ],
        proficiency: 3,
        attacks: [],
        automation: { passives },
        ...overrides,
    };
}

// Exact pushed-object contract (rules-hunterPrey.js:21-31).
function expectedMarker(abilityName, abilityBonus, prof) {
    return {
        name: 'Horde Breaker',
        damage: '1d4',
        damageType: 'Slashing',
        hitBonus: abilityBonus + prof,
        hitBonusFormula: `To Hit Bonus = ${abilityName} Bonus (${abilityBonus}) + Proficiency (${prof})`,
        range: 5,
        type: 'Bonus Action',
        weaponType: 'melee',
        isHordeBreaker: true,
    };
}

afterEach(() => vi.restoreAllMocks());

describe("addHunterPreyAttack — Hunter's Prey passive → Horde Breaker marker producer", () => {
    it('pushes exactly one full-shape marker (Dex-led) after pre-existing attacks and returns undefined', () => {
        const stats = createStats();
        stats.attacks.push({ name: 'Longbow' });
        expect(addHunterPreyAttack(stats)).toBeUndefined();
        expect(stats.attacks).toEqual([
            { name: 'Longbow' },
            expectedMarker('Dexterity', 3, 3),
        ]);
    });

    it.each([
        { label: 'Strength-led wins the Math.max', abilities: [{ name: 'Strength', bonus: 4 }, { name: 'Dexterity', bonus: 2 }], proficiency: 3, expected: expectedMarker('Strength', 4, 3) },
        { label: 'tie resolves to Strength (>= quirk, rules-hunterPrey.js:19)', abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 3 }], proficiency: 2, expected: expectedMarker('Strength', 3, 2) },
    ])('computes hitBonus + formula from the dominant ability — $label', ({ abilities, proficiency, expected }) => {
        const stats = createStats([PREY_PASSIVE], { abilities, proficiency });
        addHunterPreyAttack(stats);
        expect(stats.attacks).toEqual([expected]);
    });

    it.each([
        { label: 'empty passives', passives: [] },
        { label: "Superior Hunter's Prey (real 2024/:9030 row — different type AND name)", passives: [{ type: 'superior_hunter_prey', name: "Superior Hunter's Prey", casting_time: 'passive', hasAutomation: true }] },
        { label: "Hunter's Lore passive_rule (real 2024/:9002 row)", passives: [{ type: 'passive_rule', effect: 'hunter_lore', name: "Hunter's Lore", casting_time: 'passive', hasAutomation: true }] },
        { label: 'correct type, subfeature-label name (real classes.json:8980)', passives: [{ type: 'hunter_prey', name: "Hunter's Prey: Horde Breaker", casting_time: 'passive', hasAutomation: true }] },
        { label: 'correct type, curly-apostrophe decoy (disk canon is straight 0x27)', passives: [{ type: 'hunter_prey', name: 'Hunter\u2019s Prey', casting_time: 'passive', hasAutomation: true }] },
    ])('pushes nothing when $label', ({ passives }) => {
        const stats = createStats(passives);
        addHunterPreyAttack(stats);
        expect(stats.attacks).toEqual([]);
    });

    it.each([
        { label: 'passives is a string', automation: { passives: 'nope' } },
        { label: 'passives is null', automation: { passives: null } },
        { label: 'passives is undefined (automation present)', automation: {} },
        { label: 'automation is missing entirely', automation: undefined },
    ])('guarded-throws naming the character when $label (console.error:9 fires first)', ({ automation }) => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stats = createStats();
        if (automation === undefined) {
            delete stats.automation;
        } else {
            stats.automation = automation;
        }
        expect(() => addHunterPreyAttack(stats)).toThrow('Missing array: passives for TestRanger');
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(errSpy).toHaveBeenCalledWith('rules: expected passives to be an array for', 'TestRanger');
        expect(stats.attacks).toEqual([]);
    });

    it('quirk: unguarded attacks.push TypeError when the attacks key is absent — console stays untouched', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stats = createStats();
        delete stats.attacks;
        expect(() => addHunterPreyAttack(stats)).toThrow(TypeError);
        expect(errSpy).not.toHaveBeenCalled();
    });
});
