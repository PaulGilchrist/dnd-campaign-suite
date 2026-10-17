// @maintained-by-ai
/**
 * EyebiteEffectModal — PLAYER SAVE lane (prompt dispatch, the save-result listener
 * lifecycle, and handleSaveResult resolution: fail / suppress / pass).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .test.jsx                    — effect list render, effect→target navigation, target filtering,
 *                                  skip/cancel, custom featureName render. No save resolution there.
 * - .npc-save.test.jsx         — NPC auto-roll math, immunity gate rows, routing of
 *   'monster'/type-less creatures (they land on the PLAYER prompt branch — pinned THERE by
 *   identity; this lane pins the intended 'player'-typed flow). Gate byte-exact rows are
 *   pinned there; here the gate is pinned only for its player-lane consequence: no prompt.
 * This lane owns: exact sendSavePrompt payload, LIVE store resolution of a dispatched
 * save-result (fail appends, pass writes nothing, suppression arm at :285-311 — the
 * aura-covered failed save, untested anywhere else until now), byte-exact log rows with a
 * frozen Date.now, exact promptId reuse (guid minted once), the listener lifetime
 * (registers ONLY while pending — opposite of the npc lane flag :389-396 — dead after
 * resolve and after unmount), missing-roll ?? 0 defaults, double-fire and inertness.
 *
 * FLAG (pins actual behavior, not intent):
 * - EyebiteEffectModal.jsx:288 — unguarded `await getAuraConditionImmunities` in the
 *   failed-save arm. A rejection/hang strands the resolution mid-branch: the store writes,
 *   addTargetResult, resolution rows and popup all never run; and a REJECTION additionally
 *   escapes the seam unhandled (:263-396 never catches). The prompt is NOT consumed (:386
 *   is after the await), so a re-dispatch recovers — pinned below. Product fix: try/catch →
 *   treat lookup failure as uncovered, or gate before any writes. Pin uses a never-settling
 *   lookup (byte-identical stranding, no leak): a genuine rejection cannot be pinned here —
 *   test-registered process/window 'unhandledrejection' guards never fire under Vitest 4's
 *   realm split and a real leak fails the collector (verified in
 *   ElementalAttunementModal.error-handling.test.jsx:203-212); its .then-chain guard has
 *   no analogue at this fire-and-forget call-site (:391-393).
 * - EyebiteEffectModal.jsx:263-387 — the pending prompt is removed only at the async tail
 *   (:386). Two save-results for the same promptId inside one flush DOUBLE-resolve:
 *   duplicated save_result/condition rows, two addTargetResults, and targetEffects stacks
 *   an exact duplicate (:301-310 appends without dedupe). activeConditions dedupe survives
 *   (:294). Pinned as actual. Product fix: claim the pending entry (or dedupe by promptId)
 *   before awaiting anything.
 * - EyebiteEffectModal.jsx:169-178 — the cast-time PENDING prompt is logged as a
 *   save_result with `success: false` (pending ≠ failed; a reader cannot tell an answered
 *   fail from an unanswered prompt) and carries NO timestamp, while ability_use/condition
 *   rows do. Product fix: a dedicated 'save_pending' type (or success: null) + timestamp.
 * - EyebiteEffectModal.jsx:51,177,330,373 — log descriptions hard-code the literal
 *   'Eyebite' even when featureName differs (abilityName and popup copy DO ride featureName).
 *   Pinned by the custom-featureName test. Product fix: interpolate featureName.
 * - EyebiteEffectModal.jsx:25-29 — the unmount cleanup setPendingPrompts([]) is a no-op
 *   on already-discarded state (listener removal at :395 is what actually stops handling).
 *
 * Anti-vacuity: LIVE runtime store (a never-issued commit is a missing cell, not a
 * call-recorder echo); LIVE rollback mutators moving lastAttack/results inspected directly;
 * Date.now frozen (FROZEN_TS); utils.guid pinned to PROMPT_ID and minted exactly once —
 * resolution must REUSE it, never mint fresh; rollD20 mocked but must NEVER roll here;
 * frozen summary/aura fixtures handed back by identity; role-scoped queries; wait-on-DOM
 * before dispatch; fresh vi.fn onClose per render; afterEach mockReset + re-arm (never
 * clearAllMocks); no bare setTimeout — no timers of any kind on this seam.
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EyebiteEffectModal from './EyebiteEffectModal.jsx';

vi.mock('./shared/SecondaryTargetModal.jsx', () => {
    return {
        default: vi.fn(({ title, targets, onTargetSelected, onSkip, description, confirmLabel, confirmIcon }) => {
            const firstTargetName = targets.length > 0 ? (targets[0].name || targets[0].value) : null;
            return (
                <div data-testid="secondary-target-modal">
                    <span data-testid="stm-title">{title}</span>
                    <span data-testid="stm-icon">{confirmIcon}</span>
                    <span data-testid="stm-description">{description}</span>
                    <span data-testid="stm-confirmLabel">{confirmLabel}</span>
                    <span data-testid="stm-targetCount">{targets.length}</span>
                    <button
                        onClick={() => onTargetSelected(firstTargetName)}
                        data-testid="stm-confirm"
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                    <button onClick={onSkip} data-testid="stm-skip" type="button">
                        Skip
                    </button>
                    {targets.map((t, i) => (
                        <span key={i} data-testid={`stm-target-${i}`}>{t.name || t.value}</span>
                    ))}
                </div>
            );
        }),
    };
});

// ── Live runtime store (anti-vacuous): condition/targetEffects resolution writes land here;
//    cells are inspected directly ──

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

// LIVE rollback recorder: lastAttack/results are moved by these mutators and read back
// directly — "recorded" is proven on the store itself, not on a call-args echo.
vi.mock('../../../services/automation/common/damageRollback.js', () => {
    const rollback = { lastAttack: null, results: [] };
    return {
        rollback,
        storeSpellLastAttack: vi.fn((campaign, attack) => { rollback.lastAttack = { campaign, attack }; }),
        addTargetResult: vi.fn((campaign, result) => { rollback.results.push({ campaign, result }); }),
    };
});

vi.mock('../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// rollD20 must NEVER roll on this lane — the player answers their own save.
vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    playerIsImmuneToCondition: vi.fn(() => false),
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

vi.mock('../../../services/combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn(() => Promise.resolve({ immunities: [], immunitySources: {} })),
    auraCoversCondition: vi.fn(() => false),
    splitAuraCoveredConditions: vi.fn((saveConditions) => ({ covered: [], applicable: saveConditions || [] })),
    logAuraConditionImmunity: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../../services/automation/common/damageRollback.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../services/dice/diceRoller.js';
import * as automationService from '../../../services/combat/automation/automationService.js';
import * as logService from '../../../services/ui/logService.js';
import * as savePromptService from '../../../services/combat/conditions/savePromptService.js';
import * as auraService from '../../../services/combat/auras/auraConditionImmunity.js';
import utils from '../../../services/ui/utils.js';

const { cells, getRuntimeValue } = runtime;
const { rollback } = damageRollback;

const PLAYER = 'Elf Mage';
const CASTER = 'Witch1';
const CAMPAIGN = 'test-campaign';
const SAVE_DC = 13;
const PROMPT_ID = 'test-guid-123'; // utils.guid pinned
const FROZEN_TS = 1737000000000;
const DEFAULT_AURA = Object.freeze({ immunities: Object.freeze([]), immunitySources: Object.freeze({}) });

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const EFFECTS = [
    { label: 'Asleep', key: 'asleep', condition: 'unconscious' },
    { label: 'Panicked', key: 'panicked', condition: 'frightened' },
    { label: 'Sickened', key: 'sickened', condition: 'poisoned' },
];

// ── Fixtures (frozen; handed back by identity so assertions prove THIS creature was used) ──

function makePlayer({ type = 'player', saveBonuses = { wis: 1 } } = {}) {
    const p = { name: PLAYER, type };
    if (saveBonuses) p.saveBonuses = Object.freeze(saveBonuses);
    return Object.freeze(p);
}

function summaryOf(...creatures) {
    return Object.freeze({ creatures: Object.freeze(creatures) });
}

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        combatSummary: summaryOf(makePlayer()),
        attackerName: CASTER,
        saveDc: SAVE_DC,
        campaignName: CAMPAIGN,
        onClose: vi.fn(),
        characters: [],
        featureName: 'Eyebite',
        rangeFeet: 60,
        ...overrides,
    };
}

// ── Byte-exact row builders (frozen ts; save_result rows carry NO timestamp — see FLAG) ──

const attackFor = (dc = SAVE_DC) => ({
    casterName: CASTER,
    spellName: 'Eyebite',
    saveType: 'WIS',
    saveDc: dc,
    attackScope: 'single',
});

const abilityUseRow = (label, condLabel, dc = SAVE_DC, feature = 'Eyebite') => ({
    type: 'ability_use',
    characterName: CASTER,
    abilityName: feature,
    // FLAG: description hard-codes 'Eyebite' even when feature differs.
    description: `${CASTER} casts Eyebite (${label})! ${PLAYER} must make a WIS save (DC ${dc}) or gain the ${condLabel} condition.`,
    timestamp: FROZEN_TS,
});

const pendingRow = (label, dc = SAVE_DC) => ({
    type: 'save_result',
    characterName: CASTER,
    rollType: 'save-eyebite',
    targetName: PLAYER,
    saveDc: dc,
    saveType: 'WIS',
    // FLAG: PENDING logged as success:false — indistinguishable from an answered fail.
    success: false,
    description: `${PLAYER} must make a WIS save (DC ${dc}) against Eyebite (${label})...`,
});

const saveResultRow = (success, label, dc = SAVE_DC) => ({
    type: 'save_result',
    characterName: CASTER,
    rollType: 'save-eyebite',
    targetName: PLAYER,
    saveDc: dc,
    saveType: 'WIS',
    success,
    description: `${PLAYER} ${success ? 'succeeded on' : 'failed'} WIS save against Eyebite (${label}).`,
});

const conditionRow = (condLabel) => ({
    type: 'condition',
    action: 'applied',
    characterName: PLAYER,
    condition: condLabel,
    reason: 'Eyebite spell',
    note: `${PLAYER} gains the ${condLabel} condition from Eyebite.`,
    timestamp: FROZEN_TS,
});

const failPopup = (condLabel) => `${PLAYER} failed on WIS save against Eyebite. ${PLAYER} gains the ${condLabel} condition.`;
const auraFailPopup = (condLabel) => `${PLAYER} failed on WIS save against Eyebite. Immune to ${condLabel} (aura) — unaffected.`;
const successPopup = `${PLAYER} succeeded on WIS save against Eyebite. Unaffected.`;
const immunePopup = (condition) => `${PLAYER} is immune to ${condition} and automatically succeeds on WIS save against Eyebite. Unaffected.`;

// ── Flow helpers ──

async function selectAndConfirm(effectLabel) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${effectLabel}`) }));
    // Register-before-dispatch: wait for the target stage in the DOM, then confirm inside an
    // async act so resolveSave's awaits AND the pendingPrompts effect (listener registration)
    // are flushed before the caller dispatches a save-result.
    const confirm = await screen.findByTestId('stm-confirm');
    await act(async () => {
        fireEvent.click(confirm);
    });
}

async function dispatchSaveResult(detail) {
    await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail }));
    });
}

const FAIL_DETAIL = Object.freeze({ promptId: PROMPT_ID, success: false, roll: 5, total: 6 });
const PASS_DETAIL = Object.freeze({ promptId: PROMPT_ID, success: true, roll: 12, total: 13 });

// ── Setup / teardown ──

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});

// House rule: mockReset (not clearAllMocks/resetAllMocks) + re-arm; live cells wiped.
afterEach(() => {
    cleanup();
    cells.clear();
    rollback.lastAttack = null;
    rollback.results.length = 0;
    vi.restoreAllMocks();
    runtime.getRuntimeValue.mockReset().mockImplementation((key, prop) => cells.get(`${key}|${prop}`) ?? null);
    runtime.setRuntimeValue.mockReset().mockImplementation((key, prop, value) => { cells.set(`${key}|${prop}`, value); return Promise.resolve(); });
    damageRollback.storeSpellLastAttack.mockReset().mockImplementation((campaign, attack) => { rollback.lastAttack = { campaign, attack }; });
    damageRollback.addTargetResult.mockReset().mockImplementation((campaign, result) => { rollback.results.push({ campaign, result }); });
    expirations.addExpiration.mockReset();
    diceRoller.rollD20.mockReset().mockReturnValue(15);
    automationService.playerIsImmuneToCondition.mockReset().mockReturnValue(false);
    logService.addEntry.mockReset().mockResolvedValue(undefined);
    savePromptService.sendSavePrompt.mockReset();
    savePromptService.sendSaveResult.mockReset();
    utils.guid.mockReset().mockReturnValue(PROMPT_ID);
    auraService.getAuraConditionImmunities.mockReset().mockResolvedValue(DEFAULT_AURA);
    auraService.auraCoversCondition.mockReset().mockReturnValue(false);
    auraService.splitAuraCoveredConditions.mockReset().mockImplementation((saveConditions) => ({ covered: [], applicable: saveConditions || [] }));
    auraService.logAuraConditionImmunity.mockReset();
});

describe('EyebiteEffectModal — player save prompt & resolution', () => {

    it('mount purity: nothing resolves, no listener registered, until effect+target are confirmed', async () => {
        const props = makeProps();
        render(<EyebiteEffectModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /^Asleep/ }));
        await screen.findByTestId('stm-confirm');

        expect(diceRoller.rollD20).not.toHaveBeenCalled();
        expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
        expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
        expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([]);
        expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
        expect(rollback.lastAttack).toBeNull();
        expect(rollback.results).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
        expect(cells.size).toBe(0);
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(auraService.getAuraConditionImmunities).not.toHaveBeenCalled();
        expect(automationService.playerIsImmuneToCondition).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();

        // No prompt pending → listener never registered (:390 guard): the exact future
        // promptId is DEAD at this stage.
        await dispatchSaveResult({ promptId: PROMPT_ID, success: false, roll: 1, total: 1 });
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(cells.size).toBe(0);
        expect(rollback.results).toEqual([]);
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    describe('prompt dispatch', () => {
        it.each(EFFECTS)('prompt dispatch ($label): exact sendSavePrompt payload, cast preamble only, zero resolution writes', async ({ label, condition }) => {
            const condLabel = cap(condition);
            const player = makePlayer();
            const props = makeProps({ combatSummary: summaryOf(player) });
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm(label);

            // The player rolls themselves: no d20, no auto result on this seam.
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();

            // Exactly one prompt, exact payload, pinned promptId minted exactly once.
            expect(utils.guid).toHaveBeenCalledTimes(1);
            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([[CAMPAIGN, {
                promptId: PROMPT_ID, targetName: PLAYER, saveType: 'WIS', saveDc: SAVE_DC, sourceName: CASTER,
            }]]);

            // Cast preamble stores the attack once (live recorder holds it); nothing resolves yet.
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()]]);
            expect(rollback.lastAttack).toEqual({ campaign: CAMPAIGN, attack: attackFor() });
            expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
            expect(rollback.results).toEqual([]);
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);

            // CLA-019 gate rode the flow: immunities ARRAY into the gate, playerStats is the
            // summary creature BY IDENTITY (characters=[] → fallback), inert default aura.
            expect(auraService.getAuraConditionImmunities.mock.calls).toEqual([[{ targetName: PLAYER, characters: props.characters }]]);
            expect(automationService.playerIsImmuneToCondition).toHaveBeenCalledTimes(1);
            expect(automationService.playerIsImmuneToCondition.mock.calls[0][0]).toEqual({
                conditionKey: condition,
                playerStats: player,
                getRuntimeValue,
                campaignName: CAMPAIGN,
                auraImmunities: DEFAULT_AURA.immunities,
            });
            expect(automationService.playerIsImmuneToCondition.mock.calls[0][0].playerStats).toBe(player);
            expect(auraService.logAuraConditionImmunity).not.toHaveBeenCalled();

            // Exactly two cast rows, byte-exact: ability_use + the pending save_result.
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow(label, condLabel)],
                [CAMPAIGN, pendingRow(label)],
            ]);

            // Awaiting the player's answer: no popup, modal stays open, onClose untouched.
            expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('immune player: gate short-circuits — NO prompt issued, exact immune rows, onClose once, listener never registered', async () => {
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');

            // The player-lane consequence: immunity beats the prompt entirely.
            expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
            expect(utils.guid).not.toHaveBeenCalled();
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();

            // Gate preamble (byte-exact gate rows pinned in .npc-save.test.jsx): one rollback
            // store, one 'immune' target result, zero store writes.
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()]]);
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: PLAYER, saveResult: 'immune', roll: 0, total: 0, conditions: [], appliedDamage: 0,
            }]]);
            expect(cells.size).toBe(0);

            // Gate consulted the aura channel but no aura covered → no aura log.
            expect(auraService.getAuraConditionImmunities).toHaveBeenCalledTimes(1);
            expect(auraService.auraCoversCondition.mock.calls).toEqual([[DEFAULT_AURA, 'unconscious']]);
            expect(auraService.logAuraConditionImmunity).not.toHaveBeenCalled();

            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, {
                    type: 'save_result',
                    characterName: CASTER,
                    rollType: 'save-eyebite',
                    targetName: PLAYER,
                    saveDc: SAVE_DC,
                    saveType: 'WIS',
                    success: true,
                    description: `${PLAYER} is immune to unconscious and automatically succeeds on the save against Eyebite (Asleep).`,
                }],
            ]);

            expect(await screen.findByText(immunePopup('unconscious'))).toBeInTheDocument();
            expect(props.onClose).toHaveBeenCalledTimes(1);

            // pendingPrompts stayed empty → listener never registered: the pinned promptId is dead.
            await dispatchSaveResult(FAIL_DETAIL);
            expect(logService.addEntry.mock.calls).toHaveLength(2);
            expect(rollback.results).toHaveLength(1);
        });

        it('characters fixture: the gate receives the computedStats object and the characters array BY IDENTITY', async () => {
            const computedStats = Object.freeze({ wisdomSave: 1, wits: 'elf' });
            const characters = Object.freeze([Object.freeze({ name: PLAYER, computedStats })]);
            const props = makeProps({ characters });
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Panicked');

            expect(auraService.getAuraConditionImmunities.mock.calls[0][0].characters).toBe(characters);
            expect(automationService.playerIsImmuneToCondition).toHaveBeenCalledTimes(1);
            expect(automationService.playerIsImmuneToCondition.mock.calls[0][0].playerStats).toBe(computedStats);

            // Not immune (default): the prompt still rides out exactly once, nothing resolves.
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
            expect(cells.size).toBe(0);
            expect(rollback.results).toEqual([]);
        });
    });

    describe('save-result resolution', () => {
        it.each(EFFECTS)('failed save ($label): LIVE store append, exact rollback, four byte-exact rows, popup', async ({ label, key, condition }) => {
            const condLabel = cap(condition);
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm(label);

            // Listener-alive proof: exact pinned promptId resolves on THIS lane.
            await dispatchSaveResult(FAIL_DETAIL);

            // LIVE store: exactly the cells this branch should have written — no more, no less.
            expect(Array.from(cells.keys()).sort()).toEqual([`${PLAYER}|activeConditions`, 'campaign|targetEffects']);
            expect(cells.get(`${PLAYER}|activeConditions`)).toEqual([condition]);
            const entry = { target: PLAYER, effect: `eyebite_${key}`, source: CASTER, condition, duration: 'concentration' };
            expect(cells.get('campaign|targetEffects')).toEqual([entry]);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([
                [PLAYER, 'activeConditions', [condition], CAMPAIGN],
                ['campaign', 'targetEffects', [entry], CAMPAIGN],
            ]);
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: CASTER, targetName: PLAYER, effects: [{ type: condition, condition }], campaignName: CAMPAIGN,
            });

            // Rollback: stored at cast AND at resolution (twice, identical attack) — one exact
            // failure target result on the LIVE recorder.
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()], [CAMPAIGN, attackFor()]]);
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: PLAYER, saveResult: 'failure', roll: FAIL_DETAIL.roll, total: FAIL_DETAIL.total, conditions: [condition], appliedDamage: 0,
            }]]);
            expect(rollback.results).toHaveLength(1);
            expect(rollback.results[0].result.total).toBe(FAIL_DETAIL.total);

            // PromptId REUSED (guid minted once); no auto-roll machinery on this lane.
            expect(utils.guid).toHaveBeenCalledTimes(1);
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();

            // Suppression consulted but uncovered: default aura at cast AND resolution, no aura log.
            expect(auraService.getAuraConditionImmunities.mock.calls).toEqual([
                [{ targetName: PLAYER, characters: props.characters }],
                [{ targetName: PLAYER, characters: props.characters }],
            ]);
            expect(auraService.auraCoversCondition.mock.calls).toEqual([[DEFAULT_AURA, condition]]);
            expect(auraService.logAuraConditionImmunity).not.toHaveBeenCalled();

            // Every row, byte-exact, in order, nothing extra.
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow(label, condLabel)],
                [CAMPAIGN, pendingRow(label)],
                [CAMPAIGN, saveResultRow(false, label)],
                [CAMPAIGN, conditionRow(condLabel)],
            ]);

            expect(await screen.findByText(failPopup(condLabel))).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it.each(EFFECTS)('passed save ($label): nothing written anywhere, single success target-result, exact rows + popup', async ({ label, condition }) => {
            const condLabel = cap(condition);
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm(label);
            await dispatchSaveResult(PASS_DETAIL);

            // A passed save must not touch the LIVE store or the expiration service at all.
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);
            expect(expirations.addExpiration).not.toHaveBeenCalled();

            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: PLAYER, saveResult: 'success', roll: PASS_DETAIL.roll, total: PASS_DETAIL.total, conditions: [], appliedDamage: 0,
            }]]);
            expect(rollback.results).toHaveLength(1);

            // Resolution of a PASS never re-consults the aura channel (fail branch only).
            expect(auraService.getAuraConditionImmunities).toHaveBeenCalledTimes(1);
            expect(auraService.auraCoversCondition).not.toHaveBeenCalled();

            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow(label, condLabel)],
                [CAMPAIGN, pendingRow(label)],
                [CAMPAIGN, saveResultRow(true, label)],
            ]);

            expect(await screen.findByText(successPopup)).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('failed save with aura-covered condition (:285-311 suppression): save fails, condition NEVER lands, suppression logged, popup says aura-immune', async () => {
            const aura = Object.freeze({
                immunities: Object.freeze(['unconscious']),
                immunitySources: Object.freeze({ unconscious: 'Paladin1' }),
            });
            auraService.getAuraConditionImmunities.mockResolvedValue(aura);
            auraService.auraCoversCondition.mockImplementation((auraImmunities, conditionKey) =>
                (auraImmunities?.immunities || []).includes(String(conditionKey).toLowerCase()));
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep'); // gate stays open (immune=false) → prompt issued
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);

            await dispatchSaveResult(FAIL_DETAIL);

            // Suppression logged ONCE with the resolved aura BY IDENTITY.
            expect(auraService.logAuraConditionImmunity).toHaveBeenCalledTimes(1);
            expect(auraService.logAuraConditionImmunity.mock.calls[0][0]).toEqual({
                campaignName: CAMPAIGN, targetName: PLAYER, conditionKey: 'unconscious', auraImmunities: aura, sourceAbility: 'Eyebite',
            });
            expect(auraService.logAuraConditionImmunity.mock.calls[0][0].auraImmunities).toBe(aura);
            expect(auraService.auraCoversCondition.mock.calls).toEqual([[aura, 'unconscious']]);

            // The condition NEVER lands: no store cells, no expiration, no condition row.
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);
            expect(expirations.addExpiration).not.toHaveBeenCalled();

            // The save STILL failed for rollback purposes — with EMPTY conditions.
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: PLAYER, saveResult: 'failure', roll: 5, total: 6, conditions: [], appliedDamage: 0,
            }]]);

            // Exactly three rows: the condition row is suppressed.
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, pendingRow('Asleep')],
                [CAMPAIGN, saveResultRow(false, 'Asleep')],
            ]);

            expect(await screen.findByText(auraFailPopup('Unconscious'))).toBeInTheDocument();

            // Prompt was still consumed at the tail (:386): re-dispatch is dead.
            await dispatchSaveResult(FAIL_DETAIL);
            expect(logService.addEntry.mock.calls).toHaveLength(3);
            expect(auraService.logAuraConditionImmunity).toHaveBeenCalledTimes(1);
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it.each([
            { desc: 'omitted', extra: {} },
            { desc: 'null', extra: { roll: null, total: null } },
        ])('failed save with roll/total $desc: ?? 0 defaults land byte-exact on the rollback result', async ({ extra }) => {
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');
            await dispatchSaveResult({ promptId: PROMPT_ID, success: false, ...extra });

            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: PLAYER, saveResult: 'failure', roll: 0, total: 0, conditions: ['unconscious'], appliedDamage: 0,
            }]]);
            expect(rollback.results).toHaveLength(1);
            expect(cells.get(`${PLAYER}|activeConditions`)).toEqual(['unconscious']);
            expect(await screen.findByText(failPopup('Unconscious'))).toBeInTheDocument();
        });

        it('aura lookup at :288 never settles (unguarded-await strand): resolution stops there — no writes, no popup, prompt NOT consumed, re-dispatch recovers (FLAG)', async () => {
            // Never-settling lookup strands everything after :288 byte-identically to a
            // rejection; the rejection's extra unhandled leak is documented in the header
            // (uncapturable under Vitest 4, and a real leak would fail the collector).
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');
            auraService.getAuraConditionImmunities.mockImplementationOnce(() => new Promise(() => {}));
            await dispatchSaveResult(FAIL_DETAIL);

            // Stranded mid-branch: only the cast rows and the resolution's preamble store
            // survived. Nothing after :288 ran.
            expect(auraService.getAuraConditionImmunities).toHaveBeenCalledTimes(2);
            expect(cells.size).toBe(0);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()], [CAMPAIGN, attackFor()]]);
            expect(auraService.auraCoversCondition).not.toHaveBeenCalled();
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, pendingRow('Asleep')],
            ]);
            expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
            expect(rollback.results).toEqual([]);

            // Prompt NOT consumed (:386 is after the await) — a healthy re-dispatch fully resolves.
            auraService.getAuraConditionImmunities.mockImplementation(() => Promise.resolve(DEFAULT_AURA));
            await dispatchSaveResult(FAIL_DETAIL);

            expect(cells.get(`${PLAYER}|activeConditions`)).toEqual(['unconscious']);
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: PLAYER, saveResult: 'failure', roll: 5, total: 6, conditions: ['unconscious'], appliedDamage: 0,
            }]]);
            expect(damageRollback.storeSpellLastAttack.mock.calls).toHaveLength(3);
            expect(auraService.getAuraConditionImmunities).toHaveBeenCalledTimes(3);
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, pendingRow('Asleep')],
                [CAMPAIGN, saveResultRow(false, 'Asleep')],
                [CAMPAIGN, conditionRow('Unconscious')],
            ]);
            expect(await screen.findByText(failPopup('Unconscious'))).toBeInTheDocument();
            expect(rollback.results).toHaveLength(1); // the stranded attempt recorded nothing to roll back
        });
    });

    describe('listener lifecycle, garbage input and double-fire', () => {
        it.each([
            { desc: 'null detail', detail: null },
            { desc: 'no promptId', detail: { success: false, roll: 1, total: 1 } },
            { desc: 'unknown promptId', detail: { promptId: 'nonexistent-guid', success: false, roll: 1, total: 1 } },
        ])('garbage dispatch ($desc) is inert and does NOT consume the pending prompt', async ({ detail }) => {
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');
            const rowsBefore = logService.addEntry.mock.calls.slice();

            await dispatchSaveResult(detail);

            expect(logService.addEntry.mock.calls).toEqual(rowsBefore);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);
            expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

            // The slot is still open: the pinned promptId resolves normally afterwards.
            await dispatchSaveResult(FAIL_DETAIL);
            expect(await screen.findByText(failPopup('Unconscious'))).toBeInTheDocument();
            expect(cells.get(`${PLAYER}|activeConditions`)).toEqual(['unconscious']);
        });

        it('two matching save-results in ONE flush DOUBLE-resolve (FLAG :263-387): stacked rows, two target-results, duplicate targetEffects; post-flush dispatch is dead', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');

            await act(async () => {
                window.dispatchEvent(new CustomEvent('save-result', { detail: FAIL_DETAIL }));
                window.dispatchEvent(new CustomEvent('save-result', { detail: FAIL_DETAIL }));
            });

            // activeConditions dedupe survives; targetEffects STACKS an exact duplicate.
            expect(cells.get(`${PLAYER}|activeConditions`)).toEqual(['unconscious']);
            const entry = { target: PLAYER, effect: 'eyebite_asleep', source: CASTER, condition: 'unconscious', duration: 'concentration' };
            expect(cells.get('campaign|targetEffects')).toEqual([entry, entry]);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([
                [PLAYER, 'activeConditions', ['unconscious'], CAMPAIGN],
                ['campaign', 'targetEffects', [entry], CAMPAIGN],
                [PLAYER, 'activeConditions', ['unconscious'], CAMPAIGN],
                // Second handler read the FIRST handler's live write back and stacked on it.
                ['campaign', 'targetEffects', [entry, entry], CAMPAIGN],
            ]);

            // Two target results, duplicate resolution rows, third rollback store, one prompt.
            const failResult = { targetName: PLAYER, saveResult: 'failure', roll: 5, total: 6, conditions: ['unconscious'], appliedDamage: 0 };
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, failResult], [CAMPAIGN, failResult]]);
            expect(rollback.results).toHaveLength(2);
            expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledTimes(3);
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
            expect(utils.guid).toHaveBeenCalledTimes(1);
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, pendingRow('Asleep')],
                [CAMPAIGN, saveResultRow(false, 'Asleep')],
                [CAMPAIGN, saveResultRow(false, 'Asleep')],
                [CAMPAIGN, conditionRow('Unconscious')],
                [CAMPAIGN, conditionRow('Unconscious')],
            ]);
            expect(await screen.findByText(failPopup('Unconscious'))).toBeInTheDocument();

            // Tail ran: pendingPrompts emptied → listener unregistered → further dispatch is dead.
            const rowsAfter = logService.addEntry.mock.calls.slice();
            await dispatchSaveResult(FAIL_DETAIL);
            await dispatchSaveResult(PASS_DETAIL);
            expect(logService.addEntry.mock.calls).toEqual(rowsAfter);
            expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(2);
        });

        it('listener dies after resolve and after unmount: late matching dispatches resolve nothing', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');
            await dispatchSaveResult(PASS_DETAIL);
            await screen.findByText(successPopup);

            const rowsAfter = logService.addEntry.mock.calls.slice();

            // Pending queue empty → effect cleanup unregistered the listener.
            await dispatchSaveResult(FAIL_DETAIL);
            expect(logService.addEntry.mock.calls).toEqual(rowsAfter);
            expect(rollback.results).toHaveLength(1);
            expect(cells.size).toBe(0);
            expect(screen.getByText(successPopup)).toBeInTheDocument();

            // Unmount: even a fresh pending-shaped dispatch resolves nothing.
            cleanup();
            await dispatchSaveResult({ promptId: PROMPT_ID, success: false, roll: 1, total: 1 });
            expect(logService.addEntry.mock.calls).toEqual(rowsAfter);
            expect(damageRollback.addTargetResult).toHaveBeenCalledTimes(1);
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
        });
    });

    describe('popup interactions', () => {
        it('Done after a failed player save closes the modal exactly once', async () => {
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');
            await dispatchSaveResult(FAIL_DETAIL);

            const done = await screen.findByRole('button', { name: 'Done' });
            expect(props.onClose).not.toHaveBeenCalled();
            fireEvent.click(done);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it('custom featureName: prompt payload carries no featureName; cast/pending/result rows hard-code "Eyebite"; popup and abilityName ride featureName (FLAG)', async () => {
            const props = makeProps({ featureName: 'Dread Glare' });
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');
            await dispatchSaveResult(FAIL_DETAIL);

            // The save-prompt protocol has no featureName field at all (FLAG).
            expect(savePromptService.sendSavePrompt.mock.calls).toEqual([[CAMPAIGN, {
                promptId: PROMPT_ID, targetName: PLAYER, saveType: 'WIS', saveDc: SAVE_DC, sourceName: CASTER,
            }]]);

            // abilityName respects featureName; every description hard-codes 'Eyebite' (FLAG).
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious', SAVE_DC, 'Dread Glare')],
                [CAMPAIGN, pendingRow('Asleep')],
                [CAMPAIGN, saveResultRow(false, 'Asleep')],
                [CAMPAIGN, conditionRow('Unconscious')],
            ]);

            expect(await screen.findByText(`${PLAYER} failed on WIS save against Dread Glare. ${PLAYER} gains the Unconscious condition.`)).toBeInTheDocument();
        });
    });
});
