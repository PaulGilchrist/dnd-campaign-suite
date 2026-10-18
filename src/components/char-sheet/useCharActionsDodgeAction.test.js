// @maintained-by-ai
// Generic/5e Dodge lane: cannotAct gate, toggleBuff + addExpiration byte
// payloads, toggle-off copy, name propagation, and 5e Dex-clause PRESENCE
// byte-pinned in BOTH sinks (log AND popup) in one run. The 2024
// dexSaveClause === '' dual-sink absence pins are owned by
// useCharActionsBaseActions.dodge-2024.test.js (#332) — not restated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { createHooks, mockToggleBuff, mockAddExpiration, mockSetPopupHtml, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';

describe('useCharActionsBaseActions - handleDodgeAction (generic/5e)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockToggleBuff.mockReturnValue({ wasActive: false });
    });

    it('returns early without side effects when cannotAct is true', async () => {
        const hooks = createHooks({ cannotAct: true });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockToggleBuff).not.toHaveBeenCalled();
        expect(mockAddExpiration).not.toHaveBeenCalled();
        expect(mockAddEntry).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });

    it.each(['TestFighter', 'RogueOne'])(
        'activates Dodge as %s — byte-exact buff payload, expiry, and Dex-clause copy in log AND popup',
        async (name) => {
            const hooks = createHooks({ playerStats: { ...basePlayerStats, name } });
            const actions = useCharActionsBaseActions(hooks);
            await actions.handleDodgeAction();

            expect(mockToggleBuff).toHaveBeenCalledWith(
                name, 'Dodge',
                { effect: 'dodge', duration: 'until_start_of_next_turn' },
                campaignName, name
            );
            expect(mockAddExpiration).toHaveBeenCalledWith({ attackerName: name, targetName: name, effects: [{ type: 'remove_active_buff', buffName: 'Dodge' }], campaignName, rounds: undefined, expireOnCreatureName: name });
            expect(mockAddEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: name,
                abilityName: 'Dodge',
                description: `${name} takes the Dodge action. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.`,
            });
            expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
            expect(mockSetPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Dodge',
                description: 'Dodge activated. Attackers have disadvantage on attacks against you until the start of your next turn. You have advantage on Dexterity saving throws.',
            });
        }
    );

    it('deactivates dodge when buff is already active — deactivated copy only, no expiry, no log', async () => {
        mockToggleBuff.mockReturnValue({ wasActive: true });
        const hooks = createHooks();
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockToggleBuff).toHaveBeenCalledTimes(1);
        expect(mockAddExpiration).not.toHaveBeenCalled();
        expect(mockAddEntry).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith({
            type: 'automation_info',
            name: 'Dodge',
            description: 'Dodge deactivated.',
        });
    });
});
