// @maintained-by-ai
/**
 * ElementalAttunementModal — SUMMARY SECTION lane (jsx:661-695 rendering + the Close commit
 * DESCRIPTION variants). This lane owns what only the summary view can show: the per-element
 * summary VARIANT lines (Fire-saved and Cold-failed exact lines are npc-save's; the Cold-saved,
 * Lightning-failed, Thunder-saved and Fire-failed lines — plus the CON DC banner variant — are
 * owned here), multi-target AGGREGATE rows (row order, success/fail className mapping on the
 * summary rows, mixed pass/fail NOT sorted), the mixed NPC+player aggregation (NPCs always land
 * above an awaited player — resolution order, not selection order — pinned as a product note),
 * and onClose invocation on Close + the expiration log DESCRIPTION VARIANTS (custom action names /
 * non-Fire elements; the default Fire expiration payload is deactivation's).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx  — ELEMENT_DATA/ELEMENT_DESCRIPTIONS as rendered, non-mutation.
 * - .test.jsx (main)          — element-phase header/instruction text, Cancel button, skip/cancel.
 * - .phase-flow.test.jsx      — master chain transitions with previous-control-gone checks, DC
 *                               MATH (DC 12 consumed as given), processing-phase exact line, Fire
 *                               'Save DC 12 DEX' banner in transition, pending→summary gate,
 *                               surviving-summary commit seam, zero-target stranding.
 * - .aoe-results exact lines  — pinned in .npc-save/.player-save lanes (single-target exact
 *                               result lines); this lane reuses their numbers ONLY where the pin is
 *                               aggregate ORDER, never to re-pin a lone line.
 * - .npc-save.test.jsx        — NPC save math, live store writes, exact log rows, persistAndNotify
 *                               order, exact single-target 'Saved (d20 19+2 = 21). 1d10 fire…' and
 *                               'Failed (d20 11+-10 = 1) — speed reduced by 15 ft.' summary lines.
 * - .player-save.test.jsx     — prompt payloads, save-result event handling, listener lifecycle,
 *                               double-roll divergence, player rejection lanes (consumed as mechanism).
 * - .deactivation.test.jsx    — handleResultsClose commit payloads, §39 single-clock order,
 *                               duplicate expiration default-Fire log (exact payload at :249-274),
 *                               double-commit defect pin, inertness.
 * - .error-handling.test.jsx  — addEntry/loadMapData/addExpiration rejection survival.
 *
 * FLAG (product note, owned here as the aggregation lane):
 * - ElementalAttunementModal.jsx:672 — summary rows render in results-array order, which is
 *   RESOLUTION order: NPCs (resolved during processing) always appear ABOVE players (appended
 *   when their save-result event lands), regardless of selection order. A player selected first
 *   is listed last. Pinned below; product fix: order rows by selection order if that matters.
 * - ElementalAttunementModal.jsx:563 — expiration description hardcodes 'Elemental Attunement'
 *   even when the action has a custom name; abilityName and description can silently drift.
 *   The renamed-action arm below pins the actual behavior.
 *
 * Anti-vacuity: live runtime store (cells inspected); live applyDamage mutates the ONE by-identity
 * combat fixture so aggregate HP movement is proven on the summary itself; Math.random pinned
 * (d20 = floor(r*20)+1) so every roll total in every exact line is deterministic; Date.now frozen;
 * exact full-line text; exact row className mapping; role-scoped queries; fresh vi.fn onClose per
 * render; mockReset + re-arm per test; findBy idiom; captured promptId dispatched directly; no
 * bare setTimeout, no wall-clock waits.
 */
import { render, screen, fireEvent, cleanup, configure } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// Flake hardening (same mechanism as the registered player-save flake, bugs.md:552): dice here
// are fully pinned (rollExpression mocked, sequential Math.random d20 per case) and forks-pool
// isolation excludes cross-file leaks — the live risk is passive-effect flush starvation vs the
// DEFAULT 1000ms findBy budget. Witnessed RED under contention this window: full modals-slice
// run 4/10, this file 1240ms, 1 failed (gate expired just past its 1s budget). Pin 3000ms
// (3x observed stall, bounded): exact-byte assertions unchanged, patience only.
configure({ asyncUtilTimeout: 3000 });

