/**
 * ElementalAttunementModal — DEACTIVATION lane (handleResultsClose seam only).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .elemental-data.test.jsx — ELEMENT_DATA structure integrity, non-mutation on render.
 * - .phase-flow.test.jsx     — element→target→processing→summary transitions, DC math,
 *                              map-overlay loading, processing overlay click-to-close guard.
 * - .npc-save.test.jsx       — NPC save resolution (rolls, speed_reduction/push writes on the
 *                              NPC's store, processing 'roll'/'ability_use' log content), persistAndNotify.
 * - .player-save.test.jsx    — save prompts, save-result event handling, listener lifecycle.
 * - .summary.test.jsx        — onClose invocation, expiration log DESCRIPTION text variants
 *                              (custom action names / elements, stringContaining depth).
 * - .error-handling.test.jsx — addEntry/loadMapData/addExpiration rejection survival.
 * This lane owns ONLY the deactivation commit: the exact live-store flag writes, the ONE merged
 * CLA-113 expiration payload (§39 — sequential clocks race; a single addExpiration carries every
 * epitome/stride key), activation-before-clock write ORDER through the live store, the single
 * expiration log entry, double-fire/in-flight guards, and inertness on cancel/skip/overlay/unmount.
 *
 * Round-seam semantics (no-timers architecture): rounds: Infinity means NO round seam matures
 * the clock — it dies at the CREATURE seam (expireOnCreatureName = the monk, per
 * processExpirationList's `currentRound > appliedRound` owner-turn rule), never a wall-clock
 * deadline. There is no setTimeout anywhere on this seam.
 *
 * FLAG (component, not fixed here):
 * - ElementalAttunementModal.jsx:579-603,653 — inline styles in the element picker and the
 *   "All targets resolved" note violate the no-inline-styles house rule.
 * - ElementalAttunementModal.jsx:430-450 — unguarded async IIFE (map path): setState fires on
 *   an unmounted component if the modal closes mid-map-load; no cancellation flag.
 * - ElementalAttunementModal.jsx:482-485 — unguarded .then(setResults): same unmount exposure.
 * - ElementalAttunementModal.jsx:124,301 — raw `<strong>${targetName}</strong>` HTML embedded in
 *   log entries; XSS safety depends entirely on downstream log-render sanitization of combat names.
 * - ElementalAttunementModal.jsx:364-368 — DOUBLE-COMMIT defect: the auto-summary effect flips
 *   'done' back to 'summary' (the `!phase.startsWith('summary')` guard also matches 'done'), so
 *   the Close button survives the commit and handleResultsClose (no self-guard) re-arms a
 *   DUPLICATE expiration + duplicate flag writes + duplicate log on a second tap. Pinned as
 *   current behavior; product fix: guard the effect with `phase === 'processing'` OR early-return
 *   in handleResultsClose when phase is already 'done'.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAttunementModal from './ElementalAttunementModal.jsx';

// ── Live runtime store (anti-vacuous): writes land, reads reflect, so the
//    activation→arm ordering and the inertness contracts are checked against
//    state that actually exists, not static null-returning mocks. ──

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

// Recorder for addExpiration: keeps the component's OWN args object — no shape
// mirroring of expirationQueue's entry builder, so nothing here can drift from prod.
vi.mock('../../../services/rules/effects/expirations.js', () => {
    const arms = [];
    return {
        arms,
        KEY: 'pendingExpirations',
        addExpiration: vi.fn(arm => { arms.push(arm); }),
    };
});

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
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as aoeService from '../../../services/rules/combat/aoeService.js';
import * as combatData from '../../../services/encounters/combatData.js';
import * as logService from '../../../services/ui/logService.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { persistAndNotify } from './shared/AreaEffectTargetModalBase.utils.jsx';

const { cells } = runtime;
const { arms } = expirations;

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

// Same-object identity: every getCombatSummary read returns THIS frozen fixture, so
// an identity assertion proves the flow actually consumed the seeded summary.
const combatFixture = Object.freeze({
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

// Drive element→processing→summary. Overlay path is synchronous (no mapName),
// so no pendingPrompts and no save-result listener involved.
async function armToSummary(element = 'Fire', props = {}) {
    const utils = renderModal({ activeOverlay: { type: 'sphere' }, ...props });
    fireEvent.click(utils.getByRole('button', { name: new RegExp(`^${element}`) }));
    const closeBtn = await utils.findByRole('button', { name: /Close/ });
    return { ...utils, closeBtn };
}

// House rule: mockReset (not clearAllMocks) + re-arm defaults; live cells wiped per test.
afterEach(() => {
    cleanup();
    cells.clear();
    arms.length = 0;
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    expirations.addExpiration.mockReset().mockImplementation(arm => { arms.push(arm); });
    diceRoller.rollExpression.mockReset().mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
    combatData.getCombatSummary.mockReset().mockReturnValue(null);
    aoeService.getAffectedCreatures.mockReset().mockReturnValue([]);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    mapsService.loadMapData.mockReset().mockResolvedValue(null);
    persistAndNotify.mockReset();
});

beforeEach(() => {
    combatData.getCombatSummary.mockReturnValue(combatFixture);
    aoeService.getAffectedCreatures.mockReturnValue([
        { creature: combatFixture.creatures[0] },
    ]);
    // Deterministic NPC save: roll = floor(0.5*20)+1 = 11, +dex 2 = 13 >= DC 12 → success.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

// ── Tests ──

describe('ElementalAttunementModal — deactivation commit (handleResultsClose)', () => {

    it('Close commits ONE expiration carrying the exact CLA-113 clear-list payload', async () => {
        const { closeBtn } = await armToSummary('Fire');
        fireEvent.click(closeBtn);

        // ONE clock (§39) anchored to the monk; target/attacker both the owner.
        expect(arms).toHaveLength(1);
        expect(arms[0]).toEqual({
            attackerName: PLAYER,
            targetName: PLAYER,
            campaignName: CAMPAIGN,
            // rounds: Infinity → NO round seam matures it (no-timers); it dies at the
            // owner-turn creature seam via expireOnCreatureName, never a wall clock.
            rounds: Infinity,
            expireOnCreatureName: PLAYER,
            // Ordered clear-list: activation pair + Stride buff, then the CLA-113
            // epitome/stride leak closures. Exact depth AND byte shape — nothing extra,
            // nothing reordered.
            effects: [
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'elementalAttunementActive' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'elementalAttunementElement' },
                { type: 'remove_active_buff', buffName: 'Stride of the Elements' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'elementalEpitomeActive' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'epitomeResistanceType' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'epitomeEmpoweredUsedRound' },
                { type: 'remove_active_buff', buffName: 'Elemental Epitome' },
                { type: 'remove_active_buff', buffName: 'Destructive Stride' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'destructiveStrideActive' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: 'destructiveStrideDamageType' },
                { type: 'clear_runtime_value', creatureName: PLAYER, key: '_Destructive_Stride_usedRound' },
            ],
        });
        // Recorder holds the component's own effects array — same object, never copied from a fixture.
        expect(expirations.addExpiration.mock.calls[0][0].effects).toBe(arms[0].effects);
    });

    it('attunement flags go live in the store BEFORE the clock is armed, and exactly ONE expiration log rides the commit', async () => {
        const { closeBtn } = await armToSummary('Fire');
        fireEvent.click(closeBtn);

        // Exact full four-arg writes, live in the store (not just call-recorder echoes).
        expect(runtime.setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'elementalAttunementActive', true, CAMPAIGN);
        expect(runtime.setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'elementalAttunementElement', 'Fire', CAMPAIGN);
        expect(cells.get(`${PLAYER}|elementalAttunementActive`)).toBe(true);
        expect(cells.get(`${PLAYER}|elementalAttunementElement`)).toBe('Fire');

        // §39 ordering through the live store: both flag writes precede the arm, so the
        // clock never expires against state that was never set.
        const flagOrders = runtime.setRuntimeValue.mock.invocationCallOrder;
        expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(2);
        expect(expirations.addExpiration.mock.invocationCallOrder[0]).toBeGreaterThan(Math.max(...flagOrders));

        // Expiration log: exactly ONE ability_use entry, full payload exact (text VARIANTS
        // per custom action names/elements → owned by .summary.test.jsx). The Fire processing
        // 'roll' log is npc-save lane's — filtered out, not duplicated here.
        const expirationLogs = logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use');
        expect(expirationLogs).toEqual([[CAMPAIGN, {
            type: 'ability_use',
            characterName: PLAYER,
            abilityName: 'Elemental Attunement',
            description: 'Monk1\'s <strong>Elemental Attunement (Fire)</strong> expires on their next turn.',
        }]]);
    });

    it.each([
        { path: 'element-phase Cancel', act: async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) },
        { path: 'target-selection Skip', act: async () => {
            fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
            fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));
        } },
    ])('$path closes the modal inertly — no flags, no clock, no log', async ({ act }) => {
        const props = makeProps();
        render(<ElementalAttunementModal {...props} />);
        await act();

        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(arms).toEqual([]);
        expect(logService.addEntry).not.toHaveBeenCalled();
        // The live store never even saw an attunement cell.
        expect(cells.has(`${PLAYER}|elementalAttunementActive`)).toBe(false);
        expect(cells.has(`${PLAYER}|elementalAttunementElement`)).toBe(false);
    });

    it('clicking the results header (bubbles through the overlay) is inert — no commit, Close stays available', async () => {
        const props = makeProps({ activeOverlay: { type: 'sphere' } });
        render(<ElementalAttunementModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
        fireEvent.click(await screen.findByText('Elemental Attunement (Fire) — Results'));

        expect(props.onClose).not.toHaveBeenCalled();
        expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
        expect(arms).toEqual([]);
        expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();
    });

    it('FLAG: commit does NOT unmount the summary — phase "done" flips back to "summary", so a second Close re-arms a duplicate clock (pinned as current behavior)', async () => {
        const props = makeProps({ activeOverlay: { type: 'sphere' } });
        render(<ElementalAttunementModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /^Fire/ }));
        const closeBtn = await screen.findByRole('button', { name: /Close/ });

        fireEvent.click(closeBtn);
        expect(arms).toHaveLength(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);

        // DEFECT (jsx:364-368): the auto-summary effect's `!phase.startsWith('summary')`
        // guard is also true for 'done', so setPhase('done') instantly re-arms summary —
        // the Close button SURVIVES the commit even though onClose fired.
        expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument();

        // Consequence: handleResultsClose has no self-guard, so a tap on the RE-MOUNTED
        // button (the stale ref detached when 'done' rendered null) commits AGAIN —
        // duplicate expiration queue entry, duplicate flag writes, duplicate expiration log.
        fireEvent.click(screen.getByRole('button', { name: /Close/ }));
        expect(arms).toHaveLength(2);
        expect(arms[1].effects).toEqual(arms[0].effects); // fresh clone of the same clear-list
        expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(4); // two exact pairs, not one
        expect(props.onClose).toHaveBeenCalledTimes(2);
        expect(logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use')).toHaveLength(2);
    });

    it('unmounting mid-processing never commits deactivation — no flags, no armed clock', async () => {
        const utils = renderModal({ activeOverlay: { type: 'sphere' } });
        fireEvent.click(utils.getByRole('button', { name: /^Fire/ }));
        // Unmount while the resolve promise chain is still in flight (no Close seen).
        utils.unmount();
        // Drain the microtask chain (no wall-clock waits — no-timers architecture).
        await Promise.resolve();
        await Promise.resolve();

        expect(arms).toEqual([]);
        expect(cells.has(`${PLAYER}|elementalAttunementActive`)).toBe(false);
        expect(cells.has(`${PLAYER}|elementalAttunementElement`)).toBe(false);
        expect(logService.addEntry.mock.calls.filter(([, e]) => e.type === 'ability_use')).toEqual([]);
    });
});
