// @improved-by-ai
// @cleaned-by-ai
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
        { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
        { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
    ],
};

// Shared mock state for the AreaEffectTargetModalBase mock
const mockState = {
    selectedEffect: null,
    processing: false,
    results: [],
    pendingPrompts: [],
    setSelectedEffect: null,
    setProcessing: null,
    setResults: null,
    setPendingPrompts: null,
};

vi.mock('./shared/AreaEffectTargetModalBase.jsx', () => {
    return {
        default: vi.fn(({ renderBody, renderActions, featureName, icon, onClose, extraState, combatSummary }) => {
            if (extraState?.setSelectedEffect) {
                mockState.setSelectedEffect = extraState.setSelectedEffect;
            }

            const ctx = {
                selected: new Set(),
                processing: mockState.processing,
                results: mockState.results,
                pendingPrompts: mockState.pendingPrompts,
                eligibleTargets: [],
                toggleTarget: vi.fn(),
                handleApply: vi.fn(),
                selectedEffect: mockState.selectedEffect,
                allResolved: false,
                setProcessing: mockState.setProcessing || vi.fn(),
                setResults: mockState.setResults || vi.fn(),
                setPendingPrompts: mockState.setPendingPrompts || vi.fn(),
                setSelectedEffect: mockState.setSelectedEffect || vi.fn(),
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
                        <div className="sp-actions">
                            {renderActions ? renderActions(ctx) : null}
                        </div>
                    </div>
                </div>
            );
        }),
    };
});

export { mockState };

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
    getEffectOptions: vi.fn(() => [
        { key: 'blinded', label: 'Blinded', condition: 'blinded' },
        { key: 'deafened', label: 'Deafened', condition: 'deafened' },
    ]),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import utils from '../../../services/ui/utils.js';
import AreaEffectTargetModalBase from './shared/AreaEffectTargetModalBase.jsx';

const baseProps = {
    combatSummary: {
        creatures: [
            { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
            { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
            { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
        ],
    },
    attackerName: 'Witch1',
    attackerPos: { gridX: 10, gridY: 10 },
    saveDc: 14,
    campaignName: 'test-campaign',
    mapData: null,
    onClose: vi.fn(),
    characters: [],
    featureName: 'Blindness/Deafness',
    rangeFeet: 120,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

// Helper: get the handleApplyOverride function from the last AreaEffectTargetModalBase render
function getApplyFn() {
    const lastCall = AreaEffectTargetModalBase.mock.calls[AreaEffectTargetModalBase.mock.calls.length - 1];
    return lastCall?.[0]?.handleApplyOverride;
}

// Helper: create a minimal ctx with the defaults, allowing overrides
function makeCtx(overrides = {}) {
    return {
        selectedEffect: { key: 'blinded', label: 'Blinded', condition: 'blinded' },
        processing: false,
        combatSummary: baseCombatSummary,
        results: [],
        pendingPrompts: [],
        allResolved: false,
        selected: new Set(['Goblin1']),
        eligibleTargets: [],
        toggleTarget: vi.fn(),
        handleApply: vi.fn(),
        setProcessing: vi.fn(),
        setResults: vi.fn(),
        setPendingPrompts: vi.fn(),
        ...overrides,
    };
}

// ── Initiative rolled event ──

describe('BlindnessDeafnessModal handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollD20.mockReturnValue(15);
        utils.guid.mockReturnValue('test-guid-123');
        runtimeState.getRuntimeValue.mockReturnValue(null);
        mockState.selectedEffect = null;
        mockState.processing = false;
        mockState.results = [];
        mockState.pendingPrompts = [];
    });

    // ── Initiative-rolled event ──

    describe('initiative-rolled event handling', () => {
        function renderModal() {
            render(<BlindnessDeafnessModal {...makeProps()} />);
        }

        it('is a no-op when detail is missing, lacks characterName, or rolling character is not the caster', () => {
            renderModal();
            window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: null }));
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

            window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: {} }));
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'OtherCharacter' },
            }));
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // ── HandleApplyOverride (NPC resolution) ──

    describe('handleApplyOverride - NPC resolution', () => {
        it('sets processing to true, rolls saves, and applies condition on failure', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const applyFn = getApplyFn();

            diceRoller.rollD20.mockReturnValue(1);

            const setProcessing = vi.fn();
            const ctx = makeCtx({ setProcessing });

            act(() => {
                applyFn(ctx);
            });

            expect(setProcessing).toHaveBeenCalledWith(true);

            const sendSaveResultCall = savePromptService.sendSaveResult.mock.calls[0];
            expect(sendSaveResultCall[0]).toBe('test-campaign');
            expect(sendSaveResultCall[1]).toBe('Goblin1');
            expect(sendSaveResultCall[2]).toEqual(
                expect.objectContaining({ success: false, roll: 1, total: 3, saveBonus: 2, rawRolls: [1, 1] })
            );

            expect(expirations.addExpiration).toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    type: 'condition',
                    action: 'applied',
                    condition: 'Blinded',
                })
            );
            expect(logService.addEntry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    type: 'roll',
                    targetName: 'Goblin1',
                    saveDc: 14,
                    saveType: 'CON',
                })
            );
        });

        it('does nothing when no effect or no targets are selected', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const applyFn = getApplyFn();

            act(() => {
                applyFn(makeCtx({ selectedEffect: null }));
            });
            expect(diceRoller.rollD20).not.toHaveBeenCalled();

            act(() => {
                applyFn(makeCtx({ selected: new Set() }));
            });
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
        });

        it('sends save result and skips condition when NPC succeeds save', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const applyFn = getApplyFn();

            diceRoller.rollD20.mockReturnValue(15);

            act(() => {
                applyFn(makeCtx());
            });

            expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
                'test-campaign',
                'Goblin1',
                expect.objectContaining({ success: true })
            );
            expect(expirations.addExpiration).not.toHaveBeenCalled();
        });

        it('treats missing creature as NPC with zero save bonus', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const applyFn = getApplyFn();

            diceRoller.rollD20.mockReturnValue(5);

            act(() => {
                applyFn(makeCtx({ selected: new Set(['Unknown Creature']) }));
            });

            expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
                'test-campaign',
                'Unknown Creature',
                expect.objectContaining({ saveBonus: 0 })
            );
        });
    });

    // ── HandleApplyOverride (Player save prompt) ──

    describe('handleApplyOverride - player save prompt', () => {
        it('sends save prompt, logs, and sets pending prompts for player targets', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const applyFn = getApplyFn();

            const setPendingPrompts = vi.fn();

            act(() => {
                applyFn(makeCtx({
                    selected: new Set(['Elf Mage']),
                    setPendingPrompts,
                }));
            });

            expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
            const promptCall = savePromptService.sendSavePrompt.mock.calls[0][1];
            expect(promptCall.targetName).toBe('Elf Mage');
            expect(promptCall.saveType).toBe('CON');
            expect(promptCall.saveDc).toBe(14);
            expect(promptCall.sourceName).toBe('Witch1');

            expect(logService.addEntry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    type: 'roll',
                    targetName: 'Elf Mage',
                    saveResult: 'failure',
                    formula: '1d20 (waiting)',
                })
            );

            expect(setPendingPrompts).toHaveBeenCalled();
            const pendingCalls = setPendingPrompts.mock.calls;
            const lastPendingCall = pendingCalls[pendingCalls.length - 1][0];
            expect(lastPendingCall).toHaveLength(1);
            expect(lastPendingCall[0].targetName).toBe('Elf Mage');
            expect(lastPendingCall[0].promptId).toBe('test-guid-123');
        });
    });

});
