// @maintained-by-ai — deterministic contract pin for restoreBalanceHandler (CLA-295).
// Owns the handler lane only: uses accounting (exact runtime keys), refusal guards,
// popup/log full-string composition. Armed-state internals (armRestoreBalance /
// isRestoreBalanceArmed / consumeArmedRestoreBalance) are owned by
// src/services/combat/restoreBalanceState.test.js — here arming is pinned as
// delegation only, matching useLoggedDiceRollAttack.restore-balance.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './restoreBalanceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    // Mirrors real canonicalization (cha → Charisma) so usesMax pins are faithful.
    getAbilityModifier: vi.fn((abilities, ability) => {
        const canonical =
            { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }[
                String(ability).toLowerCase()
            ] || ability;
        const ab = abilities?.find((a) => a.name === canonical);
        return ab?.bonus ?? 0;
    }),
}));

vi.mock('../../../combat/restoreBalanceState.js', () => ({
    isRestoreBalanceArmed: vi.fn(() => false),
    armRestoreBalance: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../ui/logService.js');
const { getAbilityModifier } = await import(
    '../../../shared/abilityLookup.js'
);
const { isRestoreBalanceArmed, armRestoreBalance } = await import(
    '../../../combat/restoreBalanceState.js'
);

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Restore Balance',
        automation: { type: 'restore_balance', range: '60_ft', ...automation },
    };
}

// Exact-key router over the handler's runtime reads. Armed state is consulted
// via the mocked restoreBalanceState module, never via a direct key read.
function mockRuntime({ uses = null, armed = false }) {
    isRestoreBalanceArmed.mockReturnValue(armed);
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'restorebalanceUses') return uses;
        return null;
    });
}

describe('restoreBalanceHandler.handle', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Re-pin factory impls so a reset can never leave addEntry returning
        // undefined (the handler chains .catch on its promise).
        setRuntimeValue.mockResolvedValue(undefined);
        addEntry.mockResolvedValue(undefined);
        armRestoreBalance.mockResolvedValue(undefined);
        isRestoreBalanceArmed.mockReturnValue(false);
    });

    it('arms and returns an automation_info popup with the exact description', async () => {
        mockRuntime({ uses: 3 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Restore Balance');
        expect(result.payload.automation).toEqual({ type: 'restore_balance', range: '60_ft' });
        expect(result.payload.description).toBe(
            'Restore Balance armed: the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet will be without Advantage or Disadvantage. Uses: 2/3.',
        );
    });

    it('spends one use and delegates arming to restoreBalanceState', async () => {
        mockRuntime({ uses: 3 });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(getAbilityModifier).toHaveBeenCalledWith(expect.any(Array), 'CHA');
        expect(getRuntimeValue).toHaveBeenCalledWith('TestSorcerer', 'restorebalanceUses');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'restorebalanceUses',
            2,
            campaignName,
        );
        expect(isRestoreBalanceArmed).toHaveBeenCalledWith('TestSorcerer', campaignName);
        // Handler-side arming is delegation; payload shape owned by restoreBalanceState.test.js.
        expect(armRestoreBalance).toHaveBeenCalledWith('TestSorcerer', expect.any(Number), campaignName);
    });

    it('writes 0 when spending the last use', async () => {
        mockRuntime({ uses: 1 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'restorebalanceUses',
            0,
            campaignName,
        );
        expect(result.payload.description).toContain('Uses: 0/3.');
    });

    it('logs an ability_use entry with the exact description', async () => {
        mockRuntime({ uses: 2 });

        await handle(makeAction(), makePlayerStats(), campaignName);

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestSorcerer',
            abilityName: 'Restore Balance',
            description:
                'TestSorcerer used Restore Balance (Reaction). Armed: the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet is without Advantage or Disadvantage. Uses: 1/3.',
            timestamp: expect.any(Number),
        });
    });

    it('defaults uses to max(1, chaMod) when the runtime value is null', async () => {
        mockRuntime({ uses: null }); // cha bonus 3 → usesMax 3

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'restorebalanceUses',
            2,
            campaignName,
        );
        expect(result.payload.description).toContain('Uses: 2/3.');
    });

    it('clamps default uses to 1 when the CHA modifier is negative', async () => {
        mockRuntime({ uses: null });
        getAbilityModifier.mockReturnValue(-1);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'restorebalanceUses',
            0,
            campaignName,
        );
        expect(result.payload.description).toContain('Uses: 0/1.');
    });

    it('refuses when no uses remain without touching anything', async () => {
        mockRuntime({ uses: 0 });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toBe('No uses remaining. Recharges on a Long Rest.');
        expect(isRestoreBalanceArmed).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(armRestoreBalance).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('refuses to arm twice without spending a second use', async () => {
        mockRuntime({ uses: 2, armed: true });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result.payload.description).toBe(
            'Restore Balance is already armed — the next d20 roll with Advantage or Disadvantage by a creature you can see within 60 feet will be a normal roll.',
        );
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(armRestoreBalance).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
