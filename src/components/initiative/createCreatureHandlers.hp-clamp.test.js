// @maintained-by-ai
// Regression lane for bug-initiative-hp-input-no-range-clamp: the GM HP input on
// Initiative creature cards used to write ANY parsed int straight into combatSummary
// (HP 99/7, HP −3/7 — un-dead monster, broken readout, zero hp_change audit rows).
// Pins, in the handler lane (leaf display bytes stay in CreatureHp.test.jsx):
//   - monster commits clamp into [0, effective max] (> max → max, ≤ 0 → 0 = the
//     app's monster death model, mirroring applyDamage's Math.max(0,…) floor)
//   - every committed override logs an hp_change entry in the damage-lane shape
//     (sourceName 'GM HP override', threshold 'dead'/'bloodied' stamps)
//   - player lane keeps the UNCLAMPED ceiling (temp-HP overshoot is legitimate)
//     but shares the damage lane's 0 death floor (bug-gm-hp-input-negative-player-hp)
//   - max-edit third-arg lane bypasses the clamp (it pre-clamps against the NEW max)
//   - placeholder rows without maxHp stay unclamped (legacy lane, cf. SP-069 table)
// Mock set mirrors createCreatureHandlers.sp069.test.js (+ logService).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { addEntry } from '../../services/ui/logService.js';
import storage from '../../services/ui/storage.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { vanishSummonAtZeroHp } from '../../services/combat/summons/summonedCreatureService.js';

vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(),
    sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    clearCombat: vi.fn(),
    setInitiative: vi.fn(),
    renameNpc: vi.fn(),
    setTarget: vi.fn(),
    removeNpc: vi.fn(),
    addNpc: vi.fn(),
}));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    maybeGrantThiefsReflexesSecondTurn: vi.fn(),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    vanishSummonAtZeroHp: vi.fn(),
}));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({
    breakHypnoticPatternOnDamage: vi.fn(() => false),
}));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({
    sweepNewCombatClocks: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';

function makeHandlers(creatures) {
    const combatSummary = { round: 1, creatures };
    const setCombatSummary = vi.fn();
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary,
        setActiveCreatureName: vi.fn(),
        characters: [],
        numOfNpc: 0,
        isLocalhost: true,
    });
    return { handlers, combatSummary, setCombatSummary };
}

const hpEntry = () => addEntry.mock.calls.find((c) => c[1]?.type === 'hp_change')?.[1];

beforeEach(() => {
    vi.clearAllMocks();
    // Deterministic runtime reads: no Aid/Feast bonuses, PC at 10/20.
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'hitPoints') return 20;
        return null;
    });
});

describe('handleCreatureHpChange — monster clamp (bug-initiative-hp-input-no-range-clamp)', () => {
    it.each`
        committed | expected | desc
        ${99}     | ${7}     | ${'HP 99 on a 7-max goblin clamps to maxHp'}
        ${-3}     | ${0}     | ${'HP −3 clamps to 0 — the app\'s monster death floor'}
        ${0}      | ${0}     | ${'HP 0 stays 0'}
        ${5}      | ${5}     | ${'in-range edit persists cleanly'}
    `('$desc — commits $expected verbatim', ({ committed, expected }) => {
        getRuntimeValue.mockImplementation((_key, prop) => (prop === 'currentHitPoints' ? 3 : null));
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 3, maxHp: 7 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', committed);

        expect(combatSummary.creatures[0].currentHp).toBe(expected);
    });

    it('clamp ceiling is the EFFECTIVE max (Aid/Heroes-Feast increases included)', () => {
        getRuntimeValue.mockImplementation((_key, prop) => {
            if (prop === 'aidHpMaxIncrease') return 5;
            return null;
        });
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 3, maxHp: 7 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', 99);

        expect(combatSummary.creatures[0].currentHp).toBe(12);
    });

    it('placeholder row without maxHp stays unclamped (legacy lane)', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'NPC 1', type: 'npc', currentHp: 10 },
        ]);

        handlers.handleCreatureHpChange('NPC 1', 50);

        expect(combatSummary.creatures[0].currentHp).toBe(50);
    });

    it('max-edit third-arg is NOT re-clamped against the old cap', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 8, maxHp: 10 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', 5, 5); // MaxHpInput pre-clamps current to new max

        expect(combatSummary.creatures[0].currentHp).toBe(5);
        expect(combatSummary.creatures[0].maxHp).toBe(5);
    });

    it('commit clamping to an unchanged value is a silent no-op — zero writes, zero log', () => {
        const { handlers, combatSummary, setCombatSummary } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 7, maxHp: 7 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', 99); // clamps 7 → 7 = delta 0

        expect(combatSummary.creatures[0].currentHp).toBe(7);
        expect(storage.set).not.toHaveBeenCalled();
        expect(setCombatSummary).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('spell-summon clamped to 0 still vanishes (SP-114 rides the clamped value)', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Sprite', type: 'npc', currentHp: 5, maxHp: 30, summonedBy: 'Alice', summonSource: 'spell' },
        ]);

        handlers.handleCreatureHpChange('Sprite', -1);

        expect(combatSummary.creatures[0].currentHp).toBe(0);
        expect(vanishSummonAtZeroHp).toHaveBeenCalled();
    });
});

