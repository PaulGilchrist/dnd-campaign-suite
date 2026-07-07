// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

import { handle, handleRestore, hasActionSpells } from './elderChampionHandler.js';

const campaignName = 'test-campaign';
const playerName = 'ClericBoy';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 6,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Elder Champion',
        automation: {
            type: 'elder_champion',
            duration: '1_minute',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function mockActivationState(active, restUsed, activeBuffs) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'elderChampionActive') return active;
        if (key === 'elderChampionRestUsed') return restUsed;
        if (key === 'activeBuffs') return activeBuffs;
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('elderChampionHandler', () => {
    describe('handle - toggle off', () => {
        it('returns popup and clears state when Elder Champion is active', async () => {
            mockActivationState(true, false, [{ name: 'Elder Champion', effect: 'elder_champion' }]);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elder Champion ended.');
            expect(result.payload.automationType).toBe('elder_champion');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'elderChampionActive', false, campaignName);
        });

        it('removes only Elder Champion buff while preserving other buffs', async () => {
            mockActivationState(true, false, [
                { name: 'Elder Champion', effect: 'elder_champion' },
                { name: 'Mage Armor', effect: 'mage_armor' },
            ]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [{ name: 'Mage Armor', effect: 'mage_armor' }],
                campaignName,
            );
        });

        it('toggles off based on buff name presence even when elderChampionActive flag is false', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [{ name: 'Elder Champion', effect: 'elder_champion' }];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Elder Champion ended.');
        });
    });

    describe('handle - already used long rest', () => {
        it('returns modal for restore when long rest already used', async () => {
            mockActivationState(false, true, []);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elderChampionRestore');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe(campaignName);
        });
    });

    describe('handle - activation', () => {
        it('sets elderChampionActive to true and adds buff on activation', async () => {
            mockActivationState(false, false, []);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elder Champion');
            expect(result.payload.automationType).toBe('elder_champion');
            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, 'elderChampionActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, 'activeBuffs', expect.arrayContaining([
                expect.objectContaining({ name: 'Elder Champion', effect: 'elder_champion' }),
            ]), campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Elder Champion',
            }));
        });

        it('appends Elder Champion buff to existing buffs', async () => {
            mockActivationState(false, false, [
                { name: 'Mage Armor', effect: 'mage_armor' },
            ]);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Mage Armor' }),
                    expect.objectContaining({ name: 'Elder Champion' }),
                ]),
                campaignName,
            );
        });

        it('uses custom duration from automation config', async () => {
            mockActivationState(false, false, []);

            const action = makeAction({ automation: { duration: '10_minutes' } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '10_minutes' }),
                ]),
                campaignName,
            );
        });
    });

    describe('handleRestore', () => {
        it('returns popup when no level 5 spell slots available', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handleRestore(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No level 5 spell slots available');
        });

        it('spends a level 5 spell slot and restores on restore', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'spellSlotLevel5') return 3;
                return null;
            });

            const result = await handleRestore(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'spellSlotLevel5', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'elderChampionRestUsed', false, campaignName);
            expect(result.payload.description).toContain('restored');
            expect(result.payload.name).toBe('Elder Champion');
        });

        it('reduces slot count to zero when exactly 1 slot available', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'spellSlotLevel5') return 1;
                return null;
            });

            await handleRestore(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'spellSlotLevel5', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'elderChampionRestUsed', false, campaignName);
        });

        it('does not spend slots or restore when no slots available', async () => {
            getRuntimeValue.mockReturnValue(0);

            await handleRestore(makeAction(), makePlayerStats(), campaignName);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });


    describe('hasActionSpells', () => {
        it('returns true when player has a spell with "1 action" casting time', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Guiding Bolt', casting_time: '1 action' },
                    { name: 'Healing Word', casting_time: '1 bonus action' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(true);
        });

        it('returns true when player has a spell with "action" casting time', () => {
            const stats = makePlayerStats({
                spells: [{ name: 'Cantrip', casting_time: 'action' }],
            });

            expect(hasActionSpells(stats)).toBe(true);
        });

        it('returns false when spells have non-action casting times', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Healing Word', casting_time: '1 bonus action' },
                    { name: 'Reaction Shield', casting_time: '1 reaction' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(false);
        });

        it('returns false when spells array is empty or missing', () => {
            expect(hasActionSpells(makePlayerStats({ spells: [] }))).toBe(false);
            expect(hasActionSpells(makePlayerStats({}))).toBe(false);
        });

        it('returns false when casting_time is falsy or non-action', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Mystery Spell', casting_time: undefined },
                    { name: 'Null Spell', casting_time: null },
                    { name: 'Action Spell', casting_time: '1 ACTION' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(true);
        });
    });
});
