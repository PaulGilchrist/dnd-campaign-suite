// @maintained-by-ai
// OWNERSHIP (early-returns lane, trimmed 2026-10-18): this file owns ONLY the guard
// faces no sibling verifies — the plain-negative passthrough legs of the MONK_KI
// membership and damage_bonus options.length guards, and the omitted-optional-dep
// (onBuffsChange) dispatch legs. Everything else here was a weaker duplicate, deleted
// and verified stronger at its owner:
//   cannotAct silent abort, FP spend/refusal tables (CLA-159), skip-list at FP=0,
//   CLA-399 after_casting_action_spell lane, feature-choice gates, FP resolution
//   fallbacks, focus-points-updated event → useCharActionsAutomation.test.js
//   after_attack_action gate → useCharActionsAutomation.cla143-gate.test.js
//   CLA-342 Stunning Strike armed/blocked → useCharActionsAutomation.stunning-strike.test.js
//   executeHandler null/undefined → .test.js robustness + .test.result-types.js
//   unknown modalName drop → useCharActionsAutomation.test.class-feature-modals.js
//   handleDivineInterventionCast no-action abort → useCharActionsAutomation.test.divine-intervention.js
// No timers in this lane.
import { describe, it, expect } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach, campaignName } from './useCharActionsAutomation.test.setup.js';

describe('useCharActionsAutomation — guard passthroughs (early-returns lane)', () => {
    setupBeforeEach();

    // Plain-negative faces of two guard seams (MONK_KI_FEATURES membership, damage_bonus
    // options.length): a non-matching row must reach executeHandler and write nothing —
    // zero Focus spend, no chooser modal, no refusal log.
    it.each([
        { label: 'non-monk action', action: { name: 'Fireball', automation: {} } },
        { label: 'empty-options damage_bonus', action: { name: 'Test Action', automation: { type: 'damage_bonus', options: [] } } },
    ])('$label passes every guard: dispatches untouched, zero writes', async ({ action }) => {
        const hooks = createHooks();
        hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await handleAutomationAction(action);

        expect(hooks.executeHandler).toHaveBeenCalledWith(action, hooks.playerStats, campaignName, 'test-map', []);
        expect(hooks.setRuntimeValue).not.toHaveBeenCalled();
        expect(hooks.setModalState).not.toHaveBeenCalled();
        expect(hooks.addEntry).not.toHaveBeenCalled();
    });

    // Missing optional dep: both `if (onBuffsChange)` guards (result dispatch + finalize)
    // must skip cleanly when a caller omits onBuffsChange — resolve undefined and still
    // dispatch the popup normally.
    it('resolves popup/temp_buff and notify_buffs_changed without crashing when optional onBuffsChange dep is omitted', async () => {
        const hooks = createHooks();
        delete hooks.onBuffsChange;
        hooks.executeHandler
            .mockResolvedValueOnce({ type: 'popup', payload: '<p>Buffed</p>' })
            .mockResolvedValueOnce({ type: 'notify_buffs_changed' });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);

        await expect(handleAutomationAction({ name: 'Test Feature', automation: { type: 'temp_buff' } })).resolves.toBeUndefined();
        await expect(handleAutomationAction({ name: 'Test Feature', automation: {} })).resolves.toBeUndefined();

        expect(hooks.executeHandler).toHaveBeenCalledTimes(2);
        expect(hooks.setPopupHtml).toHaveBeenCalledWith('<p>Buffed</p>');
    });
});
