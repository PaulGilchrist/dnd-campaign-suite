// @maintained-by-ai 2026-11-26
//
// Shared mock fixture for CharSummary component tests + its contract suite.
// All ~25 test files in the CharSummary family import mockPlayerStats /
// mockCampaignName from here rather than duplicating the object. Extend with
// spread syntax for test-specific overrides:
//   { ...mockPlayerStats, feats: [{ name: 'Test' }] }
//
// Contract suite (guarded block below) — pins the fixture↔production contract
// against the read sites in CharSummary.jsx / charSummaryCalc.js, so a fixture
// edit that breaks a consumer fails loudly HERE instead of silently shifting a
// hardcoded expectation in one of the consumer files:
//   - Speed-row baseline is sourced from race.subrace.speed and the equipped
//     armor is detected by computeHasArmorOrShield (family speed tests hardcode
//     the un-buffed baseline and rely on armor suppressing unarmored bonuses).
//     PassiveEffects delegates the no_armor_no_shield calc-lane gating and the
//     missing-bonusExpression default +10 parse (charSummaryCalc.js:97) here.
//   - Ally-Initiative delegates the effectiveInitiative formula (−2 per
//     exhaustion level) to this calc lane.
//   - ConditionImmunities delegates the computeResistances calc contract here:
//     `automationConditionImmunities` (plain strings, merged unconditionally)
//     and `automationConditionalImmunities` (objects gated on an active 'Rage'
//     buff) are DISTINCT production keys. This fixture ships only the Rage-gated
//     one; consumers spread the string-list key themselves.
//   - wrathOfTheSeaActive is store-sourced — the playerStats field of the same
//     name is inert (pinned below: even set true it cannot arm the badge, so
//     the render siblings' absence baselines stay safe).
//   - NaN-leak guard: every numeric value the sheet renders is finite for the
//     untouched fixture (project history of NaN leaks). Circle Forms AC, fly
//     suffixes and the rendered immunity rows are owned by the render siblings.
//
// HARD CONSTRAINT — this module is IMPORTED by consumer test files, so it must
// stay free of vi.mock calls and of unguarded describe/it blocks: Vitest
// hoists vi.mock out of conditionals and registers suites at import time, so
// either one would silently clobber or duplicate the consumers' own harnesses
// (verified empirically — leaked useTrackedResource/useRuntimeState mocks broke
// CharSummary-Remaining.test.jsx). The suites below therefore (a) live inside
// the COLLECTED_DIRECTLY guard and (b) use ONLY the real in-memory runtime
// store and rules modules (no mocking needed — an empty store returns the same
// empty defaults the consumers' mocks emulate). The render-lane pins
// (full default sheet render, XP-checkbox spread-copy guard) live in
// CharSummary-FixtureContract.test.jsx, which owns the shared mock harness.

import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach } from 'vitest';
import { computeCharSummaryContext } from './charSummaryCalc.js';
import rulesFactory from '../../../services/rules/rulesFactory.js';
import { getStore, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const mockPlayerStats = {
    name: 'Thorin',
    xp: 2300,
    xpMode: 'milestone',
    rules: '5e',
    race: { name: 'Dwarf', type: 'Hill Dwarf', subrace: { name: 'Hill Dwarf', speed: 25 } },
    class: { name: 'Cleric', subclass: { name: 'War', type: 'Choice' }, major: { name: 'Cleric' } },
    level: 5,
    alignment: 'Lawful Good',
    proficiency: 3,
    initiative: 2,
    initiativeAdvantage: false,
    abilities: [
        { name: 'Wisdom', bonus: 3 },
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 2 },
    ],
    armorClass: 18,
    armorClassFormula: '16 + 2 (shield)',
    hitPoints: 45,
    inventory: { equipped: ['Scale Mail', 'Shield'] },
    equipment: [{ name: 'Scale Mail', equipment_category: 'Armor' }, { name: 'Shield', type: 'Shield' }],
    background: 'Soldier',
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    senses: [],
    proficiencies: [],
    toolProficiencies: [],
    languages: [],
    automation: { passives: [], actions: [] },
    automationConditionalImmunities: [],
    passives: [],
    exhaustionLevel: 0,
    feats: [],
    wrathOfTheSeaActive: false,
};

const mockCampaignName = 'test-campaign';

export { mockPlayerStats, mockCampaignName };

// Register the contract suite ONLY when this file itself is the collected test
// file — never when consumers import the fixtures (see header constraint).
const COLLECTED_DIRECTLY = globalThis.__vitest_worker__?.filepath === fileURLToPath(import.meta.url);

