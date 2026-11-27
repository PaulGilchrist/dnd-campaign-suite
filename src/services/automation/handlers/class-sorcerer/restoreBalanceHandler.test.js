// @maintained-by-ai 2026-11-26
// Owns the handler lane only: uses accounting (exact runtime keys), refusal guards,
// popup/log full-shape pins, commit write+log census. Armed-state internals
// (armRestoreBalance / isRestoreBalanceArmed / consumeArmedRestoreBalance) are owned
// by src/services/combat/restoreBalanceState.test.js — here arming is pinned as
// delegation only, matching useLoggedDiceRollAttack.restore-balance.test.js.
// The ability-modifier lookup is NOT mocked: the real getAbilityModifier is a pure
// lookup and usesMax is observable through the popup/log strings.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { callOrder } = vi.hoisted(() => ({ callOrder: [] }));

import { handle } from './restoreBalanceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((...args) => {
        callOrder.push('getRuntimeValue');
        return args;
    }),
    setRuntimeValue: vi.fn(async () => {
        callOrder.push('setRuntimeValue');
    }),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async (...args) => {
        callOrder.push('addEntry');
        return args;
    }),
}));

vi.mock('../../../combat/restoreBalanceState.js', () => ({
    isRestoreBalanceArmed: vi.fn(() => {
        callOrder.push('isRestoreBalanceArmed');
        return false;
    }),
    armRestoreBalance: vi.fn(async () => {
        callOrder.push('armRestoreBalance');
    }),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../ui/logService.js');
const { isRestoreBalanceArmed, armRestoreBalance } = await import(
    '../../../combat/restoreBalanceState.js'
);

const campaignName = 'TestCampaign';
const FROZEN_NOW = 1_700_000_000_000;

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

const action = {
    name: 'Restore Balance',
    automation: { type: 'restore_balance', range: '60_ft' },
};

// Exact-key router over the handler's runtime reads. Armed state is consulted
// via the mocked restoreBalanceState module, never via a direct key read.
function mockRuntime({ uses = null, armed = false }) {
    // Re-pin per-test while keeping the call-order tracking.
    isRestoreBalanceArmed.mockImplementation(() => {
        callOrder.push('isRestoreBalanceArmed');
        return armed;
    });
    getRuntimeValue.mockImplementation((name, key) => {
        callOrder.push('getRuntimeValue');
        return key === 'restoreBalanceUses' ? uses : null;
    });
}

const armedPopup = (description) => ({
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Restore Balance',
        description,
        automation: { type: 'restore_balance', range: '60_ft' },
    },
});

const ARMED_PREFIX =
    'Restore Balance armed: the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet will be without Advantage or Disadvantage. Uses: ';
const LOG_PREFIX =
    'TestSorcerer used Restore Balance (Reaction). Armed: the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet is without Advantage or Disadvantage. Uses: ';

describe('restoreBalanceHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        callOrder.length = 0;
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('commit census: reads uses, spends one, arms, logs, and returns the armed popup in order', async () => {
        mockRuntime({ uses: 3 });

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result).toEqual(
            armedPopup(`${ARMED_PREFIX}2/3.`)
        );
        expect(callOrder).toEqual([
            'getRuntimeValue',
            'isRestoreBalanceArmed',
            'setRuntimeValue',
            'armRestoreBalance',
            'addEntry',
        ]);
        expect(getRuntimeValue.mock.calls).toEqual([
            ['TestSorcerer', 'restoreBalanceUses'],
        ]);
        expect(isRestoreBalanceArmed.mock.calls).toEqual([
            ['TestSorcerer', campaignName],
        ]);
        expect(setRuntimeValue.mock.calls).toEqual([
            ['TestSorcerer', 'restoreBalanceUses', 2, campaignName],
        ]);
        expect(armRestoreBalance.mock.calls).toEqual([
            ['TestSorcerer', FROZEN_NOW, campaignName],
        ]);
        expect(addEntry.mock.calls).toEqual([
            [
                campaignName,
                {
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Restore Balance',
                    description: `${LOG_PREFIX}2/3.`,
                    timestamp: FROZEN_NOW,
                },
            ],
        ]);
    });

    it.each([
        ['spends the explicit last use down to 0', 3, 1, 0, '0/3'],
        ['defaults a null runtime value to usesMax = chaMod', 3, null, 2, '2/3'],
        ['clamps the default to 1 use when the CHA modifier is negative', -1, null, 0, '0/1'],
    ])(
        '%s',
        async (_name, chaBonus, uses, expectedWrite, expectedCounts) => {
            mockRuntime({ uses });

            const result = await handle(
                action,
                makePlayerStats({ abilities: [{ name: 'Charisma', bonus: chaBonus }] }),
                campaignName
            );

            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestSorcerer', 'restoreBalanceUses', expectedWrite, campaignName],
            ]);
            expect(result).toEqual(armedPopup(`${ARMED_PREFIX}${expectedCounts}.`));
        }
    );

    it.each([
        [
            'refuses with no uses remaining (never consults armed state)',
            { uses: 0, armedQueries: [] },
            'No uses remaining. Recharges on a Long Rest.',
        ],
        [
            'refuses to arm twice without spending a second use',
            { uses: 2, armed: true, armedQueries: [['TestSorcerer', campaignName]] },
            'Restore Balance is already armed — the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet will be a normal roll.',
        ],
    ])('%s', async (_name, { uses, armed = false, armedQueries }, expectedDescription) => {
        mockRuntime({ uses, armed });

        const result = await handle(action, makePlayerStats(), campaignName);

        expect(result).toEqual(armedPopup(expectedDescription));
        // Zero-spend census: nothing written, armed, or logged.
        expect(isRestoreBalanceArmed.mock.calls).toEqual(armedQueries);
        expect(setRuntimeValue.mock.calls).toEqual([]);
        expect(armRestoreBalance.mock.calls).toEqual([]);
        expect(addEntry.mock.calls).toEqual([]);
    });
});
