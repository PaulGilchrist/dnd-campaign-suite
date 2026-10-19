// @maintained-by-ai
// CLA-295 Restore Balance — arm/consume seam lane (restoreBalanceState.js).
// Family split (#1009): use-cost gate + popup/log composition ->
//   automation/handlers/class-sorcerer/restoreBalanceHandler.test.js (mocks this module);
// roll-lane invocation + _restoreBalanceCancelled ->
//   hooks/combat/useLoggedDiceRollAttack.restore-balance.test.js (mocks this module);
// effect combine / net-mode legs -> conditions/conditionEffects* and
//   conditions/restoreBalance.test.js (which explicitly delegates arm/consume here).
// This lane owns the latch contract: exact persisted bytes at each seam (#787/#932),
// payload gate, vision-before-range guard order (#967), first-holder-wins precedence
// with other-holder falsifier (#948), and the one-shot two-call latch (#950).
// armedAt is a caller-supplied number stored verbatim — no timers, no wall-clock
// adjudication here (#app); the log timestamp is benign log metadata.
// Old -> new map:
//   "arms via runtime store with JSON armedAt payload"        -> seam flow (test 1)
//   "isRestoreBalanceArmed only true for valid armed JSON payload"
//                                                              -> payload gate + replacement (#949)
//   "returns null and leaves flag when nothing armed"         -> zero-write honesty + no-roller guard (#921)
//   "does not consume when roller is out of 60 ft range" +
//   "does not consume when holder is Blinded"                 -> consolidated guard-order test
//   "lets the holder cancel its own adv/dis roll"             -> self-cancel (exact log bytes, no-rollName branch)
//   [added] two armed holders -> only first consumes, second latch intact (#948)
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../rules/combat/rangeCheck.js';
import { addEntry } from '../ui/logService.js';
import {
    consumeArmedRestoreBalance,
    armRestoreBalance,
    isRestoreBalanceArmed,
    RESTORE_BALANCE_ARMED_KEY,
    RESTORE_BALANCE_RANGE_FT,
} from './restoreBalanceState.js';

const campaignName = 'test-campaign';

const armedKey = (name) => `${name}.${RESTORE_BALANCE_ARMED_KEY}`;

// Faithful keyed fake store: all reads/writes of this module go through the
// single armed key; values persist byte-exact (including the null disarm write).
function fakeStore(initialArmed = {}) {
    const store = new Map(
        Object.entries(initialArmed).map(([name, bytes]) => [armedKey(name), bytes]),
    );
    getRuntimeValue.mockImplementation((name, prop) => {
        const value = store.get(`${name}.${prop}`);
        return value === undefined ? null : value;
    });
    setRuntimeValue.mockImplementation(async (name, prop, value) => {
        store.set(`${name}.${prop}`, value);
        return value;
    });
    return store;
}

const combatSummary = {
    creatures: [
        { name: 'DraconicDragon', conditions: [] },
        { name: 'AberrantSorcerer', conditions: [] },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    isWithinRange.mockResolvedValue(true);
});