describe('handleCreatureHpChange — hp_change audit log', () => {
    it('logs the death override in the damage-lane entry shape with threshold dead', () => {
        const { handlers } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 3, maxHp: 7 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', -3);

        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(hpEntry()).toEqual({
            type: 'hp_change',
            targetName: 'Goblin 1',
            sourceName: 'GM HP override',
            delta: -3,
            currentHp: 0,
            maxHp: 7,
            isHealing: false,
            isUnconscious: true,
            note: 'Manual GM edit from the initiative card.',
            threshold: 'dead',
        });
    });

    it('logs a bloodied crossing with threshold bloodied', () => {
        const { handlers } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 7, maxHp: 7 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', 3);

        expect(hpEntry()).toMatchObject({ delta: -4, currentHp: 3, threshold: 'bloodied', isUnconscious: false });
    });

    it('logs an upward override as healing with the clamped currentHp', () => {
        const { handlers } = makeHandlers([
            { name: 'Goblin 1', type: 'npc', currentHp: 3, maxHp: 7 },
        ]);

        handlers.handleCreatureHpChange('Goblin 1', 99);

        // No threshold stamped on a within-combat bump (mirrors applyDamage: the
        // key is only added when a dead/bloodied line is actually crossed).
        expect(hpEntry()).toMatchObject({ delta: 4, currentHp: 7, maxHp: 7, isHealing: true });
        expect('threshold' in hpEntry()).toBe(false);
    });
});

describe('handleCreatureHpChange — player lane (unclamped ceiling, shared 0 floor)', () => {
    it('player commit above max passes through unclamped (temp-HP overshoot)', () => {
        const { handlers, combatSummary } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 10, maxHp: 20 },
        ]);

        handlers.handleCreatureHpChange('Alice', 99);

        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'currentHitPoints', 99, campaignName);
        expect(combatSummary.creatures[0].currentHp).toBe(10); // card stays the NPC-lane store
        expect(hpEntry()).toMatchObject({ delta: 89, currentHp: 99, maxHp: 20, isHealing: true, isUnconscious: false });
    });

    // bug-gm-hp-input-negative-player-hp: negatives used to persist straight into
    // currentHitPoints with a self-contradicting dead row (threshold 'dead',
    // isUnconscious false). The commit now floors at 0, mirroring applyDamage's
    // Math.max(0, oldHp − damage) death floor.
    it('player negative commit floors at 0 with a coherent dead row', () => {
        const { handlers } = makeHandlers([
            { name: 'Alice', type: 'player', currentHp: 10, maxHp: 20 },
        ]);

        handlers.handleCreatureHpChange('Alice', -5);

        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'currentHitPoints', 0, campaignName);
        // No negative ever reaches the canonical HP key.
        expect(setRuntimeValue.mock.calls.filter((c) => c[1] === 'currentHitPoints').every((c) => c[2] >= 0)).toBe(true);
        expect(hpEntry()).toMatchObject({ delta: -10, currentHp: 0, threshold: 'dead', isUnconscious: true });
    });
});
