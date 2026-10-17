/**
 * ElementalAttunementModal — PHASE-FLOW lane (the element→targets→processing→summary→close
 * state machine, proven through observable UI: each transition asserts the previous phase's
 * controls are GONE, so a stuck or skipped phase fails here, not silently.
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx  — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as rendered: exact picker
 *                                labels/icons, verbatim selection description/note per element.
 * - .test.jsx (main)          — element-phase header/instruction text, Cancel button, skip/cancel.
 * - .npc-save.test.jsx        — NPC save math, live store writes, exact log rows, persistAndNotify
 *                                order, exact summary result-line text, Thunder dead-code pin.
 * - .player-save.test.jsx     — save prompt payloads, save-result event handling, listener lifecycle.
 * - .summary.test.jsx         — onClose invocation on Close, expiration log DESCRIPTION variants.
 * - .deactivation.test.jsx    — handleResultsClose commit payloads, §39 single-clock order,
 *                                double-commit defect pin (payload side), inertness.
 * This lane owns ONLY the transitions: the full chain in one test with previous-control-gone
 * checks at every seam, the exact processing-phase line (save type + DC, which is DC MATH —
 * owned here), the map-overlay loading seam, the overlay click-to-close guard, the stuck-phase
 * pins (no-combat-summary, zero-target overlay), the pending→summary gate, and the commit seam
 * as seen by the UI (does the modal render null after Close?).
 *
 * TRIMMED (subsumed by .elemental-data.test.jsx, per its header :41-42): "passes correct save
 * type to CreatureSelectionModal per element" and the two "element-specific notes" toContain
 * tests — the elemental-data lane pins those description/note strings byte-exact per element,
 * so fragment-matching here only weakens the same contract. The target-count/selection-content
 * evidence is likewise exact-pinned there; this lane keeps only the selection-appears/picker-
 * gone transition.
 *
 * FLAG (cross-note, owned by .deactivation.test.jsx:309-333): the component does NOT render
 * null after commit — the auto-summary effect (jsx:364-368, `!phase.startsWith('summary')` also
 * matches 'done') flips 'done' back to 'summary', so the summary and its Close button SURVIVE
 * onClose(). The commit-seam test below pins that surviving-summary UI; the duplicate-clock
 * payload consequence is pinned in the deactivation lane.
 * FLAG (this lane): zero-target overlay resolve strands the modal in 'processing' forever —
 * the resolve effect requires selectedTargets.size > 0, so no Close and no summary ever appear.
 * Pinned below; product fix: auto-advance (or surface a Cancel) when the overlay hits nothing.
 *
 * Anti-vacuity: live runtime store (commit lands on cells, inspected directly); ONE frozen
 * fixture per scenario handed back by identity; exact full-line phase text; role-scoped
 * queries; Math.random pinned (d20 = floor(r*20)+1 = 11); fresh vi.fn onClose per render;
 * mockReset + re-arm per test; findBy idiom; no bare setTimeout, no wall-clock waits.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Live runtime store (anti-vacuous): the commit flags must LAND, not just be called ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
    const cells = new Map();
    const read = (key, prop) => cells.get(`${key}|${prop}`) ?? null;
    const write = (key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); };
    return {
        cells,
        getRuntimeValue: vi.fn(read),
        setRuntimeValue: vi.fn(write),
    };
});

// ── Mocks ──

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
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

const { cells } = runtime;

// ── Fixtures (frozen — the component may not mutate its inputs) ──

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';
const OVERLAY = Object.freeze({ type: 'sphere' });

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

// Same-object identity per scenario: every getCombatSummary read returns THIS fixture.
const goblinFixture = Object.freeze({
    creatures: Object.freeze([
        Object.freeze({ name: 'Goblin1', type: 'npc', currentHp: 7, maxHp: 7, saveBonuses: Object.freeze({ dex: 2 }), resistances: Object.freeze([]), immunities: Object.freeze([]) }),
    ]),
});
const pairFixture = Object.freeze({
    creatures: Object.freeze([
        goblinFixture.creatures[0],
        Object.freeze({ name: 'Goblin2', type: 'npc', currentHp: 6, maxHp: 6, saveBonuses: Object.freeze({ dex: 0 }), resistances: Object.freeze([]), immunities: Object.freeze([]) }),
    ]),
});
const playerFixture = Object.freeze({
    creatures: Object.freeze([
        Object.freeze({ name: 'Player1', type: 'player', currentHp: 10, maxHp: 10, saveBonuses: Object.freeze({ dex: 3 }), resistances: Object.freeze([]), immunities: Object.freeze([]) }),
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
    cells.clear();
    vi.restoreAllMocks();
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    savePromptService.sendSavePrompt.mockReset();
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    mapsService.loadMapData.mockReset().mockResolvedValue(null);
});

beforeEach(() => {
    // Deterministic NPC d20: floor(0.5*20)+1 = 11 (+dex 2 = 13 >= DC 12 → success; +dex 0 → fail).
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    combatData.getCombatSummary.mockReturnValue(goblinFixture);
});

// ── Tests ──

describe('ElementalAttunementModal phase flow', () => {

    describe('full chain element→selection→processing→summary→close', () => {
        it('walks the whole state machine in order — every transition removes the previous phase\'s controls', async () => {
            combatData.getCombatSummary.mockReturnValue(pairFixture);
            const props = makeProps();
            render(<ElementalAttunementModal {...props} />);

            // PHASE 1 'element': picker + instruction + Cancel are live.
            expect(screen.getByText('Choose the element for your manifestation:')).toBeInTheDocument();
            const fireBtn = screen.getByRole('button', { name: /^Fire/ });

            // TRANSITION element→creatureSelection (no overlay: synchronous enumeration of the summary).
            fireEvent.click(fireBtn);
            expect(await screen.findByTestId('creature-selection-modal')).toBeInTheDocument();
            // Previous phase's controls are GONE — the picker cannot coexist with selection.
            expect(screen.queryByRole('button', { name: /^Cold/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /^Fire/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /^Lightning/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /^Thunder/ })).not.toBeInTheDocument();
            expect(screen.queryByText('Choose the element for your manifestation:')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
            // Identity: the enumeration consumed the frozen fixture.
            expect(screen.getByTestId('cs-modal-target-count').textContent).toBe('2');
            expect(combatData.getCombatSummary.mock.results[0].value).toBe(pairFixture);

            // TRANSITION creatureSelection→processing on Activate.
            fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
            expect(await screen.findByText('Resolving DEX saving throws (DC 12)...')).toBeInTheDocument();
            expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();

            // TRANSITION processing→summary once both NPCs resolve.
            const summaryHeader = await screen.findByText('Elemental Attunement (Fire) — Results');
            expect(summaryHeader).toBeInTheDocument();
            expect(screen.getByText('Save DC 12 DEX')).toBeInTheDocument();
            // Previous phase's controls are GONE.
            expect(screen.queryByText('Resolving DEX saving throws (DC 12)...')).not.toBeInTheDocument();
            expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
            // Both fixture targets surfaced as result rows in the summary.
            const resultLines = document.querySelectorAll('.aoe-results > div');
            expect(resultLines).toHaveLength(2);
            expect(resultLines[0]).toHaveTextContent('Goblin1');
            expect(resultLines[1]).toHaveTextContent('Goblin2');

            // TRANSITION summary→close: onClose fires exactly once per tap.
            fireEvent.click(screen.getByRole('button', { name: /Close/ }));
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it('Close commits through the LIVE store, then FLAG: the modal does NOT render null — summary and Close survive onClose (see .deactivation.test.jsx:309)', async () => {
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: goblinFixture.creatures[0] }]);
            const props = makeProps({ activeOverlay: OVERLAY });
            render(<ElementalAttunementModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
            const closeBtn = await screen.findByRole('button', { name: /Close/ });

            fireEvent.click(closeBtn);

            // The commit is real: activation flags land in the live store.
            expect(cells.get(`${PLAYER}|elementalAttunementActive`)).toBe(true);
            expect(cells.get(`${PLAYER}|elementalAttunementElement`)).toBe('Fire');
            expect(props.onClose).toHaveBeenCalledTimes(1);

            // PINNED SURVIVING BEHAVIOR (not the recommended null): the auto-summary effect
            // (jsx:364-368) flips 'done' back to 'summary' instantly, so the results view and
            // its Close button remain mounted after the parent was told to close. The
            // deactivation lane pins the duplicate-clock consequence of a second tap.
            expect(screen.getByText('Elemental Attunement (Fire) — Results')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
        });
    });

    describe('processing→summary seam', () => {
        it('auto-advances processing→summary with NO user interaction once the overlay resolves', async () => {
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: goblinFixture.creatures[0] }]);
            const props = makeProps({ activeOverlay: OVERLAY });
            render(<ElementalAttunementModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

            // No Activate, no keyboard — the pendingPrompts===0 && results>0 effect alone flips
            // the phase. By the time the summary surfaces, the transient processing-complete note
            // ("All targets resolved.") is retired with its phase (volatile flush frame, so the
            // note itself is only pinned by its ABSENCE here).
            expect(await screen.findByText('Elemental Attunement (Fire) — Results')).toBeInTheDocument();
            expect(screen.queryByText('Resolving DEX saving throws (DC 12)...')).not.toBeInTheDocument();
            expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('summary stays behind the pending gate while a player save is outstanding, and opens the moment it resolves', async () => {
            combatData.getCombatSummary.mockReturnValue(playerFixture);
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: playerFixture.creatures[0] }]);
            const props = makeProps({ activeOverlay: OVERLAY });
            render(<ElementalAttunementModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

            // Pending: exact waiting row, no summary, no escape hatch while gated.
            expect(await screen.findByText('Waiting for save roll...', { selector: 'em' })).toBeInTheDocument();
            expect(document.querySelector('.abjure-result-pending')).toHaveTextContent('Player1: Waiting for save roll...');
            expect(screen.queryByText('Elemental Attunement (Fire) — Results')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();

            // Resolve the ONE prompt the component actually sent (identity of its own promptId).
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
            const [promptCampaign, prompt] = savePromptService.sendSavePrompt.mock.calls[0];
            expect(promptCampaign).toBe(CAMPAIGN);
            expect(prompt.targetName).toBe('Player1');

            fireEvent(window, new CustomEvent('save-result', {
                detail: { promptId: prompt.promptId, roll: 20, total: 23, saveBonus: 3, success: true },
            }));

            // Last prompt cleared → summary phase raises, pending row is gone.
            expect(await screen.findByText('Elemental Attunement (Fire) — Results')).toBeInTheDocument();
            expect(screen.queryByText('Waiting for save roll...', { selector: 'em' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
        });

        it('processing overlay click cannot close the modal mid-resolution', async () => {
            combatData.getCombatSummary.mockReturnValue(playerFixture);
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: playerFixture.creatures[0] }]);
            const props = makeProps({ activeOverlay: OVERLAY });
            render(<ElementalAttunementModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
            expect(await screen.findByText('Waiting for save roll...', { selector: 'em' })).toBeInTheDocument();

            fireEvent.click(document.querySelector('.sp-overlay'));

            expect(props.onClose).not.toHaveBeenCalled();
            // Still exactly the processing phase — nothing advanced, nothing closed.
            expect(screen.getByText('Resolving DEX saving throws (DC 12)...')).toBeInTheDocument();
            expect(document.querySelector('.abjure-result-pending')).toHaveTextContent('Player1: Waiting for save roll...');
        });

        it('FLAG: an overlay that affects nobody strands the modal in processing — no results, no note, no Close, zero logs', async () => {
            aoeService.getAffectedCreatures.mockReturnValue([]);
            const props = makeProps({ activeOverlay: OVERLAY });
            render(<ElementalAttunementModal {...props} />);
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

            // Targets empty → resolve effect never fires (needs selectedTargets.size > 0).
            expect(await screen.findByText('Resolving DEX saving throws (DC 12)...')).toBeInTheDocument();
            expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
            expect(screen.queryByText('Elemental Attunement (Fire) — Results')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Close/ })).not.toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
            expect(document.querySelectorAll('.abjure-results > div')).toHaveLength(0);
            // Nothing actually happened under the hood — anti-echo: zero logs, zero persists.
            expect(logService.addEntry).not.toHaveBeenCalled();
        });
    });

    describe('processing-phase DC math and save type', () => {
        const wis = bonus => Object.freeze({ name: 'Wisdom', bonus });

        it.each([
            { label: 'default Wisdom 1 + proficiency 3', element: 'Fire', abilities: basePlayerStats.abilities, proficiency: 3, line: 'Resolving DEX saving throws (DC 12)...' },
            { label: 'Thunder routes a CON save at the same DC', element: 'Thunder', abilities: basePlayerStats.abilities, proficiency: 3, line: 'Resolving CON saving throws (DC 12)...' },
            { label: 'Wisdom 5 raises the DC to 16', element: 'Fire', abilities: Object.freeze([wis(5)]), proficiency: 3, line: 'Resolving DEX saving throws (DC 16)...' },
            { label: 'proficiency 5 raises the DC to 14', element: 'Fire', abilities: Object.freeze([wis(1)]), proficiency: 5, line: 'Resolving DEX saving throws (DC 14)...' },
            { label: 'missing Wisdom defaults its bonus to 0', element: 'Fire', abilities: Object.freeze([Object.freeze({ name: 'Strength', bonus: 2 })]), proficiency: 3, line: 'Resolving DEX saving throws (DC 11)...' },
            { label: 'undefined abilities default to DC 11', element: 'Fire', abilities: undefined, proficiency: 3, line: 'Resolving DEX saving throws (DC 11)...' },
            { label: 'empty abilities default to DC 11', element: 'Fire', abilities: Object.freeze([]), proficiency: 3, line: 'Resolving DEX saving throws (DC 11)...' },
        ])('processing line is exact for $label', async ({ element, abilities, proficiency, line }) => {
            const playerStats = Object.freeze({ ...basePlayerStats, abilities, proficiency });
            // Player target holds the modal in 'processing' behind the pending-save gate, so
            // the processing view renders STABLY — no race against the auto-summary flip frame.
            combatData.getCombatSummary.mockReturnValue(playerFixture);
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: playerFixture.creatures[0] }]);
            renderModal({ activeOverlay: OVERLAY, playerStats });
            fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${element}`) }));

            // Exact full processing line — the DC math rendered, not a /DC \\d+/ fragment.
            expect(await screen.findByText(line)).toBeInTheDocument();
            expect(screen.getByText('Waiting for save roll...', { selector: 'em' })).toBeInTheDocument();
        });
    });

    describe('map-overlay loading seam', () => {
        it('loads map data by exact campaign+name and drives the resolved map targets into processing', async () => {
            const mapData = Object.freeze({
                players: Object.freeze([Object.freeze({ name: 'Player1', gridX: 5, gridY: 5 })]),
                placedItems: Object.freeze([]),
            });
            combatData.getCombatSummary.mockReturnValue(playerFixture);
            mapsService.loadMapData.mockResolvedValue(mapData);
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: playerFixture.creatures[0] }]);
            renderModal({ mapName: 'test-map', activeOverlay: OVERLAY });
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

            expect(await screen.findByText('Waiting for save roll...', { selector: 'em' })).toBeInTheDocument();
            expect(document.querySelector('.abjure-result-pending')).toHaveTextContent('Player1: Waiting for save roll...');
            expect(mapsService.loadMapData).toHaveBeenCalledWith(CAMPAIGN, 'test-map');
            // The AOE consumed the LOADED map object's players, not an empty default.
            expect(aoeService.getAffectedCreatures).toHaveBeenCalledWith(OVERLAY, mapData.players, [], playerFixture);
        });

        it('skips map loading entirely when no mapName and proceeds straight to the summary', async () => {
            aoeService.getAffectedCreatures.mockReturnValue([{ creature: goblinFixture.creatures[0] }]);
            renderModal({ activeOverlay: OVERLAY });
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

            expect(await screen.findByText('Elemental Attunement (Fire) — Results')).toBeInTheDocument();
            expect(mapsService.loadMapData).not.toHaveBeenCalled();
            // No-map path enumerates against empty player/item lists.
            expect(aoeService.getAffectedCreatures).toHaveBeenCalledWith(OVERLAY, [], [], goblinFixture);
        });
    });

    describe('targets phase without a combat summary', () => {
        it('choosing an element with no combat summary strands the modal — picker gone, nothing renders, onClose never fires', async () => {
            combatData.getCombatSummary.mockReturnValue(null);
            const props = makeProps();
            const { container } = render(<ElementalAttunementModal {...props} />);

            expect(screen.getByText('Choose the element for your manifestation:')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));

            // 'targets' effect bails on the null summary; the fallback render is null.
            expect(screen.queryByText('Choose the element for your manifestation:')).not.toBeInTheDocument();
            expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
            expect(screen.queryByText('Resolving DEX saving throws (DC 12)...')).not.toBeInTheDocument();
            expect(container.textContent).toBe('');
            expect(props.onClose).not.toHaveBeenCalled();
        });
    });
});