// ── Live runtime store (anti-vacuous): commits land here, cells inspected directly ──

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

// LIVE applyDamage: mutates the fixture's currentHp so aggregate damage landing on MULTIPLE
// creatures is proven on the summary object itself, not on a call-args echo.
vi.mock('../../../services/rules/combat/applyDamage.js', async (importOriginal) => ({
    ...await importOriginal(),
    computeDamageAfterSave: vi.fn((damage, success, dcSuccess) => {
        if (dcSuccess === 'half') return success ? Math.floor(damage / 2) : damage;
        return damage;
    }),
    computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
    applyDamageToTarget: vi.fn((summary, targetName, damage) => {
        const creature = summary?.creatures?.find(c => c.name === targetName);
        if (creature) creature.currentHp = Math.max(0, creature.currentHp - damage);
    }),
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
    default: vi.fn(({ targets, onConfirm, onSkip }) => (
        <div className="sp-overlay">
            <div className="sp-modal">
                <button onClick={() => onConfirm(targets.map(t => t.name))} disabled={targets.length === 0}>Activate</button>
                <button onClick={onSkip}>Skip</button>
            </div>
        </div>
    )),
}));

// ── Re-import mocked modules ──

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import { persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';

const { cells } = runtime;
const { applyDamageToTarget } = applyDamage;

// ── Fixtures (frozen where the component must not mutate; creature HP stays mutable —
//    the live applyDamage mock moves it) ──

const PLAYER = 'Monk1';
const CAMPAIGN = 'test-campaign';
const OVERLAY = Object.freeze({ type: 'sphere' });
const FROZEN_TS = 1737000000000;

// DC = 8 + WIS 1 + PROF 3 = 12 (DC math owned by .phase-flow — consumed as given here).
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

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        activeOverlay: OVERLAY,
        ...overrides,
    };
}

// ONE summary per test, handed back by identity; the overlay auto-selects in list order,
// so this lane controls aggregate ordering at its source.
function seedCreatures(creatures) {
    const summary = Object.freeze({ creatures: Object.freeze(creatures) });
    combatData.getCombatSummary.mockReturnValue(summary);
    aoeService.getAffectedCreatures.mockReturnValue(summary.creatures.map(c => ({ creature: c })));
    return summary;
}

function npc(name, saveBonuses, currentHp = 7) {
    return { name, type: 'npc', currentHp, maxHp: currentHp, saveBonuses: { dex: -10, con: -10, ...saveBonuses }, resistances: [], immunities: [] };
}