describe('arm/consume seam (restoreBalanceState.js)', () => {
    it('seam flow: arm writes exact bytes, consume disarms once with exact log bytes, second call refused', async () => {
        const store = fakeStore();

        await armRestoreBalance('AberrantSorcerer', 123, campaignName);
        expect(store.get(armedKey('AberrantSorcerer'))).toBe('{"armedAt":123}');
        expect(isRestoreBalanceArmed('AberrantSorcerer', campaignName)).toBe(true);

        setRuntimeValue.mockClear();
        addEntry.mockClear();
        const consumed = await consumeArmedRestoreBalance(
            campaignName, combatSummary, 'DraconicDragon', 'Warhammer', 'attack',
        );

        expect(consumed).toBe('AberrantSorcerer');
        expect(isWithinRange).toHaveBeenCalledWith('AberrantSorcerer', 'DraconicDragon', RESTORE_BALANCE_RANGE_FT);
        expect(store.get(armedKey('AberrantSorcerer'))).toBeNull();
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'AberrantSorcerer', RESTORE_BALANCE_ARMED_KEY, null, campaignName,
        );
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'AberrantSorcerer',
            abilityName: 'Restore Balance',
            description: "AberrantSorcerer used Restore Balance (Reaction): DraconicDragon's Warhammer attack roll is made without Advantage or Disadvantage.",
            targetName: 'DraconicDragon',
            timestamp: expect.any(Number),
        });

        // two-call latch proof (#950): the disarmed holder cannot consume twice
        setRuntimeValue.mockClear();
        addEntry.mockClear();
        const again = await consumeArmedRestoreBalance(
            campaignName, combatSummary, 'DraconicDragon', 'Warhammer', 'attack',
        );
        expect(again).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('payload gate: only a JSON object with truthy armedAt reads as armed; arming replaces bytes, never stacks', () => {
        const store = fakeStore({
            valid: '{"armedAt":1}',
            garbage: 'not-json',
            scalar: '3',
            zero: '{"armedAt":0}',
            nully: 'null',
        });

        expect(isRestoreBalanceArmed('valid', campaignName)).toBe(true);
        expect(isRestoreBalanceArmed('garbage', campaignName)).toBe(false);
        expect(isRestoreBalanceArmed('scalar', campaignName)).toBe(false);
        expect(isRestoreBalanceArmed('zero', campaignName)).toBe(false);
        expect(isRestoreBalanceArmed('nully', campaignName)).toBe(false);
        expect(isRestoreBalanceArmed('absent', campaignName)).toBe(false);

        // re-arm overwrites with the new payload (replacement-not-stacked, #949)
        return armRestoreBalance('valid', 456, campaignName).then(() => {
            expect(store.get(armedKey('valid'))).toBe('{"armedAt":456}');
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        });
    });

    it('writes nothing when there is nothing to consume', async () => {
        const store = fakeStore();

        const consumed = await consumeArmedRestoreBalance(
            campaignName, combatSummary, 'DraconicDragon', 'Warhammer', 'attack',
        );

        expect(consumed).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(store.size).toBe(0);

        // guard leg (#921): armed holders but no roller — short-circuits
        // before any range consultation and keeps the latch bytes intact
        setRuntimeValue.mockClear();
        addEntry.mockClear();
        isWithinRange.mockClear();
        const armedStore = fakeStore({ AberrantSorcerer: '{"armedAt":1}' });

        const noRoller = await consumeArmedRestoreBalance(
            campaignName, combatSummary, undefined, 'Warhammer', 'attack',
        );

        expect(noRoller).toBeNull();
        expect(isWithinRange).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(armedStore.get(armedKey('AberrantSorcerer'))).toBe('{"armedAt":1}');
    });

    it('refuses out-of-range and blinded holders, keeping the latch armed', async () => {
        const store = fakeStore({ AberrantSorcerer: '{"armedAt":1}' });

        // leg 1: out of 60 ft — range IS consulted, latch stays armed
        isWithinRange.mockResolvedValueOnce(false);
        const outOfRange = await consumeArmedRestoreBalance(
            campaignName, combatSummary, 'DraconicDragon', 'Warhammer', 'attack',
        );

        expect(outOfRange).toBeNull();
        expect(isWithinRange).toHaveBeenCalledWith('AberrantSorcerer', 'DraconicDragon', RESTORE_BALANCE_RANGE_FT);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(store.get(armedKey('AberrantSorcerer'))).toBe('{"armedAt":1}');

        // leg 2: blinded holder — vision guard short-circuits BEFORE range (#967)
        isWithinRange.mockClear();
        const blindedSummary = {
            creatures: [
                { name: 'DraconicDragon', conditions: [] },
                { name: 'AberrantSorcerer', conditions: [{ key: 'blinded' }] },
            ],
        };

        const blinded = await consumeArmedRestoreBalance(
            campaignName, blindedSummary, 'DraconicDragon', 'Warhammer', 'attack',
        );

        expect(blinded).toBeNull();
        expect(isWithinRange).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(store.get(armedKey('AberrantSorcerer'))).toBe('{"armedAt":1}');
    });

    it('first armed holder consumes once; another holder\'s armed bytes stay intact', async () => {
        const store = fakeStore({
            DraconicDragon: '{"armedAt":1}',
            AberrantSorcerer: '{"armedAt":7}',
        });

        const consumed = await consumeArmedRestoreBalance(
            campaignName, combatSummary, 'AberrantWarlock', 'Fire Bolt', 'attack',
        );

        expect(consumed).toBe('DraconicDragon');
        expect(store.get(armedKey('DraconicDragon'))).toBeNull();
        expect(store.get(armedKey('AberrantSorcerer'))).toBe('{"armedAt":7}');
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'DraconicDragon', RESTORE_BALANCE_ARMED_KEY, null, campaignName,
        );
        expect(addEntry).toHaveBeenCalledTimes(1);
    });

    it('holder cancels its own roll; log pins exact bytes with the no-rollName branch', async () => {
        const store = fakeStore({ AberrantSorcerer: '{"armedAt":1}' });

        const consumed = await consumeArmedRestoreBalance(
            campaignName, combatSummary, 'AberrantSorcerer', null, 'save',
        );

        expect(consumed).toBe('AberrantSorcerer');
        expect(store.get(armedKey('AberrantSorcerer'))).toBeNull();
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'AberrantSorcerer',
            abilityName: 'Restore Balance',
            description: "AberrantSorcerer used Restore Balance (Reaction): AberrantSorcerer's save roll is made without Advantage or Disadvantage.",
            targetName: 'AberrantSorcerer',
            timestamp: expect.any(Number),
        });
    });
});
