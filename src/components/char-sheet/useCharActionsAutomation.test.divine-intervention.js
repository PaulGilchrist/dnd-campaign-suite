// @maintained-by-ai
// Divine-intervention cast lane of useCharActionsAutomation
// (handleDivineInterventionCast). Owns: the close-modal-first contract,
// runtime action resolution (runtime leg), guard early-returns, the enriched
// recharge-popup template, async trigger-result routing (wildMagicSurge
// modal + popup name fallback), and heal-popup derivation from cast results.
// NOT covered here (owned by sibling lanes):
//   - executeSpellCast deps payload, working getTargetInfo, modalState
//     fallback leg:            useCharActionsAutomation.test.js (deps seam)
//   - divineIntervention modal-open routing + identity: .test.class-feature-modals.js
//   - real uses spend, Wish cooldown dice math, Greater upgrade:
//     divineInterventionHandler.test.js (onSpellSelected/executeSpellCast
//     stay mocked here — this lane pins only the hook's own contract)
import { describe, it, expect, vi } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach, campaignName, basePlayerStats } from './useCharActionsAutomation.test.setup.js';

// Mocked only because their return values steer this hook's branching.
// damageUtils/classFeatures mocks dropped — real modules load cleanly
// unmocked (proven by .test.condition-modals.js) and no test here invokes
// getTargetInfo (pinned working by the deps-seam suite in the main file).
vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    handle: vi.fn(),
    onSpellSelected: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

import { onSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js';
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';

const action = { name: 'Divine Intervention' };
// Runtime-leg resolver: the modalState fallback leg is pinned by the
// deps-seam suite in useCharActionsAutomation.test.js — not repeated here.
const runtimeAction = vi.fn((charKey, key, _cn) => (key === 'divineInterventionAction' ? action : undefined));

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleDivineInterventionCast', () => {
        it('casts the runtime-resolved action and reports the enriched recharge popup', async () => {
            onSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Guidance' },
                name: 'Divine Intervention',
                rechargeMessage: 'until you finish a Long Rest',
            });
            executeSpellCast.mockResolvedValue({ healAmount: 0, triggerResult: null });

            const hooks = createHooks({ getRuntimeValue: runtimeAction });
            const { handleDivineInterventionCast } = useCharActionsAutomation(hooks);
            await handleDivineInterventionCast({ name: 'Guidance' });

            expect(runtimeAction).toHaveBeenCalledWith('charActions', 'divineInterventionAction', campaignName);
            // close-modal-first: exactly one setModalState, the clear payload
            expect(hooks.setModalState).toHaveBeenCalledTimes(1);
            expect(hooks.setModalState).toHaveBeenCalledWith({ divineInterventionModal: null, divineInterventionAction: null });
            expect(onSpellSelected).toHaveBeenCalledWith(action, basePlayerStats, campaignName, { name: 'Guidance' });
            // healAmount=0 gate: the info popup is the ONLY popup — cast chain settled
            await vi.waitFor(() => expect(hooks.setPopupHtml).toHaveBeenCalledTimes(1));
            expect(hooks.setPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Divine Intervention',
                description: 'Divine Intervention cast Guidance. Divine Intervention recharges until you finish a Long Rest',
            });
        });

        it('closes the modal and aborts when no action resolves', async () => {
            const hooks = createHooks({
                getRuntimeValue: vi.fn(() => null),
                modalState: {},
            });
            const { handleDivineInterventionCast } = useCharActionsAutomation(hooks);
            await handleDivineInterventionCast({ name: 'Guidance' });

            expect(hooks.setModalState).toHaveBeenCalledTimes(1);
            expect(hooks.setModalState).toHaveBeenCalledWith({ divineInterventionModal: null, divineInterventionAction: null });
            expect(onSpellSelected).not.toHaveBeenCalled();
            expect(executeSpellCast).not.toHaveBeenCalled();
        });

        it('returns early when onSpellSelected returns null', async () => {
            onSpellSelected.mockResolvedValue(null);

            const hooks = createHooks({ getRuntimeValue: runtimeAction });
            const { handleDivineInterventionCast } = useCharActionsAutomation(hooks);
            await handleDivineInterventionCast({ name: 'Guidance' });

            expect(executeSpellCast).not.toHaveBeenCalled();
            expect(hooks.setPopupHtml).not.toHaveBeenCalled();
        });

        it('routes cast trigger results: wildMagicSurge modal payload, popup name fallback', async () => {
            onSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Guidance' },
                name: 'Divine Intervention',
                rechargeMessage: 'recharged',
            });
            executeSpellCast
                .mockResolvedValueOnce({ healAmount: 0, triggerResult: { type: 'modal', modalName: 'wildMagicSurge', payload: { surge: 'teleport' } } })
                .mockResolvedValueOnce({ healAmount: 0, triggerResult: { type: 'popup', payload: { description: 'The gods answer' } } });

            const hooks = createHooks({ getRuntimeValue: runtimeAction });
            const { handleDivineInterventionCast } = useCharActionsAutomation(hooks);

            // modal branch: only wildMagicSurge routes (clear + surge = 2 calls, payload passthrough)
            await handleDivineInterventionCast({ name: 'Guidance' });
            await vi.waitFor(() => expect(hooks.setModalState).toHaveBeenLastCalledWith({ wildMagicSurgeModal: { surge: 'teleport' } }));
            expect(hooks.setModalState).toHaveBeenCalledTimes(2);

            // popup branch: name falls back to payload.name || spell.name
            await handleDivineInterventionCast({ name: 'Guidance' });
            await vi.waitFor(() => expect(hooks.setPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Guidance',
                description: 'The gods answer',
            }));
        });

        it('derives heal popup totals and joined bonus details from the cast result', async () => {
            onSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Cure Wounds' },
                name: 'Divine Intervention',
                rechargeMessage: 'recharged',
            });
            executeSpellCast.mockResolvedValue({
                healAmount: 8,
                rawTotal: 10,
                formula: '1d8+2',
                rolls: [5, 3],
                targetName: 'TestFighter',
                bonusHeal: 2,
                bonusDetails: [{ amount: 2, name: 'Inspiration' }, { amount: 3, name: 'Blessing' }],
                triggerResult: null,
            });

            const hooks = createHooks({ getRuntimeValue: runtimeAction });
            const { handleDivineInterventionCast } = useCharActionsAutomation(hooks);
            await handleDivineInterventionCast({ name: 'Cure Wounds' });

            // Derivations pinned: total = rawTotal (not healAmount),
            // bonusHealDetail joined with ', ', reroll fields default null.
            await vi.waitFor(() => expect(hooks.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'heal',
                name: 'Cure Wounds',
                formula: '1d8+2',
                rolls: [5, 3],
                total: 10,
                finalHeal: 8,
                bonusHeal: 2,
                bonusHealDetail: '2 Inspiration, 3 Blessing',
                healingRerollOriginalRolls: null,
                healingRerollDisplayRolls: null,
            })));
        });

        it('logs executeSpellCast rejections without surfacing an extra popup', async () => {
            onSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Guidance' },
                name: 'Divine Intervention',
                rechargeMessage: 'recharged',
            });
            executeSpellCast.mockRejectedValue(new Error('Cast failed'));
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

            const hooks = createHooks({ getRuntimeValue: runtimeAction });
            const { handleDivineInterventionCast } = useCharActionsAutomation(hooks);
            await handleDivineInterventionCast({ name: 'Guidance' });

            await vi.waitFor(() => {
                expect(consoleError).toHaveBeenCalledWith('[CharActions] executeSpellCast error:', expect.any(Error));
            });
            // rejection is swallowed by .catch — only the deterministic info popup fires
            expect(hooks.setPopupHtml).toHaveBeenCalledTimes(1);
            consoleError.mockRestore();
        });
    });
});
