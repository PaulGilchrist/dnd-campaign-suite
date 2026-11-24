// @maintained-by-ai
// Results/processing-face save-equation law (bug-aoe-condition-results-row-brace-literal-leak).
// Both per-target row builders hand-rolled their annotation INSIDE a template
// literal with `{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''}` — missing `$`, so
// `{...}` is NOT interpolation and the raw JS SOURCE TEXT rendered verbatim in
// every save row (live-captured Entangle DC 17:
// "Goblin BraceRig: Failed — restrained! (rolled 17{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''} = 12)").
// Both branches now print the shared self-reconciling equation
// `rolled R + B = T vs DC D` via saveEquationText (AreaEffectSaveFlow.utils.js),
// the established pattern SaveAttackAoeModal/ElementalAttunementModal ride since
// bug-spell-results-face-save-total-contradicts-saved-verdict. Pinned on BOTH
// faces at opposite-sign seams (mirror of SaveAttackAoeModal.results-face-equation):
//   · overlay-lane processing face (AOEConditionModal.jsx renderBody) — the
//     leaked-source branch — via the contract-stubbed base (overlay.test.jsx
//     harness): SAVED with a positive bonus + FAILED with a negative one.
//   · selection-lane ResultsSummaryModal (AOEConditionModal.subcomponents.jsx) —
//     the same hand-rolled family (string-concat twin, bare `(rolled R = T)`
//     that could never be reconciled against the announced DC) — now byte-equal
//     equation copy.
// Machine truth stays untouched: the save_result log rows keep their own
// `rolled R + B = T` description bytes; only the face copy changed.

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules (data seams only — honest NPC save semantics) ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

// SP-024 clock seam stays inert here (expiry CONTENT is expiry.test.jsx's lane).
vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Contract stub of the base (overlay.test.jsx harness): captures the forwarded
// props so renderBody(ctx) — the ONLY executable route to the overlay-lane row
// branch — can be driven with the base-populated ctx.
const { overlayHarness } = vi.hoisted(() => ({
    overlayHarness: { props: null, ctx: null },
}));

