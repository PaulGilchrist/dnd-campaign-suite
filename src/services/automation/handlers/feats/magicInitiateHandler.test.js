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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

beforeEach(() => {
    vi.clearAllMocks();
});

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
        it('returns popup when class already selected', async () => {
            getRuntimeValue.mockReturnValue('Cleric');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already selected');
        });

        it('returns modal when no class selected', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('magicInitiate');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('passes action, playerStats, campaignName in modal payload', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });
    });

    describe('confirmMagicInitiate', () => {
        it('returns popup with "No class selected" for invalid class', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Bard', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No class selected.');
        });

        it('returns popup for valid Cleric class', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Cleric', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Magic Initiate');
            expect(result.payload.description).toContain('Cleric');
            expect(result.payload.description).toContain('Wisdom');
        });

        it('returns popup for valid Druid class', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Druid', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Druid');
            expect(result.payload.description).toContain('Wisdom');
        });

        it('returns popup for valid Wizard class', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Wizard', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Wizard');
            expect(result.payload.description).toContain('Intelligence');
        });

        it('stores chosen class in runtime value', async () => {
            await confirmMagicInitiate(makePlayerStats(), 'Cleric', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateClass',
                'Cleric',
                'test-campaign'
            );
        });

        it('stores spellcasting ability in runtime value', async () => {
            await confirmMagicInitiate(makePlayerStats(), 'Druid', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateAbility',
                'Wisdom',
                'test-campaign'
            );
        });

        it('stores Intelligence for Wizard class', async () => {
            await confirmMagicInitiate(makePlayerStats(), 'Wizard', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateAbility',
                'Intelligence',
                'test-campaign'
            );
        });

        it('includes automation in popup payload', async () => {
            const result = await confirmMagicInitiate(makePlayerStats(), 'Cleric', 'test-campaign');

            expect(result.payload.automation).toBeDefined();
            expect(result.payload.automation.type).toBe('magic_initiate');
            expect(result.payload.automation.options).toEqual(['Cleric', 'Druid', 'Wizard']);
        });
    });

    describe('setMagicInitiateCantrips', () => {
        it('stores cantrips in runtime value', async () => {
            const cantrips = ['Fire Bolt', 'Light'];
            await setMagicInitiateCantrips(makePlayerStats(), cantrips, 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateCantrips',
                cantrips,
                'test-campaign'
            );
        });
    });

    describe('setMagicInitiateLevel1Spell', () => {
        it('stores level 1 spell in runtime value', async () => {
            await setMagicInitiateLevel1Spell(makePlayerStats(), 'Magic Missile', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateLevel1Spell',
                'Magic Missile',
                'test-campaign'
            );
        });
    });

    describe('getMagicInitiateClass', () => {
        it('returns stored class', () => {
            getRuntimeValue.mockReturnValue('Cleric');

            expect(getMagicInitiateClass(makePlayerStats(), 'test-campaign')).toBe('Cleric');
        });

        it('returns undefined when no class stored', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(getMagicInitiateClass(makePlayerStats(), 'test-campaign')).toBeUndefined();
        });
    });

    describe('getMagicInitiateAbility', () => {
        it('returns stored ability', () => {
            getRuntimeValue.mockReturnValue('Wisdom');

            expect(getMagicInitiateAbility(makePlayerStats(), 'test-campaign')).toBe('Wisdom');
        });
    });

    describe('getMagicInitiateCantrips', () => {
        it('returns stored cantrips', () => {
            const cantrips = ['Fire Bolt', 'Light'];
            getRuntimeValue.mockReturnValue(cantrips);

            expect(getMagicInitiateCantrips(makePlayerStats(), 'test-campaign')).toBe(cantrips);
        });
    });

    describe('getMagicInitiateLevel1Spell', () => {
        it('returns stored level 1 spell', () => {
            getRuntimeValue.mockReturnValue('Magic Missile');

            expect(getMagicInitiateLevel1Spell(makePlayerStats(), 'test-campaign')).toBe('Magic Missile');
        });
    });

    describe('restoreUses', () => {
        it('clears all runtime values', async () => {
            await restoreUses('WizardBoy', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateClass',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateAbility',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateCantrips',
                null,
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_magicInitiateLevel1Spell',
                null,
                'test-campaign'
            );
        });
    });
});
