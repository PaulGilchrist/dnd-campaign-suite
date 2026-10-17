// @maintained-by-ai
/**
 * EyebiteEffectModal — NPC SAVE lane (handleTargetSelected → resolveSave isNpc branch,
 * the immunity gate, and the routing decision between them).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .test.jsx              — effect list render, effect→target navigation, target filtering,
 *                          skip/cancel, custom featureName. No save resolution there.
 * - .player-save.test.jsx  — prompt dispatch, save-result event handling, listener lifecycle,
 *                          Done-after-player-result. No prompt is ever issued on this lane.
 * This lane owns: NPC auto-save math (pinned d20, missing-bonus default, >= DC threshold),
 * LIVE store writes inspected via cells directly (append / never-duplicate / dedupe byte-exact,
 * targetEffects appended), the live damageRollback recorder proving rollback state movement by
 * identity, exact full byte-exact log rows with a frozen Date.now (an extra or missing field
 * flips a pin), exact sendSaveResult payloads with the pinned promptId, the immunity gate and
 * its aura channel, all three effect variants, popup copy, and the inertness contract of any
 * save-result dispatch on this seam.
 *
 * FLAG (pins actual behavior, not intent — never invent the catch here):
 * - EyebiteEffectModal.jsx:186-187 — isNpc is `!targetCreature || type === 'npc'`: ONLY the
 *   exact string 'npc' auto-rolls. A 'monster'-typed or type-less creature routes into the
 *   PLAYER prompt branch. The routing it.each pins the actual routing; product fix: treat
 *   unknown types as NPC (or normalise type at intake).
 * - EyebiteEffectModal.jsx:204-220 — the immunity gate copy-pastes resolveSave's
 *   storeSpellLastAttack + ability_use preamble instead of delegating. At runtime each fires
 *   ONCE (the gate returns before resolveSave), but the byte-identical copies can drift.
 * - EyebiteEffectModal.jsx:389-396 — the save-result listener NEVER registers on this lane
 *   (pendingPrompts stays empty): dispatching even with the matching promptId is a dead branch.
 *   Pinned as a no-op by the inertness test.
 * - The 'save_result' rows carry NO `timestamp` while 'ability_use' and 'condition' rows do
 *   (pinned byte-exact above; product fix: add timestamp to save_result rows).
 * - EyebiteEffectModal.jsx:78-87 — campaign targetEffects APPENDS unconditionally: re-casting
 *   stacks duplicate eyebrow entries (pinned by the seeded-append test). Player-fail aura
 *   suppression (:285-311) is unreachable from this lane; the player-save lane should grow an
 *   aura-covered arm. The unguarded `await getAuraConditionImmunities` (:193) is inert here
 *   only because characters=[] — a guard belongs to an error-handling pass.
 *
 * Anti-vacuity: live runtime store (a never-issued commit is a missing cell, not a
 * call-recorder echo); live rollback mutators that move lastAttack/results which the tests
 * inspect directly; Date.now frozen (FROZEN_TS); deterministic rollD20 pinned to 15; frozen
 * summary fixtures handed back by identity; role-scoped queries; fresh vi.fn onClose per
 * render; afterEach mockReset + re-arm (never clearAllMocks); no bare setTimeout — no timers
 * of any kind on this seam.
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

// ── Live runtime store (anti-vacuous): condition/targetEffects writes land here; cells
//    are inspected directly ──

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

// d20 pinned to 15: pass DC 13 with wis >= -2, fail with less.
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

const NPC = 'Goblin1';
const CASTER = 'Witch1';
const CAMPAIGN = 'test-campaign';
const SAVE_DC = 13;
const PROMPT_ID = 'test-guid-123';
const FROZEN_TS = 1737000000000;
const ROLL = 15; // rollD20 pinned
const DEFAULT_AURA = Object.freeze({ immunities: Object.freeze([]), immunitySources: Object.freeze({}) });

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Fixtures (frozen; handed back by identity so assertions prove THIS creature was used) ──

function makeTarget({ type = 'npc', saveBonuses = { wis: -10 } } = {}) {
    const npc = { name: NPC, type };
    if (saveBonuses) npc.saveBonuses = Object.freeze(saveBonuses);
    return Object.freeze(npc);
}

function summaryOf(...creatures) {
    return Object.freeze({ creatures: Object.freeze(creatures) });
}

// Fresh vi.fn per render (house rule: no shared module-level onClose).
function makeProps(overrides = {}) {
    return {
        combatSummary: summaryOf(makeTarget()),
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

const abilityUseRow = (label, condLabel, dc = SAVE_DC) => ({
    type: 'ability_use',
    characterName: CASTER,
    abilityName: 'Eyebite',
    description: `${CASTER} casts Eyebite (${label})! ${NPC} must make a WIS save (DC ${dc}) or gain the ${condLabel} condition.`,
    timestamp: FROZEN_TS,
});

const saveResultRow = (success, label, dc = SAVE_DC) => ({
    type: 'save_result',
    characterName: CASTER,
    rollType: 'save-eyebite',
    targetName: NPC,
    saveDc: dc,
    saveType: 'WIS',
    success,
    description: `${NPC} ${success ? 'succeeded on' : 'failed'} WIS save against Eyebite (${label}).`,
});

const conditionRow = (condLabel) => ({
    type: 'condition',
    action: 'applied',
    characterName: NPC,
    condition: condLabel,
    reason: 'Eyebite spell',
    note: `${NPC} gains the ${condLabel} condition from Eyebite.`,
    timestamp: FROZEN_TS,
});

const failPopup = (condLabel) => `${NPC} failed on WIS save against Eyebite. ${NPC} gains the ${condLabel} condition.`;
const successPopup = `${NPC} succeeded on WIS save against Eyebite. Unaffected.`;
const immunePopup = (condition) => `${NPC} is immune to ${condition} and automatically succeeds on WIS save against Eyebite. Unaffected.`;

// ── Flow helpers ──

async function selectAndConfirm(effectLabel) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${effectLabel}`) }));
    // Register-before-dispatch: wait for the target stage to exist in the DOM, THEN confirm.
    const confirm = await screen.findByTestId('stm-confirm');
    await act(async () => {
        fireEvent.click(confirm);
    });
}

function dispatchSaveResult(detail) {
    act(() => {
        window.dispatchEvent(new CustomEvent('save-result', { detail }));
    });
}

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
    diceRoller.rollD20.mockReset().mockReturnValue(ROLL);
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

describe('EyebiteEffectModal — NPC save resolution', () => {

    it('mount purity: choosing an effect resolves nothing until a target is confirmed', async () => {
        const props = makeProps();
        render(<EyebiteEffectModal {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /^Asleep/ }));
        await screen.findByTestId('stm-confirm');

        expect(diceRoller.rollD20).not.toHaveBeenCalled();
        expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([]);
        expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
        expect(rollback.lastAttack).toBeNull();
        expect(rollback.results).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
        expect(cells.size).toBe(0);
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
        expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
        expect(auraService.getAuraConditionImmunities).not.toHaveBeenCalled();
        expect(automationService.playerIsImmuneToCondition).not.toHaveBeenCalled();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    describe('resolveSave — NPC auto-roll math and payloads', () => {
        // Asleep -10 total 5 fail; Panicked/Sickened same math; boundary arm 15+-2=13 === DC
        // pins the >= threshold; the last two pass cleanly.
        it.each([
            { label: 'Asleep', key: 'asleep', condition: 'unconscious', wis: -10, success: false },
            { label: 'Panicked', key: 'panicked', condition: 'frightened', wis: -10, success: false },
            { label: 'Sickened', key: 'sickened', condition: 'poisoned', wis: -10, success: false },
            { label: 'Asleep', key: 'asleep', condition: 'unconscious', wis: 2, success: true },
            { label: 'Panicked', key: 'panicked', condition: 'frightened', wis: -2, success: true },
            { label: 'Sickened', key: 'sickened', condition: 'poisoned', wis: 2, success: true },
        ])('$label vs WIS $wis → $success: exact roll, rollback, LIVE store, full log rows, popup', async ({ label, key, condition, wis, success }) => {
            const condLabel = cap(condition);
            const npc = makeTarget({ saveBonuses: { wis } });
            const props = makeProps({ combatSummary: summaryOf(npc) });
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm(label);

            const total = ROLL + wis;

            // One d20, one save result — exact payload, pinned promptId, no prompt on this lane.
            expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
            expect(savePromptService.sendSaveResult.mock.calls).toEqual([[CAMPAIGN, NPC, {
                promptId: PROMPT_ID, success, roll: ROLL, total, saveBonus: wis, rawRolls: [ROLL, ROLL],
            }]]);
            expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();

            // Rollback: last attack stored once, and the LIVE recorder holds it.
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()]]);
            expect(rollback.lastAttack).toEqual({ campaign: CAMPAIGN, attack: attackFor() });

            // Target result recorded ONCE on the LIVE recorder, exact.
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: NPC,
                saveResult: success ? 'success' : 'failure',
                roll: ROLL,
                total,
                conditions: success ? [] : [condition],
                appliedDamage: 0,
            }]]);
            expect(rollback.results).toHaveLength(1);
            expect(rollback.results[0].campaign).toBe(CAMPAIGN);
            expect(rollback.results[0].result.conditions).toEqual(success ? [] : [condition]);

            // CLA-019 gate rode the flow with the inert default aura.
            expect(auraService.getAuraConditionImmunities).toHaveBeenCalledWith({ targetName: NPC, characters: [] });
            expect(automationService.playerIsImmuneToCondition).toHaveBeenCalledWith({
                conditionKey: condition,
                playerStats: npc,
                getRuntimeValue,
                campaignName: CAMPAIGN,
                auraImmunities: DEFAULT_AURA.immunities, // gate receives the immunities ARRAY, not the wrapper
            });
            expect(auraService.logAuraConditionImmunity).not.toHaveBeenCalled();

            // Every log row, byte-exact, in order, nothing extra (save_result has NO timestamp).
            expect(logService.addEntry.mock.calls).toEqual(success
                ? [[CAMPAIGN, abilityUseRow(label, condLabel)], [CAMPAIGN, saveResultRow(true, label)]]
                : [[CAMPAIGN, abilityUseRow(label, condLabel)], [CAMPAIGN, saveResultRow(false, label)], [CAMPAIGN, conditionRow(condLabel)]]);

            // LIVE store: exactly the cells the branch should have written — no more, no less.
            if (success) {
                expect(cells.size).toBe(0);
                expect(expirations.addExpiration).not.toHaveBeenCalled();
                expect(await screen.findByText(successPopup)).toBeInTheDocument();
            } else {
                expect(Array.from(cells.keys()).sort()).toEqual([`${NPC}|activeConditions`, 'campaign|targetEffects']);
                expect(cells.get(`${NPC}|activeConditions`)).toEqual([condition]);
                expect(cells.get('campaign|targetEffects')).toEqual([{
                    target: NPC, effect: `eyebite_${key}`, source: CASTER, condition, duration: 'concentration',
                }]);
                expect(expirations.addExpiration).toHaveBeenCalledWith({
                    attackerName: CASTER, targetName: NPC, effects: [{ type: condition, condition }], campaignName: CAMPAIGN,
                });
                expect(await screen.findByText(failPopup(condLabel))).toBeInTheDocument();
            }

            // Popup is terminal for this lane: stays open until Done; nothing auto-closes.
            expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });

        it('NPC with no saveBonuses property: bonus defaults to 0 — d20 15 still fails DC 16, exact payload and store write', async () => {
            const npc = makeTarget({ saveBonuses: null });
            const props = makeProps({ combatSummary: summaryOf(npc), saveDc: 16 });
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');

            expect(savePromptService.sendSaveResult.mock.calls).toEqual([[CAMPAIGN, NPC, {
                promptId: PROMPT_ID, success: false, roll: ROLL, total: ROLL, saveBonus: 0, rawRolls: [ROLL, ROLL],
            }]]);
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor(16)]]);
            expect(cells.get(`${NPC}|activeConditions`)).toEqual(['unconscious']);
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious', 16)],
                [CAMPAIGN, saveResultRow(false, 'Asleep', 16)],
                [CAMPAIGN, conditionRow('Unconscious')],
            ]);
        });
    });

    describe('LIVE store condition bookkeeping', () => {
        it('appends unconscious AFTER existing conditions — others survive byte-exact', async () => {
            const existing = ['frightened', 'poisoned'];
            cells.set(`${NPC}|activeConditions`, existing);
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');

            expect(runtime.setRuntimeValue).toHaveBeenCalledWith(NPC, 'activeConditions', ['frightened', 'poisoned', 'unconscious'], CAMPAIGN);
            expect(cells.get(`${NPC}|activeConditions`)).toEqual(['frightened', 'poisoned', 'unconscious']);
        });

        it('never duplicates an active unconscious: cell holds exactly one byte-exact entry', async () => {
            cells.set(`${NPC}|activeConditions`, ['unconscious']);
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');

            expect(runtime.setRuntimeValue).toHaveBeenCalledWith(NPC, 'activeConditions', ['unconscious'], CAMPAIGN);
            expect(cells.get(`${NPC}|activeConditions`)).toEqual(['unconscious']);
        });

        it('targetEffects APPENDS without dedupe — a matching eyebrow entry is kept and a new one stacked (FLAG)', async () => {
            const seedEntry = { target: NPC, effect: 'eyebite_asleep', source: CASTER, condition: 'unconscious', duration: 'concentration' };
            cells.set('campaign|targetEffects', [seedEntry]);
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');

            const effects = cells.get('campaign|targetEffects');
            expect(effects).toHaveLength(2);
            expect(effects[0]).toBe(seedEntry); // the pre-existing entry was preserved by identity
            expect(effects[1]).toEqual({ target: NPC, effect: 'eyebite_asleep', source: CASTER, condition: 'unconscious', duration: 'concentration' });
        });
    });

    describe('inertness contract — no save-result dispatch resolves on this lane', () => {
        it('no prompt issued; dispatched save-results (even matching promptId) are dead and never re-resolve', async () => {
            render(<EyebiteEffectModal {...makeProps()} />);
            await selectAndConfirm('Asleep');
            await screen.findByText(failPopup('Unconscious'));

            expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
            const logCallsBefore = logService.addEntry.mock.calls.slice();
            const conditionsBefore = cells.get(`${NPC}|activeConditions`);
            const resultsBefore = rollback.results.slice();

            dispatchSaveResult({ promptId: PROMPT_ID, success: false, roll: 1, total: 1 });
            dispatchSaveResult(null);
            dispatchSaveResult({ promptId: 'unknown-guid', success: false, roll: 1, total: 1 });

            expect(logService.addEntry.mock.calls).toEqual(logCallsBefore);
            expect(cells.get(`${NPC}|activeConditions`)).toBe(conditionsBefore);
            expect(rollback.results).toEqual(resultsBefore);
            expect(runtime.setRuntimeValue).toHaveBeenCalledTimes(2); // the two cast-time writes, nothing more
            expect(await screen.findByText(failPopup('Unconscious'))).toBeInTheDocument();

            // Listener-leak guard: after unmount a late dispatch still resolves nothing.
            cleanup();
            dispatchSaveResult({ promptId: PROMPT_ID, success: false, roll: 1, total: 1 });
            expect(logService.addEntry.mock.calls).toEqual(logCallsBefore);
            expect(rollback.results).toHaveLength(1);
        });
    });

    describe('immunity gate (NPC)', () => {
        it('immune NPC that would have FAILED (wis -10): no roll, no condition, exact immune rows, onClose once', async () => {
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');

            // The gate short-circuits before the roll — immunity beats even a certain failure.
            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
            expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();

            // FLAG: the gate copy-pastes resolveSave's store+log preamble (single call each at
            // runtime — byte-identical today, but the copies can drift independently).
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()]]);
            expect(damageRollback.addTargetResult.mock.calls).toEqual([[CAMPAIGN, {
                targetName: NPC, saveResult: 'immune', roll: 0, total: 0, conditions: [], appliedDamage: 0,
            }]]);

            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);
            expect(auraService.logAuraConditionImmunity).not.toHaveBeenCalled();

            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, {
                    type: 'save_result',
                    characterName: CASTER,
                    rollType: 'save-eyebite',
                    targetName: NPC,
                    saveDc: SAVE_DC,
                    saveType: 'WIS',
                    success: true,
                    description: `${NPC} is immune to unconscious and automatically succeeds on the save against Eyebite (Asleep).`,
                }],
            ]);

            expect(await screen.findByText(immunePopup('unconscious'))).toBeInTheDocument();
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });

        it('immune NPC with aura-covered condition: logAuraConditionImmunity fires once with the resolved aura by identity, store still empty', async () => {
            const aura = Object.freeze({
                immunities: Object.freeze(['unconscious']),
                immunitySources: Object.freeze({ unconscious: 'Paladin1' }),
            });
            auraService.getAuraConditionImmunities.mockResolvedValueOnce(aura);
            auraService.auraCoversCondition.mockImplementation((auraImmunities, conditionKey) =>
                (auraImmunities?.immunities || []).includes(conditionKey));
            automationService.playerIsImmuneToCondition.mockReturnValue(true);
            const props = makeProps();
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');

            expect(auraService.getAuraConditionImmunities).toHaveBeenCalledWith({ targetName: NPC, characters: [] });
            expect(auraService.logAuraConditionImmunity).toHaveBeenCalledTimes(1);
            expect(auraService.logAuraConditionImmunity.mock.calls[0][0]).toEqual({
                campaignName: CAMPAIGN, targetName: NPC, conditionKey: 'unconscious', auraImmunities: aura, sourceAbility: 'Eyebite',
            });
            expect(auraService.logAuraConditionImmunity.mock.calls[0][0].auraImmunities).toBe(aura);

            // The aura channel is recorded on its own mock; the log channel stays at core rows.
            expect(logService.addEntry.mock.calls).toHaveLength(2);
            expect(logService.addEntry.mock.calls[1][1].description).toBe(`${NPC} is immune to unconscious and automatically succeeds on the save against Eyebite (Asleep).`);
            expect(cells.size).toBe(0);
            expect(props.onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('routing — which types auto-roll (FLAG: only exact type "npc")', () => {
        it.each([
            { desc: "'monster'-typed", creature: Object.freeze({ name: NPC, type: 'monster', saveBonuses: Object.freeze({ wis: -10 }) }) },
            { desc: 'type-less', creature: Object.freeze({ name: NPC, saveBonuses: Object.freeze({ wis: -10 }) }) },
        ])('$desc creature routes to the PLAYER prompt branch: no auto-roll, exact prompt payload, pending log row', async ({ creature }) => {
            const props = makeProps({ combatSummary: summaryOf(creature) });
            render(<EyebiteEffectModal {...props} />);
            await selectAndConfirm('Asleep');

            expect(diceRoller.rollD20).not.toHaveBeenCalled();
            expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
            expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith(CAMPAIGN, {
                promptId: PROMPT_ID, targetName: NPC, saveType: 'WIS', saveDc: SAVE_DC, sourceName: CASTER,
            });
            // resolveSave's preamble runs, then the player branch: one rollback store, but no
            // target result, no expiration, no store writes, no popup.
            expect(damageRollback.storeSpellLastAttack.mock.calls).toEqual([[CAMPAIGN, attackFor()]]);
            expect(rollback.lastAttack).toEqual({ campaign: CAMPAIGN, attack: attackFor() });
            expect(damageRollback.addTargetResult.mock.calls).toEqual([]);
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(runtime.setRuntimeValue.mock.calls).toEqual([]);
            expect(cells.size).toBe(0);
            expect(logService.addEntry.mock.calls).toEqual([
                [CAMPAIGN, abilityUseRow('Asleep', 'Unconscious')],
                [CAMPAIGN, {
                    type: 'save_result',
                    characterName: CASTER,
                    rollType: 'save-eyebite',
                    targetName: NPC,
                    saveDc: SAVE_DC,
                    saveType: 'WIS',
                    success: false,
                    description: `${NPC} must make a WIS save (DC ${SAVE_DC}) against Eyebite (Asleep)...`,
                }],
            ]);
            expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();
        });
    });

    it('popup stays open and Done closes the modal exactly once', async () => {
        const props = makeProps();
        render(<EyebiteEffectModal {...props} />);
        await selectAndConfirm('Asleep');

        const done = await screen.findByRole('button', { name: 'Done' });
        expect(props.onClose).not.toHaveBeenCalled();
        fireEvent.click(done);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });
});
