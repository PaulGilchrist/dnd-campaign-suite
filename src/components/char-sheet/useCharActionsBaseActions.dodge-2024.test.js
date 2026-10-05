// BA-001: popup/log text ruleset split — 2014 Dodge adds "You have advantage
// on Dexterity saving throws."; 2024 Dodge (manifest BA-001 expectedBehavior)
// is attack-roll Disadvantage only. The 5e byte-pins live in
// useCharActionsDodgeAction.test.js; this file pins the 2024 branch.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { createHooks, mockToggleBuff, mockSetPopupHtml, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';

beforeEach(() => {
    vi.clearAllMocks();
    mockToggleBuff.mockReturnValue({ wasActive: false });
});

describe('handleDodgeAction — 2024 ruleset copy', () => {
    it('logs ability_use WITHOUT the 2014 Dex-save clause for a 2024 character', async () => {
        const hooks = createHooks({ playerStats: { ...basePlayerStats, rules: '2024' } });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Dodge',
            description: 'TestFighter takes the Dodge action. Attackers have disadvantage on attacks against you until the start of your next turn.',
        }));
    });

    it('popup omits the Dex-save clause for a 2024 character', async () => {
        const hooks = createHooks({ playerStats: { ...basePlayerStats, rules: '2024' } });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Dodge',
            description: 'Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn.',
        });
    });

    it('keeps the Dex-save clause for a 5e character (byte-identical)', async () => {
        const hooks = createHooks({ playerStats: { ...basePlayerStats, rules: '5e' } });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: 'Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.',
        }));
    });
});
