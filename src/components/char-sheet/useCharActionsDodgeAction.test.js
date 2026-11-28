// @maintained-by-ai 2026-11-28
// Generic/5e Dodge hook face: cannotAct gate, toggleBuff + addExpiration byte
// payloads, toggle-off copy, name propagation (pinned via a non-default name so
// a hardcoded default would fail), the L5-002 charge branch (activation charges
// the action slot, toggle-off is free), and 5e Dex-clause PRESENCE byte-pinned
// in BOTH sinks (log AND popup) in one run. The 2024 dexSaveClause === ''
// dual-sink absence pins are owned by
// useCharActionsBaseActions.dodge-2024.test.js (#332) — not restated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/combat/chargeEconomy.js', () => ({
    chargeSlot: vi.fn(() => true),
    refundSlot: vi.fn(() => true),
}));

import useCharActionsBaseActions from './useCharActionsBaseActions.js';
import { chargeSlot } from '../../services/combat/chargeEconomy.js';
import { createHooks, mockToggleBuff, mockAddExpiration, mockSetPopupHtml, mockAddEntry, campaignName, basePlayerStats } from './useCharActionsBaseActions.test-utils.js';
import { CANNOT_ACT_REASON } from '../../services/combat/canTakeAction.js';

describe('useCharActionsBaseActions - handleDodgeAction (generic/5e)', () => {
    beforeEach(() => {
        // clearAllMocks does NOT reset the factory-provided chargeSlot
        // implementation (#2065 trap) — only call history is cleared.
        vi.clearAllMocks();
        mockToggleBuff.mockReturnValue({ wasActive: false });
    });

    it('returns early without side effects when cannotAct is true, popping the shared reason once (RB-1115)', async () => {
        const hooks = createHooks({ cannotAct: true });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockToggleBuff).not.toHaveBeenCalled();
        expect(mockAddExpiration).not.toHaveBeenCalled();
        expect(mockAddEntry).not.toHaveBeenCalled();
        expect(chargeSlot).not.toHaveBeenCalled();
        // RB-1115: silent gate → assertCanAct reason popup is the ONLY feedback.
        expect(mockSetPopupHtml).toHaveBeenCalledTimes(1);
        expect(mockSetPopupHtml).toHaveBeenCalledWith(CANNOT_ACT_REASON);
    });

    // Name deliberately differs from basePlayerStats.name ('TestFighter'):
    // every sink is asserted against this name, pinning propagation from
    // playerStats rather than a hardcoded default.
    it('activates Dodge — charges the action slot with byte-exact buff payload, expiry, and Dex-clause copy in log AND popup', async () => {
        const name = 'RogueOne';
        const hooks = createHooks({ playerStats: { ...basePlayerStats, name } });
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockToggleBuff).toHaveBeenCalledWith(
            name, 'Dodge',
            { effect: 'dodge', duration: 'until_start_of_next_turn' },
            campaignName, name
        );
        // L5-002: activating Dodge takes the action.
        expect(chargeSlot).toHaveBeenCalledWith({ creatureName: name, bucket: 'action', campaignName });
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
    });

    it('deactivates dodge when buff is already active — deactivated copy only, no charge, no expiry, no log', async () => {
        mockToggleBuff.mockReturnValue({ wasActive: true });
        const hooks = createHooks();
        const actions = useCharActionsBaseActions(hooks);
        await actions.handleDodgeAction();

        expect(mockToggleBuff).toHaveBeenCalledTimes(1);
        // L5-002: toggling Dodge off is free.
        expect(chargeSlot).not.toHaveBeenCalled();
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
