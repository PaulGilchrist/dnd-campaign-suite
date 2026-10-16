// #1884 charmSpellUtils.aura-immunity — canonical home (pair #1884/#1885) for the
// handleCharmSpell aura-immunity suppression leg + legacy-charmed-write control.
// CLA-020: Aura of Devotion — the Charm Person/Monster failed-save leg is gated by the
// CLA-019 aura condition-immunity channel: protected targets SUPPRESS Charmed (suppression
// logged, zero writes); unprotected control still gets charmed byte-identical.
//
// Pair + canonical-home split (recorded 2026-10-16, verified at source):
// - THIS file (#1884) drives the REAL charmPerson shell live via handle() → real
//   charmSpellUtils (only pair file that does — charmMonster/charmPerson shells (#1883 pair)
//   mock handleCharmSpell and pin delegation config tables only). Owned here:
//   applyCharmImmunityLeg suppression (auraCoversCondition('charmed') gate, real
//   logAuraConditionImmunity channel), legacy-write control in applyCharmFailure
//   (activeConditions dedup/preserve + case-fold filter, activeConditionMeta merge,
//   non-array store guard, addExpiration latch, condition/save_result logs),
//   resolveCharmTargetNames refusal popup (config.noTargetDescription), empty-combat
//   refusal popup, charmPerson-only saveConditions:['charmed'] prompt spread
//   (utils line: ...(config.saveConditions ? { saveConditions } : {})), multi-target
//   immunity differential, buildCharmSummary immune-tail (both branches, full strings).
// - #1885 metamagic-disadvantage: rollNpcSave 2d20 keep-low (creature + no-creature
//   paths) + foldMagicalAmbush fold + metamagicHeighten disadvantage transport.
//   It hand-writes a charmMonster-shaped config and calls handleCharmSpell directly.
// - Out-of-pair seams: PFEG ward block lives in saveProcessing.js
//   (saveProcessing.pfeg-charm-immunity.test.js — it.fails FIXME lane, do not touch);
//   dominateHandler.js:174 / crownOfMadnessHandler.js:182 consume rollNpcSave in their
//   own lanes; auraConditionImmunity.test.js unit-pins the channel itself.
//
// Caller liveness (grep-verified 2026-10-16): automation/index.js:546/:547 dynamically
// dispatch charm_person/charm_monster → the two shells → handleCharmSpell. Registration is
// the live production lane. No game timers — turn-based; all promises settle per-cast.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const logEntries = [];
const addedResults = [];

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

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 8),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
    sendSaveResult: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn((campaignName, r) => { addedResults.push(r); return Promise.resolve(); }),
}));

vi.mock('./areaSpellUtils.js', () => ({
    spellNoticePopup: vi.fn((name, description) => ({ type: 'popup', payload: { type: 'automation_info', name, description } })),
}));

// Aura channel: ElderPaladin hosts Aura of Devotion (charmed); Thug 1 is the control.
// Only the roster query is stubbed — auraCoversCondition and logAuraConditionImmunity
// stay REAL, so the gate + log shape under test are the production ones.
vi.mock('../../../combat/auras/auraConditionImmunity.js', async (importActual) => {
    const actual = await importActual();
    return {
        ...actual,
        getAuraConditionImmunities: vi.fn(async ({ targetName }) => (
            targetName === 'Thug 1'
                ? { immunities: [], immunitySources: {} }
                : { immunities: ['charmed'], immunitySources: { charmed: 'ElderPaladin' } }
        )),
    };
});

import { handle } from './charmPersonHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack } from '../../common/damageRollback.js';
import { getAuraConditionImmunities } from '../../../combat/auras/auraConditionImmunity.js';

const campaignName = 'test-campaign';

const devotionCharacters = [
    { name: 'ElderPaladin', computedStats: { automation: { passives: [{ name: 'Aura of Protection' }, { name: 'Aura of Devotion', type: 'passive_buff', target: 'allies_in_range', range_expression: '10_ft', conditionImmunity: 'charmed', casting_time: 'passive' }] } } },
];

function playerStats() {
    return { name: 'HexWarlock', level: 14, proficiency: 5, abilities: [{ name: 'Charisma', bonus: 3 }] };
}

function setupMocks(targetName, saveResult = { success: false, roll: 5, total: 5, saveBonus: 0 }) {
    getCombatContext.mockResolvedValue({ creatures: [{ name: targetName, type: 'player' }] });
    createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve(saveResult) });
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

