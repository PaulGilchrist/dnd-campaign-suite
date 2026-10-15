// @maintained-by-ai
// elfishLineageHandler — unit seam map.
//
// This file OWNS:
// - handle() router: modal when unselected, popup with subrace-authoritative
//   lineage when already selected (CLA-118: never a stale runtime value).
// - confirmElfisLineage() / changeElfisLineageCantrip() / restoreUses():
//   exact runtime-key write pins (selection/ability/cantrip/level3/level5/
//   wizardCantrip) — the keys other suites mock against live here.
// - the six getters as one getter→key delegation table.
// - resolveElfishLineage() CLA-118 precedence: race.lineage > race.subrace.name
//   > legacy _elfishLineageSelection runtime key > null.
// - elfishLineageSpeedBonus() guards: trait gating (specialActions AND
//   passives lanes), Wood Elf only, absolute-speed guard, missing-speedBonus
//   console.error.
// - stampElfishLineageRuntime() CLA-118 wizard seam: one merged setRuntimeObject
//   write, High Elf wizard-cantrip swap, unknown-subrace guard.
//
// Owned ELSEWHERE (do not re-pin here):
// - charSummaryCalc.cla118-lineage-speed.test.js — sheet SPEED LINE arithmetic.
// - speedUtils.cla118-elfish-lineage.test.js — applyElfisLineageSpeed base
//   seeding (its channel-preference cases re-run this file's resolves).
//
// Deterministic: pure functions over an in-memory runtime-store mock, no
// timers, no DOM, no network. LINEAGE_DATA below intentionally mirrors the
// handler's ELVEN_LINEAGES so rule-data edits fail here on purpose.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmElfisLineage,
    changeElfisLineageCantrip,
    restoreUses,
    resolveElfishLineage,
    elfishLineageSpeedBonus,
    stampElfishLineageRuntime,
    getElfisLineageSelection,
    getElfisLineageAbility,
    getElfisLineageCantrip,
    getElfisLineageLevel3Spell,
    getElfisLineageLevel5Spell,
    getElfisLineageWizardCantrip,
} from './elfishLineageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeObject, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        ...overrides,
    };
}

const LINEAGE_DATA = {
    Drow: {
        ability: 'Charisma',
        cantrip: 'Dancing Lights',
        level3: 'Faerie Fire',
        level5: 'Darkness',
    },
    'High Elf': {
        ability: 'Intelligence',
        cantrip: 'Prestidigitation',
        level3: 'Detect Magic',
        level5: 'Misty Step',
        wizardCantrip: 'Prestidigitation',
    },
    'Wood Elf': {
        ability: 'Wisdom',
        cantrip: 'Druidcraft',
        level3: 'Longstrider',
        level5: 'Pass Without Trace',
    },
};

