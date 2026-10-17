// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

// Ownership: this lane owns the handleSaveResultOverride seam ONLY — the
// promptId guards, condition application on a failed player save, zero
// fallbacks for missing detail fields, formula derivation from saveBonus,
// and exact ctx results/prompt bookkeeping (including removing only the
// matching pending prompt).
// Base render/click → base .test.jsx lane; renderBody/renderActions display
// edges + Cancel-exclusivity → .edge-cases.test.jsx lane; handleApplyOverride
// roll/apply/back deep write contracts (sendSaveResult full payload,
// persistAndNotify event, Cancel/Back write-inertness) → .handlers.test.jsx
// lane.
// (This lane formerly carried the full mockState backfill and a dead
// `export { mockState }` — stripped per the handlers-lane recommendation.
// Selection is driven through a real click on the Blinded/Deafened button so
// the component's own setSelectedEffect updates extraState: unlike the apply
// seam, handleSaveResultOverride closes over the component's selectedEffect
// STATE (not ctx.selectedEffect), so arming the seam legitimately requires a
// re-render with the selection in place. Nothing else is shared cross-mock.)

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
        { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
        { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
    ],
};

const BLENDED = { key: 'blinded', label: 'Blinded', condition: 'blinded' };
const DEAFENED = { key: 'deafened', label: 'Deafened', condition: 'deafened' };

// Base mock mirrors the real base: selection lives in the component's
// extraState, and the seam props (handleSaveResultOverride) are captured
// from the props object the component passes down.
vi.mock('./shared/AreaEffectTargetModalBase.jsx', () => ({
    default: vi.fn(({ renderBody, renderActions, featureName, icon, onClose, extraState, combatSummary }) => {
        const ctx = {
            selected: new Set(),
            processing: false,
            results: [],
            pendingPrompts: [],
            eligibleTargets: [],
            toggleTarget: vi.fn(),
            handleApply: vi.fn(),
            selectedEffect: extraState?.selectedEffect ?? null,
            allResolved: false,
            setProcessing: vi.fn(),
            setResults: vi.fn(),
            setPendingPrompts: vi.fn(),
            combatSummary: combatSummary || baseCombatSummary,
        };

        return (
            <div data-testid="area-effect-modal-base" className="sp-overlay" onClick={onClose}>
                <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="sp-header">
                        <i className={icon}></i> {featureName}
                    </div>
                    <div className="sp-body">
                        {renderBody ? renderBody(ctx) : null}
                    </div>
                    <div className="sp-actions" data-testid="sp-actions">
                        {renderActions ? renderActions(ctx) : null}
                    </div>
                </div>
            </div>
        );
    }),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: (name) => name,
        guid: vi.fn(() => 'test-guid-123'),
    },
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/spells/blindnessDeafnessHandler.js', () => ({
    handle: vi.fn(),
    getEffectOptions: vi.fn(() => [BLENDED, DEAFENED]),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as conditionSaveService from '../../../services/combat/conditions/conditionSaveService.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import utils from '../../../services/ui/utils.js';
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';

// Fresh props (and fresh onClose) per call — never a shared fixture.
function makeProps(overrides = {}) {
    return {
        combatSummary: baseCombatSummary,
        attackerName: 'Witch1',
        attackerPos: { gridX: 10, gridY: 10 },
        saveDc: 14,
        campaignName: 'test-campaign',
        mapData: null,
        onClose: vi.fn(),
        characters: [],
        featureName: 'Blindness/Deafness',
        rangeFeet: 120,
        ...overrides,
    };
}

function getSaveResultFn() {
    const seam = AreaEffectTargetModalBase.mock.calls.at(-1)[0].handleSaveResultOverride;
    expect(seam).toBeTypeOf('function');
    return seam;
}

// Mounts and arms the seam by clicking the effect button — the component's
// setSelectedEffect then flows through extraState into the seam's closure
// (handleSaveResultOverride reads selectedEffect STATE, not ctx).
function mountWithEffectSelected(effect) {
    render(<BlindnessDeafnessModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(effect.label, 'i') }));
    return getSaveResultFn();
}

// ctx for direct seam invocation. The component calls the ctx setters with
// updater functions, so the mock applies them to a live state object the
// tests assert against exactly.
function makeCtx(overrides = {}) {
    // Seed the live state from the SAME arrays the ctx exposes, so updater
    // calls run against what the component actually sees.
    const initialResults = overrides.results ?? [];
    const initialPending = overrides.pendingPrompts ?? [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }];
    const state = {
        results: initialResults,
        pendingPrompts: initialPending,
    };
    const ctx = {
        selectedEffect: BLENDED,
        processing: true,
        combatSummary: baseCombatSummary,
        results: initialResults,
        pendingPrompts: initialPending,
        allResolved: false,
        selected: new Set(),
        eligibleTargets: [],
        toggleTarget: vi.fn(),
        handleApply: vi.fn(),
        setProcessing: vi.fn(),
        setResults: vi.fn((fn) => { state.results = fn(state.results); }),
        setPendingPrompts: vi.fn((fn) => { state.pendingPrompts = fn(state.pendingPrompts); }),
        ...overrides,
    };
    return { ctx, state };
}

