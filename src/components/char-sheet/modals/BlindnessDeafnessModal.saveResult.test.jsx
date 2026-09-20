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
                <div data-testid="area-effect-base" className="sp-overlay" onClick={onClose}>
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

// ── handleSaveResultOverride ──

describe('BlindnessDeafnessModal save result handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        utils.guid.mockReturnValue('test-guid-123');
        runtimeState.getRuntimeValue.mockReturnValue(null);
        mockState.selectedEffect = null;
        mockState.processing = false;
        mockState.results = [];
        mockState.pendingPrompts = [];
    });

    function getSaveResultFn() {
        const lastCall = AreaEffectTargetModalBase.mock.calls[AreaEffectTargetModalBase.mock.calls.length - 1];
        return lastCall?.[0]?.handleSaveResultOverride;
    }

    function makeCtx(overrides = {}) {
        return {
            selectedEffect: { key: 'blinded', label: 'Blinded', condition: 'blinded' },
            processing: true,
            combatSummary: baseCombatSummary,
            results: [],
            pendingPrompts: [],
            allResolved: false,
            selected: new Set(),
            eligibleTargets: [],
            toggleTarget: vi.fn(),
            handleApply: vi.fn(),
            setProcessing: vi.fn(),
            setResults: vi.fn(),
            setPendingPrompts: vi.fn(),
            ...overrides,
        };
    }

    describe('handleSaveResultOverride', () => {
        it('applies condition, logs, and updates state when player save fails', async () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);

            // Select an effect via the real setter so the component's
            // useCallback closure captures a non-null selectedEffect
            await act(async () => {
                if (mockState.setSelectedEffect) {
                    mockState.setSelectedEffect({ key: 'blinded', label: 'Blinded', condition: 'blinded' });
                }
            });

            const saveResultFn = getSaveResultFn();

            let resultsAccum = [];
            let pendingAccum = [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }];
            const setResults = vi.fn((fn) => { resultsAccum = fn(resultsAccum); });
            const setPendingPrompts = vi.fn((fn) => { pendingAccum = fn(pendingAccum); });

            const ctx = makeCtx({
                results: [],
                pendingPrompts: [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }],
                setResults,
                setPendingPrompts,
            });

            const event = {
                detail: {
                    promptId: 'test-guid-123',
                    success: false,
                    roll: 3,
                    total: 4,
                    saveBonus: 1,
                },
            };

            act(() => {
                saveResultFn(event, ctx);
            });

            expect(expirations.addExpiration).toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'condition', action: 'applied', characterName: 'Elf Mage' })
            );
            expect(logService.addEntry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'roll', targetName: 'Elf Mage', saveDc: 14, saveType: 'CON' })
            );
            expect(resultsAccum).toHaveLength(1);
            expect(resultsAccum[0]).toEqual({ targetName: 'Elf Mage', success: false, roll: 3, total: 4, saveBonus: 1 });
            expect(pendingAccum).toHaveLength(0);
        });

        it('does not apply condition when player save succeeds', async () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);

            await act(async () => {
                if (mockState.setSelectedEffect) {
                    mockState.setSelectedEffect({ key: 'blinded', label: 'Blinded', condition: 'blinded' });
                }
            });

            const saveResultFn = getSaveResultFn();

            let resultsAccum = [];
            let pendingAccum = [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }];
            const setResults = vi.fn((fn) => { resultsAccum = fn(resultsAccum); });
            const setPendingPrompts = vi.fn((fn) => { pendingAccum = fn(pendingAccum); });

            const ctx = makeCtx({
                pendingPrompts: [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }],
                setResults,
                setPendingPrompts,
            });

            const event = {
                detail: {
                    promptId: 'test-guid-123',
                    success: true,
                    roll: 15,
                    total: 16,
                    saveBonus: 1,
                },
            };

            act(() => {
                saveResultFn(event, ctx);
            });

            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
            expect(resultsAccum).toHaveLength(1);
            expect(resultsAccum[0].success).toBe(true);
            expect(pendingAccum).toHaveLength(0);
        });

        it('does nothing when promptId does not match any pending prompt', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);
            const saveResultFn = getSaveResultFn();

            let resultsAccum = [];
            let pendingAccum = [{ promptId: 'other-id', targetName: 'Elf Mage' }];
            const setResults = vi.fn((fn) => { resultsAccum = fn(resultsAccum); });
            const setPendingPrompts = vi.fn((fn) => { pendingAccum = fn(pendingAccum); });

            const ctx = makeCtx({
                pendingPrompts: [{ promptId: 'other-id', targetName: 'Elf Mage' }],
                setResults,
                setPendingPrompts,
            });

            const event = {
                detail: {
                    promptId: 'test-guid-123',
                    success: false,
                    roll: 3,
                    total: 4,
                    saveBonus: 1,
                },
            };

            act(() => {
                saveResultFn(event, ctx);
            });

            expect(resultsAccum).toHaveLength(0);
            expect(pendingAccum).toHaveLength(1);
        });

        it('uses fallback values when detail fields are missing', async () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);

            await act(async () => {
                if (mockState.setSelectedEffect) {
                    mockState.setSelectedEffect({ key: 'blinded', label: 'Blinded', condition: 'blinded' });
                }
            });

            const saveResultFn = getSaveResultFn();

            let resultsAccum = [];
            let pendingAccum = [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }];
            const setResults = vi.fn((fn) => { resultsAccum = fn(resultsAccum); });
            const setPendingPrompts = vi.fn((fn) => { pendingAccum = fn(pendingAccum); });

            const ctx = makeCtx({
                pendingPrompts: [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }],
                setResults,
                setPendingPrompts,
            });

            const event = {
                detail: {
                    promptId: 'test-guid-123',
                    success: false,
                },
            };

            act(() => {
                saveResultFn(event, ctx);
            });

            expect(resultsAccum[0]).toEqual({ targetName: 'Elf Mage', success: false, roll: 0, total: 0, saveBonus: 0 });
            expect(pendingAccum).toHaveLength(0);
        });

        it('logs the save entry with correct formula based on bonus value', async () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);

            await act(async () => {
                if (mockState.setSelectedEffect) {
                    mockState.setSelectedEffect({ key: 'blinded', label: 'Blinded', condition: 'blinded' });
                }
            });

            const saveResultFn = getSaveResultFn();

            let resultsAccum = [];
            let pendingAccum = [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }];
            const setResults = vi.fn((fn) => { resultsAccum = fn(resultsAccum); });
            const setPendingPrompts = vi.fn((fn) => { pendingAccum = fn(pendingAccum); });

            const ctx = makeCtx({
                pendingPrompts: [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }],
                setResults,
                setPendingPrompts,
            });

            const event = {
                detail: {
                    promptId: 'test-guid-123',
                    success: false,
                    roll: 3,
                    total: 4,
                    saveBonus: 1,
                },
            };

            act(() => {
                saveResultFn(event, ctx);
            });

            let rollLogCall = logService.addEntry.mock.calls.find(
                (call) => call[1]?.type === 'roll'
            );
            expect(rollLogCall[1].formula).toBe('1d20+1');

            logService.addEntry.mockClear();
            resultsAccum = [];
            pendingAccum = [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }];
            const setResults2 = vi.fn((fn) => { resultsAccum = fn(resultsAccum); });
            const setPendingPrompts2 = vi.fn((fn) => { pendingAccum = fn(pendingAccum); });

            const ctx2 = makeCtx({
                pendingPrompts: [{ promptId: 'test-guid-123', targetName: 'Elf Mage' }],
                setResults: setResults2,
                setPendingPrompts: setPendingPrompts2,
            });

            const event2 = {
                detail: {
                    promptId: 'test-guid-123',
                    success: false,
                    roll: 14,
                    total: 14,
                    saveBonus: 0,
                },
            };

            act(() => {
                saveResultFn(event2, ctx2);
            });

            rollLogCall = logService.addEntry.mock.calls.find(
                (call) => call[1]?.type === 'roll'
            );
            expect(rollLogCall[1].formula).toBe('1d20');
        });
    });
});
