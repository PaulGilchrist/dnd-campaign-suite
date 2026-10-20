// @maintained-by-ai
/**
 * Feature-decision lane: steps/features/stalkersFlurry.js (CLA-326) — the
 * ranger Gloom Stalker lv11 (2024) attack_rider post-hit decision on an armed
 * weapon_attack_hit: rider-shape filter, no-target gate, once-per-round gate
 * (holder-name latch, FT-082-style — never the cs.activeCreatureName mirror),
 * modal-pause contract (result carries ONLY `modal`, no `data`, so the
 * triggering hit's damage waits at the resume seam), resolved-option lanes
 * (Mass Fear call bytes incl. the secondary-target effectTarget byte-swap;
 * Sudden Strike pendingSuddenStrike arm + pendingSuddenStrikeTarget verbatim),
 * exact sideEffects write sequence (latch stamp + clearSkipFlag + five null
 * clears), round fallback to 1 when the second context read is empty, and the
 * armed/unarmed oncePerTurn pair (#903/#936).
 *
 * Lane map (cited, not re-pinned here):
 *  - Pipeline wiring of stalkersFlurryPostDamage (idx 19, damage:applied→
 *    cleave:check) → attackRollDamageSteps.test.js #1039 (structural cite).
 *  - Rider-filter exclusion of this feature by eldritchStrikes →
 *    eldritchStrikes.test.js #1051; THIS file owns the feature's OWN
 *    resolved decision lane it excludes.
 *  - Rider dispatch → attackRiderHandler.test.js · Mass Fear internals →
 *    massFearHandler.test.js (here only the exact call bytes) · modal UI →
 *    modals/shared/AttackRiderModal.test.jsx · resume seam (CLA-326) →
 *    useAttackDamageResolution.stalkersFlurryResume.test.js +
 *    CharActionModals.stalkersFlurry-resume.test.jsx · pendingSuddenStrike
 *    consumer → attackRollPostDamage lane · pending keys cleared →
 *    attackRollHousekeeping.
 *  - No wall-clock in source (turn-based, #app); source carries zero
 *    console.* lines — debug-log audit clean (#1056).
 *
 * StubStore decoy + determinism re-arm per #1057 exemplar: wrong-campaign reads
 * return a loud decoy object; a stale-mirror option planted under the wrong
 * character must NOT resolve the lane (modal still offered — FT-074 class).
 *
 * Old→new: modal assertions tightened from toMatchObject fragments to exact
 * full-result bytes incl. the no-`data` pause contract; mass-fear payload moved
 * from objectContaining to exact toEqual and its stamp filter-counts replaced by
 * the exhaustive ordered write sequence; once-per-turn guard gained exact
 * gate-arg pins + zero-store-read reach proof (#1035/#1026); sudden-strike
 * folded a secondary-target arm/no-arm pair; added contract+condition table,
 * rider-shape filter table, target-gate table, bogus-choice latch honesty
 * (#950), round-fallback WATCH, and the unarmed gate pair.
 * All 4 mocked modules are imported by stalkersFlurry.js — verified, no dead
 * mocks (#1049).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (exactly the 4 modules stalkersFlurry.js imports) ─────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../automation/common/oncePerTurn.js', () => ({
  checkOncePerTurnWithSkip: vi.fn(),
  clearSkipFlag: vi.fn(),
}));

vi.mock('../../../automation/handlers/combat/massFearHandler.js', () => ({
  resolveMassFear: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { stalkersFlurry } from './stalkersFlurry.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { checkOncePerTurnWithSkip, clearSkipFlag } from '../../../automation/common/oncePerTurn.js';
import { resolveMassFear } from '../../../automation/handlers/combat/massFearHandler.js';

// ── Fixtures ─────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const PREV = { formula: '1d8+2', total: 5 };
const CS = { round: 2, activeCreatureName: 'StaleMirrorName' };
const TARGET = { name: 'Thug 1' };

const SF = {
  name: "Stalker's Flurry",
  type: 'attack_rider',
  trigger: 'weapon_attack_hit',
  oncePerTurn: true,
  chooseOne: true,
  options: [
    { name: 'Sudden Strike', effect: 'sudden_strike' },
    { name: 'Mass Fear', effect: 'mass_fear' },
  ],
};
const OPT_MF = SF.options[1];

const STATS = { name: 'FeyRanger', automation: { passives: [SF] } };

// Key bytes derived by the source from sf.name (space→underscore).
const KEY_USED = "_Stalker's_Flurry_usedRound";
const KEY_SKIP = "_Stalker's_Flurry_skippedRound";
const KEY_OPT = "_Stalker's_Flurry_option";

// Full armed sideEffects write sequence (latch + option/target nulls).
const ARMED_SIDE_BYTES = [
  ['FeyRanger', KEY_USED, 2, CAMPAIGN],
  ['FeyRanger', KEY_OPT, null, CAMPAIGN],
  ['FeyRanger', 'stalkersFlurryChosenTarget', null, CAMPAIGN],
  ['FeyRanger', 'stalkersFlurrySecondaryTargets', null, CAMPAIGN],
  ['FeyRanger', 'stalkersFlurryPrimaryTarget', null, CAMPAIGN],
  ['FeyRanger', 'stalkersFlurryOptions', null, CAMPAIGN],
];

function makeCtx(passives = [SF]) {
  return {
    playerStats: { ...STATS, automation: { passives } },
    campaignName: CAMPAIGN,
    attack: { name: 'Longbow', damageType: 'Piercing' },
    setAttackRiderModal: vi.fn(),
  };
}

// Campaign/character-faithful store stub: reads on the wrong campaign lane
// return a loud decoy so a wrong-campaign read fails assertions (#1019/#1021).
function stubStore(map = {}) {
  getRuntimeValue.mockImplementation((character, key, campaign) => {
    if (campaign && campaign !== CAMPAIGN) return { name: 'DECOY-WRONG-CAMPAIGN' };
    return map[`${character}.${key}`] ?? null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Determinism re-arm: every stub re-armed even if only some tests tweak it.
  stubStore({});
  getCombatContext.mockResolvedValue(CS);
  getTargetFromAttacker.mockReturnValue(TARGET);
  checkOncePerTurnWithSkip.mockResolvedValue(null);
  resolveMassFear.mockResolvedValue(null);
});

// ── Tests ────────────────────────────────────────────────────────

describe('stalkersFlurry contract + condition', () => {
  it('step name is stalkersFlurry', () => {
    expect(stalkersFlurry.name).toBe('stalkersFlurry');
  });

  it.each([
    ['passives present', { automation: { passives: [SF] } }, true],
    ['passives empty array (truthy — filter rejects downstream)', { automation: { passives: [] } }, true],
    ['automation without passives', { automation: {} }, false],
    ['no automation at all', {}, false],
  ])('condition: %s → %s', (_label, playerStats, expected) => {
    expect(stalkersFlurry.condition({ campaignName: CAMPAIGN, playerStats })).toBe(expected);
  });

  it('throws TypeError honestly when playerStats is null', () => {
    expect(() => stalkersFlurry.condition({ campaignName: CAMPAIGN, playerStats: null })).toThrow(TypeError);
  });
});

describe('rider filter — off-shape passives bail with zero reads', () => {
  it.each([
    ['no passives', []],
    ['near-miss name (no space-apostrophe)', [{ ...SF, name: 'Stalkers Flurry' }]],
    ['wrong type', [{ ...SF, type: 'passive' }]],
    ['wrong trigger', [{ ...SF, trigger: 'melee_hit' }]],
    ['chooseOne false', [{ ...SF, chooseOne: false }]],
    ['empty options', [{ ...SF, options: [] }]],
  ])('%s → null, bails before any context/store/modal touch', async (_label, passives) => {
    const ctx = makeCtx(passives);

    expect(await stalkersFlurry.handler(ctx, PREV)).toBeNull();

    expect(getCombatContext).not.toHaveBeenCalled();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(checkOncePerTurnWithSkip).not.toHaveBeenCalled();
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(resolveMassFear).not.toHaveBeenCalled();
  });
});

describe('gates → { data: prevData } with zero side effects', () => {
  it.each([
    ['no combat context (cs null)', null, TARGET],
    ['no target from attacker', CS, null],
    ['target without name', CS, {}],
  ])('%s', async (_label, cs, target) => {
    getCombatContext.mockResolvedValue(cs);
    getTargetFromAttacker.mockReturnValue(target);
    const ctx = makeCtx();

    expect(await stalkersFlurry.handler(ctx, PREV)).toEqual({ data: PREV });

    // gate-order reach pins: the target gate precedes the round gate (#1035)
    if (cs) expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'FeyRanger');
    else expect(getTargetFromAttacker).not.toHaveBeenCalled();
    expect(checkOncePerTurnWithSkip).not.toHaveBeenCalled();
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('once-per-turn gate refuses a second trigger in the same round — exact gate args, no modal, no store reads past the gate', async () => {
    checkOncePerTurnWithSkip.mockResolvedValue({ type: 'popup', payload: { name: "Stalker's Flurry", description: 'already used' } });
    const ctx = makeCtx();

    const result = await stalkersFlurry.handler(ctx, PREV);

    expect(checkOncePerTurnWithSkip).toHaveBeenCalledWith("Stalker's Flurry", KEY_USED, KEY_SKIP, ctx.playerStats, CAMPAIGN);
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(ctx.setAttackRiderModal).not.toHaveBeenCalled();
    expect(resolveMassFear).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(result).toEqual({ data: PREV });
  });

  it('oncePerTurn:false never consults the gate — modal offered even with a loud skip byte', async () => {
    checkOncePerTurnWithSkip.mockResolvedValue({ type: 'popup' });
    const ctx = makeCtx([{ ...SF, oncePerTurn: false }]);

    const result = await stalkersFlurry.handler(ctx, PREV);

    expect(checkOncePerTurnWithSkip).not.toHaveBeenCalled();
    expect(result.modal.props.action.oncePerTurn).toBe(false);
  });
});

describe('fresh armed hit, option unchosen → modal pause (CLA-326)', () => {
  it('offers the modal with exact bytes, holds data at the resume seam, writes nothing — stale option under the wrong character never resolves', async () => {
    // stale-mirror falsifier (FT-074 class): a resolved option planted under
    // the wrong character must NOT be consumed by the FeyRanger lane.
    stubStore({ [`StaleMirrorName.${KEY_OPT}`]: 'Mass Fear' });
    const ctx = makeCtx();

    const result = await stalkersFlurry.handler(ctx, PREV);

    expect(getRuntimeValue).toHaveBeenCalledWith('FeyRanger', KEY_OPT, CAMPAIGN);
    expect(checkOncePerTurnWithSkip).toHaveBeenCalledTimes(1);
    expect(ctx.setAttackRiderModal).toHaveBeenCalledWith({ action: SF, playerStats: ctx.playerStats, campaignName: CAMPAIGN, targetName: 'Thug 1' });
    // Pause contract: result carries ONLY modal — no data key until resume.
    expect(result).toEqual({
      modal: { type: 'stalkersFlurry', props: { action: SF, playerStats: ctx.playerStats, campaignName: CAMPAIGN, targetName: 'Thug 1' } },
    });
    expect(resolveMassFear).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('resolved option lanes', () => {
  it('Mass Fear → exact resolveMassFear payload with secondary-target byte-swap, then exact latch/clear write sequence', async () => {
    // secondaryTarget ('Goblin 2') ≠ combat target ('Thug 1'): distinguishes
    // effectTarget = secondaryTarget || t.name bytes (#1022).
    stubStore({
      [`FeyRanger.${KEY_OPT}`]: 'Mass Fear',
      'FeyRanger.stalkersFlurryChosenTarget': 'Goblin 2',
    });
    const ctx = makeCtx();

    const result = await stalkersFlurry.handler(ctx, PREV);

    expect(result.data).toEqual(PREV);
    expect(result.modal).toBeUndefined();
    expect(resolveMassFear).toHaveBeenCalledTimes(1);
    expect(resolveMassFear).toHaveBeenCalledWith({
      campaignName: CAMPAIGN,
      casterName: 'FeyRanger',
      primaryTargetName: 'Goblin 2',
      option: OPT_MF,
      playerStats: ctx.playerStats,
    });
    expect(setRuntimeValue).not.toHaveBeenCalled(); // effect lives in resolveMassFear

    await result.sideEffects();

    expect(getCombatContext.mock.calls).toEqual([[CAMPAIGN], [CAMPAIGN]]);
    expect(clearSkipFlag).toHaveBeenCalledWith(KEY_SKIP, ctx.playerStats, CAMPAIGN);
    // FT-082: latch stamped to the HOLDER name, not the cs.activeCreatureName mirror.
    expect(setRuntimeValue.mock.calls).toEqual(ARMED_SIDE_BYTES);
  });

  it.each([
    ['with chosen secondary target', 'Goblin 2', [
      ['FeyRanger', 'pendingSuddenStrike', true, CAMPAIGN],
      ['FeyRanger', 'pendingSuddenStrikeTarget', 'Goblin 2', CAMPAIGN],
    ]],
    ['without secondary target', null, [
      ['FeyRanger', 'pendingSuddenStrike', true, CAMPAIGN],
    ]],
  ])('Sudden Strike %s → arms pendingSuddenStrike for the post-damage consumer, pendingSuddenStrikeTarget written only when a secondary was chosen', async (_label, secondary, preBytes) => {
    stubStore({
      [`FeyRanger.${KEY_OPT}`]: 'Sudden Strike',
      ...(secondary ? { 'FeyRanger.stalkersFlurryChosenTarget': secondary } : {}),
    });
    const ctx = makeCtx();

    const result = await stalkersFlurry.handler(ctx, PREV);

    expect(result.data).toEqual(PREV);
    expect(result.modal).toBeUndefined();
    expect(resolveMassFear).not.toHaveBeenCalled();
    expect(setRuntimeValue.mock.calls).toEqual(preBytes);

    await result.sideEffects();

    expect(setRuntimeValue.mock.calls).toEqual([...preBytes, ...ARMED_SIDE_BYTES]);
    expect(clearSkipFlag).toHaveBeenCalledWith(KEY_SKIP, ctx.playerStats, CAMPAIGN);
  });

  it('bogus chosen byte matches no option → no lane effect, but the once-per-turn latch is still consumed (honest latch)', async () => {
    stubStore({ [`FeyRanger.${KEY_OPT}`]: 'Force Cage' });
    const ctx = makeCtx();

    const result = await stalkersFlurry.handler(ctx, PREV);

    expect(resolveMassFear).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();

    await result.sideEffects();

    expect(setRuntimeValue.mock.calls).toEqual(ARMED_SIDE_BYTES);
    expect(clearSkipFlag).toHaveBeenCalledWith(KEY_SKIP, ctx.playerStats, CAMPAIGN);
  });

  it('missing combat context on the latch read → round falls back to 1, still stamped to the holder', async () => {
    getCombatContext.mockResolvedValueOnce(CS).mockResolvedValueOnce(null);
    stubStore({ [`FeyRanger.${KEY_OPT}`]: 'Mass Fear' });
    const ctx = makeCtx();

    const result = await stalkersFlurry.handler(ctx, PREV);
    await result.sideEffects();

    expect(setRuntimeValue.mock.calls).toEqual([
      ['FeyRanger', KEY_USED, 1, CAMPAIGN],
      ...ARMED_SIDE_BYTES.slice(1),
    ]);
  });
});
