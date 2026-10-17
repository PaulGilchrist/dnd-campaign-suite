// @maintained-by-ai
/**
 * ElementalAttunementModal — ELEMENTAL DATA presentation lane.
 *
 * Ownership map (siblings, do not duplicate here):
 * - (this file)            — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as RENDERED: exact picker labels,
 *                           descriptions, icons, fixed picker order, verbatim propagation of
 *                           saveType/damage/damageType/half-on-save copy into the creature-selection
 *                           seam, and behavioral non-mutation of the picker across a full cycle.
 * - .test.jsx (main)       — element-phase header/instruction text, Cancel button + cancel/skip.
 * - .phase-flow.test.jsx   — element→targets→processing→summary transitions, DC math,
 *                            map-overlay loading, processing overlay click-to-close guard.
 * - .npc-save.test.jsx     — NPC save resolution, runtime condition writes, log content, persistAndNotify.
 * - .player-save.test.jsx  — save prompts, save-result event handling, listener lifecycle.
 * - .summary.test.jsx      — onClose invocation, expiration log DESCRIPTION text variants.
 * - .error-handling.test.jsx — addEntry/loadMapData/addExpiration rejection survival.
 * - .deactivation.test.jsx — handleResultsClose commit payloads, §39 single-clock order,
 *                            double-commit defect pin, inertness.
 *
 * Anti-vacuity: every value below is asserted against the DOM as exact full-line text —
 * nothing here can pass on a count, a `toContain` fragment, or a mock echoing its own fixture.
 * getCombatSummary hands back ONE frozen fixture by identity; the rendered target count proves
 * the component actually consumed it. This lane never rolls dice (picker→selection only), so no
 * Math.random seam is involved and no timers are permitted or needed.
 *
 * DELETED (subsumed here): the two prior tests — "exports exactly 4 elements" (text list +
 * .sp-roll-btn count) is subsumed by the exact ordered-label+icon test; "element data is not
 * mutated by rendering" (bare setTimeout + count-equality, vacuous even when the module mutated)
 * is replaced by a byte-compare of the picker text across a full selection cycle.
 *
 * FLAG (component, not fixed here):
 * - ElementalAttunementModal.jsx:579-603,653 — inline styles in the element picker and the
 *   "All targets resolved" note violate the no-inline-styles house rule (deactivation lane flags
 *   the same lines).
 * - ElementalAttunementModal.jsx:14-59 — ELEMENT_DESCRIPTIONS restates structured ELEMENT_DATA
 *   fields (radius, save type, die, damage type) as prose; the two can silently drift.
 *   Product fix: generate descriptions from ELEMENT_DATA.
 * - ElementalAttunementModal.jsx:55-58 vs :124/:301 — Cold prose hardcodes "speed reduced by
 *   15 ft."/"Speed reduced by 15 ft." duplicating effectValue:'15'; Thunder prose hardcodes
 *   "pushed 10 ft." duplicating effectValue:'10'. Same drift risk.
 * - Cross-file: .test.jsx "renders all four elemental buttons with their descriptions" (regex
 *   fragments) and .phase-flow "passes correct save type..." / "shows element-specific notes..."
 *   (toContain) are now exact-supersetted by this lane and can be trimmed there.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import * as combatData from '../../../services/encounters/combatData.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as logService from '../../../services/ui/logService.js';
import * as runtime from '../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures (frozen — the component may not mutate its inputs) ──

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';
// 8 + Wisdom(1) + proficiency(3) — DC math itself is owned by .phase-flow.test.jsx.
const SAVE_DC = 12;

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

// Same-object identity: every getCombatSummary read returns THIS frozen fixture; the
// rendered target count (2) proves the selection seam consumed it, not a mock default.
const combatFixture = Object.freeze({
    creatures: Object.freeze([
        Object.freeze({ name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7, saveBonuses: Object.freeze({ dex: 2 }), resistances: Object.freeze([]), immunities: Object.freeze([]) }),
        Object.freeze({ name: 'Goblin2', type: 'npc', currentHp: 6, maxHp: 6, saveBonuses: Object.freeze({ dex: 0 }), resistances: Object.freeze([]), immunities: Object.freeze([]) }),
    ]),
});

// The rendered contract per element: picker label + icon + full description line, then the
// exact creature-selection description/note the same element's data must produce downstream.
const ELEMENT_TABLE = Object.freeze([
    {
        name: 'Cold',
        icon: 'fa-snowflake',
        description: '5-ft radius area of extreme cold. Dexterity save or speed reduced by 15 ft.',
        saveType: 'DEX',
        note: 'On a failed save, target suffers the Cold effect.',
    },
    {
        name: 'Fire',
        icon: 'fa-fire',
        description: '5-ft radius flames. Dexterity save or 1d10 fire damage (half on save).',
        saveType: 'DEX',
        note: 'On a failed save, target takes 1d10 fire damage. On a successful save, target takes half damage.',
    },
    {
        name: 'Lightning',
        icon: 'fa-bolt',
        description: '60-ft line of lightning. Dexterity save or 1d8 lightning damage (half on save).',
        saveType: 'DEX',
        note: 'On a failed save, target takes 1d8 lightning damage. On a successful save, target takes half damage.',
    },
    {
        name: 'Thunder',
        icon: 'fa-volume-high',
        description: '5-ft radius burst of sonic energy. Constitution save or 1d6 thunder damage (half on save) and pushed 10 ft.',
        saveType: 'CON',
        note: 'On a failed save, target takes 1d6 thunder damage. On a successful save, target takes half damage.',
    },
]);

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

function pickerButtons() {
    return ELEMENT_TABLE.map(el => screen.getByRole('button', { name: `${el.name} ${el.description}` }));
}

function pickerTexts() {
    return pickerButtons().map(btn => btn.textContent);
}

// House rule: mockReset (not clearAllMocks) + re-arm defaults per test.
afterEach(() => {
    cleanup();
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    runtime.getRuntimeValue.mockReset().mockReturnValue(null);
    runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
});

beforeEach(() => {
    combatData.getCombatSummary.mockReturnValue(combatFixture);
});

// ── Tests ──

describe('ElementalAttunementModal ELEMENT_DATA presentation', () => {

    it.each(ELEMENT_TABLE)('renders the $name picker button with exact icon and full description', ({ name, icon, description }) => {
        renderModal();
        // Role-scoped exact accessible name proves label + description render TOGETHER in one button.
        const btn = screen.getByRole('button', { name: `${name} ${description}` });
        expect(btn).toBeInTheDocument();
        // Exact icon identity on the button's own <i> — the only element-data icon inside it.
        expect(btn.querySelector('i').getAttribute('class')).toBe(`fa-solid ${icon}`);
        // Full-line anti-vacuity: the button body carries label + description byte-exact.
        expect(btn.textContent).toBe(`${name}${description}`);
    });

    it('renders exactly the four elements in fixed Cold→Fire→Lightning→Thunder order with exact icons', () => {
        renderModal();
        expect(pickerButtons()).toHaveLength(4);
        expect(pickerTexts()).toEqual([
            'Cold5-ft radius area of extreme cold. Dexterity save or speed reduced by 15 ft.',
            'Fire5-ft radius flames. Dexterity save or 1d10 fire damage (half on save).',
            'Lightning60-ft line of lightning. Dexterity save or 1d8 lightning damage (half on save).',
            'Thunder5-ft radius burst of sonic energy. Constitution save or 1d6 thunder damage (half on save) and pushed 10 ft.',
        ]);
        // Order is Object.entries(ELEMENT_DATA) insertion order — a reorder is a UI change.
        expect(pickerButtons().map(btn => btn.querySelector('i').getAttribute('class'))).toEqual([
            'fa-solid fa-snowflake',
            'fa-solid fa-fire',
            'fa-solid fa-bolt',
            'fa-solid fa-volume-high',
        ]);
    });

    it.each(ELEMENT_TABLE)('propagates $name data verbatim into creature selection — save type, DC and half-on-save note', ({ name, saveType, note }) => {
        const props = makeProps();
        render(<ElementalAttunementModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));

        // No activeOverlay: selection enumerates the frozen combat summary synchronously.
        const description = screen.getByTestId('cs-modal-description');
        expect(description.textContent).toBe(
            `Select creatures within the ${name} manifestation. Each must make a ${saveType} saving throw (DC ${SAVE_DC}).`
        );
        // The half-on-save "resistance table" as rendered — exact for damage elements,
        // exact effect prose for Cold (never damage prose leaking into Cold).
        expect(screen.getByTestId('cs-modal-note').textContent).toBe(note);
        // Identity: the targets shown ARE the seeded fixture's creatures (2, not a mock default).
        expect(screen.getByTestId('cs-modal-target-count').textContent).toBe('2');
        expect(combatData.getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
        expect(combatData.getCombatSummary.mock.results[0].value).toBe(combatFixture);
    });

    it('picker data survives a full Fire selection cycle byte-identical — module ELEMENT_DATA is inert under render', () => {
        renderModal();
        const before = pickerTexts();
        fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
        expect(screen.getByTestId('creature-selection-modal')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Cold/ })).not.toBeInTheDocument();

        cleanup();
        renderModal();
        // Byte-compare of the full picker body: prose, icon order or count drift fails here.
        expect(pickerTexts()).toEqual(before);
        expect(pickerButtons().map(btn => btn.querySelector('i').getAttribute('class'))).toEqual([
            'fa-solid fa-snowflake',
            'fa-solid fa-fire',
            'fa-solid fa-bolt',
            'fa-solid fa-volume-high',
        ]);
    });
});
