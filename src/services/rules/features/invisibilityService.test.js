// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endInvisibilityOnHostileAction } from './invisibilityService.js';
import { getActiveBuffs } from '../../automation/common/buffToggle.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
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
                campaignName,
                `_activeInvisibility_${invisibleName}`,
                null,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: invisibleName,
                abilityName: 'Invisibility',
                description: `Invisibility ends for ${invisibleName} after a hostile action.`,
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
                campaignName,
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
                campaignName,
                '_activeInvisibility_Elf-Ranger "Swiftarrow"',
                null,
                campaignName,
            );
        });
    });
});
