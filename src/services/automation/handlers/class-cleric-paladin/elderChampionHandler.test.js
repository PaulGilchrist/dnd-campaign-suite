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

import { handle, hasActionSpells } from './elderChampionHandler.js';

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

function mockActivationState(active, restUsed, activeBuffs, level5Slots) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'elderChampionActive') return active;
        if (key === 'elderChampionRestUsed') return restUsed;
        if (key === 'activeBuffs') return activeBuffs;
        if (key === 'spell_slots_level_5') return level5Slots;
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('elderChampionHandler', () => {
    describe('handle - already active', () => {
        it('returns popup saying already active when Elder Champion is active', async () => {
            mockActivationState(true, false, [{ name: 'Elder Champion', effect: 'elder_champion' }], 1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elder Champion is already active.');
            expect(result.payload.automationType).toBe('elder_champion');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns popup when Elder Champion buff is present even if flag is false', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [{ name: 'Elder Champion', effect: 'elder_champion' }];
                if (key === 'spell_slots_level_5') return 1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Elder Champion is already active.');
        });
    });

    describe('handle - already used since long rest', () => {
        it('returns popup when no level 5 spell slots available', async () => {
            mockActivationState(false, true, [], 0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elder Champion cannot be used again until a long rest or level 5 spell slot becomes available.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('spends a level 5 spell slot and activates when slots are available', async () => {
            mockActivationState(false, true, [], 3);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elder Champion activated by expending a level 5 spell slot.');
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'spell_slots_level_5', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'elderChampionActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Elder Champion', effect: 'elder_champion' }),
                ]),
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Elder Champion',
            }));
        });

        it('reduces slot count to zero when exactly 1 slot available', async () => {
            mockActivationState(false, true, [], 1);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'spell_slots_level_5', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'elderChampionActive', true, campaignName);
        });

        it('does not spend slots or activate when no slots available', async () => {
            mockActivationState(false, true, [], 0);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handle - activation', () => {
        it('sets elderChampionActive to true and adds buff on activation', async () => {
            mockActivationState(false, false, [], 1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elder Champion');
            expect(result.payload.automationType).toBe('elder_champion');
            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, 'elderChampionActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, 'elderChampionRestUsed', true, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, 'activeBuffs', expect.arrayContaining([
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
            ], 1);

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
            mockActivationState(false, false, [], 1);

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
