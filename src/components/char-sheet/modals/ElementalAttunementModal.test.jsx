// @maintained-by-ai
/**
 * ElementalAttunementModal — MAIN lane: mount contract, open/close basics, props pass-through.
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as RENDERED: exact picker
 *                              labels/icons/order, verbatim selection description/note per
 *                              element, picker inertness. Subsumes this file's retired
 *                              "renders all four elemental buttons with their descriptions"
 *                              regex fragments (flagged there at :40-42).
 * - .phase-flow.test.jsx     — element→targets→processing→summary transitions, DC math,
 *                              map-overlay loading, processing overlay click-to-close guard,
 *                              stranding pins, commit-seam UI.
 * - .npc-save.test.jsx       — NPC save resolution, runtime condition writes, log content,
 *                              persistAndNotify.
 * - .player-save.test.jsx    — save prompts, save-result event handling, listener lifecycle.
 * - .summary.test.jsx        — onClose invocation on Close, expiration log DESCRIPTION variants.
 * - .deactivation.test.jsx   — handleResultsClose commit payloads, §39 single-clock order,
 *                              double-commit defect pin, inertness on cancel/skip/overlay/unmount.
 * - .error-handling.test.jsx — addEntry/loadMapData/addExpiration rejection survival.
 *
 * DELETED (subsumed by siblings, per family ownership): "renders all four elemental buttons
 * with their descriptions" (regex fragments → .elemental-data exact full-line pins); the
 * standalone "renders the Cancel button" (folded into the mount-contract test); processing
 * overlay guard lives only in .phase-flow (element-phase click guard stays here).
 *
 * FLAG (component, cross-note — also .deactivation.test.jsx:25, .elemental-data.test.jsx:31):
 * - ElementalAttunementModal.jsx:579-603,653 — inline styles in the element picker and the
 *   "All targets resolved" note violate the no-inline-styles house rule.
 *
 * Anti-vacuity: frozen fixtures handed back BY IDENTITY at the selection seam (the skip test
 * proves the component consumed the seeded summary, not a mock default); exact full-line text;
 * role-scoped queries; fresh vi.fn onClose per render (props pass-through asserted on THAT
 * function's identity); mount purity proven with an addEventListener spy plus zero-call
 * assertions on every service; mockReset + re-arm per test; findBy idiom; no bare setTimeout.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Mocks ──

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(() => []),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./shared/AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
    default: vi.fn(({ title, icon, targets, description, note, confirmLabel, confirmIcon: _ci, onConfirm, onSkip }) => (
        <div className="sp-overlay" onClick={onSkip}>
            <div className="sp-modal" onClick={e => e.stopPropagation()}>
                <div data-testid="creature-selection-modal">
                    <span data-testid="cs-modal-title">{title}</span>
                    <span data-testid="cs-modal-icon">{icon}</span>
                    <span data-testid="cs-modal-target-count">{targets.length}</span>
                    {description && <div data-testid="cs-modal-description" dangerouslySetInnerHTML={{ __html: description }} />}
                    {note && <div data-testid="cs-modal-note" dangerouslySetInnerHTML={{ __html: note }} />}
                    <button data-testid="cs-confirm-btn" onClick={() => onConfirm(targets.map(t => t.name))} disabled={targets.length === 0}>
                        {confirmLabel || 'Confirm'}
                    </button>
                    <button data-testid="cs-skip-btn" onClick={onSkip}>Skip</button>
                </div>
            </div>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as baseUtils from './shared/AreaEffectTargetModalBase.utils.jsx';

// ── Fixtures (frozen — the component may not mutate its inputs) ──

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';

const baseAction = Object.freeze({ name: 'Elemental Attunement' });
const basePlayerStats = Object.freeze({
    name: PLAYER,
    level: 5,
    proficiency: 3,
    abilities: Object.freeze([
        Object.freeze({ name: 'Strength', bonus: 2 }),
        Object.freeze({ name: 'Dexterity', bonus: 4 }),
        Object.freeze({ name: 'Constitution', bonus: 1 }),
        Object.freeze({ name: 'Intelligence', bonus: 0 }),
        Object.freeze({ name: 'Wisdom', bonus: 1 }),
        Object.freeze({ name: 'Charisma', bonus: 0 }),
    ]),
});

// Same-object identity: the targets-phase enumeration must hand back THIS fixture.
const selectionFixture = Object.freeze({
    creatures: Object.freeze([
        Object.freeze({ name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7, saveBonuses: Object.freeze({ dex: 2 }), resistances: Object.freeze([]), immunities: Object.freeze([]) }),
    ]),
});

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        ...overrides,
    };
}

function renderModal(props = {}) {
    return render(<ElementalAttunementModal {...makeProps(props)} />);
}

// ── House lifecycle: cleanup + mockReset (not clearAllMocks) + re-arm defaults ──

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    runtime.getRuntimeValue.mockReset().mockReturnValue(null);
    runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
    savePromptService.sendSavePrompt.mockReset();
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    mapsService.loadMapData.mockReset().mockResolvedValue(null);
    expirations.addExpiration.mockReset();
    baseUtils.persistAndNotify.mockReset();
});

// ── Tests ──

describe('ElementalAttunementModal mount contract and open/close', () => {

    it('mounts on the element phase — exact header, instruction and Cancel; no later phase renders without a choice', () => {
        renderModal();
        expect(screen.getByText('Elemental Attunement')).toBeInTheDocument();
        expect(screen.getByText('Choose the element for your manifestation:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        // The element phase is the ONLY phase reachable before a choice is made.
        expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        expect(screen.queryByText('Resolving DEX saving throws (DC 12)...')).not.toBeInTheDocument();
        expect(screen.queryByText('Elemental Attunement (Fire) — Results')).not.toBeInTheDocument();
    });

    it('mount is pure — zero service calls and zero save-result listeners armed before any choice', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        renderModal();
        expect(addSpy).not.toHaveBeenCalledWith('save-result', expect.any(Function));
        expect(combatData.getCombatSummary).not.toHaveBeenCalled();
        expect(mapsService.loadMapData).not.toHaveBeenCalled();
        expect(aoeService.getAffectedCreatures).not.toHaveBeenCalled();
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(runtime.getRuntimeValue).not.toHaveBeenCalled();
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(baseUtils.persistAndNotify).not.toHaveBeenCalled();
    });

    it.each([
        { target: 'overlay', selector: '.sp-overlay' },
        { target: 'modal content', selector: '.sp-modal' },
    ])('clicking the $target cannot dismiss the element phase', ({ selector }) => {
        const props = makeProps();
        render(<ElementalAttunementModal {...props} />);
        fireEvent.click(document.querySelector(selector));
        expect(props.onClose).not.toHaveBeenCalled();
        // Still exactly the element phase — nothing advanced, nothing closed.
        expect(screen.getByText('Choose the element for your manifestation:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('Cancel invokes the onClose prop exactly once and never touches a service', () => {
        const props = makeProps();
        render(<ElementalAttunementModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        // Cancelling at the picker commits nothing anywhere.
        expect(combatData.getCombatSummary).not.toHaveBeenCalled();
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(baseUtils.persistAndNotify).not.toHaveBeenCalled();
    });

    it('Skip in creature selection invokes onClose once, consuming the campaign prop but committing nothing', async () => {
        combatData.getCombatSummary.mockReturnValue(selectionFixture);
        const props = makeProps();
        render(<ElementalAttunementModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
        const skipBtn = await screen.findByTestId('cs-skip-btn');

        // Props pass-through: enumeration ran against THIS campaign and consumed THIS frozen
        // fixture by identity — the selection view is real, not a mock default.
        expect(combatData.getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
        expect(combatData.getCombatSummary.mock.results[0].value).toBe(selectionFixture);

        fireEvent.click(skipBtn);
        expect(props.onClose).toHaveBeenCalledTimes(1);
        // Skip resolves nothing: no dice, no prompts, no store writes, no logs, no persist.
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
        expect(baseUtils.persistAndNotify).not.toHaveBeenCalled();
    });
});
