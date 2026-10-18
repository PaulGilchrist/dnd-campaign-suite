// @maintained-by-ai
// BA-001: 2024-ruleset Dodge lane only. The single branch unique to the 2024
// path in handleDodgeAction is dexSaveClause === '' (2014 Dodge appends
// " You have advantage on Dexterity saving throws."; 2024 Dodge per the
// public/data BA-001 manifest is attack-roll Disadvantage only). It surfaces
// in the ability_use log and the activation popup — both pinned byte-exact
// here. Everything else (toggleBuff/addExpiration payloads, cannotAct gate,
// toggle-off copy, 5e byte-pins) is owned by useCharActionsDodgeAction.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { createHooks, mockToggleBuff, mockSetPopupHtml, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';

beforeEach(() => {
    vi.clearAllMocks();
    mockToggleBuff.mockReturnValue({ wasActive: false });
});

describe('handleDodgeAction — 2024 ruleset copy (BA-001)', () => {
    it('omits the 2014 Dex-save clause from the log and popup for a 2024 character', async () => {
        const hooks = createHooks({ playerStats: { ...basePlayerStats, rules: '2024' } });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestFighter',
            abilityName: 'Dodge',
            description: 'TestFighter takes the Dodge action. Attackers have disadvantage on attacks against you until the start of your next turn.',
        });
        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Dodge',
            description: 'Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn.',
        });
    });
});
