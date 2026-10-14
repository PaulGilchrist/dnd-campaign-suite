import {
    onArcaneWardRestore,
} from './arcaneWardHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const campaignName = 'test-campaign';

function makeWizardStats(name, level, intBonus) {
    return {
        name,
        rules: '2024',
        level,
        abilities: [{ name: 'Intelligence', bonus: intBonus }],
    };
}

function setWardMocks(getRuntimeValueImpl) {
    getRuntimeValue.mockImplementation(getRuntimeValueImpl);
}

describe('onArcaneWardRestore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic restoration', () => {
        it('restores ward HP based on spell slot level', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                2,
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 9, campaignName);
            expect(result.payload.description).toContain('restored 4 HP');
            expect(result.payload.description).toContain('5 → 9/13');
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Arcane Ward',
                }),
            );
        });

        it('caps ward HP at max when restoration would exceed it', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                3,
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
            expect(result.payload.description).toContain('12 → 13/13');
        });
    });

    describe('edge cases for spell slot level', () => {
        it.each([
            ['invalid', 7, 'restored 2 HP'],
            [0, 7, 'restored 2 HP'],
        ])('defaults to spell slot level 1 when value is %s', async (slotLevel, expectedHp, expectedDescription) => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                slotLevel,
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', expectedHp, campaignName);
            expect(result.payload.description).toContain(expectedDescription);
            expect(result.payload.description).toContain('spell slot level 1');
        });
    });

    describe('edge cases for ward HP values', () => {
        it('defaults to 0 when ward HP is not set', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return undefined;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                1,
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 2, campaignName);
            expect(result.payload.description).toContain('0 → 2/13');
        });

        it('throws when addEntry rejects', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });
            addEntry.mockRejectedValueOnce(new Error('log failure'));

            await expect(
                onArcaneWardRestore(
                    { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                    makeWizardStats('TestWizard', 5, 3),
                    2,
                    campaignName,
                ),
            ).rejects.toThrow('log failure');
        });
    });
});