function clickElement(element) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${element}`) }));
}

function summaryRows() {
    return Array.from(document.querySelectorAll('.aoe-results > div'));
}

// Close exists ONLY in the summary phase — finding it gates the transition (owned by .phase-flow;
// consumed here as the entry condition into the summary section).
async function openSummary(element) {
    clickElement(element);
    return screen.findByRole('button', { name: /Close/ });
}

// The expiration log is the ability_use entry whose description carries the expiry sentence;
// any processing ability_use rows (Cold speed-reduction) are filtered OUT, not re-pinned.
function expirationLogCalls() {
    return logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use' && typeof e.description === 'string' && e.description.includes('expires on their next turn.'));
}

// ── Setup / teardown ──

beforeEach(() => {
    // Default d20 = floor(0.5*20)+1 = 11 (fails DC 12 with the -10 default bonuses);
    // arms override with pinned per-scenario values.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});

// House rule: mockReset (not clearAllMocks/resetAllMocks) + re-arm; live cells wiped;
// Math/Date spies restored.
afterEach(() => {
    cleanup();
    cells.clear();
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    const liveApply = applyDamageToTarget.getMockImplementation();
    applyDamageToTarget.mockReset().mockImplementation(liveApply);
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    savePromptService.sendSavePrompt.mockReset();
    persistAndNotify.mockReset();
});

// ── Tests ──

describe('ElementalAttunementModal summary section', () => {
    describe('per-element summary variant lines (the ones npc-save does NOT pin)', () => {
        // Fire-SAVED and Cold-FAILED exact lines are .npc-save's; every arm below is a variant
        // nothing else pins: Cold-saved, Lightning-failed, Thunder-saved (+CON banner), Fire-failed.
        it.each([
            {
                element: 'Cold', saveBonuses: { dex: 2 }, random: 0.9, cls: 'abjure-result-success',
                banner: 'Save DC 12 DEX',
                line: 'Goblin1: Saved (d20 19+2 = 21) — no effect.',
            },
            {
                element: 'Lightning', saveBonuses: { dex: -10 }, random: 0.3, cls: 'abjure-result-fail',
                banner: 'Save DC 12 DEX',
                line: 'Goblin1: Failed (d20 7+-10 = -3). 1d8 lightning: 1d8 [5] = 5 → 5 lightning damage',
            },
            {
                // Thunder routes through the damage template (push is dead code — pinned by
                // .npc-save); the CON save banner VARIANT is owned here.
                element: 'Thunder', saveBonuses: { con: 4 }, random: 0.75, cls: 'abjure-result-success',
                banner: 'Save DC 12 CON',
                line: 'Goblin1: Saved (d20 16+4 = 20). 1d6 thunder: 1d6 [5] = 5 → 2 thunder damage',
            },
            {
                element: 'Fire', saveBonuses: { dex: -1 }, random: 0.05, cls: 'abjure-result-fail',
                banner: 'Save DC 12 DEX',
                line: 'Goblin1: Failed (d20 2+-1 = 1). 1d10 fire: 1d10 [5] = 5 → 5 fire damage',
            },
        ])('$element renders the exact $cls row: $line', async ({ element, saveBonuses, random, cls, banner, line }) => {
            vi.spyOn(Math, 'random').mockReturnValue(random);
            seedCreatures([npc('Goblin1', saveBonuses)]);

            render(<ElementalAttunementModal {...makeProps()} />);
            await openSummary(element);

            expect(screen.getByText(`Elemental Attunement (${element}) — Results`)).toBeInTheDocument();
            expect(screen.getByText(banner)).toBeInTheDocument();
            const rows = summaryRows();
            expect(rows).toHaveLength(1);
            expect(rows[0].className).toBe(cls);
            expect(rows[0].textContent).toBe(line);
            expect(document.querySelector('.abjure-result-pending')).toBeNull();
        });
    });

    describe('multi-target aggregate rows', () => {
        it('renders one row per resolved NPC in SELECTION order, mixed pass/fail unsorted, with exact per-row text and class', async () => {
            // Overlay auto-selects [Goblin1, Goblin2]; the d20 queue consumes Math.random in that
            // same iteration order: Goblin1 0.9 → 19 (19+2 = 21 ≥ 12 SAVED, half = 2),
            // Goblin2 0.05 → 2 (2+-1 = 1 < 12 FAILED, full 5).
            vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.05);
            const summary = seedCreatures([
                npc('Goblin1', { dex: 2 }),
                npc('Goblin2', { dex: -1 }),
            ]);

            render(<ElementalAttunementModal {...makeProps()} />);
            await openSummary('Fire');

            // Aggregate identity: the rows came from THIS frozen by-identity fixture.
            expect(combatData.getCombatSummary.mock.results[0].value).toBe(summary);

            const rows = summaryRows();
            expect(rows.map(r => r.className)).toEqual(['abjure-result-success', 'abjure-result-fail']);
            expect(rows.map(r => r.textContent)).toEqual([
                'Goblin1: Saved (d20 19+2 = 21). 1d10 fire: 1d10 [5] = 5 → 2 fire damage',
                'Goblin2: Failed (d20 2+-1 = 1). 1d10 fire: 1d10 [5] = 5 → 5 fire damage',
            ]);
            // Aggregate damage landed on the LIVE fixture: half on save, full on fail.
            expect(summary.creatures.find(c => c.name === 'Goblin1').currentHp).toBe(5);
            expect(summary.creatures.find(c => c.name === 'Goblin2').currentHp).toBe(2);
        });

        it('FLAG: NPC rows always aggregate ABOVE an awaited player — rows follow resolution order, not selection order', async () => {
            // Selection order is [Player1, Goblin1] (overlay list order, preserved by the Set),
            // but the NPC resolves during processing and the player only lands when its
            // save-result event arrives — so the summary lists Goblin1 FIRST.
            vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.9);
            const player = { name: 'Player1', type: 'player', currentHp: 20, maxHp: 20, saveBonuses: {}, resistances: [], immunities: [] };
            const summary = seedCreatures([player, npc('Goblin1', { dex: 5 })]);

            render(<ElementalAttunementModal {...makeProps()} />);
            clickElement('Fire');

            // Behind the pending gate (mechanism owned by .phase-flow/.player-save): consume it.
            expect(await screen.findByText('Waiting for save roll...', { selector: 'em' })).toBeInTheDocument();
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
            const [promptCampaign, prompt] = savePromptService.sendSavePrompt.mock.calls[0];
            expect(promptCampaign).toBe(CAMPAIGN);
            expect(prompt.targetName).toBe('Player1');

            // Player FAILS with the event's rawDamage echo (8): full damage, no halving.
            fireEvent(window, new CustomEvent('save-result', {
                detail: { promptId: prompt.promptId, roll: 3, total: 5, saveBonus: 2, success: false, rawDamage: 8 },
            }));

            await screen.findByRole('button', { name: /Close/ });

            const rows = summaryRows();
            expect(rows.map(r => r.textContent)).toEqual([
                'Goblin1: Saved (d20 19+5 = 24). 1d10 fire: 1d10 [5] = 5 → 2 fire damage',
                'Player1: Failed (d20 3+2 = 5). 1d10 fire: 1d10 [5] = 8 → 8 fire damage',
            ]);
            expect(rows.map(r => r.className)).toEqual(['abjure-result-success', 'abjure-result-fail']);
            // Aggregate damage on the LIVE fixture: NPC halved on save (7−2), player full on fail (20−8).
            expect(summary.creatures.find(c => c.name === 'Goblin1').currentHp).toBe(5);
            expect(summary.creatures.find(c => c.name === 'Player1').currentHp).toBe(12);
            // The resolved player is retired from the pending list — the aggregate has no ghosts.
            expect(document.querySelector('.abjure-result-pending')).toBeNull();
            // Every read consumed the SAME by-identity fixture (no silent re-fetch mid-aggregate).
            expect(combatData.getCombatSummary.mock.results.every(r => r.value === summary)).toBe(true);
        });
    });

    describe('close from summary — onClose invocation + expiration log DESCRIPTION variants', () => {
        // The DEFAULT Fire expiration payload is .deactivation's (:249-274); these arms own the
        // VARIANTS: non-Fire elements and a custom (renamed) action. Description is BYTE-exact.
        it.each([
            { element: 'Cold', actionName: 'Elemental Attunement' },
            { element: 'Thunder', actionName: 'Elemental Attunement' },
            {
                // FLAG (jsx:563): description hardcodes 'Elemental Attunement' even though
                // abilityName carries the custom action name — the pair can silently drift.
                element: 'Lightning', actionName: 'Storm Soul Manifestation',
            },
        ])('$actionName × $element: Close fires onClose once and logs the exact expiration row', async ({ element, actionName }) => {
            seedCreatures([npc('Goblin1', {})]);
            const props = makeProps({ action: Object.freeze({ name: actionName }) });

            render(<ElementalAttunementModal {...props} />);
            const closeBtn = await openSummary(element);
            fireEvent.click(closeBtn);

            expect(props.onClose).toHaveBeenCalledTimes(1);
            expect(expirationLogCalls()).toEqual([[CAMPAIGN, {
                type: 'ability_use',
                characterName: PLAYER,
                abilityName: actionName,
                description: `${PLAYER}'s <strong>Elemental Attunement (${element})</strong> expires on their next turn.`,
            }]]);
        });
    });
});
