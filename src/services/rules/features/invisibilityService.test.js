import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endInvisibilityOnHostileAction, endGreaterInvisibilityOnHostileAction, endGreaterInvisibility } from './invisibilityService.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../ui/logService.js');

describe('invisibilityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset();
        setRuntimeValue.mockReset();
        getActiveBuffs.mockReset();
        addEntry.mockResolvedValue({});
    });

    describe('endInvisibilityOnHostileAction', () => {
        const campaignName = 'TestCampaign';
        const invisibleName = 'GnomeWizard';

        it.each([
            [null],
            [undefined],
            [''],
        ])('returns early when stored invisibility value is %s', (value) => {
            getRuntimeValue.mockReturnValue(value);

            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
            expect(getActiveBuffs).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('removes Invisibility buff and invisible condition when both are active', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(['invisible', 'frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
                { name: 'Shield', duration: '1_round' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeBuffs',
                [{ name: 'Shield', duration: '1_round' }],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeConditions',
                ['frightened'],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeInvisibility_${invisibleName}`,
                null,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: invisibleName,
                abilityName: 'Invisibility',
                description: `Invisibility ends for ${invisibleName}: target made a hostile action (attack roll, dealt damage, or cast a spell).`,
            });
        });

        it('removes Invisibility buff but preserves other buffs', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
                { name: 'Bless', duration: '10_min' },
                { name: 'Shield', duration: '1_round' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeBuffs',
                [
                    { name: 'Bless', duration: '10_min' },
                    { name: 'Shield', duration: '1_round' },
                ],
                campaignName,
            );
        });

        it('skips buff update when Invisibility is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([
                { name: 'Shield', duration: '1_round' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls).toHaveLength(0);
        });

        it('skips condition update when invisible condition is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(['frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls).toHaveLength(0);
        });

        it('removes invisible condition case-insensitively', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(['INVISIBLE', 'frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls[0][2]).toEqual(['frightened']);
        });

        it('throws when activeConditions is null or undefined', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(null);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
            ]);

            expect(() => endInvisibilityOnHostileAction(invisibleName, campaignName))
                .toThrow('Expected array, got null');
        });

        it('clears the invisibility key even when no buffs or conditions needed updating', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeInvisibility_${invisibleName}`,
                null,
                campaignName,
            );
        });

        it('suppresses addEntry rejection without throwing', async () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);
            addEntry.mockReturnValue(Promise.reject(new Error('Log failed')));

            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
        });

        it('handles special characters in character name', () => {
            const characterName = 'Elf-Ranger "Swiftarrow"';
            getRuntimeValue
                .mockReturnValueOnce(characterName)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endInvisibilityOnHostileAction(characterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_activeInvisibility_Elf-Ranger "Swiftarrow"',
                null,
                campaignName,
            );
        });
    });

    describe('endGreaterInvisibilityOnHostileAction', () => {
        const campaignName = 'test-campaign';
        const invisibleName = 'GnomeWizard';

        it.each([
            null,
            undefined,
            '',
        ])('returns early when stored invisibility value is %s', (value) => {
            getRuntimeValue.mockReturnValue(value);

            const result = endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
            expect(getActiveBuffs).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('removes GreaterInvisibility buff and invisible condition when both are active', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(['invisible', 'frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
                { name: 'Shield', duration: '1_round' },
            ]);

            endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeBuffs',
                [{ name: 'Shield', duration: '1_round' }],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeConditions',
                ['frightened'],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeGreaterInvisibility_${invisibleName}`,
                null,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: invisibleName,
                abilityName: 'Greater Invisibility',
                description: `Greater Invisibility ends for ${invisibleName}: target made a hostile action (attack roll, dealt damage, or cast a spell).`,
            });
        });

        it('removes GreaterInvisibility buff but preserves other buffs', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
                { name: 'Bless', duration: '10_min' },
                { name: 'Shield', duration: '1_round' },
            ]);

            endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeBuffs',
                [
                    { name: 'Bless', duration: '10_min' },
                    { name: 'Shield', duration: '1_round' },
                ],
                campaignName,
            );
        });

        it('skips buff update when GreaterInvisibility is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([
                { name: 'Shield', duration: '1_round' },
            ]);

            endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls).toHaveLength(0);
        });

        it('skips condition update when invisible condition is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(['frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls).toHaveLength(0);
        });

        it('removes invisible condition case-insensitively', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(['INVISIBLE', 'frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls[0][2]).toEqual(['frightened']);
        });

        it('throws when activeConditions is null or undefined', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce(null);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            expect(() => endGreaterInvisibilityOnHostileAction(invisibleName, campaignName))
                .toThrow('Expected array, got null');
        });

        it('clears the invisibility key even when no buffs or conditions needed updating', () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeGreaterInvisibility_${invisibleName}`,
                null,
                campaignName,
            );
        });

        it('suppresses addEntry rejection without throwing', async () => {
            getRuntimeValue
                .mockReturnValueOnce(invisibleName)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);
            addEntry.mockReturnValue(Promise.reject(new Error('Log failed')));

            const result = endGreaterInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
        });

        it('handles special characters in character name', () => {
            const characterName = 'Elf-Ranger "Swiftarrow"';
            getRuntimeValue
                .mockReturnValueOnce(characterName)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endGreaterInvisibilityOnHostileAction(characterName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_activeGreaterInvisibility_Elf-Ranger "Swiftarrow"',
                null,
                campaignName,
            );
        });
    });

    describe('endGreaterInvisibility', () => {
        const campaignName = 'test-campaign';
        const targetName = 'GnomeWizard';

        it('returns early when no greater invisibility is stored', () => {
            getRuntimeValue.mockReturnValue(null);

            endGreaterInvisibility(targetName, campaignName, 'spell ended');

            expect(getActiveBuffs).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('removes GreaterInvisibility buff and invisible condition with custom reason', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce(['invisible', 'frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
                { name: 'Shield', duration: '1_round' },
            ]);

            endGreaterInvisibility(targetName, campaignName, 'spell duration expired');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                targetName,
                'activeBuffs',
                [{ name: 'Shield', duration: '1_round' }],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                targetName,
                'activeConditions',
                ['frightened'],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeGreaterInvisibility_${targetName}`,
                null,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: targetName,
                abilityName: 'Greater Invisibility',
                description: `Greater Invisibility ends for ${targetName}: spell duration expired.`,
            });
        });

        it('uses the casterName from runtime store in buff removal', () => {
            const casterName = 'Alchemist';
            getRuntimeValue
                .mockReturnValueOnce(casterName)
                .mockReturnValueOnce(['invisible']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            endGreaterInvisibility(targetName, campaignName, 'test');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                targetName,
                'activeBuffs',
                [],
                campaignName,
            );
        });

        it('skips buff update when GreaterInvisibility is not in activeBuffs', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([
                { name: 'Shield', duration: '1_round' },
            ]);

            endGreaterInvisibility(targetName, campaignName, 'test');

            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls).toHaveLength(0);
        });

        it('skips condition update when invisible condition is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce(['frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            endGreaterInvisibility(targetName, campaignName, 'test');

            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls).toHaveLength(0);
        });

        it('removes invisible condition case-insensitively', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce(['Invisible', 'frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            endGreaterInvisibility(targetName, campaignName, 'test');

            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls[0][2]).toEqual(['frightened']);
        });

        it('throws when activeConditions is null', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce(null);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            expect(() => endGreaterInvisibility(targetName, campaignName, 'test'))
                .toThrow('Expected array, got null');
        });

        it('throws when activeConditions is undefined', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce(undefined);
            getActiveBuffs.mockReturnValue([
                { name: 'GreaterInvisibility', duration: '1_hour' },
            ]);

            expect(() => endGreaterInvisibility(targetName, campaignName, 'test'))
                .toThrow('Expected array, got undefined');
        });

        it('clears the greater invisibility key even when no buffs or conditions needed updating', () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endGreaterInvisibility(targetName, campaignName, 'test');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                `_activeGreaterInvisibility_${targetName}`,
                null,
                campaignName,
            );
        });

        it('suppresses addEntry rejection without throwing', async () => {
            getRuntimeValue
                .mockReturnValueOnce(targetName)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);
            addEntry.mockReturnValue(Promise.reject(new Error('Log failed')));

            const result = endGreaterInvisibility(targetName, campaignName, 'test');

            expect(result).toBeUndefined();
        });

        it('handles special characters in character name', () => {
            const characterName = 'Elf-Ranger "Swiftarrow"';
            getRuntimeValue
                .mockReturnValueOnce(characterName)
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endGreaterInvisibility(characterName, campaignName, 'test');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_activeGreaterInvisibility_Elf-Ranger "Swiftarrow"',
                null,
                campaignName,
            );
        });
    });
});
