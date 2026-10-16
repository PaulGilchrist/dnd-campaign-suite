// CLA-219 / #1885: charm NPC inline adjudication honours the Heightened Spell /
// Magical Ambush disadvantage transport — 2d20 keep-low, applied once.
//
// Pair seam map (canonical split recorded in charmSpellUtils.aura-immunity.test.js header):
// - #1884 (aura-immunity): REAL charmPerson shell, applyCharmFailure legacy writes,
//   immunity suppression leg, saveConditions:['charmed'] spread, summary immune-tail.
// - #1885 (THIS file): rollNpcSave 2d20 keep-low (creature + no-creature paths),
//   foldMagicalAmbush fold + early-return guard (utils:234), metamagicHeighten
//   disadvantage transport (utils:180), resolveCharmTargetNames precedence + no-target
//   refusal (utils:162-166), buildCharmSummary saved-only branch, charmAdvantages
//   advantage leg (utils:178), storeSpellLastAttack once-per-cast pre-loop (utils:259).
//
// KNOWN FLAG, resolved honestly (pair header line: "hand-writes a charmMonster-shaped
// config and calls handleCharmSpell directly"): charmMonsterHandler.js builds its config
// literal INLINE inside handle() and exports NO config object, so importing the real
// shell config is impossible without a production refactor. The shell pair (#1883) mocks
// handleCharmSpell and pins the delegation table only; this file drives handleCharmSpell
// DIRECTLY to isolate the metamagic transport through the charm utils without two shells'
// noise. The CHARMSHIELD_CONFIG below is therefore byte-matched to
// charmMonsterHandler.js:4-10 (targetsKey, advantagesKey, rollType, noTargetDescription,
// logPrefix '[charmMonster] Error:') and DELIBERATELY omits saveConditions — that key is
// charmPerson-only (charmPersonHandler.js:9). The charmMonster prompt objects pinned here
// are EXACT-shape, so the utils false-spread branch (`...(config.saveConditions ? … : {})`,
// utils:191) closing WITHOUT saveConditions is pinned here while #1884 pins it opening
// WITH saveConditions:['charmed'] for charmPerson.
//
// Caller liveness (grep-verified 2026-10-16): automation/index.js:546/:547 dynamically
// dispatch charm_person/charm_monster → the two shells → handleCharmSpell. The chooser
// lane useComplexSpellHandlers.js:181 → charmMonsterService.triggerCharmMonster rebuilds
// the action via charmActionMetaCtx (carries metamagicHeighten + charmMonsterTargets +
// charmMonsterAdvantages) and re-enters executeHandler — the lane that bypasses
// executeSpellCast's choke-point fold, which is exactly why utils' foldMagicalAmbush
// exists. magical_ambush passive is real: public/data/classes.json:9974.
// No game timers — turn-based; every promise settles per-cast via await.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const logEntries = [];
const addedResults = [];
const expirationCalls = [];
const setCalls = [];
const callOrder = [];
const runtimeStore = {};

vi.mock('../../../dice/diceRoller.js', () => ({
    rollD20: vi.fn(() => 10),
}));

vi.mock('../../../combat/auras/auraConditionImmunity.js', () => ({
    getAuraConditionImmunities: vi.fn(() => Promise.resolve(null)),
    auraCoversCondition: vi.fn(() => false),
    logAuraConditionImmunity: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Keep-real spy: rollSaveForCreature's production keep-low mode resolution must stay
// LIVE for the creature-path pins, while the spy captures arg order
// (creature, 'WIS', dc, disadvantage, advantage) as the arg-order catcher.
vi.mock('../../../rules/combat/applyDamage.js', async (importActual) => {
    const actual = await importActual();
    return { ...actual, rollSaveForCreature: vi.fn(actual.rollSaveForCreature) };
});

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
    sendSaveResult: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => runtimeStore[`${name}:${key}`]),
    setRuntimeValue: vi.fn((name, key, value) => { setCalls.push({ name, key, value }); runtimeStore[`${name}:${key}`] = value; }),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn((campaignName, entry) => { logEntries.push(entry); return Promise.resolve(); }),
}));

vi.mock('./areaSpellUtils.js', () => ({
    spellNoticePopup: vi.fn((name, description) => ({ type: 'popup', payload: { type: 'automation_info', name, description } })),
}));

import { rollNpcSave, handleCharmSpell } from './charmSpellUtils.js';
import { rollD20 } from '../../../dice/diceRoller.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { sendSaveResult } from '../../../combat/conditions/savePromptService.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';
import { spellNoticePopup } from './areaSpellUtils.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'AasimarTest';

