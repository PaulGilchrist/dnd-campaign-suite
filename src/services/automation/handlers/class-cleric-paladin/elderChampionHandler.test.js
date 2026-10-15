// @maintained-by-ai: 2026-10-15
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

import { handle, hasActionSpells, isElderChampionActive } from './elderChampionHandler.js';

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

// NOTE: handle() determines "already active" solely from an 'Elder Champion'
// entry in activeBuffs — the elderChampionActive flag is never read there.
function mockState(config = {}) {
    const { active = false, restUsed = false, activeBuffs = [] } = config;
    // level5Slots may be explicitly null/undefined — read it without a destructuring default.
    const level5Slots = 'level5Slots' in config ? config.level5Slots : 1;
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
        it('returns already-active popup without writing when buff is in activeBuffs, even if the flag is stale', async () => {
            mockState({ active: false, restUsed: false, activeBuffs: [{ name: 'Elder Champion', effect: 'elder_champion' }] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elder Champion');
            expect(result.payload.automationType).toBe('elder_champion');
            expect(result.payload.description).toBe('Elder Champion is already active.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handle - already used since long rest', () => {
        it('returns blocked popup without writing when no level 5 spell slots are available', async () => {
            for (const level5Slots of [0, null, undefined]) {
                vi.clearAllMocks();
                mockState({ restUsed: true, level5Slots });

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toBe('Elder Champion cannot be used again until a long rest or level 5 spell slot becomes available.');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });

        it('spends a level 5 spell slot and re-activates when slots are available', async () => {
            mockState({ restUsed: true, level5Slots: 3 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elder Champion activated by expending a level 5 spell slot.');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, 'spell_slots_level_5', 2, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, 'elderChampionActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, 'activeBuffs', expect.arrayContaining([
                expect.objectContaining({ name: 'Elder Champion', effect: 'elder_champion', duration: '1_minute' }),
            ]), campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Elder Champion',
                description: expect.stringContaining('expending a level 5 spell slot'),
            }));
        });

        it('treats non-array activeBuffs as empty when expending a slot', async () => {
            mockState({ restUsed: true, activeBuffs: 'not-an-array', level5Slots: 2 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('expending a level 5 spell slot');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [expect.objectContaining({ name: 'Elder Champion', effect: 'elder_champion' })],
                campaignName,
            );
        });
    });

    describe('handle - first activation', () => {
        it('sets flag and rest-used, adds buff, and logs on activation', async () => {
            mockState();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elder Champion');
            expect(result.payload.automationType).toBe('elder_champion');
            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, 'elderChampionActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, 'elderChampionRestUsed', true, campaignName);
            expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, 'activeBuffs', expect.arrayContaining([
                expect.objectContaining({ name: 'Elder Champion', effect: 'elder_champion', duration: '1_minute' }),
            ]), campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Elder Champion',
            }));
        });

        it('appends Elder Champion buff without clobbering existing buffs', async () => {
            mockState({ activeBuffs: [{ name: 'Mage Armor', effect: 'mage_armor' }] });

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

        it('uses custom duration from automation config for the buff entry', async () => {
            mockState();

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

        it('falls back to default 1_minute duration when automation.duration is null', async () => {
            mockState();

            const action = makeAction({ automation: { duration: null } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_minute' }),
                ]),
                campaignName,
            );
        });

        it('treats non-array activeBuffs as empty on first activation', async () => {
            mockState({ activeBuffs: 'not-an-array' });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('activated');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                3,
                playerName,
                'activeBuffs',
                [expect.objectContaining({ name: 'Elder Champion' })],
                campaignName,
            );
        });
    });

    describe('hasActionSpells', () => {
        it('returns true for action casting times, case and whitespace insensitive', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Guiding Bolt', casting_time: '1 action' },
                    { name: 'Healing Word', casting_time: '1 bonus action' },
                    { name: 'Cantrip', casting_time: 'action' },
                    { name: 'Shouty Spell', casting_time: '1 ACTION' },
                    { name: 'Spaced Spell', casting_time: ' 1 Action ' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(true);
        });

        it('returns false when all spells have non-action casting times', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Healing Word', casting_time: '1 bonus action' },
                    { name: 'Reaction Shield', casting_time: '1 reaction' },
                    { name: 'Ritual Spell', casting_time: '1 minute' },
                    { name: 'Empty Casting Time', casting_time: '' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(false);
        });

        it('returns false when casting_time is missing or null on every spell', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Incomplete Spell' },
                    { name: 'Null Spell', casting_time: null },
                    { name: 'Undefined Spell', casting_time: undefined },
                ],
            });

            expect(hasActionSpells(stats)).toBe(false);
        });

        it('returns false when spells array is empty or missing', () => {
            expect(hasActionSpells(makePlayerStats({ spells: [] }))).toBe(false);
            expect(hasActionSpells(makePlayerStats({}))).toBe(false);
        });
    });

    describe('isElderChampionActive', () => {
        it('returns true only when elderChampionActive is strictly true', () => {
            mockState({ active: true });

            expect(isElderChampionActive(playerName, campaignName)).toBe(true);
        });

        it('returns false for any non-true stored value', () => {
            for (const value of [false, null, undefined, 0, 'yes']) {
                vi.clearAllMocks();
                mockState({ active: value });

                expect(isElderChampionActive(playerName, campaignName)).toBe(false);
            }
        });
    });
});
