// @maintained-by-ai
// OWNERSHIP (result-types lane, trimmed 2026-10-18): this file owns the
// handler-result SHAPE seam of handleAutomationAction — one truth table per
// dispatch seam over executeHandler's returned result:
//   dispatchAutomationResult type routing (popup / notify_buffs_changed)
//   finalizeAutomationOutcome buffs gate (temp_buff / combat_stance + negatives)
//   dispatchRollResult (damage payload, contextConfig || {}, non-damage dead leg)
//   dispatchAttackRollResult (full fields vs || defaults; exact rollAttack pin)
//   finalizeAutomationOutcome logEntries (1 / many / empty → campaignName pin)
//   falsy-result guard :449 (null/undefined, strengthened with reached-guard pin;
//   jointly cited by .test.early-returns.js #548)
// Owned elsewhere — not replicated here:
//   modal routing → .test.resource-modals.js / .test.condition-modals.js /
//     .test.class-feature-modals.js (#545/#549); unknown modalName drop → class-feature-modals
//   FP/gate/CLA-399 lanes → useCharActionsAutomation.test.js (#545)
//   addEntry rejection swallowing → .test.js robustness (#545)
//   telepathicSpeech producer → .test.telepathic-speech.js (CLA-053)
//   handleDivineInterventionCast flows → .test.divine-intervention.js (#547)
// Deleted as duplicates, verified stronger at cite: weaker default-damageType
// dupe (:194 of old file) → default row of the attack_roll table below;
// two byte-dup null/undefined it()s → falsy it.each below.
// no vi.mock needed — no test here invokes divineInterventionHandler or
// spellCastService callbacks (unmocked jsdom load proven: #546/#549 + siblings).
// No timers in this lane.
import { describe, it, expect } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach, campaignName } from './useCharActionsAutomation.test.setup.js';