vi.mock('./AreaEffectTargetModalBase.jsx', () => ({
    default: function MockAreaEffectTargetModalBase(props) {
        overlayHarness.props = props;
        return (
            <div data-testid="area-effect-target-modal-base">
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
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';

// ── Fixtures ──

const campaignName = 'test-campaign';

const basePlayerStats = { name: 'Wizard1', level: 10, proficiency: 4 };
const baseAction = { name: 'Entangling Weeds' };

// saveBonuses keys are lowercase by contract (resolveNpcTarget lookup rides
// normalizeSaveType(saveType).toLowerCase()).
const combatSummary = {
    creatures: [
        { name: 'Goblin Wretch', type: 'npc', currentHp: 7, maxHp: 7, saveBonuses: { con: -5 } },
        { name: 'Orc Hero', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { con: 5 } },
    ],
};

const baseEffects = [{ type: 'restrained', condition: 'restrained' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 13,
        effects: baseEffects,
        conditionLabel: 'Restrained',
        duration: 'Concentration, up to 1 minute',
        onClose: vi.fn(),
        ...overrides,
    };
}

function overlayProps() {
    return makeProps({
        playerStats: { ...basePlayerStats, targetName: 'overlay-123' },
        activeOverlay: { id: 'overlay-123', shape: 'sphere' },
    });
}

// Minimal stand-in for the base's selection context (the ctx the real base
// builds and feeds into handleApplyOverride).
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

// ── RNG stream: resolveNpcTarget draws one Math.random per NPC save (no
// disadvantage) — a constant 0.82 lands every d20 at floor(0.82*20)+1 = 17:
//   Goblin Wretch: 17 + -5 = 12 < DC 13 → FAILED (negative bonus, mirror of
//     the SaveAttackAoe FAILED seam — the pre-fix face printed the raw source
//     where the sign term should be).
//   Orc Hero:      17 + 5  = 22 ≥ DC 13 → SAVED (positive bonus).

let randomSpy;

beforeEach(() => {
    vi.clearAllMocks();
    overlayHarness.props = null;
    overlayHarness.ctx = null;
    getCombatSummary.mockReturnValue(combatSummary);
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.82);
});

afterEach(() => randomSpy.mockRestore());

const EXPECTED_SAVE_ROW = 'Orc Hero: Saved — unaffected (rolled 17 + 5 = 22 vs DC 13)';
const EXPECTED_FAIL_ROW = 'Goblin Wretch: Failed — Restrained! (rolled 17 + -5 = 12 vs DC 13)';
const LEAKED_SOURCE = "{r.saveBonus !== 0 ? ' +' + r.saveBonus : ''}";

describe('AOEConditionModal — save faces print the reconciled equation, never raw source', () => {
    it('overlay-lane processing face renders both equations with real numbers and zero leaked source text', async () => {
        render(<AOEConditionModal {...overlayProps()} />);
        const ctx = makeCtx(['Goblin Wretch', 'Orc Hero']);
        overlayHarness.ctx = ctx;

        await act(async () => {
            fireEvent.click(screen.getByTestId('apply-btn'));
        });

        // NPC saves auto-resolved synchronously into the base ctx: one fail, one save.
        expect(ctx.results.map(r => r.success)).toEqual([false, true]);

        Object.assign(ctx, { processing: true, allResolved: true });
        render(<div>{overlayHarness.props.renderBody(ctx)}</div>);

        const rows = [...document.querySelectorAll('.abjure-results-list .abjure-result')].map(r => r.textContent);
        expect(rows).toContain(EXPECTED_SAVE_ROW);
        expect(rows).toContain(EXPECTED_FAIL_ROW);
        expect(document.body.textContent).not.toContain(LEAKED_SOURCE);
        expect(document.body.textContent).not.toContain('(rolled 17 = ');
    });

    it('selection-lane ResultsSummaryModal renders the same reconciled equations on both verdicts', async () => {
        render(<AOEConditionModal {...makeProps()} />);
        const check = name => [...document.querySelectorAll('.secondary-target-row')]
            .find(r => r.textContent.includes(name)).querySelector('input[type="checkbox"]');
        fireEvent.click(check('Goblin Wretch'));
        fireEvent.click(check('Orc Hero'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Entangling Weeds/ }));
        });

        await waitFor(() => expect(document.body.textContent).toMatch(/1 target saved, 1 target failed/));
        const rows = [...document.querySelectorAll('.abjure-results-list .abjure-result')].map(r => r.textContent);
        expect(rows).toContain(EXPECTED_SAVE_ROW);
        expect(rows).toContain(EXPECTED_FAIL_ROW);
        expect(document.body.textContent).not.toContain(LEAKED_SOURCE);
        // The legacy bare equation with no DC (never reconcilable against the
        // announced DC — the pre-fix ResultsSummaryModal face) must not return.
        expect(document.body.textContent).not.toContain('(rolled 17 + -5 = 12)');
        expect(document.body.textContent).not.toContain('(rolled 17 + 5 = 22)');
    });

    it('machine truth is display-only changed: save_result log rows keep their own description bytes', async () => {
        render(<AOEConditionModal {...makeProps()} />);
        const check = name => [...document.querySelectorAll('.secondary-target-row')]
            .find(r => r.textContent.includes(name)).querySelector('input[type="checkbox"]');
        fireEvent.click(check('Goblin Wretch'));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Entangling Weeds/ }));
        });

        await waitFor(() => expect(document.body.textContent).toMatch(/0 targets saved, 1 target failed/));
        const saveRows = addEntry.mock.calls.map(c => c[1]).filter(e => e && e.type === 'save_result');
        expect(saveRows).toHaveLength(1);
        expect(saveRows[0]).toMatchObject({
            targetName: 'Goblin Wretch',
            success: false,
            roll: 17,
            saveBonus: -5,
            total: 12,
            description: 'Goblin Wretch failed CON save (DC 13, rolled 17 + -5 = 12)',
        });
    });
});