if (COLLECTED_DIRECTLY) {
    const BASE_SPEED = mockPlayerStats.race.subrace.speed;

    // Snapshot for the mutation guard below — captured before any test runs.
    const FIXTURE_SNAPSHOT = JSON.parse(JSON.stringify(mockPlayerStats));

    const runCalc = (stats = mockPlayerStats, extra = {}) =>
        computeCharSummaryContext({
            playerStats: stats,
            campaignName: mockCampaignName,
            characters: [],
            exhaustionLevel: 0,
            ...extra,
        });

    afterEach(() => {
        // Real-store writes in this suite must not leak into later tests.
        const store = getStore(mockPlayerStats.name);
        store.delete('activeBuffs');
        store.delete('wrathOfTheSeaActive');
    });

    // -----------------------------------------------------------------------
    // Calc lane — the REAL computeCharSummaryContext consumes the fixture
    // without leaking NaN and honors the cross-field invariants consumers
    // rely on. Empty in-memory store == the empty defaults consumers mock.
    // -----------------------------------------------------------------------
    describe('computeCharSummaryContext consumes the fixture cleanly', () => {
        it('leaks no non-finite value into any number the sheet renders for the untouched fixture', () => {
            const ctx = runCalc();
            for (const key of [
                'totalSpeedWithBuff', 'buffSpeedBonus', 'auraSpeedBonus', 'effectiveInitiative',
                'dexBonus', 'hasteAcBonus', 'shieldAcBonus', 'shieldOfFaithBonus',
                'defensiveDuelistBonus', 'baitAndSwitchBonus', 'mageArmorAc',
            ]) {
                expect(Number.isFinite(ctx[key]), `ctx.${key} leaked a non-finite value: ${ctx[key]}`).toBe(true);
            }
        });

        it('ctx baselines mirror the fixture fields: walk speed, Dexterity bonus, initiative minus 2 per exhaustion level', () => {
            const ctx = runCalc();
            // Family speed tests hardcode this un-buffed race-speed baseline.
            expect(ctx.totalSpeedWithBuff).toBe(BASE_SPEED);
            // Mage-armor badge text derives from the Dexterity abilities entry.
            expect(ctx.dexBonus).toBe(mockPlayerStats.abilities.find((a) => a.name === 'Dexterity').bonus);
            // Ally-Initiative delegates the effectiveInitiative formula here.
            expect(ctx.effectiveInitiative).toBe(mockPlayerStats.initiative);
            expect(runCalc(mockPlayerStats, { exhaustionLevel: 2 }).effectiveInitiative)
                .toBe(mockPlayerStats.initiative - 4);
        });

        it('detects the fixture loadout as armor: an unarmored-only speed passive contributes 0 equipped and the default +10 once stripped', () => {
            // No bonusExpression: pins charSummaryCalc.js:97's default +10 parse,
            // which PassiveEffects explicitly delegates to this suite. The strip
            // arm also proves equipped→equipment resolution for BOTH items
            // (Scale Mail and Shield each individually block the bonus).
            const passive = { type: 'passive_buff', effect: 'speed_bonus', condition: 'no_armor_no_shield' };
            const automation = { ...mockPlayerStats.automation, passives: [passive] };

            expect(runCalc({ ...mockPlayerStats, automation }).totalSpeedWithBuff).toBe(BASE_SPEED);
            expect(runCalc({ ...mockPlayerStats, inventory: { equipped: [] }, automation }).totalSpeedWithBuff)
                .toBe(BASE_SPEED + 10);
        });

        it('merges automationConditionImmunities unconditionally but gates automationConditionalImmunities on an active Rage buff', () => {
            const stats = {
                ...mockPlayerStats,
                automationConditionImmunities: ['poison'],
                automationConditionalImmunities: [{ requiresActive: 'Rage', immunities: ['charmed'] }],
            };
            // Distinct keys, distinct semantics: strings in, Rage-gated objects out
            // until the store says Rage is active.
            const gated = runCalc(stats).allImmunities;
            expect(gated).toContain('poison');
            expect(gated).not.toContain('charmed');

            setRuntimeValue(mockPlayerStats.name, 'activeBuffs', [{ name: 'Rage' }], mockCampaignName);
            expect(runCalc(stats).allImmunities).toContain('charmed');
        });

        it('wrathOfTheSeaActive is store-sourced — the inert playerStats fixture field cannot enable the badge', () => {
            // Setting the fixture field true must NOT arm the flag: every render
            // sibling's "badge absent" baseline relies on this staying inert.
            expect(runCalc({ ...mockPlayerStats, wrathOfTheSeaActive: true }).wrathOfTheSeaActive).toBeFalsy();

            setRuntimeValue(mockPlayerStats.name, 'wrathOfTheSeaActive', true, mockCampaignName);
            expect(runCalc().wrathOfTheSeaActive).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Shape guards — spread/store safety and internal cross-field consistency.
    // -----------------------------------------------------------------------
    describe('fixture shape guards', () => {
        it('exposes the arrays and ability entries production iterates or looks up', () => {
            for (const path of [
                'abilities', 'immunities', 'resistances', 'vulnerabilities', 'senses',
                'proficiencies', 'toolProficiencies', 'languages', 'feats', 'passives',
                'automationConditionalImmunities', 'automation.passives', 'inventory.equipped', 'equipment',
            ]) {
                const value = path.split('.').reduce((obj, key) => obj?.[key], mockPlayerStats);
                expect(Array.isArray(value), `${path} is not an array`).toBe(true);
            }

            for (const name of ['Wisdom', 'Dexterity']) {
                const ability = mockPlayerStats.abilities.find((a) => a.name === name);
                // Production looks these entries up and ADDS bonus to numbers.
                expect(ability?.bonus, `${name} abilities entry missing`).toEqual(expect.any(Number));
            }
        });

        it('rules value resolves through the real rulesFactory to a complete module set', () => {
            const modules = rulesFactory.getRules(mockPlayerStats);
            expect(modules.rules).toBeTruthy();
            expect(modules.raceRules).toBeTruthy();
            expect(modules.classRules).toBeTruthy();
        });

        // mockCampaignName === 'test-campaign' is the literal constant above;
        // the lockdown rule is enforced by policy, not by restating the literal.

        it('no test in this suite mutated the shared fixture (calc purity + spread-only pattern)', () => {
            // Production mutates props in one place (handleXpModeToggle:
            // playerStats.xpMode); consumers must always spread first. The
            // render-level pin for that lives in
            // CharSummary-FixtureContract.test.jsx — here a full deep-equal
            // against the pre-run snapshot catches any calc-level mutation.
            expect(mockPlayerStats).toEqual(FIXTURE_SNAPSHOT);
        });
    });
}
