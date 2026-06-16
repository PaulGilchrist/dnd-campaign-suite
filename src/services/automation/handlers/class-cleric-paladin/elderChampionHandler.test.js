import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, handleRestore, isElderChampionActive, hasActionSpells } from './elderChampionHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'ClericBoy',
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

describe('elderChampionHandler', () => {
    describe('handle - toggle off', () => {
        it('returns popup when already active and removes buff', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return true;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [{ name: 'Elder Champion', effect: 'elder_champion' }];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Elder Champion ended.');
            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'elderChampionActive', false, 'test-campaign');
        });

        it('removes only Elder Champion from activeBuffs', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return true;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [
                    { name: 'Elder Champion', effect: 'elder_champion' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeBuffs',
                [{ name: 'Mage Armor', effect: 'mage_armor' }],
                'test-campaign'
            );
        });
    });

    describe('handle - already used long rest', () => {
        it('returns modal for restore when already used', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return true;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elderChampionRestore');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });
    });

    describe('handle - activation', () => {
        it('sets elderChampionActive to true', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'elderChampionActive', true, 'test-campaign');
        });

        it('adds buff to activeBuffs', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Elder Champion',
                        effect: 'elder_champion',
                        duration: '1_minute',
                        hasAutomation: true,
                    }),
                ]),
                'test-campaign'
            );
        });

        it('logs ability use on activation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'ClericBoy',
                abilityName: 'Elder Champion',
                description: expect.stringContaining('activated Elder Champion'),
            }));
        });

        it('returns popup with activation description', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elder Champion');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('primal power');
        });

        it('uses custom duration from automation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'elderChampionActive') return false;
                if (key === 'elderChampionRestUsed') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = makeAction({ automation: { duration: '10_minutes' } });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '10_minutes' }),
                ]),
                'test-campaign'
            );
        });
    });

    describe('handleRestore', () => {
        it('returns popup when no level 5 spell slots available', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handleRestore(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No level 5 spell slots available');
        });

        it('spends a level 5 spell slot on restore', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handleRestore(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'spellSlotLevel5', 2, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'elderChampionRestUsed', false, 'test-campaign');
            expect(result.payload.description).toContain('restored');
        });

        it('sets restUsed to false on restore', async () => {
            getRuntimeValue.mockReturnValue(1);

            await handleRestore(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'elderChampionRestUsed', false, 'test-campaign');
        });
    });

    describe('isElderChampionActive', () => {
        it('returns true when active', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(isElderChampionActive('ClericBoy', 'test-campaign')).toBe(true);
        });

        it('returns false when not active', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(isElderChampionActive('ClericBoy', 'test-campaign')).toBe(false);
        });

        it('returns false when null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isElderChampionActive('ClericBoy', 'test-campaign')).toBe(false);
        });
    });

    describe('hasActionSpells', () => {
        it('returns true when player has action spells', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Guiding Bolt', casting_time: '1 action' },
                    { name: 'Healing Word', casting_time: '1 bonus action' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(true);
        });

        it('returns true for "action" casting time', () => {
            const stats = makePlayerStats({
                spells: [{ name: 'Cantrip', casting_time: 'action' }],
            });

            expect(hasActionSpells(stats)).toBe(true);
        });

        it('returns false when no action spells', () => {
            const stats = makePlayerStats({
                spells: [
                    { name: 'Healing Word', casting_time: '1 bonus action' },
                    { name: 'Reaction Shield', casting_time: '1 reaction' },
                ],
            });

            expect(hasActionSpells(stats)).toBe(false);
        });

        it('returns false when no spells', () => {
            const stats = makePlayerStats({ spells: [] });

            expect(hasActionSpells(stats)).toBe(false);
        });

        it('returns false when no spells property', () => {
            const stats = makePlayerStats({});

            expect(hasActionSpells(stats)).toBe(false);
        });
    });
});