// Byte-matched to the inline literal in charmMonsterHandler.js:4-10 — see KNOWN FLAG
// header. Omits saveConditions (charmPerson-only key, charmPersonHandler.js:9).
const CHARMSHIELD_CONFIG = {
    targetsKey: 'charmMonsterTargets',
    advantagesKey: 'charmMonsterAdvantages',
    rollType: 'save-charm-monster',
    noTargetDescription: 'No target selected. Charm Monster has no effect.',
    logPrefix: '[charmMonster] Error:',
};

const ambushPlayerStats = () => ({
    name: CASTER,
    level: 20,
    proficiency: 6,
    automation: { passives: [{ type: 'passive_rule', effect: 'magical_ambush' }] },
});

const plainPlayerStats = () => ({
    name: CASTER,
    level: 20,
    proficiency: 6,
    automation: { passives: [] },
});

function bandit(name = 'Bandit 1') {
    return { name, type: 'npc', saveBonuses: { wis: 2 } };
}

function charmAction({ metaCtx = {}, automationOverrides = {}, name = 'Charm Monster' } = {}) {
    return {
        name,
        automation: { type: 'charm_monster', saveDc: 14, ...automationOverrides },
        metaCtx,
    };
}

async function cast({ metaCtx = {}, automationOverrides = {}, playerStats = ambushPlayerStats() } = {}) {
    return handleCharmSpell(charmAction({ metaCtx, automationOverrides }), playerStats, CAMPAIGN, CHARMSHIELD_CONFIG);
}

// Exact-shape prompt object: proves charmMonster's saveConditions spread branch stays CLOSED.
function promptFor(targetName, { advantage = false, disadvantage = false } = {}) {
    return {
        targetName,
        attackerName: CASTER,
        saveType: 'WIS',
        saveDc: 14,
        dcSuccess: 'none',
        advantage,
        disadvantage,
        condition: 'charmed',
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    logEntries.length = 0;
    addedResults.length = 0;
    expirationCalls.length = 0;
    setCalls.length = 0;
    callOrder.length = 0;
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];

    rollD20.mockReturnValue(5);
    getCombatContextResolved();
    createSaveListener.mockImplementation((campaignName, cfg) => {
        callOrder.push(`prompt:${cfg.targetName}`);
        return { promptId: 'p-1', promise: Promise.resolve({ success: false, roll: 5, total: 5, bonus: 0 }) };
    });
    storeSpellLastAttack.mockImplementation(() => { callOrder.push('storeSpellLastAttack'); });
    addTargetResult.mockImplementation((campaignName, r) => { addedResults.push(r); return Promise.resolve(); });
    spellNoticePopup.mockImplementation((name, description) => ({ type: 'popup', payload: { type: 'automation_info', name, description } }));
});

function getCombatContextResolved(creatures = [bandit()]) {
    // getCombatContext is a module mock — re-resolve roster per test via the vi.fn.
    getCombatContext.mockResolvedValue({ creatures });
}

describe('CLA-219 rollNpcSave disadvantage (2d20 keep-low, creature + no-creature paths)', () => {
    it('keeps the lower die on disadvantage (no creature)', () => {
        rollD20.mockReturnValueOnce(15).mockReturnValueOnce(4);

        const result = rollNpcSave(null, 14, false, true);

        expect(result.rawRolls).toEqual([15, 4]);
        expect(result.roll).toBe(4);
        expect(result.success).toBe(false);
    });

    it('rolls a single kept die when neither advantage nor disadvantage (control)', () => {
        rollD20.mockReturnValue(15);

        const result = rollNpcSave(null, 14, false, false);

        expect(result.roll).toBe(15);
        expect(result.success).toBe(true);
    });

    it('keeps the lower die on disadvantage via the creature path (REAL rollSaveForCreature, arg order caught)', () => {
        rollD20.mockReturnValueOnce(17).mockReturnValueOnce(3);

        const creature = bandit();
        const result = rollNpcSave(creature, 14, false, true);

        // Arg-order catcher: rollSaveForCreature(creature, 'WIS', dc, disadvantage, advantage).
        expect(rollSaveForCreature).toHaveBeenCalledWith(creature, 'WIS', 14, true, false);
        expect(result.rawRolls).toEqual([17, 3]);
        expect(result.roll).toBe(3);
        expect(result.total).toBe(5);
    });

    it('advantage still keeps the higher die when disadvantage absent', () => {
        rollD20.mockReturnValueOnce(5).mockReturnValueOnce(18);

        const result = rollNpcSave(null, 14, true, false);

        expect(result.roll).toBe(18);
        expect(result.success).toBe(true);
    });
});

