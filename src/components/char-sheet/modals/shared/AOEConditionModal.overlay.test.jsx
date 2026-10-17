// @maintained-by-ai
//
// Overlay lane: the early-return render switch in AOEConditionModal.jsx
// (targetName starts with 'overlay-' AND activeOverlay set → AreaEffectTargetModalBase)
// and the overlay-only handler seam: handleApplyOverride / handleSaveResultOverride are
// distinct functions from the normal-path handleCreatureSelectionConfirm / handleSaveResult.
// The siblings (test.jsx, save-flow.test.jsx, results.test.jsx, expiry.test.jsx,
// integration.test.jsx) all render the non-overlay path, so the ctx plumbing below —
// the ONLY executable coverage of those two handlers — stays in this lane.
// Business semantics of the save resolution they delegate to (logging, condition
// application, careful spell, prompts) are covered by save-flow.test.jsx against the
// shared resolveAllSaves and are not re-asserted here.
//
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

// Keep the real expirationQueue (needs getCurrentCombatRound) inert — clock CONTENT is
// asserted by AOEConditionModal.expiry.test.jsx, not here.
vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

// The base renders inside a map/selection context far too heavy for this lane.
// Stub it as the contract it is: forwarded display props plus the Apply button that
// feeds the modal its selection context (exactly what the real base does on click).
const { overlayHarness } = vi.hoisted(() => ({
    overlayHarness: { props: null, ctx: null },
}));

vi.mock('./AreaEffectTargetModalBase.jsx', () => ({
    default: function MockAreaEffectTargetModalBase(props) {
        overlayHarness.props = props;
        return (
            <div data-testid="area-effect-target-modal-base">
                <div data-testid="feature-name">{props.featureName}</div>
                <div data-testid="save-type">{props.saveType}</div>
                <div data-testid="save-dc">{props.saveDc}</div>
                <button
                    data-testid="apply-btn"
                    onClick={() => props.handleApplyOverride(overlayHarness.ctx)}
                    type="button"
                >
                    Apply
                </button>
            </div>
        );
    },
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';

// ── Test fixtures ──

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Blinding Darkness',
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { con: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const baseEffects = [{ type: 'blinded', condition: 'blinded' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 12,
        effects: baseEffects,
        conditionLabel: 'Blinded',
        onClose: vi.fn(),
        ...overrides,
    };
}

function overlayProps(overrides = {}) {
    return makeProps({
        playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
        activeOverlay: { name: 'TestOverlay' },
        ...overrides,
    });
}

// Minimal stand-in for the base's selection context (the ctx the real base builds and
// passes into handleApplyOverride / handleSaveResultOverride).
function makeCtx(selectedNames) {
    const ctx = {
        selected: new Set(selectedNames),
        pendingPrompts: [],
        results: [],
        setProcessing: vi.fn(),
        setResults: update => { ctx.results = typeof update === 'function' ? update(ctx.results) : update; },
        setPendingPrompts: update => { ctx.pendingPrompts = typeof update === 'function' ? update(ctx.pendingPrompts) : update; },
    };
    return ctx;
}

// ── Tests ──

describe('AOEConditionModal Overlay', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        overlayHarness.props = null;
        overlayHarness.ctx = null;
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    it('renders AreaEffectTargetModalBase only for overlay targets with an active overlay, forwarding feature name, save type and DC', () => {
        const { unmount } = render(<AOEConditionModal {...overlayProps()} />);
        expect(screen.getByTestId('area-effect-target-modal-base')).toBeInTheDocument();
        expect(screen.getByTestId('feature-name')).toHaveTextContent('Blinding Darkness');
        expect(screen.getByTestId('save-type')).toHaveTextContent('CON');
        expect(screen.getByTestId('save-dc')).toHaveTextContent('12');
        unmount();

        // 'overlay-' target WITHOUT an active overlay must fall back to the standard
        // selection UI (second half of the && guard — the non-overlay default is
        // test.jsx's lane, this half is unique here).
        render(<AOEConditionModal {...makeProps({ playerStats: { ...basePlayerStats, targetName: 'overlay-123' } })} />);
        expect(screen.queryByTestId('area-effect-target-modal-base')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Blinding Darkness/ })).toBeInTheDocument();
    });

    it('routes Apply through handleApplyOverride and the save-result round trip through handleSaveResultOverride, updating the base context', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.01); // NPC saves roll 1 → fail DC 12
        try {
            render(<AOEConditionModal {...overlayProps()} />);
            const ctx = makeCtx(['Goblin', 'PlayerAlly']);
            overlayHarness.ctx = ctx;

            await act(async () => {
                fireEvent.click(screen.getByTestId('apply-btn'));
            });

            // Ability use logged once for the overlay lane...
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Wizard1',
                abilityName: 'Blinding Darkness',
                description: expect.stringContaining('Selecting 2 target'),
            }));
            expect(ctx.setProcessing).toHaveBeenCalledWith(true);

            // ...NPC save auto-resolved into the base ctx (failed → blinded applied)...
            expect(ctx.results.map(r => r.targetName)).toEqual(['Goblin']);
            expect(ctx.results[0].success).toBe(false);
            const goblinWrites = setRuntimeValue.mock.calls.filter(
                call => call[0] === 'Goblin' && call[1] === 'activeConditions'
            );
            expect(goblinWrites[0][2]).toContain('blinded');

            // ...player target prompted and tracked in the base ctx, not resolved locally.
            expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'PlayerAlly',
                saveType: 'CON',
                saveDc: 12,
            }));
            expect(ctx.pendingPrompts.map(p => p.targetName)).toEqual(['PlayerAlly']);

            const promptId = ctx.pendingPrompts[0].promptId;

            // Non-matching promptId is ignored (guard unique to the override handler).
            await act(async () => {
                overlayHarness.props.handleSaveResultOverride(
                    { detail: { promptId: 'someone-elses-prompt', success: false, roll: 1, total: 1 } },
                    ctx
                );
            });
            expect(setRuntimeValue.mock.calls.filter(
                call => call[0] === 'PlayerAlly' && call[1] === 'activeConditions'
            )).toHaveLength(0);
            expect(ctx.pendingPrompts).toHaveLength(1);

            // Matching promptId: condition applied to the ally, save_result logged,
            // prompt cleared from the base ctx.
            await act(async () => {
                overlayHarness.props.handleSaveResultOverride(
                    { detail: { promptId, success: false, roll: 3, total: 4, saveBonus: 1 } },
                    ctx
                );
            });
            const allyWrites = setRuntimeValue.mock.calls.filter(
                call => call[0] === 'PlayerAlly' && call[1] === 'activeConditions'
            );
            expect(allyWrites.length).toBeGreaterThan(0);
            expect(allyWrites[0][2]).toContain('blinded');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                targetName: 'PlayerAlly',
                success: false,
            }));
            expect(ctx.pendingPrompts).toHaveLength(0);
        } finally {
            vi.restoreAllMocks();
        }
    });
});
