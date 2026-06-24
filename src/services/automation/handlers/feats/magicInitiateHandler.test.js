// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handle,
    confirmMagicInitiate,
    setMagicInitiateCantrips,
    setMagicInitiateLevel1Spell,
    getMagicInitiateClass,
    getMagicInitiateAbility,
    getMagicInitiateCantrips,
    getMagicInitiateLevel1Spell,
    restoreUses,
} from './magicInitiateHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);

beforeEach(() => {
    vi.clearAllMocks();
});

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'WizardBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Magic Initiate',
        automation: {
            type: 'magic_initiate',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('magicInitiateHandler', () => {
    describe('handle', () => {
        it('returns popup with confirmation message when class already selected', async () => {
            getRuntimeValue.mockReturnValue('Cleric');

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Magic Initiate: Cleric (already selected).');
            expect(result.payload.name).toBe('Magic Initiate');
        });

        it('returns modal when no class is stored', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('magicInitiate');
            expect(result.payload).toEqual({
                action: expect.objectContaining({ name: 'Magic Initiate' }),
                playerStats: expect.objectContaining({ name: 'WizardBoy' }),
                campaignName,
            });
        });

        it('returns modal when stored class is a falsy value (empty string)', async () => {
            getRuntimeValue.mockReturnValue('');

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('magicInitiate');
        });

        it('reads the class key from runtime using player name and campaign name', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateClass',
                campaignName
            );
        });
    });

    describe('confirmMagicInitiate', () => {
        it('returns error popup for unrecognized class', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Bard', campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No class selected.');
            expect(result.payload.name).toBe('Magic Initiate');
            expect(result.payload.automation.type).toBe('magic_initiate');
            expect(result.payload.automation.options).toEqual(['Cleric', 'Druid', 'Wizard']);
        });

        it('returns error popup for empty string class', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), '', campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No class selected.');
        });

        it('stores Cleric class and Wisdom ability, returns confirmation popup', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Cleric', campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Magic Initiate');
            expect(result.payload.description).toContain('Cleric');
            expect(result.payload.description).toContain('Wisdom');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'WizardBoy',
                '_magicInitiateClass',
                'Cleric',
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'WizardBoy',
                '_magicInitiateAbility',
                'Wisdom',
                campaignName
            );
        });

        it('stores Druid class and Wisdom ability', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Druid', campaignName);

            expect(result.payload.description).toContain('Druid');
            expect(result.payload.description).toContain('Wisdom');
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'WizardBoy',
                '_magicInitiateAbility',
                'Wisdom',
                campaignName
            );
        });

        it('stores Wizard class and Intelligence ability', async () => {
            await confirmMagicInitiate(makePlayerStats(), 'Wizard', campaignName);

            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'WizardBoy',
                '_magicInitiateAbility',
                'Intelligence',
                campaignName
            );
        });

        it('includes automation config with available options in popup payload', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Cleric', campaignName);

            expect(result.payload.automation).toEqual({
                type: 'magic_initiate',
                options: ['Cleric', 'Druid', 'Wizard'],
            });
        });
    });

    describe('setMagicInitiateCantrips', () => {
        it('stores cantrip list in runtime value', async () => {
            const cantrips = ['Fire Bolt', 'Light'];
            await setMagicInitiateCantrips(makePlayerStats(), cantrips, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateCantrips',
                cantrips,
                campaignName
            );
        });

        it('stores empty array when no cantrips selected', async () => {
            await setMagicInitiateCantrips(makePlayerStats(), [], campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateCantrips',
                [],
                campaignName
            );
        });
    });

    describe('setMagicInitiateLevel1Spell', () => {
        it('stores level 1 spell in runtime value', async () => {
            await setMagicInitiateLevel1Spell(makePlayerStats(), 'Magic Missile', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateLevel1Spell',
                'Magic Missile',
                campaignName
            );
        });
    });

    describe('getMagicInitiateClass', () => {
        it('returns stored class name', () => {
            getRuntimeValue.mockReturnValue('Cleric');

            expect(getMagicInitiateClass(makePlayerStats(), campaignName)).toBe('Cleric');
        });

        it('returns undefined when no class is stored', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(getMagicInitiateClass(makePlayerStats(), campaignName)).toBeUndefined();
        });
    });

    describe('getMagicInitiateAbility', () => {
        it('returns stored ability name', () => {
            getRuntimeValue.mockReturnValue('Wisdom');

            expect(getMagicInitiateAbility(makePlayerStats(), campaignName)).toBe('Wisdom');
        });

        it('returns undefined when no ability is stored', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(getMagicInitiateAbility(makePlayerStats(), campaignName)).toBeUndefined();
        });
    });

    describe('getMagicInitiateCantrips', () => {
        it('returns stored cantrip array', () => {
            const cantrips = ['Fire Bolt', 'Light'];
            getRuntimeValue.mockReturnValue(cantrips);

            expect(getMagicInitiateCantrips(makePlayerStats(), campaignName)).toBe(cantrips);
        });

        it('returns undefined when no cantrips are stored', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(getMagicInitiateCantrips(makePlayerStats(), campaignName)).toBeUndefined();
        });
    });

    describe('getMagicInitiateLevel1Spell', () => {
        it('returns stored spell name', () => {
            getRuntimeValue.mockReturnValue('Magic Missile');

            expect(getMagicInitiateLevel1Spell(makePlayerStats(), campaignName)).toBe('Magic Missile');
        });

        it('returns undefined when no spell is stored', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(getMagicInitiateLevel1Spell(makePlayerStats(), campaignName)).toBeUndefined();
        });
    });

    describe('restoreUses', () => {
        it('clears all four runtime values by setting them to null', () => {
            restoreUses('WizardBoy', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateClass',
                null,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateAbility',
                null,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateCantrips',
                null,
                campaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateLevel1Spell',
                null,
                campaignName
            );
        });

        it('uses correct call order: class, ability, cantrips, level1Spell', () => {
            restoreUses('TestCharacter', campaignName);

            const calls = setRuntimeValue.mock.calls;
            expect(calls[0][1]).toBe('_magicInitiateClass');
            expect(calls[1][1]).toBe('_magicInitiateAbility');
            expect(calls[2][1]).toBe('_magicInitiateCantrips');
            expect(calls[3][1]).toBe('_magicInitiateLevel1Spell');
        });
    });
});