function saveResultEvent(detail) {
    return { detail };
}

// The full write surface this seam can touch — used to prove inertness.
function expectNoSeamWrites(ctx) {
    expect(ctx.setProcessing).not.toHaveBeenCalled();
    expect(ctx.setResults).not.toHaveBeenCalled();
    expect(ctx.setPendingPrompts).not.toHaveBeenCalled();
    expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(diceRoller.rollD20).not.toHaveBeenCalled();
}

describe('BlindnessDeafnessModal handleSaveResultOverride seam', () => {
    beforeEach(() => {
        diceRoller.rollD20.mockReturnValue(15);
        utils.guid.mockReturnValue('test-guid-123');
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    afterEach(() => {
        // mockReset (not clearAllMocks) so return stubs cannot leak across
        // tests. AreaEffectTargetModalBase and getEffectOptions are
        // deliberately NOT reset — their mock rendering/stubs live in the
        // vi.mock factories and must survive.
        diceRoller.rollD20.mockReset();
        utils.guid.mockReset();
        runtimeState.getRuntimeValue.mockReset();
        runtimeState.setRuntimeValue.mockReset();
        expirations.addExpiration.mockReset();
        conditionSaveService.addCondition.mockReset();
        logService.addEntry.mockReset();
        savePromptService.sendSavePrompt.mockReset();
        savePromptService.sendSaveResult.mockReset();
    });

    // ── failed player save — full write contract ──

    [BLENDED, DEAFENED].forEach((effect) => {
        it(`applies the exact ${effect.key} write contract and resolves only the matching prompt when the player save fails`, () => {
            const saveResultFn = mountWithEffectSelected(effect);
            // A distinct summary object proves the seam forwards the ctx's
            // combatSummary by identity, not a deep-equal copy.
            const combatSummary = { creatures: [...baseCombatSummary.creatures] };
            const otherPrompt = { promptId: 'other-prompt', targetName: 'Goblin1' };
            const { ctx, state } = makeCtx({
                combatSummary,
                pendingPrompts: [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }, otherPrompt],
            });

            act(() => {
                saveResultFn(saveResultEvent({
                    promptId: 'test-guid-123',
                    success: false,
                    roll: 3,
                    total: 4,
                    saveBonus: 1,
                }), ctx);
            });

            expect(conditionSaveService.addCondition).toHaveBeenCalledWith({
                combatSummary,
                creatureName: 'Elf Mage',
                conditionDef: effect,
                dc: 14,
                ability: 'CON',
                getRuntimeValue: runtimeState.getRuntimeValue,
                setRuntimeValue: runtimeState.setRuntimeValue,
                campaignName: 'test-campaign',
                playerStats: undefined,
            });
            // Same-object identity through the seam, not structural copies.
            expect(conditionSaveService.addCondition.mock.calls[0][0].combatSummary).toBe(combatSummary);
            expect(conditionSaveService.addCondition.mock.calls[0][0].conditionDef).toBe(effect);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Elf Mage', `blindnessDeafness_${effect.condition}`, true, 'test-campaign'
            );
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: 'Witch1',
                targetName: 'Elf Mage',
                effects: [{ type: 'condition', condition: effect.condition }],
                campaignName: 'test-campaign',
            });
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'condition',
                action: 'applied',
                characterName: 'Elf Mage',
                condition: effect.label,
                dc: 14,
                ability: 'CON',
                sourceName: 'Witch1',
                timestamp: expect.any(Number),
            });
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'roll',
                name: 'Blindness/Deafness',
                characterName: 'Witch1',
                rollType: 'save-damage',
                targetName: 'Elf Mage',
                saveDc: 14,
                saveType: 'CON',
                saveResult: 'failure',
                total: 4,
                rolls: [3],
                bonus: 1,
                formula: '1d20+1',
                timestamp: expect.any(Number),
            });
            // Exactly the two log entries — condition application + roll.
            expect(logService.addEntry).toHaveBeenCalledTimes(2);
            expect(state.results).toEqual([
                { targetName: 'Elf Mage', success: false, roll: 3, total: 4, saveBonus: 1 },
            ]);
            // Only the matching prompt is removed; others survive untouched.
            expect(state.pendingPrompts).toEqual([otherPrompt]);
        });
    });

    // ── successful player save ──

    it('logs the successful roll only — no condition writes, results recorded exactly', () => {
        const saveResultFn = mountWithEffectSelected(BLENDED);
        const { ctx, state } = makeCtx();

        act(() => {
            saveResultFn(saveResultEvent({
                promptId: 'test-guid-123',
                success: true,
                roll: 15,
                total: 16,
                saveBonus: 1,
            }), ctx);
        });

        expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        // The player already rolled — the seam never re-rolls or re-sends.
        expect(diceRoller.rollD20).not.toHaveBeenCalled();
        expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'roll',
            name: 'Blindness/Deafness',
            characterName: 'Witch1',
            rollType: 'save-damage',
            targetName: 'Elf Mage',
            saveDc: 14,
            saveType: 'CON',
            saveResult: 'success',
            total: 16,
            rolls: [15],
            bonus: 1,
            formula: '1d20+1',
            timestamp: expect.any(Number),
        });
        expect(state.results).toEqual([
            { targetName: 'Elf Mage', success: true, roll: 15, total: 16, saveBonus: 1 },
        ]);
        expect(state.pendingPrompts).toEqual([]);
    });

    // ── guard returns: invalid events are fully inert ──

    const inertEventCases = [
        { title: 'detail is missing', detail: null },
        { title: 'detail lacks a promptId', detail: { success: false, roll: 3, total: 4, saveBonus: 1 } },
        { title: 'promptId matches no pending prompt', detail: { promptId: 'unknown-prompt', success: false, roll: 3, total: 4, saveBonus: 1 } },
    ];

    inertEventCases.forEach(({ title, detail }) => {
        it(`is completely inert when ${title}`, () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const saveResultFn = getSaveResultFn();
            const { ctx, state } = makeCtx();

            act(() => {
                saveResultFn(saveResultEvent(detail), ctx);
            });

            expectNoSeamWrites(ctx);
            // The seeded pending prompt survives unresolved.
            expect(state.pendingPrompts).toEqual([{ promptId: 'test-guid-123', targetName: 'Elf Mage' }]);
            expect(state.results).toEqual([]);
        });
    });

    it('is inert for an unmatched promptId even after an effect is selected', () => {
        const saveResultFn = mountWithEffectSelected(BLENDED);
        const { ctx, state } = makeCtx();

        act(() => {
            saveResultFn(saveResultEvent({
                promptId: 'stale-prompt',
                success: false,
                roll: 3,
                total: 4,
                saveBonus: 1,
            }), ctx);
        });

        expectNoSeamWrites(ctx);
        expect(state.pendingPrompts).toEqual([{ promptId: 'test-guid-123', targetName: 'Elf Mage' }]);
    });

    // ── fallbacks and formula derivation ──

    it('falls back to zeros for missing roll fields and still applies the condition on a failed save', () => {
        const saveResultFn = mountWithEffectSelected(BLENDED);
        const { ctx, state } = makeCtx();

        act(() => {
            saveResultFn(saveResultEvent({
                promptId: 'test-guid-123',
                success: false,
            }), ctx);
        });

        expect(state.results).toEqual([
            { targetName: 'Elf Mage', success: false, roll: 0, total: 0, saveBonus: 0 },
        ]);
        expect(state.pendingPrompts).toEqual([]);
        expect(conditionSaveService.addCondition).toHaveBeenCalledTimes(1);
        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Elf Mage', 'blindnessDeafness_blinded', true, 'test-campaign'
        );
        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'roll',
            saveResult: 'failure',
            total: 0,
            rolls: [0],
            bonus: 0,
            // Pins current guard behaviour: `detail.saveBonus !== 0` lets
            // undefined through the formula string ('1d20+undefined') even
            // though bonus itself falls back to 0. See product note in the
            // maintenance report.
            formula: '1d20+undefined',
        }));
    });

    it('derives formula from saveBonus — bare 1d20 when the bonus is 0', () => {
        const saveResultFn = mountWithEffectSelected(BLENDED);
        const { ctx, state } = makeCtx();

        act(() => {
            saveResultFn(saveResultEvent({
                promptId: 'test-guid-123',
                success: true,
                roll: 14,
                total: 14,
                saveBonus: 0,
            }), ctx);
        });

        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'roll',
            saveResult: 'success',
            total: 14,
            rolls: [14],
            bonus: 0,
            formula: '1d20',
        }));
        expect(state.results).toEqual([
            { targetName: 'Elf Mage', success: true, roll: 14, total: 14, saveBonus: 0 },
        ]);
        expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
    });
});