describe('useCharActionsAutomation — handler result types', () => {
    setupBeforeEach();

    describe('dispatchAutomationResult type routing', () => {
        // Modal legs live in the modal-routing sibling lanes (#545 ownership map).
        it.each([
            {
                label: 'popup',
                result: { type: 'popup', payload: '<b>Test</b>' },
                expect: (hooks) => expect(hooks.setPopupHtml).toHaveBeenCalledWith('<b>Test</b>'),
            },
            {
                label: 'notify_buffs_changed',
                result: { type: 'notify_buffs_changed' },
                expect: (hooks) => expect(hooks.onBuffsChange).toHaveBeenCalledTimes(1),
            },
        ])('routes $label result to its sink and nothing else', async ({ result, expect: pin }) => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue(result);
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation: {} });

            pin(hooks);
            expect(hooks.executeHandler).toHaveBeenCalledWith(
                { name: 'TestAction', automation: {} }, hooks.playerStats, campaignName, 'test-map', []
            );
            if (result.type !== 'popup') expect(hooks.setPopupHtml).not.toHaveBeenCalled();
            if (result.type !== 'notify_buffs_changed') expect(hooks.onBuffsChange).not.toHaveBeenCalled();
            expect(hooks.setModalState).not.toHaveBeenCalled();
            expect(hooks.addEntry).not.toHaveBeenCalled();
        });
    });

    describe('finalize buffs gate (popup result)', () => {
        // finalizeAutomationOutcome: popup + (temp_buff || combat_stance) → onBuffsChange.
        it.each([
            { automation: { type: 'temp_buff' }, buffs: true },
            { automation: { type: 'combat_stance' }, buffs: true },
            { automation: { type: 'other' }, buffs: false },
            { automation: {}, buffs: false },
        ])('popup result with automation $automation calls onBuffsChange $buffs', async ({ automation, buffs }) => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation });

            expect(hooks.setPopupHtml).toHaveBeenCalledWith('done');
            expect(hooks.onBuffsChange).toHaveBeenCalledTimes(buffs ? 1 : 0);
        });
    });

    describe('dispatchRollResult', () => {
        it.each([
            {
                label: 'damage payload, context defaults to {}',
                payload: { rollType: 'damage', name: 'Test Damage', formula: '2d6+3', total: 10, rolls: [3, 7], modifier: 3 },
                expected: { name: 'Test Damage', formula: '2d6+3', total: 10, rolls: [3, 7], modifier: 3, context: {} },
            },
            {
                label: 'contextConfig threads through as context',
                payload: { rollType: 'damage', name: 'Test Damage', formula: '2d6+3', total: 10, rolls: [3, 7], modifier: 3, contextConfig: { source: 'test' } },
                expected: { name: 'Test Damage', formula: '2d6+3', total: 10, rolls: [3, 7], modifier: 3, context: { source: 'test' } },
            },
        ])('roll result — $label', async ({ payload, expected }) => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({ type: 'roll', payload });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.rollDamage).toHaveBeenCalledWith(expected);
        });

        it('roll result with non-damage rollType is a dead leg — no rollDamage', async () => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({ type: 'roll', payload: { rollType: 'attack', name: 'Test Roll' } });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.rollDamage).not.toHaveBeenCalled();
            expect(hooks.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('dispatchAttackRollResult', () => {
        // dispatchAttackRollResult: autoDamageFormula || null, autoDamageName || name,
        // damageType || 'Slashing' — exact full-args pin (forcedMode/isOpportunityAttack fixed).
        it.each([
            {
                label: 'full attack fields pass through',
                attack: { name: 'Test Attack', hitBonus: 6, autoDamageFormula: '1d4', autoDamageName: 'Test Attack Damage', damageType: 'Slashing' },
                expectedOpts: { targetName: 'Enemy', forcedMode: undefined, isOpportunityAttack: false, autoDamageFormula: '1d4', autoDamageName: 'Test Attack Damage', damageType: 'Slashing' },
            },
            {
                label: 'missing autoDamage fields fall back to defaults',
                attack: { name: 'Test Attack', hitBonus: 6 },
                expectedOpts: { targetName: 'Enemy', forcedMode: undefined, isOpportunityAttack: false, autoDamageFormula: null, autoDamageName: 'Test Attack', damageType: 'Slashing' },
            },
        ])('attack_roll result — $label', async ({ attack, expectedOpts }) => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({ type: 'attack_roll', payload: { attack, targetName: 'Enemy' } });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.rollAttack).toHaveBeenCalledWith('Test Attack', 6, expectedOpts);
        });
    });

    describe('finalizeAutomationOutcome logEntries', () => {
        it.each([
            { label: 'one entry', entries: [{ type: 'ability_use', abilityName: 'Test' }] },
            {
                label: 'multiple entries in order',
                entries: [
                    { type: 'ability_use', abilityName: 'Test1' },
                    { type: 'damage', amount: 5 },
                ],
            },
            { label: 'empty array logs nothing', entries: [] },
        ])('logEntries — $label', async ({ entries }) => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done', logEntries: entries });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.addEntry).toHaveBeenCalledTimes(entries.length);
            entries.forEach((entry, i) => {
                expect(hooks.addEntry).toHaveBeenNthCalledWith(i + 1, campaignName, entry);
            });
        });
    });

    describe('falsy result guard', () => {
        // executeHandler falsy → early return at :449. Reached-guard pin
        // (executeHandler called) proves the silence is this branch, not an
        // upstream gate — strengthens the old byte-dup null/undefined pair
        // cited by .test.early-returns.js (#548).
        it.each([null, undefined])('executeHandler returning %s dispatches nothing after being reached', async (falsyResult) => {
            const hooks = createHooks();
            hooks.executeHandler.mockResolvedValue(falsyResult);
            const { handleAutomationAction } = useCharActionsAutomation(hooks);

            await handleAutomationAction({ name: 'TestAction', automation: {} });

            expect(hooks.executeHandler).toHaveBeenCalledTimes(1);
            expect(hooks.setPopupHtml).not.toHaveBeenCalled();
            expect(hooks.setModalState).not.toHaveBeenCalled();
            expect(hooks.rollDamage).not.toHaveBeenCalled();
            expect(hooks.rollAttack).not.toHaveBeenCalled();
            expect(hooks.onBuffsChange).not.toHaveBeenCalled();
            expect(hooks.addEntry).not.toHaveBeenCalled();
        });
    });
});
