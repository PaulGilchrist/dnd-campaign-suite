// @maintained-by-ai
/**
 * Feature-decision lane: steps/features/eldritchStrikes.js (CLA-109 fix).
 * Owns the weapon_attack_hit attack-rider decision bytes: the rider filter
 * (true attack_rider + weapon_attack_hit only; damageExpression riders and
 * the "Stalker's Flurry" near-miss name go to sibling lanes), the derived
 * "_Eldritch_Strike_usedRound" latch key (space→underscore — falsified by a
 * second rider name), the campaign-pinned round read getCurrentCombatRound(ctx
 * .campaignName) (eldritchStrikes.js:27 is the CORRECT sibling vs the no-arg
 * defect reported in #1050), the once-per-round strict byte latch (=== round,
 * including the 0-byte near-miss), the oncePerTurn:true/false armed/unarmed
 * pair (#903/#932), verbatim te stamps (#993) of registry effect
 * 'disadvantage_on_next_save' with value:null/noOpportunityAttacks:false
 * derived bytes, campaign-keyed write bytes (#1021), zero-guard-pass-throughs
 * that must not burn the latch (#1026/#1035), and exact log bytes (#app
 * logging mandate).
 *
 * Family map (steps/features/): stalkersFlurry.test.js owns the excluded
 * "Stalker's Flurry" riders; damageExpression riders route through the
 * pipeline-dispatch lane (#1034 owns dispatch); epitomeEmpoweredStrikes.js
 * (queued next) owns the no-arg round-read defect — distinct lane. No
 * sibling test executes eldritchStrikes internals; dispatch mentions only
 * (colossusSlayer.test.js:21) cite this file's correct campaignName arg.
 *
 * Store mock is faithful to useRuntimeState.js: getRuntimeValue is (characterKey,
 * propertyName) only (campaign-agnostic in-process read; write carries the
 * campaignName byte), so te accumulation across riders in one handler call
 * behaves like production. campaignName bytes on writes are pinned via
 * recorded write tuples (test-campaign is the only campaign touched, per
 * campaign-lockdown).
 *
 * Old→new: no-rider folded into the filter test; no-context + no-target +
 * no-options guards ×2→1 pass-through test with a latch-order falsifier;
 * same-round refused + re-arm + three-round loop consolidated into one
 * honest multi-call latch test (plus a fresh-armed second-rider byte read);
 * success te folded into exact-bytes pins; added armed/unarmed oncePerTurn
 * pair and multi-rider te append bytes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

// Faithful to useRuntimeState.js: reads are (characterKey, propertyName) —
// writes carry the campaign byte, recorded verbatim for pinning.
const runtimeStore = {};
const runtimeWrites = [];
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (characterKey, propertyName) => runtimeStore[`${characterKey}:${propertyName}`] ?? null,
  setRuntimeValue: (characterKey, propertyName, value, campaignName) => {
    runtimeWrites.push([characterKey, propertyName, value, campaignName]);
    runtimeStore[`${characterKey}:${propertyName}`] = value;
  },
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { eldritchStrikes } from './eldritchStrikes.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

// Verbatim automation block from public/data/{2024/,}classes.json Eldritch
// Strike (Warlock invocation, level 10) — no value/noOpportunityAttacks, so
// the te must carry value:null/noOpportunityAttacks:false derived bytes.
const RIDER = {
  name: 'Eldritch Strike',
  type: 'attack_rider',
  trigger: 'weapon_attack_hit',
  oncePerTurn: true,
  casting_time: 'passive',
  options: [{ name: 'Eldritch Strike', effect: 'disadvantage_on_next_save' }],
};

const LATCH = '_Eldritch_Strike_usedRound'; // verbatim: space→underscore, leading/trailing _
const TE = 'targetEffects';
const CAMPAIGN = 'test-campaign';

function makeCtx(riderOverrides = {}) {
  const rider = { ...RIDER, ...riderOverrides };
  return {
    campaignName: CAMPAIGN,
    playerStats: { name: 'EvasiveFighter', automation: { actions: [rider], passives: [] } },
  };
}

// Arms every gate open (target resolves, fresh round) unless overridden.
function arm({ round = 1, target = { name: 'Zombie 1' } } = {}) {
  const cs = { creatures: [] };
  getCombatContext.mockResolvedValue(cs);
  getTargetFromAttacker.mockReturnValue(target);
  getCurrentCombatRound.mockReturnValue(round);
  return cs;
}

function freshStore() {
  for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  runtimeWrites.length = 0;
}

const teWrites = () => runtimeWrites.filter(w => w[0] === 'campaign' && w[1] === TE);

const te = (name = 'Zombie 1', src = 'Eldritch Strike') => ({
  target: name,
  source: src,
  option: src,
  effect: 'disadvantage_on_next_save',
  value: null,
  noOpportunityAttacks: false,
  duration: 'until_start_of_next_turn',
});

const logEntry = () => ({
  type: 'ability_use',
  characterName: 'EvasiveFighter',
  abilityName: 'Eldritch Strike',
  description: "EvasiveFighter used Eldritch Strike on Zombie 1, imposing Disadvantage on the target's next saving throw.",
  targetName: 'Zombie 1',
});

// ── Tests ────────────────────────────────────────────────────────

describe('eldritchStrikes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    freshStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition is true only when automation actions or passives exist', () => {
    expect(eldritchStrikes.condition(makeCtx())).toBe(true);
    expect(eldritchStrikes.condition({
      campaignName: CAMPAIGN,
      playerStats: { name: 'EvasiveFighter', automation: { actions: [], passives: [RIDER] } },
    })).toBe(true);
    expect(eldritchStrikes.condition({ campaignName: CAMPAIGN, playerStats: { name: 'X' } })).toBe(false);
  });

  it('filters the rider set: no eligible rider passes prevData through; damageExpression and Stalker\'s Flurry exclusions byte-pin', async () => {
    const prevData = { prev: true };
    const empty = {
      campaignName: CAMPAIGN,
      playerStats: { name: 'EvasiveFighter', automation: { actions: [], passives: [] } },
    };
    expect(await eldritchStrikes.handler(empty, prevData)).toBeNull();
    expect(await eldritchStrikes.handler({ ...empty, playerStats: { name: 'EvasiveFighter' } }, prevData))
      .toBeNull();
    expect(getCombatContext).not.toHaveBeenCalled(); // short-circuit before any lookup

    // All four exclusions in one pass: true-action type, wrong trigger,
    // damageExpression (sibling damage lanes), and the near-miss name.
    const ctx = makeCtx();
    ctx.playerStats = {
      name: 'EvasiveFighter',
      automation: {
        actions: [
          { ...RIDER, name: 'Attack Action', type: 'action' },
          { ...RIDER, name: 'Counter Strike', trigger: 'enemy_miss' },
          { ...RIDER, name: 'Brutal Strike', damageExpression: '1d10' },
          { ...RIDER, name: "Stalker's Flurry" },
        ],
        passives: [],
      },
    };
    expect(await eldritchStrikes.handler(ctx, prevData)).toBeNull(); // every rider filtered → null, not prevData
    expect(getCombatContext).not.toHaveBeenCalled();
    expect(runtimeWrites).toEqual([]);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('on an eligible hit stamps the verbatim te, writes the derived _Eldritch_Strike_usedRound latch keyed to test-campaign, and logs exact bytes', async () => {
    const cs = arm({ round: 1 });
    const prevData = { prev: true };
    const result = await eldritchStrikes.handler(makeCtx(), prevData);

    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'EvasiveFighter');
    // #1024 falsifier: a no-arg round read (the #1050 defect class) fails this pin.
    expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN);
    expect(result).toEqual({ data: prevData });

    expect(runtimeWrites).toEqual([
      ['campaign', TE, [te()], CAMPAIGN],
      ['EvasiveFighter', LATCH, 1, CAMPAIGN],
    ]);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, logEntry());
  });

  it('latches strictly once per round: old/stale/zero bytes, same-round refusal, and exact re-arm at round 2 (CLA-109)', async () => {
    // Stale latch (old round) arms — falsifies a truthiness gate.
    arm({ round: 8 });
    runtimeStore[`EvasiveFighter:${LATCH}`] = 7;
    expect(await eldritchStrikes.handler(makeCtx(), {})).toEqual({ data: {} });
    expect(teWrites()).toHaveLength(1);

    // Same round: strict === blocks, even at the 0 byte (not truthiness).
    arm({ round: 0 });
    runtimeStore[`EvasiveFighter:${LATCH}`] = 0;
    const prevData = { prev: true };
    expect(await eldritchStrikes.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(teWrites()).toHaveLength(1);
    expect(addEntry).toHaveBeenCalledTimes(1);

    // Round 2 re-arms and re-stamps: second te, second exact log, latch=2.
    arm({ round: 2 });
    expect(await eldritchStrikes.handler(makeCtx(), {})).toEqual({ data: {} });
    expect(teWrites()).toEqual([
      ['campaign', TE, [te()], CAMPAIGN],
      ['campaign', TE, [te(), te()], CAMPAIGN],
    ]);
    expect(runtimeWrites).toContainEqual(['EvasiveFighter', LATCH, 2, CAMPAIGN]);
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry).toHaveBeenLastCalledWith(CAMPAIGN, logEntry());
  });

  it('oncePerTurn pairs: a fresh named rider is armed by its own underscore-converted latch while a latched rider refuses', async () => {
    arm({ round: 1 });
    runtimeStore['EvasiveFighter:_Eldritch_Strike_usedRound'] = 1;
    const prevData = { prev: true };
    const fresh = { name: 'Hex Strike', effect: 'disadvantage_on_next_save' };

    const result = await eldritchStrikes.handler(makeCtx({ name: "Stalker's Flurry" }), prevData);
    expect(result).toBeNull(); // exclusion wins over the armed new rider

    // Armed pair in one pass: latched rider refused, fresh rider fires once.
    await eldritchStrikes.handler({
      campaignName: CAMPAIGN,
      playerStats: {
        name: 'EvasiveFighter',
        automation: {
          actions: [RIDER, { ...RIDER, name: 'Hex Strike', options: [fresh] }],
          passives: [],
        },
      },
    }, prevData);

    expect(teWrites()).toEqual([
      ['campaign', TE, [te('Zombie 1', 'Hex Strike')], CAMPAIGN],
    ]);
    expect(runtimeWrites).toContainEqual(['EvasiveFighter', '_Hex_Strike_usedRound', 1, CAMPAIGN]);
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ abilityName: 'Hex Strike' }));
  });

  it('fires every hit when oncePerTurn is false and appends te across riders and calls', async () => {
    arm({ round: 1 });
    const prevData = { prev: true };
    const fresh = { name: 'Hex Strike', effect: 'disadvantage_on_next_save' };
    const twoRiders = {
      campaignName: CAMPAIGN,
      playerStats: {
        name: 'EvasiveFighter',
        automation: {
          actions: [{ ...RIDER, oncePerTurn: false }, { ...RIDER, name: 'Hex Strike', oncePerTurn: false, options: [fresh] }],
          passives: [],
        },
      },
    };

    expect(await eldritchStrikes.handler(twoRiders, prevData)).toEqual({ data: prevData });
    // te appends across riders in a single call (faithful read of the campaign store).
    expect(teWrites()).toEqual([
      ['campaign', TE, [te()], CAMPAIGN],
      ['campaign', TE, [te(), te('Zombie 1', 'Hex Strike')], CAMPAIGN],
    ]);
    // Latch never stamped when oncePerTurn is false (#903 unarmed side).
    expect(runtimeWrites.every(w => w[1] !== LATCH && w[1] !== '_Hex_Strike_usedRound')).toBe(true);

    // Second hit, same round, no latch: fires again, appending te.
    await eldritchStrikes.handler(twoRiders, prevData);
    expect(teWrites()).toHaveLength(4);
    expect(addEntry).toHaveBeenCalledTimes(4);
  });

  it('guard pass-throughs burn nothing: null context, nameless target, and empty options each skip, and the latch is stamped only when te is written', async () => {
    const prevData = { prev: true };
    getCurrentCombatRound.mockReturnValue(1);

    // Null context short-circuits before target lookup.
    getCombatContext.mockResolvedValue(null);
    expect(await eldritchStrikes.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(getTargetFromAttacker).not.toHaveBeenCalled();

    // Context present but target nameless, then unresolvable: consulted, silent.
    const cs = { creatures: [] };
    getCombatContext.mockResolvedValue(cs);
    getTargetFromAttacker.mockReturnValue({ name: undefined });
    expect(await eldritchStrikes.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    getTargetFromAttacker.mockReturnValue(null);
    expect(await eldritchStrikes.handler(makeCtx(), prevData)).toEqual({ data: prevData });
    expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, 'EvasiveFighter');

    // Resolved target but rider without options: gate open, guard refuses.
    getTargetFromAttacker.mockReturnValue({ name: 'Zombie 1' });
    expect(await eldritchStrikes.handler(makeCtx({ options: [] }), prevData)).toEqual({ data: prevData });

    expect(runtimeWrites).toEqual([]); // no te, no latch — gates never stamped on a refused pass
    expect(addEntry).not.toHaveBeenCalled();
  });
});