describe('elfishLineageHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal when no lineage is selected', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                { name: 'Elfish Lineage', description: 'Choose an elfish lineage.', automation: { type: 'elfish_lineage' } },
                makePlayerStats(),
                'test-campaign',
                'test-map'
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elfishLineage');
            expect(result.payload.action.name).toBe('Elfish Lineage');
            expect(result.payload.playerStats).toEqual(makePlayerStats());
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns popup with info when lineage is already selected', async () => {
            getRuntimeValue.mockReturnValue('Drow');

            const result = await handle(
                { name: 'Elfish Lineage', automation: { type: 'elfish_lineage' } },
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elfish Lineage: Drow (already selected).');
            expect(result.payload.automation.type).toBe('elfish_lineage');
        });

        // CLA-118: popup reports the subrace-authoritative lineage, never a
        // stale runtime value.
        it('reports the subrace-authoritative lineage, not the stale runtime value', async () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            const stats = makePlayerStats({ race: { name: 'Elf', subrace: { name: 'Drow' } } });
            const result = await handle({ name: 'Elfish Lineage', automation: { type: 'elfish_lineage' } }, stats, 'test-campaign', null);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Elfish Lineage: Drow (already selected).');
        });
    });

    describe('confirmElfisLineage', () => {
        it.each(Object.entries(LINEAGE_DATA))('stores lineage data for %s', async (lineage, data) => {
            const result = await confirmElfisLineage(makePlayerStats(), lineage, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elfish Lineage');
            expect(result.payload.description).toBe(`Selected ${lineage} lineage. Spellcasting ability: ${data.ability}.`);
            expect(result.payload.automation.type).toBe('elfish_lineage');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageSelection', lineage, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageAbility', data.ability, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageCantrip', data.cantrip, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageLevel3', data.level3, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageLevel5', data.level5, 'test-campaign'
            );
            if (data.wizardCantrip) {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestHero', '_elfishLineageWizardCantrip', data.wizardCantrip, 'test-campaign'
                );
            }
        });

        it.each(['Nonexistent', '', undefined])('returns error popup for invalid lineage %s', async (lineage) => {
            const result = await confirmElfisLineage(makePlayerStats(), lineage, 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No lineage selected.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('changeElfisLineageCantrip', () => {
        it('stores the new wizard cantrip and returns confirmation', async () => {
            const result = await changeElfisLineageCantrip(makePlayerStats(), 'Fire Bolt', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Wizard cantrip changed to Fire Bolt.');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', '_elfishLineageWizardCantrip', 'Fire Bolt', 'test-campaign'
            );
        });
    });

    describe('restoreUses', () => {
        it('clears all lineage keys including wizard cantrip', () => {
            restoreUses('TestHero', 'test-campaign');

            const calls = setRuntimeValue.mock.calls;
            expect(calls.map((c) => c[1])).toEqual([
                '_elfishLineageSelection',
                '_elfishLineageAbility',
                '_elfishLineageCantrip',
                '_elfishLineageLevel3',
                '_elfishLineageLevel5',
                '_elfishLineageWizardCantrip',
            ]);
            calls.forEach((c) => {
                expect(c).toEqual(['TestHero', c[1], null, 'test-campaign']);
            });
        });
    });

    describe('runtime getters', () => {
        // Each getter is a one-line delegation to getRuntimeValue on its exact
        // key — pinned as a table so a renamed key fails here, once, clearly.
        it.each([
            ['getElfisLineageSelection', getElfisLineageSelection, '_elfishLineageSelection'],
            ['getElfisLineageAbility', getElfisLineageAbility, '_elfishLineageAbility'],
            ['getElfisLineageCantrip', getElfisLineageCantrip, '_elfishLineageCantrip'],
            ['getElfisLineageLevel3Spell', getElfisLineageLevel3Spell, '_elfishLineageLevel3'],
            ['getElfisLineageLevel5Spell', getElfisLineageLevel5Spell, '_elfishLineageLevel5'],
            ['getElfisLineageWizardCantrip', getElfisLineageWizardCantrip, '_elfishLineageWizardCantrip'],
        ])('%s reads %s verbatim', (_label, getter, key) => {
            getRuntimeValue.mockReturnValue('SENTINEL');
            expect(getter(makePlayerStats(), 'test-campaign')).toBe('SENTINEL');
            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', key, 'test-campaign');
        });
    });

    describe('resolveElfishLineage (CLA-118 precedence)', () => {
        it('prefers race.lineage over subrace and runtime', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            const stats = makePlayerStats({ race: { name: 'Elf', lineage: 'High Elf', subrace: { name: 'Drow' } } });
            expect(resolveElfishLineage(stats, 'test-campaign')).toBe('High Elf');
        });

        it('prefers race.subrace over a stale runtime selection', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            const stats = makePlayerStats({ race: { name: 'Elf', subrace: { name: 'Drow' } } });
            expect(resolveElfishLineage(stats, 'test-campaign')).toBe('Drow');
        });

        it('falls back to the runtime selection when no subrace is persisted', () => {
            getRuntimeValue.mockReturnValue('Wood Elf');
            expect(resolveElfishLineage(makePlayerStats({ race: { name: 'Elf' } }), 'test-campaign')).toBe('Wood Elf');
        });

        it('returns null when no channel carries a lineage', () => {
            getRuntimeValue.mockReturnValue(null);
            expect(resolveElfishLineage(makePlayerStats(), 'test-campaign')).toBeNull();
        });
    });

    describe('elfishLineageSpeedBonus (CLA-118)', () => {
        const woodElfOption = { name: 'Wood Elf', spellcastingAbility: 'Wisdom', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace', speedBonus: 5 };

        it('returns 5 for a 2024 Wood Elf resolved via subrace with no runtime key', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({
                race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } },
                automation: { specialActions: [{ type: 'elfish_lineage', options: [woodElfOption] }] },
            });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(5);
        });

        it('finds the trait row in the passives lane too', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({
                race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } },
                automation: { specialActions: [], passives: [{ type: 'elfish_lineage', options: [woodElfOption] }] },
            });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(5);
        });

        it('returns 0 when the resolved lineage is not Wood Elf', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({
                race: { name: 'Elf', speed: 30, subrace: { name: 'Drow' } },
                automation: { specialActions: [{ type: 'elfish_lineage', options: [woodElfOption] }] },
            });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
        });

        it('returns 0 when the character lacks the elfish_lineage trait', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({ race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } }, automation: {} });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
        });

        it('returns 0 when the 5e subrace JSON already carries the absolute speed', () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({
                race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf', speed: 35 } },
                automation: { specialActions: [{ type: 'elfish_lineage', options: [woodElfOption] }] },
            });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
        });

        it('logs an error and returns 0 when the Wood Elf option lacks speedBonus', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            getRuntimeValue.mockReturnValue(null);
            const stats = makePlayerStats({
                race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } },
                automation: { specialActions: [{ type: 'elfish_lineage', options: [{ name: 'Wood Elf', cantrip: 'Druidcraft' }] }] },
            });
            expect(elfishLineageSpeedBonus(stats, 'test-campaign')).toBe(0);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('stampElfishLineageRuntime (CLA-118 wizard seam)', () => {
        it('writes all runtime lineage keys in one merged write', () => {
            stampElfishLineageRuntime('ElfTest', 'Drow', 'test-campaign');
            expect(setRuntimeObject).toHaveBeenCalledTimes(1);
            const [name, patch, campaign] = setRuntimeObject.mock.calls[0];
            expect(name).toBe('ElfTest');
            expect(campaign).toBe('test-campaign');
            expect(patch).toEqual({
                _elfishLineageSelection: 'Drow',
                _elfishLineageAbility: 'Charisma',
                _elfishLineageCantrip: 'Dancing Lights',
                _elfishLineageLevel3: 'Faerie Fire',
                _elfishLineageLevel5: 'Darkness',
            });
        });

        it('includes the wizard cantrip swap for High Elf', () => {
            stampElfishLineageRuntime('ElfTest', 'High Elf', 'test-campaign');
            expect(setRuntimeObject.mock.calls[0][1]._elfishLineageWizardCantrip).toBe('Prestidigitation');
        });

        it('logs an error and writes nothing for an unknown subrace', () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            stampElfishLineageRuntime('ElfTest', 'Moon Elf', 'test-campaign');
            expect(setRuntimeObject).not.toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});