describe('CLA-219 foldMagicalAmbush — invisibility fold + early-return guard (utils:234-241)', () => {
    it('folds Magical Ambush invisibility into save disadvantage when metaCtx lacks the flag', async () => {
        runtimeStore[`${CASTER}:activeConditions`] = ['Invisible'];

        const popup = await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1'] } });

        expect(getRuntimeValue).toHaveBeenCalledWith(CASTER, 'activeConditions', CAMPAIGN);
        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1', { disadvantage: true }));
        // Folded flag rides the auto-roll exactly once: disadvantage 4th arg.
        expect(rollSaveForCreature).toHaveBeenCalledTimes(1);
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, true, false);
        const abilityUse = logEntries.find(e => e.type === 'ability_use');
        expect(abilityUse.description).toBe('AasimarTest casts Charm Monster on Bandit 1! Bandit 1 must make a WIS save (DC 14) with Disadvantage or become Charmed.');
        expect(popup.payload.description).toBe('1 creature(s) charmed: Bandit 1. 0 creature(s) saved: .');
    });

    it('does not fold when caster is visible (control)', async () => {
        runtimeStore[`${CASTER}:activeConditions`] = [];

        await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1'] } });

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1'));
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, false, false);
    });

    it('does not fold when caster lacks the magical_ambush passive (control)', async () => {
        runtimeStore[`${CASTER}:activeConditions`] = ['Invisible'];

        await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1'] }, playerStats: plainPlayerStats() });

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1'));
    });

    it('early-return guard: pre-set metamagicHeighten + invisible caster leaves action.metaCtx untouched — disadvantage still applied exactly once', async () => {
        runtimeStore[`${CASTER}:activeConditions`] = ['Invisible'];
        const action = charmAction({ metaCtx: { charmMonsterTargets: ['Bandit 1'], metamagicHeighten: true } });
        const metaRef = action.metaCtx;

        await handleCharmSpell(action, ambushPlayerStats(), CAMPAIGN, CHARMSHIELD_CONFIG);

        // Guard (utils:234) returns BEFORE the passive/condition reads — a removed guard
        // would re-spread a NEW metaCtx object here and re-pollute the transport.
        expect(action.metaCtx).toBe(metaRef);
        expect(getRuntimeValue).not.toHaveBeenCalledWith(CASTER, 'activeConditions', CAMPAIGN);
        // One prompt, disadvantage:true once, one auto-roll with the flag in arg 4.
        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1', { disadvantage: true }));
        expect(rollSaveForCreature).toHaveBeenCalledTimes(1);
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, true, false);
    });
});

describe('CLA-219 metamagicHeighten direct transport (utils:180, no ambush passive needed)', () => {
    it('metaCtx.metamagicHeighten alone reaches prompt disadvantage and rollSaveForCreature arg 4', async () => {
        // Plain caster: no magical_ambush passive, not invisible — only Heightened Spell rides.
        const popup = await cast({
            metaCtx: { charmMonsterTargets: ['Bandit 1'], metamagicHeighten: true },
            playerStats: plainPlayerStats(),
        });

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1', { disadvantage: true }));
        // Arg-order catcher: disadvantage is the 4th arg (advantage 5th stays false).
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, true, false);
        expect(logEntries.find(e => e.type === 'ability_use').description)
            .toBe('AasimarTest casts Charm Monster on Bandit 1! Bandit 1 must make a WIS save (DC 14) with Disadvantage or become Charmed.');
        expect(popup.payload).toMatchObject({ type: 'automation_info', name: 'Charm Monster' });
        expect(popup.type).toBe('popup');
    });

    it('control: no flag at all → prompt disadvantage:false and clean auto-roll args', async () => {
        await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1'] }, playerStats: plainPlayerStats() });

        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1'));
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, false, false);
    });
});

