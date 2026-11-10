// @maintained-by-ai
// Regression tests for the 2026-11-10 improvement: buildRuntimeConditions must
// never crash on a malformed activeConditions row. GB incident: one object
// entry (key.charAt is not a function) froze the ENTIRE Initiative view to
// zero cards in every tab with no error-boundary message. The label path now
// defends via String() (mirroring the cs.key idiom), so a stray object/number
// entry renders a sanitized label and the board keeps rendering.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

import { buildRuntimeConditions, buildDisplayCreature } from './displayCreatureUtils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const LOOKUP = 'ElderPaladin';

function stubRuntime(buckets) {
    getRuntimeValue.mockImplementation((name, key) => buckets[key] ?? null);
}

beforeEach(() => {
    getRuntimeValue.mockReset();
});

describe('buildRuntimeConditions — well-formed rows (byte-unchanged face)', () => {
    it('maps bare string keys to capitalized labels with stable ids', () => {
        stubRuntime({ activeConditions: ['poisoned', 'prone'] });
        const result = buildRuntimeConditions({ name: LOOKUP }, LOOKUP);
        expect(result).toEqual([
            { id: 'runtime-poisoned-0', key: 'poisoned', label: 'Poisoned', dc: 0, ability: 'con' },
            { id: 'runtime-prone-1', key: 'prone', label: 'Prone', dc: 0, ability: 'con' },
        ]);
    });

    it('keeps the speed_zero special-case label', () => {
        stubRuntime({ activeConditions: ['speed_zero'] });
        const [entry] = buildRuntimeConditions({ name: LOOKUP }, LOOKUP);
        expect(entry.label).toBe('Speed 0');
    });

    it('merges activeConditionMeta dc/ability and CS-row labels', () => {
        stubRuntime({
            activeConditions: ['poisoned', 'frightened'],
            activeConditionMeta: { poisoned: { dc: 13, ability: 'con' } },
        });
        const creature = { name: LOOKUP, conditions: [{ key: 'FRIGHTENED', label: 'Frightened (source)', dc: 11, ability: 'wis' }] };
        const [poisoned, frightened] = buildRuntimeConditions(creature, LOOKUP);
        expect(poisoned.dc).toBe(13);
        expect(frightened.label).toBe('Frightened (source)');
        expect(frightened.dc).toBe(11);
        expect(frightened.ability).toBe('wis');
    });
});

describe('buildRuntimeConditions — malformed rows (crash-proof face)', () => {
    it('does not throw on an object entry and still maps every other entry', () => {
        stubRuntime({ activeConditions: ['poisoned', { key: 'x', name: 'Prone' }, 'stunned'] });
        let result;
        expect(() => { result = buildRuntimeConditions({ name: LOOKUP }, LOOKUP); }).not.toThrow();
        expect(result).toHaveLength(3);
        expect(result[0].label).toBe('Poisoned');
        expect(result[2].label).toBe('Stunned');
        // Sanitized label for the object entry — a string, never a crash.
        expect(typeof result[1].label).toBe('string');
        expect(result[1].label.length).toBeGreaterThan(0);
    });

    it('does not throw on number entries', () => {
        stubRuntime({ activeConditions: [7, 'prone'] });
        const result = buildRuntimeConditions({ name: LOOKUP }, LOOKUP);
        expect(result[0].label).toBe('7');
        expect(result[1].label).toBe('Prone');
    });

    it('treats a non-array activeConditions value as empty (never throws)', () => {
        stubRuntime({ activeConditions: { 0: 'poisoned' } });
        expect(buildRuntimeConditions({ name: LOOKUP }, LOOKUP)).toEqual([]);
    });

    it('buildDisplayCreature keeps non-player cards rendering past a malformed row', () => {
        stubRuntime({ activeConditions: [{ key: 'x' }] });
        const creature = { name: 'Goblin', type: 'monster' };
        let displayed;
        expect(() => { displayed = buildDisplayCreature(creature, []); }).not.toThrow();
        expect(displayed.conditions).toHaveLength(1);
        expect(typeof displayed.conditions[0].label).toBe('string');
    });
});
