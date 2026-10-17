// @maintained-by-ai
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BlindnessDeafnessModal from './BlindnessDeafnessModal.jsx';

// Ownership: this base lane owns ONLY the initial render contract (mount +
// exact pass-through props), effect-selection UI basics (selected classes and
// the extraState seam), and generic cancel/close. Render edges +
// Cancel-exclusivity + Back transition → .edge-cases.test.jsx lane;
// roll/apply deep write contracts + Cancel/Back write-inertness →
// .handlers.test.jsx lane; handleSaveResultOverride → .saveResult.test.jsx
// lane.
// (This lane formerly carried the mockState backfill, a dead
// `export { mockState }`, and a shared baseProps fixture — stripped per the
// sibling-lane recommendation: the base mock mirrors extraState?.selectedEffect
// directly, so no cross-mock state sharing is needed.)

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin1', type: 'npc', saveBonuses: { con: 2 } },
        { name: 'Orc Warrior', type: 'npc', saveBonuses: { con: 4 } },
        { name: 'Elf Mage', type: 'player', saveBonuses: { con: 1 } },
    ],
};

// Stable option identities so the extraState seam can be asserted with toBe.
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

import * as diceRoller from '../../../services/dice/diceRoller.js';
import { addExpiration } from '../../../services/rules/effects/expirations.js';
import { addCondition } from '../../../services/combat/conditions/conditionSaveService.js';
import { addEntry } from '../../../services/ui/logService.js';
import { sendSavePrompt, sendSaveResult } from '../../../services/combat/conditions/savePromptService.js';
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

// The exact props object the component most recently handed to the base.
function passedToBase() {
    return AreaEffectTargetModalBase.mock.calls.at(-1)[0];
}

describe('BlindnessDeafnessModal', () => {
    beforeEach(() => {
        diceRoller.rollD20.mockReturnValue(15);
    });

    afterEach(() => {
        // mockReset (not clearAllMocks) so return stubs cannot leak across
        // tests. AreaEffectTargetModalBase and the getEffectOptions stub are
        // deliberately NOT reset — their mock rendering/option lists live in
        // the vi.mock factories and must survive.
        diceRoller.rollD20.mockReset();
        addExpiration.mockReset();
        addCondition.mockReset();
        addEntry.mockReset();
        sendSavePrompt.mockReset();
        sendSaveResult.mockReset();
    });

    // ── Initial render contract ──

    describe('initial render', () => {
        it('mounts the base modal with exact pass-through props and the feature-name header', () => {
            const props = makeProps();
            render(<BlindnessDeafnessModal {...props} />);

            expect(screen.getByTestId('area-effect-modal-base')).toBeInTheDocument();
            expect(screen.getByText('Blindness/Deafness')).toBeInTheDocument();

            const passed = passedToBase();
            expect(passed).toEqual(expect.objectContaining({
                featureName: 'Blindness/Deafness',
                saveType: 'CON',
                saveDc: 14,
                rangeFeet: 120,
                attackerName: 'Witch1',
                campaignName: 'test-campaign',
                icon: 'fa-solid fa-eye',
            }));
            // Same-object identity for the pass-through references.
            expect(passed.combatSummary).toBe(props.combatSummary);
            expect(passed.attackerPos).toBe(props.attackerPos);
            expect(passed.onClose).toBe(props.onClose);
            expect(passed.extraState).toEqual({
                selectedEffect: null,
                setSelectedEffect: expect.any(Function),
            });
        });

        it('shows the selection prompt, both effect option buttons with descriptions, and Cancel', () => {
            render(<BlindnessDeafnessModal {...makeProps()} />);

            expect(screen.getByText('Choose an effect for the target:')).toBeInTheDocument();

            for (const [label, description] of [['Blinded', 'Target is blinded'], ['Deafened', 'Target is deafened']]) {
                const btn = screen.getByRole('button', { name: new RegExp(label) });
                expect(within(btn).getByText(description)).toBeInTheDocument();
            }

            expect(within(screen.getByTestId('sp-actions')).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });

    // ── Effect selection UI basics ──
    // Full selection behaviour (target list, apply, save resolution) lives in
    // the handlers/saveResult lanes; display-edge copy in edge-cases. This
    // lane owns the core selection contract: clicking an option mirrors the
    // exact option object through the extraState seam and swaps the body to
    // the target-selection copy. (NOTE: the legacy
    // `blindness-deafness-effect-selected` button class is unreachable in a
    // faithful flow — the real base spreads extraState into ctx, so the
    // moment selectedEffect is set the effect buttons unmount. Flagged, not
    // fixed.)

    describe('effect selection UI', () => {
        [BLENDED, DEAFENED].forEach((effect) => {
            it(`clicking ${effect.label} mirrors the exact option object through extraState and swaps to the target-selection copy`, () => {
                render(<BlindnessDeafnessModal {...makeProps()} />);

                fireEvent.click(screen.getByRole('button', { name: new RegExp(effect.label) }));

                expect(passedToBase().extraState.selectedEffect).toBe(effect);
                expect(screen.queryByText('Choose an effect for the target:')).not.toBeInTheDocument();
                const base = screen.getByTestId('area-effect-modal-base');
                expect(base).toHaveTextContent(`Effect: ${effect.label}.`);
                expect(within(base).getByText('CON')).toBeInTheDocument();
                expect(within(base).getByText('Targets selected: 0/0')).toBeInTheDocument();
            });
        });
    });

    // ── Generic cancel / close ──
    // Cancel-exclusivity (exact button set) → edge-cases lane; write-inert
    //ness of Cancel → handlers lane. This lane owns the plain close contract.

    describe('cancel / close', () => {
        const closePaths = [
            ['the Cancel button', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
            ['the overlay backdrop', () => fireEvent.click(screen.getByTestId('area-effect-modal-base'))],
        ];

        closePaths.forEach(([label, click]) => {
            it(`calls onClose exactly once when clicking ${label}`, () => {
                const props = makeProps();
                render(<BlindnessDeafnessModal {...props} />);

                click();
                expect(props.onClose).toHaveBeenCalledTimes(1);
            });
        });
    });
});
