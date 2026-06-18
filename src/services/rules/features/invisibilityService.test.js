import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endInvisibilityOnHostileAction } from './invisibilityService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
const { getActiveBuffs } = await import('../../automation/common/buffToggle.js');
const { addEntry } = await import('../../ui/logService.js');

describe('invisibilityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset();
        setRuntimeValue.mockReset();
        getActiveBuffs.mockReset();
        addEntry.mockReset().mockResolvedValue({});
    });

    describe('endInvisibilityOnHostileAction', () => {
        const campaignName = 'TestCampaign';
        const invisibleName = 'GnomeWizard';

        it('returns early when no active invisibility is recorded', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
            expect(getActiveBuffs).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns early when getRuntimeValue returns undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
            expect(getActiveBuffs).not.toHaveBeenCalled();
        });

        it('returns early when getRuntimeValue returns empty string', () => {
            getRuntimeValue.mockReturnValue('');

            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
            expect(getActiveBuffs).not.toHaveBeenCalled();
        });

        it('removes Invisibility buff and logs when invisibility is active', () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
                .mockReturnValueOnce(['invisible']);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
                { name: 'Shield', duration: '1_round' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                `_activeInvisibility_${invisibleName}`,
                campaignName,
            );
            expect(getActiveBuffs).toHaveBeenCalledWith(invisibleName, campaignName);
            expect(getRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeConditions',
                campaignName,
            );

            // activeBuffs should have Invisibility removed
            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeBuffs',
                [
                    { name: 'Shield', duration: '1_round' },
                ],
                campaignName,
            );

            // activeConditions should be set to empty array (invisible removed)
            expect(setRuntimeValue).toHaveBeenCalledWith(
                invisibleName,
                'activeConditions',
                [],
                campaignName,
            );

            // Key should be cleared
            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                `_activeInvisibility_${invisibleName}`,
                null,
                campaignName,
            );

            // Log entry should be added
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: invisibleName,
                abilityName: 'Invisibility',
                description: `Invisibility ends for ${invisibleName} after a hostile action.`,
            });
        });

        it('does not re-set activeBuffs when Invisibility buff is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([
                { name: 'Shield', duration: '1_round' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            // setRuntimeValue for activeBuffs should NOT be called since Invisibility isn't in the list
            const buffCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeBuffs',
            );
            expect(buffCalls).toHaveLength(0);
        });

        it('does not re-set activeConditions when invisible condition is not present', () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
                .mockReturnValueOnce(['frightened']);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
            ]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            // setRuntimeValue for activeConditions should NOT be called since invisible isn't in the list
            const condCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'activeConditions',
            );
            expect(condCalls).toHaveLength(0);
        });

        it('handles activeConditions being null', () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
                .mockReturnValueOnce(null);
            getActiveBuffs.mockReturnValue([
                { name: 'Invisibility', duration: '1_hour' },
            ]);

            expect(() => endInvisibilityOnHostileAction(invisibleName, campaignName)).toThrow('Expected array, got null');
        });

        it('removes invisible condition case-insensitively', () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
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

        it('clears the invisibility key even when no buffs/conditions changed', () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                `_activeInvisibility_${invisibleName}`,
                null,
                campaignName,
            );
        });

        it('catches and ignores addEntry promise rejection', async () => {
            getRuntimeValue
                .mockReturnValueOnce('GnomeWizard')
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);
            addEntry.mockReturnValue(Promise.reject(new Error('Log failed')));

            // Should not throw
            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
        });

        it('works with special characters in character name', () => {
            getRuntimeValue
                .mockReturnValueOnce('Elf-Ranger "Swiftarrow"')
                .mockReturnValueOnce([]);
            getActiveBuffs.mockReturnValue([]);

            endInvisibilityOnHostileAction('Elf-Ranger "Swiftarrow"', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                '_activeInvisibility_Elf-Ranger "Swiftarrow"',
                null,
                campaignName,
            );
        });

        it('returns early when invisibility key value is empty string', () => {
            getRuntimeValue.mockReturnValueOnce('');

            const result = endInvisibilityOnHostileAction(invisibleName, campaignName);

            expect(result).toBeUndefined();
            // Should return early because '' is falsy
            expect(getActiveBuffs).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