async function castCharmPerson(targetName, metaCtx = { characters: devotionCharacters }, saveResult = undefined) {
    setupMocks(targetName, ...(saveResult ? [saveResult] : []));
    return await handle(makeAction({ metaCtx, automation: { targetName } }), playerStats(), campaignName, null);
}

async function castCharmSuccess(targetName) {
    return castCharmPerson(targetName, { characters: devotionCharacters }, { success: true, roll: 19, total: 19, saveBonus: 0 });
}

beforeEach(() => {
    vi.clearAllMocks();
    logEntries.length = 0;
    setCalls.length = 0;
    addedResults.length = 0;
    expirationCalls.length = 0;
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve({ success: false, roll: 5, total: 5, saveBonus: 0 }) });
});

describe('CLA-020 Aura of Devotion — charm spell failed-save leg', () => {
    it('aura-covered ally: failed WIS save SUPPRESSES charmed — zero writes, immunity log names Aura of Devotion', async () => {
        const popup = await castCharmPerson('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(setCalls.filter(c => c.key === 'activeConditions' || c.key === 'activeConditionMeta')).toHaveLength(0);
        expect(expirationCalls).toHaveLength(0);

        const immunity = logEntries.filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0].type).toBe('automation');
        expect(immunity[0].characterName).toBe('EvasiveFighter');
        expect(immunity[0].sourceName).toBe('ElderPaladin');
        expect(immunity[0].abilityName).toBe('Charm Person');
        expect(immunity[0].description).toBe('EvasiveFighter is immune to Charmed (Aura of Devotion from ElderPaladin) — condition not applied.');

        expect(logEntries.some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
        const failed = logEntries.find(e => e.type === 'save_result' && e.success === false);
        expect(failed.description).toContain('failed WIS save against Charm Person but is immune to Charmed');

        expect(addedResults).toHaveLength(1);
        expect(addedResults[0]).toMatchObject({ targetName: 'EvasiveFighter', saveResult: 'failure', conditions: [] });

        // Suppression-only cast: immune tail on the "No creatures charmed" summary branch.
        expect(popup.payload.description).toBe('No creatures charmed. 0 creature(s) saved: . 1 creature(s) immune: EvasiveFighter.');
    });

    it('control target outside aura: failed WIS save applies charmed (legacy byte-shape intact)', async () => {
        await castCharmPerson('Thug 1');

        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
        expect(runtimeStore['Thug 1:activeConditionMeta'].charmed).toMatchObject({ dc: 16, ability: 'wis' });
        expect(expirationCalls).toHaveLength(1);
        expect(expirationCalls[0]).toEqual({
            attackerName: 'HexWarlock',
            targetName: 'Thug 1',
            effects: [{ type: 'charmed', condition: 'charmed' }],
            campaignName,
        });
        expect(logEntries.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Charmed' && e.reason === 'Charm Person spell')).toBe(true);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('legacy-write dedup/preserve: re-cast on dirty state keeps other conditions, writes charmed exactly once, meta merge keeps unrelated keys', async () => {
        // Case-folded dedup branch: existing 'CHARMED' is filtered, others preserved, charmed lands once at tail.
        runtimeStore['Thug 1:activeConditions'] = ['Poisoned', 'CHARMED'];
        runtimeStore['Thug 1:activeConditionMeta'] = { poisoned: { dc: 12 }, charmed: { dc: 10, source: 'earlier-cast' } };

        await castCharmPerson('Thug 1');

        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['Poisoned', 'charmed']);
        expect(runtimeStore['Thug 1:activeConditionMeta'].poisoned).toEqual({ dc: 12 });
        expect(runtimeStore['Thug 1:activeConditionMeta'].charmed).toEqual({ dc: 16, ability: 'wis', source: 'earlier-cast' });
        // Fresh condition applied over an existing charmed log twice — both writes ride the pipeline.
        expect(logEntries.filter(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Charmed')).toHaveLength(1);
        expect(expirationCalls).toHaveLength(1);
    });

    it('legacy-write guard: corrupt non-array activeConditions is replaced, not spread', async () => {
        runtimeStore['Thug 1:activeConditions'] = 'charmed'; // non-array corruption

        await castCharmPerson('Thug 1');

        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
    });

    it('NPC auto-save × aura immunity: suppressed leg rides the inline adjudication too', async () => {
        const gnoll = { name: 'Gnoll', type: 'npc', saveBonuses: { wis: 2 } };
        getCombatContext.mockResolvedValue({ creatures: [gnoll] });
        rollSaveForCreature.mockReturnValueOnce({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

        const popup = await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16, targetName: 'Gnoll' } }), playerStats(), campaignName, null);

        // Inline adjudication arg order: rollSaveForCreature(creature, 'WIS', dc, disadvantage, advantage).
        expect(rollSaveForCreature).toHaveBeenCalledWith(gnoll, 'WIS', 16, false, false);
        expect(sendSaveResult).toHaveBeenCalledWith(campaignName, 'Gnoll', expect.objectContaining({ promptId: 'p-1', success: false, roll: 3, total: 5 }));

        expect(runtimeStore['Gnoll:activeConditions']).toBeUndefined();
        expect(expirationCalls).toHaveLength(0);
        const immunity = logEntries.filter(e => e.automationType === 'condition_immunity_aura');
        expect(immunity).toHaveLength(1);
        expect(immunity[0].characterName).toBe('Gnoll');

        const abilityUse = logEntries.find(e => e.type === 'ability_use');
        expect(abilityUse.characterName).toBe('HexWarlock');
        expect(abilityUse.promptId).toBe('p-1');
        expect(abilityUse.description).toBe('HexWarlock casts Charm Person on Gnoll! Gnoll must make a WIS save (DC 16) or become Charmed.');

        expect(popup.payload.description).toBe('No creatures charmed. 0 creature(s) saved: . 1 creature(s) immune: Gnoll.');
    });

    it('charmPerson savePrompt spread: config.saveConditions reaches the listener (shell-only key, utils branch)', async () => {
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

    it('callers that omit characters thread an empty roster (real channel is inert) — legacy write intact', async () => {
        getAuraConditionImmunities.mockResolvedValueOnce({ immunities: [], immunitySources: {} });

        await castCharmPerson('EvasiveFighter', {});

        expect(getAuraConditionImmunities).toHaveBeenCalledWith({ targetName: 'EvasiveFighter', characters: [] });
        expect(runtimeStore['EvasiveFighter:activeConditions']).toEqual(['charmed']);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('successful save on covered target: nothing lands, no immunity log (legacy success leg)', async () => {
        const popup = await castCharmSuccess('EvasiveFighter');

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
        expect(logEntries.some(e => e.type === 'save_result' && e.success === true)).toBe(true);
        expect(addedResults).toHaveLength(1);
        expect(addedResults[0]).toMatchObject({ targetName: 'EvasiveFighter', saveResult: 'success', conditions: [] });
        expect(popup.payload.description).toContain('saved: EvasiveFighter');
    });

    it('multi-target differential: protected suppressed, control charmed, summary reports both', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'EvasiveFighter', type: 'player' },
                { name: 'Thug 1', type: 'player' },
            ],
        });

        const popup = await handle(makeAction({ metaCtx: { charmPersonTargets: ['EvasiveFighter', 'Thug 1'], characters: devotionCharacters } }), playerStats(), campaignName, null);

        expect(runtimeStore['EvasiveFighter:activeConditions']).toBeUndefined();
        expect(runtimeStore['Thug 1:activeConditions']).toEqual(['charmed']);
        expect(logEntries.filter(e => e.automationType === 'condition_immunity_aura')).toHaveLength(1);
        expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
        expect(popup.payload.description).toBe('1 creature(s) charmed: Thug 1. 0 creature(s) saved: . 1 creature(s) immune: EvasiveFighter.');
    });

    it('channel parity: frightened-only coverage (Aura of Courage host) does NOT suppress charmed', async () => {
        setupMocks('EvasiveFighter');
        getAuraConditionImmunities.mockResolvedValueOnce({ immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } });

        await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16, targetName: 'EvasiveFighter' } }), playerStats(), campaignName, null);

        expect(runtimeStore['EvasiveFighter:activeConditions']).toEqual(['charmed']);
        expect(logEntries.some(e => e.automationType === 'condition_immunity_aura')).toBe(false);
    });

    it('no target selected: refusal popup carries config.noTargetDescription, pipeline never opens', async () => {
        setupMocks('Nobody');
        const popup = await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16 } }), playerStats(), campaignName, null);

        expect(popup.payload.description).toBe('No target selected. Charm Person has no effect.');
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setCalls).toHaveLength(0);
    });

    it('empty combat: refusal popup, no prompt and no rollback write', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });
        createSaveListener.mockReturnValue({ promptId: 'p-1', promise: Promise.resolve({ success: false }) });

        const popup = await handle(makeAction({ automation: { type: 'charm_person', saveDc: 16, targetName: 'Thug 1' } }), playerStats(), campaignName, null);

        expect(popup.payload.description).toBe('No creatures in combat. Charm Person has no effect.');
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
    });
});
