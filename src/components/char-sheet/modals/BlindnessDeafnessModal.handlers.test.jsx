import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

// Ownership: this lane owns the handler seam — handleApplyOverride (NPC
// auto-resolve + player save prompt), the initiative-rolled clear flow, and
// write-inertness of Cancel/Back. Base render/click → base .test.jsx lane;
// renderBody/renderActions display edges + Cancel-exclusivity + Back
// transition → .edge-cases.test.jsx lane; handleSaveResultOverride →
// .saveResult.test.jsx lane.
// (This lane formerly carried the mockState backfill pattern and a dead
// `export { mockState }` — removed: apply flows receive the effect via
// ctx.selectedEffect and Back drives the component's own setSelectedEffect,
// so no cross-mock state sharing is needed here.)

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
// extraState, and renderBody/renderActions run with a ctx built from it.
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

// Mounts the modal and returns { props, passed } — the props plus the exact
// props object the component handed to the base (source of the handler seam).
function mount(overrides) {
    const props = makeProps(overrides);
    render(<BlindnessDeafnessModal {...props} />);
    return { props, passed: AreaEffectTargetModalBase.mock.calls.at(-1)[0] };
}

function getApplyFn(overrides) {
    return mount(overrides).passed.handleApplyOverride;
}

// Minimal ctx for direct handleApplyOverride invocation.
function makeCtx(overrides = {}) {
    return {
        selectedEffect: BLENDED,
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

// The full write surface this modal can touch — used to prove inertness.
function expectNoWrites() {
    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
}

describe('BlindnessDeafnessModal handlers', () => {
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

    // ── handleApplyOverride — NPC auto-resolution ──

    describe('handleApplyOverride - NPC auto-resolution', () => {
        const saveScenarios = [
            { title: 'NPC fails the CON save', target: 'Goblin1', roll: 1, success: false, total: 3, saveBonus: 2 },
            { title: 'NPC rolls high enough and saves', target: 'Orc Warrior', roll: 11, success: true, total: 15, saveBonus: 4 },
            { title: 'creature missing from combatSummary is treated as NPC with +0 save', target: 'Unknown Creature', roll: 5, success: false, total: 5, saveBonus: 0 },
        ];

        saveScenarios.forEach(({ title, target, roll, success, total, saveBonus }) => {
            it(`sends the exact save result and resolves ctx when ${title}`, () => {
                const applyFn = getApplyFn();
                diceRoller.rollD20.mockReturnValue(roll);
                const ctx = makeCtx({ selected: new Set([target]) });

                act(() => {
                    applyFn(ctx);
                });

                expect(ctx.setProcessing).toHaveBeenCalledWith(true);
                expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
                expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', target, {
                    promptId: 'test-guid-123',
                    success,
                    roll,
                    total,
                    saveBonus,
                    rawRolls: [roll, roll],
                });
                expect(ctx.setResults).toHaveBeenCalledWith([{ targetName: target, success, roll, total, saveBonus }]);
                expect(ctx.setPendingPrompts).toHaveBeenCalledWith([]);
            });
        });

        [BLENDED, DEAFENED].forEach((effect) => {
            it(`applies the full write contract to the NPC when ${effect.key} save fails`, () => {
                const applyFn = getApplyFn();
                diceRoller.rollD20.mockReturnValue(1);
                const ctx = makeCtx({ selectedEffect: effect });

                let persisted = 0;
                const onPersist = () => { persisted += 1; };
                window.addEventListener('combat-summary-updated', onPersist);

                act(() => {
                    applyFn(ctx);
                });

                window.removeEventListener('combat-summary-updated', onPersist);

                expect(conditionSaveService.addCondition).toHaveBeenCalledWith({
                    combatSummary: baseCombatSummary,
                    creatureName: 'Goblin1',
                    conditionDef: effect,
                    dc: 14,
                    ability: 'CON',
                    getRuntimeValue: runtimeState.getRuntimeValue,
                    setRuntimeValue: runtimeState.setRuntimeValue,
                    campaignName: 'test-campaign',
                    playerStats: undefined,
                });
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    'Goblin1', `blindnessDeafness_${effect.condition}`, true, 'test-campaign'
                );
                expect(expirations.addExpiration).toHaveBeenCalledWith({
                    attackerName: 'Witch1',
                    targetName: 'Goblin1',
                    effects: [{ type: 'condition', condition: effect.condition }],
                    campaignName: 'test-campaign',
                });
                expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
                    type: 'condition',
                    action: 'applied',
                    characterName: 'Goblin1',
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
                    targetName: 'Goblin1',
                    saveDc: 14,
                    saveType: 'CON',
                    saveResult: 'failure',
                    total: 3,
                    rolls: [1],
                    bonus: 2,
                    formula: '1d20+2',
                    timestamp: expect.any(Number),
                });
                // persistAndNotify fired exactly once during apply.
                expect(persisted).toBe(1);
            });
        });

        it('writes no condition state when the NPC saves, logging only the roll', () => {
            const applyFn = getApplyFn();
            diceRoller.rollD20.mockReturnValue(15);

            act(() => {
                applyFn(makeCtx());
            });

            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'roll',
                name: 'Blindness/Deafness',
                characterName: 'Witch1',
                rollType: 'save-damage',
                targetName: 'Goblin1',
                saveDc: 14,
                saveType: 'CON',
                saveResult: 'success',
                total: 17,
                rolls: [15],
                bonus: 2,
                formula: '1d20+2',
                timestamp: expect.any(Number),
            });
        });

        it('resolves only the first selected target — the spell is single-target', () => {
            const applyFn = getApplyFn();
            diceRoller.rollD20.mockReturnValue(1);
            const ctx = makeCtx({ selected: new Set(['Goblin1', 'Orc Warrior']) });

            act(() => {
                applyFn(ctx);
            });

            expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
            expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
            expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin1', expect.any(Object));
            expect(ctx.setResults).toHaveBeenCalledWith([
                { targetName: 'Goblin1', success: false, roll: 1, total: 3, saveBonus: 2 },
            ]);
        });

        const inertCases = [
            { title: 'no effect is selected', ctxOverride: { selectedEffect: null } },
            { title: 'no targets are selected', ctxOverride: { selected: new Set() } },
        ];

        inertCases.forEach(({ title, ctxOverride }) => {
            it(`is completely inert when ${title}`, () => {
                const applyFn = getApplyFn();
                const ctx = makeCtx(ctxOverride);

                act(() => {
                    applyFn(ctx);
                });

                expect(ctx.setProcessing).not.toHaveBeenCalled();
                expect(ctx.setResults).not.toHaveBeenCalled();
                expect(ctx.setPendingPrompts).not.toHaveBeenCalled();
                expectNoWrites();
            });
        });
    });

    // ── handleApplyOverride — player save prompt ──

    describe('handleApplyOverride - player save prompt', () => {
        it('sends the exact save prompt and defers all condition writes to the player response', () => {
            const applyFn = getApplyFn();
            const ctx = makeCtx({ selected: new Set(['Elf Mage']) });

            act(() => {
                applyFn(ctx);
            });

            expect(ctx.setProcessing).toHaveBeenCalledWith(true);
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', {
                promptId: 'test-guid-123',
                targetName: 'Elf Mage',
                saveType: 'CON',
                saveDc: 14,
                sourceName: 'Witch1',
            });
            // The GM never rolls or commits state for a player target.
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
            expect(ctx.setResults).toHaveBeenCalledWith([]);
            expect(ctx.setPendingPrompts).toHaveBeenCalledWith([{ promptId: 'test-guid-123', targetName: 'Elf Mage' }]);

            // Only the waiting-roll log is written.
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'roll',
                name: 'Blindness/Deafness',
                characterName: 'Witch1',
                rollType: 'save-damage',
                targetName: 'Elf Mage',
                saveDc: 14,
                saveType: 'CON',
                saveResult: 'failure',
                total: 0,
                rolls: [],
                bonus: 0,
                formula: '1d20 (waiting)',
                timestamp: expect.any(Number),
            });
        });
    });

    // ── initiative-rolled event ──

    describe('initiative-rolled event', () => {
        const noOpDetails = [
            { title: 'detail is missing', detail: null },
            { title: 'detail lacks characterName', detail: {} },
            { title: 'the rolling character is not the caster', detail: { characterName: 'OtherCharacter' } },
        ];

        noOpDetails.forEach(({ title, detail }) => {
            it(`is inert when ${title}`, () => {
                mount();

                act(() => {
                    window.dispatchEvent(new CustomEvent('initiative-rolled', { detail }));
                });

                expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
                expect(logService.addEntry).not.toHaveBeenCalled();
            });
        });

        it('clears the applied condition with exact runtime writes when the caster rolls initiative', () => {
            const applyFn = getApplyFn();
            diceRoller.rollD20.mockReturnValue(1);
            act(() => {
                applyFn(makeCtx());
            });
            // 1 write so far: the effect flag set to true by apply.
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);

            // A non-caster roll must not clear anything.
            act(() => {
                window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: 'OtherCharacter' } }));
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);

            runtimeState.getRuntimeValue.mockImplementation((name, key) =>
                key === 'activeConditions' ? ['blinded', 'prone'] : null
            );

            act(() => {
                window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: 'Witch1' } }));
            });

            expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Goblin1', 'activeConditions');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin1', 'activeConditions', ['prone'], 'test-campaign');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin1', 'blindnessDeafness_blinded', null, 'test-campaign');
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'condition',
                action: 'removed',
                characterName: 'Witch1',
                condition: 'blinded',
                reason: 'Initiative rolled - new combat',
                sourceName: 'Witch1',
                timestamp: expect.any(Number),
            });

            // Clear is one-shot: a second caster roll writes nothing further.
            act(() => {
                window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { characterName: 'Witch1' } }));
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(3);
            expect(logService.addEntry.mock.calls.filter(([, entry]) => entry.action === 'removed')).toHaveLength(1);
        });
    });

    // ── Cancel / Back are write-inert ──
    // Button presence/exclusivity and the Back render transition are owned
    // by the base and edge-cases lanes; here we only pin that closing or
    // backing out never touches the runtime, the log, or the prompt channel.

    describe('cancel / back inertness', () => {
        it('Cancel with no effect selected closes and writes nothing', () => {
            const { props } = mount();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(props.onClose).toHaveBeenCalledTimes(1);
            expectNoWrites();
        });

        it('Cancel after effect selection closes and writes nothing', () => {
            const { props } = mount();
            fireEvent.click(screen.getByRole('button', { name: /Blinded/ }));

            fireEvent.click(within(screen.getByTestId('sp-actions')).getByRole('button', { name: 'Cancel' }));

            expect(props.onClose).toHaveBeenCalledTimes(1);
            expectNoWrites();
        });

        it('Back clears the effect selection via extraState and writes nothing', () => {
            mount();
            fireEvent.click(screen.getByRole('button', { name: /Blinded/ }));
            expect(AreaEffectTargetModalBase.mock.calls.at(-1)[0].extraState.selectedEffect).toEqual(BLENDED);

            fireEvent.click(within(screen.getByTestId('sp-actions')).getByRole('button', { name: 'Back' }));

            expect(AreaEffectTargetModalBase.mock.calls.at(-1)[0].extraState.selectedEffect).toBeNull();
            expectNoWrites();
        });
    });
});
