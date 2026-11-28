// @maintained-by-ai 2026-11-27
// #1884 charmSpellUtils.aura-immunity — canonical home (pair #1884/#1885) for the
// handleCharmSpell aura-immunity suppression leg + legacy-charmed-write control.
// CLA-020: Aura of Devotion — the Charm Person/Monster failed-save leg is gated by the
// CLA-019 aura condition-immunity channel: protected targets SUPPRESS Charmed (suppression
// logged, zero writes); unprotected control still gets charmed byte-identical.
//
// Pair + canonical-home split (recorded 2026-10-16, re-verified against source bytes 2026-11-27):
// - THIS file (#1884) drives the REAL charmPerson shell live via handle() → real
//   charmSpellUtils (the :10 "only pair file that does" claim re-verified 2026-11-27: the
//   charmMonster/charmPerson shell tests (#1927/#1928 pair) vi.mock handleCharmSpell and pin
//   delegation config tables only; #1885 calls handleCharmSpell directly). Owned here:
//   applyCharmFailure immunity gate (auraCoversCondition('charmed'), utils:104) +
//   applyCharmImmunityLeg suppression (real logAuraConditionImmunity/describeAuraImmunity log
//   copy), legacy-write control (activeConditions dedup/preserve + case-fold filter,
//   activeConditionMeta merge, non-array store guard, addExpiration latch, condition/
//   save_result/ability_use logs), resolveCharmTargetNames refusal popup
//   (config.noTargetDescription), empty-combat refusal popup, charmPerson-only
//   saveConditions:['charmed'] prompt spread (utils:191 branch OPENING with saveConditions —
//   per #1928 handoff; the closing/absent leg is pinned by #1885's exact-shape charmMonster
//   prompts, cited not re-pinned), multi-target immunity differential, buildCharmSummary
//   immune-tail (both branches, full strings).
// - #1885 metamagic-disadvantage: rollNpcSave 2d20 keep-low (creature + no-creature
//   paths) + foldMagicalAmbush fold + metamagicHeighten disadvantage transport.
// - Shell delegation faces live in charmMonsterHandler.test.js / charmPersonHandler.test.js
//   (each keeps its own 3-test suite); NOT restated here. The humanoid gate is upstream in
//   charmPersonService.js:11/:77-83 (service lane, not shell/utils) — no gate spec pinned here.
// - Out-of-pair seams: PFEG ward block lives in saveProcessing.js
//   (saveProcessing.pfeg-charm-immunity.test.js — green per-condition ward-filter lane, do not touch);
//   dominateHandler.js / crownOfMadnessHandler.js consume rollNpcSave in their own lanes;
//   auraConditionImmunity.test.js unit-pins the channel itself — so the frightened-only
//   coverage-does-not-suppress-charmed parity case was DROPPED here as redundant
//   (auraConditionImmunity.test.js:110 pins auraCoversCondition({immunities:['frightened']},
//   'CHARMED') === false; the write leg it also exercised is pinned by the control test).
//
// Mock boundaries (sweep 2026-11-27): the aura channel is stripped down one level — only
// computeAuraComboEffects (the roster/range scan) is stubbed; getAuraConditionImmunities
// (empty-roster inert guard), auraCoversCondition and logAuraConditionImmunity run REAL, so
// the gate, guard and log copy under test are the production ones. spellNoticePopup is the
// REAL builder (mirror-mock purged); its three module-graph imports (concentrationService/
// combatData/storage) are stubbed as import-graph isolation only — never called on this lane
// (stinkingCloudHandler.areaSave.test.js precedent). rollD20 stays mocked as a determinism
// guard — no test reaches the no-creature auto-roll path (every NPC here is in the combat list).
//
// Timestamps: Date.now frozen to FROZEN_TS; exactly two stamped outlets verified in source —
// logAuraConditionImmunity's immunity log and the condition-applied log (utils:143). The
// ability_use/save_result logs carry NO timestamp field. addExpiration latch pins the
// combat-scoped effects payload — no minutes×10 rounds and no clock in this source
// (no-timers policy). No wall-clock advancement in tests.
//
// Caller liveness (grep-verified 2026-11-27): automation/index.js:546/:547 dynamically
// dispatch charm_person/charm_monster → the two shells → handleCharmSpell. Registration is
// the live production lane. No game timers — turn-based; all promises settle per-cast.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const logEntries = [];
const addedResults = [];
const FROZEN_TS = 1700000000000;

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 16),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const runtimeStore = {};
const setCalls = [];
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}:${key}`],
    setRuntimeValue: (name, key, value) => { setCalls.push({ name, key, value }); runtimeStore[`${name}:${key}`] = value; },
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { logEntries.push(entry); return Promise.resolve(); },
}));

const expirationCalls = [];
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn((args) => { expirationCalls.push(args); }),
}));

// Base impl survives vi.clearAllMocks (impl, not mockReturnValue). Every NPC auto-roll on
// this lane hits the creature path; the fixed-failure die feeds the dispatch payload pin.
vi.mock('../../../rules/combat/applyDamage.js', () => ({
    rollSaveForCreature: vi.fn(() => ({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 8), // determinism guard — never invoked on this lane
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
    sendSaveResult: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn((campaignName, r) => { addedResults.push(r); return Promise.resolve(); }),
}));

// REAL spellNoticePopup; only its import-graph deps stubbed (never called on this lane).
vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));
vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));
vi.mock('../../../ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn() },
}));

// Aura channel: ElderPaladin hosts Aura of Devotion (charmed); Thug 1 is the control.
// Only the roster/range scan is stubbed — the empty-roster inert guard, auraCoversCondition
// and logAuraConditionImmunity stay REAL, so the gate + log shape under test are production.
vi.mock('../../../combat/auras/auraComboEffects.js', () => ({
    computeAuraComboEffects: vi.fn(async ({ targetName }) => (
        targetName === 'Thug 1'
            ? { immunities: [], immunitySources: {} }
            : { immunities: ['charmed'], immunitySources: { charmed: 'ElderPaladin' } }
    )),
}));
vi.mock('../../../combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return { ...actual, getAuraConditionImmunities: vi.fn(actual.getAuraConditionImmunities) };
});

import { handle } from './charmPersonHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';
import { getAuraConditionImmunities } from '../../../combat/auras/auraConditionImmunity.js';
import { computeAuraComboEffects } from '../../../combat/auras/auraComboEffects.js';

const campaignName = 'test-campaign';

const FAILED_SAVE = { success: false, roll: 5, total: 5, saveBonus: 0 };

const devotionCharacters = [
    { name: 'ElderPaladin', computedStats: { automation: { passives: [{ name: 'Aura of Protection' }, { name: 'Aura of Devotion', type: 'passive_buff', target: 'allies_in_range', range_expression: '10_ft', conditionImmunity: 'charmed', casting_time: 'passive' }] } } },
];

function playerStats() {
    return { name: 'HexWarlock', level: 14, proficiency: 5, abilities: [{ name: 'Charisma', bonus: 3 }] };
}

// Merges overrides (lane convention: makeAction-style helpers merge unless documented).
function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Charm Person',
        automation: { type: 'charm_person', saveDc: 16, ...automationOverrides },
        metaCtx: { characters: devotionCharacters },
        ...rest,
    };
}

async function castCharmPerson(targetName, { metaCtx = { characters: devotionCharacters }, saveResult = FAILED_SAVE } = {}) {
    getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'player' }] });
    createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve(saveResult) });
    return await handle(makeAction({ metaCtx, automation: { targetName } }), playerStats(), campaignName, null);
}

const abilityUseLog = (targetName, description) => ({
    type: 'ability_use',
    characterName: 'HexWarlock',
    abilityName: 'Charm Person',
    description,
    promptId: 'p-1',
});
const immunityLog = (targetName) => ({
    type: 'automation',
    automationType: 'condition_immunity_aura',
    characterName: targetName,
    sourceName: 'ElderPaladin',
    abilityName: 'Charm Person',
    description: `${targetName} is immune to Charmed (Aura of Devotion from ElderPaladin) — condition not applied.`,
    timestamp: FROZEN_TS,
});
const saveResultLog = (targetName, description) => ({
    type: 'save_result',
    characterName: 'HexWarlock',
    rollType: 'save-charm-person',
    targetName,
    saveDc: 16,
    saveType: 'WIS',
    success: false,
    description,
});

beforeEach(() => {
    vi.clearAllMocks();
    logEntries.length = 0;
    setCalls.length = 0;
    addedResults.length = 0;
    expirationCalls.length = 0;
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    // Re-baseline EVERY overridable stub (clearAllMocks keeps mockReturnValue).
    getCombatContext.mockResolvedValue({ creatures: [] });
    createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve(FAILED_SAVE) });
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
});
let dateNowSpy;
afterEach(() => {
    dateNowSpy.mockRestore();
});

describe('CLA-020 Aura of Devotion — charm spell failed-save leg', () => {
    it('aura-covered ally: failed WIS save SUPPRESSES charmed — zero writes, ordered full-shape immunity logs, immune-tail summary', async () => {
        const popup = await castCharmPerson('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(setCalls).toHaveLength(0);
        expect(expirationCalls).toHaveLength(0);
        expect(addedResults).toEqual([{ targetName: 'EvasiveFighter', saveResult: 'failure', roll: 5, total: 5, conditions: [], appliedDamage: 0 }]);
        // The devotion roster is threaded from metaCtx to the aura scan boundary.
        expect(computeAuraComboEffects).toHaveBeenCalledWith({ targetName: 'EvasiveFighter', characters: devotionCharacters });

        // Ordered full-array commit census: cast prompt, then suppression log, then save_result.
        expect(logEntries).toEqual([
            abilityUseLog('EvasiveFighter', 'HexWarlock casts Charm Person on EvasiveFighter! EvasiveFighter must make a WIS save (DC 16) or become Charmed.'),
            immunityLog('EvasiveFighter'),
            saveResultLog('EvasiveFighter', 'EvasiveFighter failed WIS save against Charm Person but is immune to Charmed — condition not applied.'),
        ]);

        // Suppression-only cast: immune tail on the "No creatures charmed" summary branch,
        // composed by the REAL spellNoticePopup builder.
        expect(popup).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Charm Person',
                description: 'No creatures charmed. 0 creature(s) saved: . 1 creature(s) immune: EvasiveFighter.',
            },
        });
    });

    it('control target outside aura: failed WIS save applies charmed (legacy byte-shape intact)', async () => {
        const popup = await castCharmPerson('Thug 1');

        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
        expect(runtimeStore['Thug 1:activeConditionMeta']).toEqual({ charmed: { dc: 16, ability: 'wis' } });
        // Ordered commit census: exactly the two runtime writes, conditions before meta.
        expect(setCalls).toEqual([
            { name: 'Thug 1', key: 'activeConditions', value: ['charmed'] },
            { name: 'Thug 1', key: 'activeConditionMeta', value: { charmed: { dc: 16, ability: 'wis' } } },
        ]);
        expect(expirationCalls).toEqual([{
            attackerName: 'HexWarlock',
            targetName: 'Thug 1',
            effects: [{ type: 'charmed', condition: 'charmed' }],
            campaignName,
        }]);
        expect(addedResults).toEqual([{ targetName: 'Thug 1', saveResult: 'failure', roll: 5, total: 5, conditions: ['charmed'], appliedDamage: 0 }]);
        // Control IS queried through the channel — just uncovered (no suppression branch).
        expect(computeAuraComboEffects).toHaveBeenCalledWith({ targetName: 'Thug 1', characters: devotionCharacters });

        expect(logEntries).toEqual([
            abilityUseLog('Thug 1', 'HexWarlock casts Charm Person on Thug 1! Thug 1 must make a WIS save (DC 16) or become Charmed.'),
            {
                type: 'condition',
                action: 'applied',
                characterName: 'Thug 1',
                condition: 'Charmed',
                reason: 'Charm Person spell',
                note: 'Thug 1 is Charmed by HexWarlock and regards them as a friendly acquaintance. The spell ends if HexWarlock or their companions do anything harmful to Thug 1.',
                timestamp: FROZEN_TS,
            },
            saveResultLog('Thug 1', 'Thug 1 failed WIS save against Charm Person and is Charmed.'),
        ]);
        expect(popup.payload.description).toBe('1 creature(s) charmed: Thug 1. 0 creature(s) saved: .');
    });

    it('legacy-write dedup/preserve: re-cast on dirty state keeps other conditions, writes charmed exactly once, meta merge keeps unrelated keys', async () => {
        // Case-folded dedup branch (utils:110): existing 'CHARMED' is filtered, others
        // preserved, charmed lands once at the tail; meta spread keeps foreign keys.
        runtimeStore['Thug 1:activeConditions'] = ['Poisoned', 'CHARMED'];
        runtimeStore['Thug 1:activeConditionMeta'] = { poisoned: { dc: 12 }, charmed: { dc: 10, source: 'earlier-cast' } };

        await castCharmPerson('Thug 1');

        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['Poisoned', 'charmed']);
        expect(runtimeStore['Thug 1:activeConditionMeta']).toEqual({
            poisoned: { dc: 12 },
            charmed: { dc: 16, ability: 'wis', source: 'earlier-cast' },
        });
        // Fresh condition applied over an existing charmed: exactly one applied-log rides out.
        expect(logEntries.filter(e => e.type === 'condition' && e.action === 'applied')).toHaveLength(1);
        expect(expirationCalls).toHaveLength(1);
    });

    it('legacy-write guard: corrupt non-array activeConditions is replaced, not spread', async () => {
        runtimeStore['Thug 1:activeConditions'] = 'charmed'; // non-array corruption
        // Deleting the Array.isArray branch (utils:109) would spread chars: ['c','h',...,'d','charmed'].
        await castCharmPerson('Thug 1');
        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
    });

    it('NPC auto-save × aura immunity: suppressed leg rides the inline adjudication', async () => {
        const gnoll = { name: 'Gnoll', type: 'npc', saveBonuses: { wis: 2 } };
        getCombatContext.mockResolvedValue({ creatures: [gnoll] });

        const popup = await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16, targetName: 'Gnoll' } }), playerStats(), campaignName, null);

        // Inline adjudication arg order: rollSaveForCreature(creature, 'WIS', dc, disadvantage, advantage).
        expect(rollSaveForCreature).toHaveBeenCalledWith(gnoll, 'WIS', 16, false, false);
        // Full-shape dispatch payload: bonus→saveBonus rename + rawRolls transport.
        expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Gnoll', {
            promptId: 'p-1',
            success: false,
            roll: 3,
            total: 5,
            saveBonus: 2,
            rawRolls: [3],
        });

        expect(runtimeStore['Gnoll:activeConditions']).toBeUndefined();
        expect(setCalls).toHaveLength(0);
        expect(expirationCalls).toHaveLength(0);
        expect(addedResults).toEqual([{ targetName: 'Gnoll', saveResult: 'failure', roll: 5, total: 5, conditions: [], appliedDamage: 0 }]);

        expect(logEntries).toEqual([
            abilityUseLog('Gnoll', 'HexWarlock casts Charm Person on Gnoll! Gnoll must make a WIS save (DC 16) or become Charmed.'),
            immunityLog('Gnoll'),
            saveResultLog('Gnoll', 'Gnoll failed WIS save against Charm Person but is immune to Charmed — condition not applied.'),
        ]);
        expect(popup.payload.description).toBe('No creatures charmed. 0 creature(s) saved: . 1 creature(s) immune: Gnoll.');
    });

    it('charmPerson savePrompt spread: config.saveConditions reaches the listener (shell-only key, utils:191 branch opens)', async () => {
        await castCharmPerson('Thug 1');

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
            targetName: 'Thug 1',
            attackerName: 'HexWarlock',
            saveType: 'WIS',
            saveDc: 16,
            dcSuccess: 'none',
            advantage: false,
            disadvantage: false,
            condition: 'charmed',
            saveConditions: ['charmed'],
        });
    });

    it('callers that omit characters thread an empty roster through the REAL inert guard — legacy write intact', async () => {
        await castCharmPerson('EvasiveFighter', { metaCtx: {} });

        expect(getAuraConditionImmunities).toHaveBeenCalledWith({ targetName: 'EvasiveFighter', characters: [] });
        // Gate-ORDER zero-read: the empty-roster guard (auraConditionImmunity.js:10-12)
        // short-circuits BEFORE the roster scan ever runs.
        expect(computeAuraComboEffects).not.toHaveBeenCalled();
        expect(runtimeStore['EvasiveFighter:activeConditions']).toEqual(['charmed']);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('successful save on covered target: nothing lands, aura channel never read (success leg short-circuits before the gate)', async () => {
        const popup = await castCharmPerson('EvasiveFighter', { saveResult: { success: true, roll: 19, total: 19, saveBonus: 0 } });

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(setCalls).toHaveLength(0);
        // Gate-ORDER pin (utils:215-219): success returns via logSaveSuccess before
        // applyCharmFailure, so the aura channel is not read at all.
        expect(getAuraConditionImmunities).not.toHaveBeenCalled();
        expect(addedResults).toEqual([{ targetName: 'EvasiveFighter', saveResult: 'success', roll: 19, total: 19, conditions: [], appliedDamage: 0 }]);

        expect(logEntries).toEqual([
            abilityUseLog('EvasiveFighter', 'HexWarlock casts Charm Person on EvasiveFighter! EvasiveFighter must make a WIS save (DC 16) or become Charmed.'),
            {
                type: 'save_result',
                characterName: 'HexWarlock',
                rollType: 'save-charm-person',
                targetName: 'EvasiveFighter',
                saveDc: 16,
                saveType: 'WIS',
                success: true,
                description: 'EvasiveFighter succeeded on WIS save against Charm Person.',
            },
        ]);
        expect(popup.payload.description).toBe('No creatures charmed. 1 creature(s) saved: EvasiveFighter.');
    });

    it('multi-target differential: protected suppressed, control charmed, summary reports both', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'EvasiveFighter', type: 'player' },
                { name: 'Thug 1', type: 'player' },
            ],
        });

        const popup = await handle(makeAction({ metaCtx: { charmPersonTargets: ['EvasiveFighter', 'Thug 1'], characters: devotionCharacters } }), playerStats(), campaignName, null);

        // metaCtx.charmPersonTargets precedence + ordered per-target prompts (utils:273 loop).
        expect(createSaveListener.mock.calls.map(c => c[1].targetName)).toEqual(['EvasiveFighter', 'Thug 1']);
        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
        // Only the control writes; order conditions→meta, Thug 1 only.
        expect(setCalls).toEqual([
            { name: 'Thug 1', key: 'activeConditions', value: ['charmed'] },
            { name: 'Thug 1', key: 'activeConditionMeta', value: { charmed: { dc: 16, ability: 'wis' } } },
        ]);
        expect(logEntries.filter(e => e.automationType === 'condition_immunity_aura').map(e => e.characterName)).toEqual(['EvasiveFighter']);
        expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
        expect(popup.payload.description).toBe('1 creature(s) charmed: Thug 1. 0 creature(s) saved: . 1 creature(s) immune: EvasiveFighter.');
    });

    it('no target selected: refusal popup carries config.noTargetDescription, zero-read of every later channel', async () => {
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Nobody', type: 'player' }] });
        const popup = await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16 } }), playerStats(), campaignName, null);

        expect(popup).toEqual({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Charm Person', description: 'No target selected. Charm Person has no effect.' },
        });
        // Gate-ORDER (utils:255-256): refusal precedes rollback, prompt, aura and log legs.
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(getAuraConditionImmunities).not.toHaveBeenCalled();
        expect(setCalls).toHaveLength(0);
        expect(logEntries).toEqual([]);
    });

    it('empty combat: refusal popup before target resolution, zero reads downstream', async () => {
        // getCombatContext base in beforeEach is already { creatures: [] }.
        const popup = await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16, targetName: 'Thug 1' } }), playerStats(), campaignName, null);

        expect(popup).toEqual({
            type: 'popup',
            payload: { type: 'automation_info', name: 'Charm Person', description: 'No creatures in combat. Charm Person has no effect.' },
        });
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(getAuraConditionImmunities).not.toHaveBeenCalled();
        expect(setCalls).toHaveLength(0);
        expect(logEntries).toEqual([]);
    });
});
