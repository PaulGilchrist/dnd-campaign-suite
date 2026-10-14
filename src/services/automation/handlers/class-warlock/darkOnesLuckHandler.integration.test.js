import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getStore } from '../../../../hooks/runtime/useRuntimeState.js';
import { handle } from './darkOnesLuckHandler.js';

const campaignName = 'test-campaign';
const playerName = 'HexbladeWarlockTest';

vi.mock('../../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 1,
        class: { name: 'Warlock', major: { name: 'Fiend Patron' } },
        abilities: [{ name: 'Charisma', bonus: 2 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Dark One's Own Luck",
        automation: { type: 'dark_ones_luck', diceExpression: '1d10' },
        ...overrides,
    };
}

describe('darkOnesLuckHandler integration with runtime store', () => {
    beforeEach(() => {
        const store = getStore(playerName);
        store.clear();
        const campaignStore = getStore('campaign');
        campaignStore.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should enhance a failed ability check with d10 and return popup', async () => {
        // Seed uses directly as a number (matches what handler expects)
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 2);

        const campaignStore = getStore('campaign');
        campaignStore.set('lastAttack', {
            rollType: 'check',
            attackerName: playerName,
            d20: 3,
            bonus: 3,
            checkName: 'Stealth check'
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe("Dark One's Own Luck");
        expect(result.payload.description).toContain('Stealth check');
        expect(result.payload.description).toContain('d20(3)');
        expect(result.payload.description).toContain('+ 3 = 6');
    });

    it('should enhance a failed saving throw with d10 and return popup', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 2);

        const campaignStore = getStore('campaign');
        campaignStore.set('lastAttack', {
            rollType: 'save',
            attackerName: playerName,
            d20: 5,
            bonus: 2,
            saveType: 'wisdom'
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe("Dark One's Own Luck");
        expect(result.payload.description).toContain('WIS');
        expect(result.payload.description).toContain('d20(5)');
        expect(result.payload.description).toContain('+ 2 = 7');
    });

    it('should reject when no recent check or save by this player', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 1);

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No recent ability check');
    });

    it('should reject when no uses remaining', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 0);

        const campaignStore = getStore('campaign');
        campaignStore.set('lastAttack', {
            rollType: 'check',
            attackerName: playerName,
            d20: 3,
            bonus: 3,
            checkName: 'Stealth check'
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('no uses remaining');
    });

    it('should reject when lastAttack is by a different character', async () => {
        const store = getStore(playerName);
        store.set('darkOnesLuckUses', 1);

        const campaignStore = getStore('campaign');
        campaignStore.set('lastAttack', {
            rollType: 'check',
            attackerName: 'Goblin',
            d20: 3,
            bonus: 3,
            checkName: 'Stealth check'
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName);

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No recent ability check');
        expect(result.payload.description).toContain(playerName);
    });
});
