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
    const mockPlayerStats = { name: 'TestCharacter' };
    const mockAction = {
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

    it('returns popup when no concentration active', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestCharacter', concentration: null }] });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Telekinetic Master',
                description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                automation: mockAction.automation,
            },
        });
        expect(automationInfoPopup).not.toHaveBeenCalled();
    });

    it('returns popup when concentration is on a different spell', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestCharacter', concentration: { spell: 'Bless', dc: 10 } }],
        });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Telekinetic Master',
                description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                automation: mockAction.automation,
            },
        });
        expect(automationInfoPopup).not.toHaveBeenCalled();
    });

    it('returns automation info popup when concentration on correct spell', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
        });
        automationInfoPopup.mockReturnValue({ popup: 'ok' });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

        expect(automationInfoPopup).toHaveBeenCalledWith(mockAction);
        expect(result).toEqual({ popup: 'ok' });
    });

    it('uses default concentration spell when not specified', async () => {
        const actionWithoutSpell = {
            name: 'Test Feature',
            automation: {
                type: 'concentration_bonus_attack',
                action: 'bonus_action',
            },
        };

        // Default concentration spell is 'Telekinesis', creature has it
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestCharacter', concentration: { spell: 'Telekinesis', dc: 12 } }],
        });
        automationInfoPopup.mockReturnValue({ popup: 'ok' });

        const result = await handle(actionWithoutSpell, mockPlayerStats, 'test-campaign');

        expect(automationInfoPopup).toHaveBeenCalledWith(actionWithoutSpell);
        expect(result).toEqual({ popup: 'ok' });
    });

    it('uses default concentration spell when creature lacks it', async () => {
        const actionWithoutSpell = {
            name: 'Test Feature',
            automation: {
                type: 'concentration_bonus_attack',
                action: 'bonus_action',
            },
        };

        // Default concentration spell is 'Telekinesis', creature has different spell
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestCharacter', concentration: { spell: 'Bless', dc: 10 } }],
        });

        const result = await handle(actionWithoutSpell, mockPlayerStats, 'test-campaign');

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

    it('handles missing combat summary gracefully', async () => {
        getCombatSummary.mockReturnValue(null);

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Telekinetic Master',
                description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                automation: mockAction.automation,
            },
        });
    });

    it('handles missing creature gracefully', async () => {
        getCombatSummary.mockReturnValue({ creatures: [{ name: 'OtherCharacter', concentration: null }] });

        const result = await handle(mockAction, mockPlayerStats, 'test-campaign');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Telekinetic Master',
                description: 'Telekinetic Master requires Concentration on Telekinesis to use.',
                automation: mockAction.automation,
            },
        });
    });
});
