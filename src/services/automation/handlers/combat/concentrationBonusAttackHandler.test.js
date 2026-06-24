// @improved-by-ai
import { handle } from './concentrationBonusAttackHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { automationInfoPopup } from '../../../shared/popupResponse.js';

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../shared/popupResponse.js', () => ({
    automationInfoPopup: vi.fn(),
}));

describe('concentrationBonusAttackHandler', () => {
    const campaignName = 'test-campaign';
    const mockPlayerStats = { name: 'TestCharacter' };

    const baseAction = {
        name: 'Telekinetic Master',
        automation: {
            type: 'concentration_bonus_attack',
            concentrationSpell: 'Telekinesis',
            action: 'bonus_action',
        },
    };

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('concentration check', () => {
        it('returns info popup when no concentration is active', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: null }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });

        it('returns info popup when concentration is on a different spell', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Bless', dc: 10 } }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });

        it('returns info popup when concentration object has no spell field', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: {} }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });

        it('delegates to automationInfoPopup when concentration on correct spell', async () => {
            const expectedPopupResult = { type: 'popup', payload: { type: 'automation_info', name: 'Action', automationType: 'test', description: 'desc', automation: {} } };
            automationInfoPopup.mockReturnValue(expectedPopupResult);
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(automationInfoPopup).toHaveBeenCalledWith(baseAction);
            expect(result).toBe(expectedPopupResult);
        });
    });

    describe('default concentration spell', () => {
        const actionWithoutSpell = {
            name: 'Test Feature',
            automation: {
                type: 'concentration_bonus_attack',
                action: 'bonus_action',
            },
        };

        it('uses Telekinesis as default when concentrationSpell is not specified and creature has it', async () => {
            automationInfoPopup.mockReturnValue({ popup: 'ok' });
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
            });

            const result = await handle(actionWithoutSpell, mockPlayerStats, campaignName);

            expect(automationInfoPopup).toHaveBeenCalledWith(actionWithoutSpell);
            expect(result).toEqual({ popup: 'ok' });
        });

        it('uses Telekinesis as default when concentrationSpell is not specified and creature lacks it', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCharacter', concentration: { spell: 'Bless', dc: 10 } }],
            });

            const result = await handle(actionWithoutSpell, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Test Feature',
                    description: 'Test Feature requires Concentration on Telekinesis to use.',
                    automation: actionWithoutSpell.automation,
                },
            });
        });
    });

    describe('missing data handling', () => {
        it('returns info popup when combat summary is null', async () => {
            getCombatSummary.mockReturnValue(null);

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });

        it('returns info popup when creatures array is undefined', async () => {
            getCombatSummary.mockReturnValue({});

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });

        it('returns info popup when creatures array is empty', async () => {
            getCombatSummary.mockReturnValue({ creatures: [] });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });

        it('returns info popup when creature is not found in combat summary', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'OtherCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
            });

            const result = await handle(baseAction, mockPlayerStats, campaignName);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Telekinetic Master',
                    description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                    automation: baseAction.automation,
                },
            });
            expect(automationInfoPopup).not.toHaveBeenCalled();
        });
    });

    describe('dependency invocation', () => {
        it('passes campaignName to getCombatSummary', async () => {
            getCombatSummary.mockReturnValue({ creatures: [] });

            await handle(baseAction, mockPlayerStats, campaignName);

            expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
        });

        it('passes campaignName to getCombatSummary even when creature not found', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'OtherCharacter', concentration: null }],
            });

            await handle(baseAction, mockPlayerStats, campaignName);

            expect(getCombatSummary).toHaveBeenCalledWith(campaignName);
        });
    });
});