describe('resolveCharmTargetNames — metaCtx precedence and no-target refusal (utils:162-170)', () => {
    it('metaCtx.charmMonsterTargets beats automation.targetName (precedence)', async () => {
        getCombatContextResolved([bandit('Bandit 1'), bandit('Bandit 2')]);

        await cast({
            metaCtx: { charmMonsterTargets: ['Bandit 1'] },
            automationOverrides: { targetName: 'Bandit 2' },
        });

        // Only the metaCtx target is adjudicated; the decoy never enters the pipeline.
        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1'));
        expect(sendSaveResult).toHaveBeenCalledTimes(1);
        expect(sendSaveResult).toHaveBeenCalledWith(CAMPAIGN, 'Bandit 1', expect.objectContaining({ promptId: 'p-1' }));
        expect(logEntries.filter(e => e.type === 'ability_use')).toHaveLength(1);
        expect(createSaveListener.mock.calls.every(([, cfg]) => cfg.targetName !== 'Bandit 2')).toBe(true);
        expect(rollSaveForCreature.mock.calls.every(c => c[0].name !== 'Bandit 2')).toBe(true);
    });

    it('no-target refusal: exact charmMonster-shaped popup, pipeline never opens', async () => {
        const popup = await cast({ metaCtx: {} });

        expect(spellNoticePopup).toHaveBeenCalledWith('Charm Monster', 'No target selected. Charm Monster has no effect.');
        expect(popup.payload).toEqual({ type: 'automation_info', name: 'Charm Monster', description: 'No target selected. Charm Monster has no effect.' });
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(rollSaveForCreature).not.toHaveBeenCalled();
        expect(setCalls).toHaveLength(0);
        expect(expirationCalls).toHaveLength(0);
        expect(logEntries).toHaveLength(0);
    });
});

describe('buildCharmSummary — saved-only branch (empty immune tail, full string)', () => {
    it('all targets saved: "No creatures charmed" branch with empty immune tail, zero charm writes', async () => {
        rollD20.mockReturnValue(19); // auto-roll 19 + wis 2 = 21 ≥ 14, consistent with listener success
        createSaveListener.mockImplementation((campaignName, cfg) => {
            callOrder.push(`prompt:${cfg.targetName}`);
            return { promptId: 'p-1', promise: Promise.resolve({ success: true, roll: 19, total: 21, bonus: 2 }) };
        });

        const popup = await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1'] } });

        expect(popup.payload.description).toBe('No creatures charmed. 1 creature(s) saved: Bandit 1.');
        expect(addedResults).toHaveLength(1);
        expect(addedResults[0]).toMatchObject({ targetName: 'Bandit 1', saveResult: 'success', conditions: [], appliedDamage: 0 });
        expect(setCalls).toHaveLength(0);
        expect(expirationCalls).toHaveLength(0);
    });
});

describe('charmAdvantages advantage leg (utils:178)', () => {
    it('metaCtx.charmMonsterAdvantages[targetName] → prompt advantage:true + rollSaveForCreature arg 5 true', async () => {
        // Producer live: charmMonsterService.js:51-53 fills charmMonsterAdvantages from
        // getTargetHealthAdvantage on the multi-target chooser rebuild.
        await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1'], charmMonsterAdvantages: { 'Bandit 1': true } } });

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1', { advantage: true }));
        // Arg-order catcher: advantage is the 5th arg (disadvantage 4th stays false).
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, false, true);
        expect(logEntries.find(e => e.type === 'ability_use').description)
            .toBe('AasimarTest casts Charm Monster on Bandit 1! Bandit 1 must make a WIS save (DC 14) with Advantage or become Charmed.');
    });

    it('auto.advantage fallback (single-target chooser shape): same advantage:true prompt', async () => {
        await cast({ automationOverrides: { targetName: 'Bandit 1', advantage: true } });

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(CAMPAIGN, promptFor('Bandit 1', { advantage: true }));
        expect(rollSaveForCreature).toHaveBeenCalledWith(banditMatcher('Bandit 1'), 'WIS', 14, false, true);
    });
});

describe('storeSpellLastAttack — once per cast, before the target loop (utils:259)', () => {
    it('multi-target cast writes rollback snapshot exactly once, ahead of every save prompt', async () => {
        getCombatContextResolved([bandit('Bandit 1'), bandit('Bandit 2')]);

        await cast({ metaCtx: { charmMonsterTargets: ['Bandit 1', 'Bandit 2'] } });

        // saveType:'WIS' + saveDc:14 — the snapshot the rollback lane consumes.
        // attackScope pins utils:264's current shape (ternary yields 'single' both ways).
        expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
        expect(storeSpellLastAttack).toHaveBeenCalledWith(CAMPAIGN, {
            casterName: CASTER,
            spellName: 'Charm Monster',
            saveType: 'WIS',
            saveDc: 14,
            attackScope: 'single',
        });
        expect(callOrder).toEqual(['storeSpellLastAttack', 'prompt:Bandit 1', 'prompt:Bandit 2']);
        expect(createSaveListener).toHaveBeenCalledTimes(2);
    });
});

function banditMatcher(name) {
    // toHaveBeenCalledWith deep-equals, so hand the exact creature object the utils found.
    return expect.objectContaining({ name, type: 'npc' });
}
