// @maintained-by-ai
//
// Shared mock fixture for CharSummary component tests + its contract suite.
// All ~20 test files in the CharSummary family import mockPlayerStats /
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
//   - computeCharSummaryContext produces finite numbers for every value the
//     sheet renders (project history of NaN-leak guards).
//   - `automationConditionImmunities` (plain strings, merged unconditionally)
//     and `automationConditionalImmunities` (objects gated on an active 'Rage'
//     buff) are DISTINCT production keys. This fixture ships only the Rage-gated
//     one; consumers spread the string-list key themselves.
//   - wrathOfTheSeaActive is store-sourced — the playerStats field of the same
//     name is inert (production never reads it from playerStats). Likewise
//     `speed` is only consumed by TurnEconomyStrip; the Speed row derives from
//     race.subrace.speed.
//   - mockCampaignName must stay 'test-campaign' — campaign lockdown rule.
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
import { parseMagicItemName } from '../../../services/rules/core/attackCalc.js';
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
        it('every rendered numeric ctx key is finite and circleFormsACOverride stays null for this non-shapeshifting Cleric', () => {
            const ctx = runCalc();
            for (const key of [
                'totalSpeedWithBuff', 'buffSpeedBonus', 'auraSpeedBonus', 'effectiveInitiative',
                'dexBonus', 'hasteAcBonus', 'shieldAcBonus', 'shieldOfFaithBonus',
                'defensiveDuelistBonus', 'baitAndSwitchBonus', 'mageArmorAc',
            ]) {
                expect(Number.isFinite(ctx[key]), `ctx.${key} leaked a non-finite value: ${ctx[key]}`).toBe(true);
            }
            expect(ctx.circleFormsACOverride).toBeNull();
        });

        it('ctx baselines mirror the fixture fields: walk speed, Dexterity bonus, initiative minus 2 per exhaustion level', () => {
            const ctx = runCalc();
            // Family speed tests hardcode this un-buffed race-speed baseline.
            expect(ctx.totalSpeedWithBuff).toBe(BASE_SPEED);
            // Mage-armor badge text derives from the Dexterity abilities entry.
            expect(ctx.dexBonus).toBe(mockPlayerStats.abilities.find((a) => a.name === 'Dexterity').bonus);
            expect(ctx.effectiveInitiative).toBe(mockPlayerStats.initiative);
            expect(runCalc(mockPlayerStats, { exhaustionLevel: 2 }).effectiveInitiative)
                .toBe(mockPlayerStats.initiative - 4);
        });

        it('equipped armor is detected: a no_armor_no_shield speed passive contributes 0 with the fixture loadout and the full bonus once stripped', () => {
            const passive = { type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_armor_no_shield' };
            const automation = { ...mockPlayerStats.automation, passives: [passive] };

            expect(runCalc({ ...mockPlayerStats, automation }).totalSpeedWithBuff).toBe(BASE_SPEED);
            expect(runCalc({ ...mockPlayerStats, inventory: { equipped: [] }, automation }).totalSpeedWithBuff)
                .toBe(BASE_SPEED + Number(passive.bonusExpression));
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
            expect(runCalc().wrathOfTheSeaActive).toBeFalsy();

            setRuntimeValue(mockPlayerStats.name, 'wrathOfTheSeaActive', true, mockCampaignName);
            expect(runCalc().wrathOfTheSeaActive).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Shape guards — spread/store safety and internal cross-field consistency.
    // -----------------------------------------------------------------------
    describe('fixture shape guards', () => {
        it('is JSON round-trip safe and exposes the arrays and ability entries production iterates or looks up', () => {
            expect(JSON.parse(JSON.stringify(mockPlayerStats))).toEqual(mockPlayerStats);

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
                expect(ability, `abilities entry "${name}"`).toBeDefined();
                expect(Number.isInteger(ability.bonus)).toBe(true);
            }
        });

        it('every inventory.equipped name resolves to an equipment entry (armor-detection contract)', () => {
            for (const itemName of mockPlayerStats.inventory.equipped) {
                const { baseName } = parseMagicItemName(itemName);
                expect(mockPlayerStats.equipment.some((eq) => eq.name === baseName)).toBe(true);
            }
        });

        it('rules value resolves through the real rulesFactory to a complete module set', () => {
            const modules = rulesFactory.getRules(mockPlayerStats);
            expect(modules.rules).toBeTruthy();
            expect(modules.raceRules).toBeTruthy();
            expect(modules.classRules).toBeTruthy();
        });

        it('campaign fixture respects the test-campaign lockdown rule', () => {
            expect(mockCampaignName).toBe('test-campaign');
        });

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
