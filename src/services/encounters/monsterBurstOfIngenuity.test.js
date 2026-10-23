// @maintained-by-ai
// MA-1510: Sphinx of Wonder "Burst of Ingenuity" (reactions[0]) — formerly a
// zero-affordance plain-text row: no automation (§60 gated lane unarmed),
// uses:"2/Day" STRING unparseable by every usage parser (MA-1502 NaN gate →
// zero counter, zero gate), grep-zero consumers app-wide. The Option-B
// conversion arms a gated buff-the-roller reaction
// automation{type:"reaction", trigger:"ability_check_or_save",
// effect:"burst_of_ingenuity", bonus:2, range_ft:30} + numeric uses:2/
// maxUses:2 (guardian_protection MA-1463 byte-twin lane, buff-the-roller
// first): press gates round-latch FIRST (MA-0013 shape) → uses gate (refuses
// at 0 with burst_of_ingenuity_refused, zero spend) → roller gate on the
// sphinx's OWN card-armed cs.targetName seam (MA-0882/MA-1463 press-time
// GM identification — self is RAW-legal, no self_target refusal; an
// already-armed roller refuses already_armed), every refusal LOG-ONLY §235d
// with no latch/uses/buff write. Met → latch + spend AWAITED (CLA-361) →
// ONE-SHOT activeBuffs {effect:'burst_of_ingenuity', saveBonus:2} stamp on
// the ROLLER (MA-1463 oneShot channel) → ONE anchor clock §38
// (expireOnCreatureName=sphinx — unused stamp dies at the sphinx's next
// turn-start, same-round expiry never fires §38) → ability_use spend log.
// The +2 folds + consumes at the roll seams (arm→next-resolve-consume §214,
// clear on roll not press): d20RollComputation.computeD20Roll folds
// check/skill (pendingSkillCheckBonus seam twin); saveProcessing.processNpcSave
// + SavePromptModal fold saves on the live warding_bond saveBonus channel
// (§76). MONSTER_REACTION_USES[burst_of_ingenuity] spends EVERY press
// (MA-0013 shield/jinx spend shape) — 2→1→0 then honest refusals.
//
// Family map (encounters/ monster-feature lanes):
// - Generic gated-reaction chip arm/dispatch: MonsterCardHelpers.gated-reaction.test.js
//   registry generics — this file pins ONLY the burst registry row (MonsterCardHelpers.js:1513,
//   dispatcher :2282 cited, not re-driven).
// - uses/latch/store machinery generics: monsterAbilityUses.test.js CANON (#1082, family CLOSED
//   #1080-#1083) — cited, generics not re-driven here; this lane pins burst-scoped tuples only.
// - Byte-twin defender lane: monsterGuardianProtection.test.js (MA-1463) owns guardian's
//   self_target refusal — burst differs: SELF IS RAW-LEGAL, so the self-legality leg lives HERE.
// - advisory family CLOSED (#1084-#1090): 30-ft gridless advisory rides the grant log as
//   honest copy only — pinned in the grant description bytes, no separate consumer.
//
// Old→new map (this file, trim pass):
// - disk-row pin / registry arm / roller gate: kept verbatim (contract pins).
// - economy gate: kept, tabled (+0-byte usedRound leg).
// - grant press: strengthened — stamped buff now verbatim producer bytes, press writes now
//   exact ordered campaign-pinned tuples, spend log exact bytes, bystander decoy survivor.
// - no-roller + latch/uses press refusals + already-armed press: CONSOLIDATED → one it.each
//   over all four refusal tokens (§235d zero-spend shape is identical; +no-clock +decoy legs).
// - counter 2→1→0: trimmed to the middle press only — fresh press remaining:1 is owned by the
//   grant test, press-at-0 refusal by the refusal table; only the storedUses-ride leg is new.
// - consume fold + consumes-once: CONSOLIDATED into one store-faithful test (the old once-test
//   hand-reset the store, proving nothing; now the strip write IS the store update).
// - initiative/unarmed/null guards: strengthened — inert guards must not even READ the store.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterBurstOfIngenuityRow,
  burstOfIngenuityBonus,
  burstRollerGate,
  burstOfIngenuityGate,
  buildBurstOfIngenuityBuff,
  consumeBurstOfIngenuityBuff,
  resolveMonsterBurstOfIngenuityRow,
  BURST_OF_INGENUITY_BUFF_NAME,
} from './monsterBurstOfIngenuity.js';
import { getGatedMonsterReaction } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getAllStoreKeys: vi.fn(() => []),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn(),
  processExpirationList: vi.fn(),
  expireForCreature: vi.fn(),
}));

import { addExpiration } from '../../services/rules/effects/expirationQueue.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const SPHINX = 'Sphinx of Wonder 1';
const ROLLER = 'Bandit 1';
const BYSTANDER = 'Priest 2';
const LATCH_KEY = '_burst_of_ingenuity_usedRound';

const sphinx = monstersData.find(m => m.index === 'sphinx-of-wonder');
const BURST_ROW = sphinx.reactions[0];

function makeCs({ rollerArmed = true } = {}) {
  return {
    round: 3,
    creatures: [
      { name: SPHINX, size: 'Tiny', targetName: rollerArmed ? ROLLER : null },
      { name: ROLLER, size: 'Medium' },
      { name: BYSTANDER, size: 'Medium' },
    ],
  };
}

// Holder-scoped decoy (#1050/#1057): an OFF-LANE burst stamp already living on a
// BYSTANDER must never gate the roller, never spend, never be consumed.
function bystanderDecoy() {
  return buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 2);
}

function makeDeps({ rollerBuffs = [] } = {}) {
  const store = { buffs: { [ROLLER]: rollerBuffs, [BYSTANDER]: [bystanderDecoy()] }, logs: [], latches: {}, uses: {} };
  const getRV = vi.fn((key, prop) => {
    if (prop === 'activeBuffs') return store.buffs[key] || [];
    return undefined;
  });
  const setRV = vi.fn((key, prop, value) => {
    if (prop === 'activeBuffs') store.buffs[key] = value;
    if (prop === LATCH_KEY) store.latches[key] = value;
    if (prop === 'monsterReactionUses') store.uses[key] = value;
    return Promise.resolve();
  });
  const log = vi.fn((campaign, entry) => { store.logs.push(entry); return Promise.resolve(); });
  return { store, getRV, setRV, log };
}

function resolveCall(overrides = {}) {
  const deps = makeDeps(overrides);
  const call = (cs = makeCs(), currentRound = 3, usedRound = 2, storedUses = {}) => resolveMonsterBurstOfIngenuityRow({
    action: BURST_ROW,
    monsterName: SPHINX,
    campaignName: CAMPAIGN,
    cs,
    currentRound,
    storedUses,
    usedRound,
    latchKey: LATCH_KEY,
    deps: { getRuntimeValue: deps.getRV, setRuntimeValue: deps.setRV, addEntry: deps.log },
  });
  return { ...deps, call };
}

describe('MA-1510 disk row + registry arm', () => {
  it('pins the sphinx-of-wonder Burst of Ingenuity automation byte-shape + numeric uses (MA-1502 string fixed)', () => {
    expect(BURST_ROW.name).toBe('Burst of Ingenuity');
    expect(BURST_ROW.trigger).toBe('The sphinx or another creature within 30 feet makes an ability check or a saving throw.');
    expect(BURST_ROW.description).toBe('The sphinx adds 2 to the roll.');
    expect(BURST_ROW.uses).toBe(2);
    expect(BURST_ROW.maxUses).toBe(2);
    expect(BURST_ROW.automation).toEqual({
      type: 'reaction',
      trigger: 'ability_check_or_save',
      effect: 'burst_of_ingenuity',
      bonus: 2,
      range_ft: 30,
    });
    expect(isMonsterBurstOfIngenuityRow(BURST_ROW)).toBe(true);
    expect(isMonsterBurstOfIngenuityRow({ name: 'Burst of Ingenuity' })).toBe(false);
  });

  it('arms the gated chip via getGatedMonsterReaction (registry lookup keys off automation.effect only; dispatcher seam MonsterCardHelpers.js:2282 cited, generic arm owned by gated-reaction.test.js)', () => {
    const def = getGatedMonsterReaction(BURST_ROW);
    expect(def).toEqual({ effect: 'burst_of_ingenuity', trigger: 'ability_check_or_save', label: 'Burst of Ingenuity', icon: 'fa-lightbulb' });
    expect(getGatedMonsterReaction({ name: 'Burst of Ingenuity' })).toBeNull();
  });
});

describe('MA-1510 roller + economy gates', () => {
  it('roller gate: no_target refuses unarmed; SELF is RAW-legal ("the sphinx or another creature" — unlike the guardian twin there is NO self_target refusal); already-armed refuses a double arm', () => {
    const d = makeDeps();
    expect(burstRollerGate({ cs: makeCs({ rollerArmed: false }), monsterName: SPHINX, getRV: d.getRV }).reason).toBe('no_target');
    const selfArmed = { creatures: [{ name: SPHINX, targetName: SPHINX }] };
    expect(burstRollerGate({ cs: selfArmed, monsterName: SPHINX, getRV: d.getRV }).roller.name).toBe(SPHINX);
    const armed = makeDeps({ rollerBuffs: [{ effect: 'burst_of_ingenuity', oneShot: true }] });
    expect(burstRollerGate({ cs: makeCs(), monsterName: SPHINX, getRV: armed.getRV }).reason).toBe('already_armed');
    expect(burstRollerGate({ cs: makeCs(), monsterName: SPHINX, getRV: d.getRV }).roller.name).toBe(ROLLER);
  });

  it.each([
    { name: 'round latch refuses FIRST (fresh uses never reach the uses gate)', args: { currentRound: 3, usedRound: 3, storedUses: {} }, expected: { ok: false, reason: 'round' } },
    { name: 'uses gate refuses at the numeric 2/Day limit', args: { currentRound: 3, usedRound: 2, storedUses: { burst_of_ingenuity: 2 } }, expected: { ok: false, reason: 'uses' } },
    { name: 'fresh round, 1/2 spent: passes carrying the spend tuple', args: { currentRound: 3, usedRound: 2, storedUses: { burst_of_ingenuity: 1 } }, expected: { ok: true, used: 1, limit: 2 } },
    { name: '0-byte usedRound is honest (never a phantom same-round latch)', args: { currentRound: 3, usedRound: 0, storedUses: {} }, expected: { ok: true, used: 0, limit: 2 } },
  ])('$name', ({ args, expected }) => {
    expect(burstOfIngenuityGate({ ...args, action: BURST_ROW })).toMatchObject(expected);
  });
});

describe('MA-1510 resolver press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants: press writes AWAITED in order latch→uses→stamp, exact campaign-pinned tuples, verbatim ONE-SHOT +2 stamp on the ROLLER only, ONE anchor clock, exact ability_use log bytes, NO popupHtml, bystander decoy survives', async () => {
    const { store, setRV, call } = resolveCall();
    const result = await call();
    expect(result).toMatchObject({ ok: true, bonus: 2, rollerName: ROLLER, remaining: 1 });
    expect(result.popupHtml).toBeUndefined();

    const [stamp] = store.buffs[ROLLER];
    expect(stamp).toMatchObject({
      effect: 'burst_of_ingenuity',
      name: BURST_OF_INGENUITY_BUFF_NAME,
      saveBonus: 2,
      oneShot: true,
      source: 'Burst of Ingenuity',
      grantedBy: SPHINX,
      grantedToRollTypes: ['check', 'skill', 'save'],
      grantedRound: 3,
    });

    // CLA-361/§39: latch AWAITED before uses spend before the stamp; every tuple campaign-pinned (#1019/#1021/#932).
    expect(setRV.mock.calls).toEqual([
      [SPHINX, LATCH_KEY, 3, CAMPAIGN],
      [SPHINX, 'monsterReactionUses', { burst_of_ingenuity: 1 }, CAMPAIGN],
      [ROLLER, 'activeBuffs', [stamp], CAMPAIGN],
    ]);

    expect(addExpiration).toHaveBeenCalledTimes(1);
    expect(addExpiration.mock.calls[0][0]).toEqual({
      attackerName: SPHINX,
      targetName: ROLLER,
      campaignName: CAMPAIGN,
      rounds: undefined,
      expireOnCreatureName: SPHINX,
      effects: [{ type: 'remove_active_buff', buffName: BURST_OF_INGENUITY_BUFF_NAME }],
    });

    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({
      type: 'ability_use',
      characterName: SPHINX,
      abilityName: 'Burst of Ingenuity',
      description: `${SPHINX} uses Burst of Ingenuity (Reaction) — ${ROLLER} gains +2 on the next ability check or saving throw it makes (consumed on that roll). 30-ft proximity GM-enforced (gridless advisory, §42). 2/Day · 1 left today.`,
    });

    // Holder-scoped: latch/uses key ONLY the card owner; the bystander's decoy stamp survives untouched.
    expect(store.buffs[BYSTANDER]).toHaveLength(1);
    expect(store.buffs[BYSTANDER][0]).toMatchObject({ effect: 'burst_of_ingenuity', grantedRound: 2 });
    expect(store.buffs[SPHINX]).toBeUndefined();
    expect(store.latches[BYSTANDER]).toBeUndefined();
    expect(store.uses[BYSTANDER]).toBeUndefined();
  });

  it.each([
    {
      name: 'round latch refuses FIRST — an unarmed card still answers round, not no_target',
      press: { cs: makeCs({ rollerArmed: false }), currentRound: 3, usedRound: 3, storedUses: {} },
      reason: 'round',
      message: 'Burst of Ingenuity: Reaction already used this round — refused.',
    },
    {
      name: 'uses exhausted at the numeric 2/Day limit',
      press: { cs: makeCs(), currentRound: 3, usedRound: 2, storedUses: { burst_of_ingenuity: 2 } },
      reason: 'uses',
      message: 'Burst of Ingenuity: 2/Day uses already spent today — refused. Uses reset at a long rest; GM-enforced for monsters.',
    },
    {
      name: 'no roller armed (bystander burst decoy must NOT answer already_armed — the gate reads the armed card only)',
      press: { cs: makeCs({ rollerArmed: false }), currentRound: 3, usedRound: 2, storedUses: {} },
      reason: 'no_target',
      message: `Burst of Ingenuity: ${SPHINX} has no roller armed on the card — arm the creature about to make the ability check or saving throw first (gridless proxy for the RAW 30-ft proximity).`,
    },
    {
      name: 'already-armed roller refuses a double arm (one buff instance per roller)',
      press: { cs: makeCs(), currentRound: 3, usedRound: 2, storedUses: {}, rollerBuffs: [buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3)] },
      reason: 'already_armed',
      message: `Burst of Ingenuity: ${ROLLER} is already carrying an armed +2 — one buff instance per roller; refused.`,
    },
  ])('$name — refused log-only §235d with ZERO spend', async ({ press, reason, message }) => {
    const { store, setRV, call } = resolveCall({ rollerBuffs: press.rollerBuffs });
    const r = await call(press.cs, press.currentRound, press.usedRound, press.storedUses);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(reason);
    expect(r.popupHtml).toBeUndefined();
    expect(setRV).not.toHaveBeenCalled();
    expect(addExpiration).not.toHaveBeenCalled();
    expect(store.buffs[ROLLER]).toHaveLength(press.rollerBuffs ? 1 : 0);
    expect(store.buffs[BYSTANDER]).toHaveLength(1);
    expect(store.buffs[BYSTANDER][0].effect).toBe('burst_of_ingenuity');
    const refused = store.logs.filter(l => l.automationType === 'burst_of_ingenuity_refused');
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ type: 'automation', automationDetail: reason, characterName: SPHINX, abilityName: 'Burst of Ingenuity' });
    expect(refused[0].description).toBe(`Burst of Ingenuity refused (${reason}): ${message}`);
  });

  it('second press rides storedUses: spends 1→0 with the spread preserving off-lane bytes, log honest at 0 left today (fresh press owned by the grant test, press-at-0 by the refusal table — 2→1→0 end to end)', async () => {
    const { store, setRV, call } = resolveCall();
    const r = await call(makeCs(), 4, 3, { burst_of_ingenuity: 1, other_reaction: 5 });
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
    const spendWrite = setRV.mock.calls.find(c => c[1] === 'monsterReactionUses');
    expect(spendWrite).toEqual([SPHINX, 'monsterReactionUses', { burst_of_ingenuity: 2, other_reaction: 5 }, CAMPAIGN]);
    expect(store.logs[0].description).toBe(`${SPHINX} uses Burst of Ingenuity (Reaction) — ${ROLLER} gains +2 on the next ability check or saving throw it makes (consumed on that roll). 30-ft proximity GM-enforced (gridless advisory, §42). 2/Day · 0 left today.`);
    expect(store.buffs[ROLLER]).toHaveLength(1);
  });
});

describe('MA-1510 roll-seam consume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('armed roller check folds +2, the strip write is the ONLY store update (co-located warding_bond survives byte-identical), exact applied log bytes — and the same roller then rolls byte-inert zero (clear on roll, not press §214)', () => {
    const other = { effect: 'warding_bond', saveBonus: 1 };
    const buff = buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3);
    let buffs = [other, buff];
    getRuntimeValue.mockImplementation(() => buffs);
    setRuntimeValue.mockImplementation((key, prop, value) => { buffs = value; return Promise.resolve(); });

    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'check', rollName: 'Acrobatics' })).toEqual({ bonus: 2, applied: true });
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue.mock.calls[0]).toEqual([ROLLER, 'activeBuffs', [other], CAMPAIGN]);

    const applied = addEntry.mock.calls[0];
    expect(applied[0]).toBe(CAMPAIGN);
    expect(applied[1]).toMatchObject({
      type: 'automation',
      automationType: 'burst_of_ingenuity_applied',
      characterName: SPHINX,
      targetName: ROLLER,
      abilityName: BURST_OF_INGENUITY_BUFF_NAME,
      description: `Burst of Ingenuity: +2 folded into ${ROLLER}'s check (Acrobatics) — buff consumed.`,
    });

    // ONE-SHOT — store-faithful: the strip already landed, so a second roll is honest zero.
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'save', rollName: 'DEX' })).toEqual({ bonus: 0, applied: false });
    expect(addEntry).toHaveBeenCalledTimes(1);
  });

  it('initiative NEVER folds (RAW: ability check or saving throw only) — inert guards do not even READ the store; unarmed and null rollers are byte-inert zero', () => {
    getRuntimeValue.mockReturnValue([buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3)]);
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'initiative' })).toEqual({ bonus: 0, applied: false });
    expect(getRuntimeValue).not.toHaveBeenCalled();
    getRuntimeValue.mockReturnValue([]);
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'check' })).toEqual({ bonus: 0, applied: false });
    expect(consumeBurstOfIngenuityBuff(null, CAMPAIGN, { rollType: 'save' })).toEqual({ bonus: 0, applied: false });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// #1091 (fix class #90/#195 zero-is-data + #223 dead-text): the resolver lane's
// gate-precedence pins above already prove round/uses refusals surface the GATE's
// own bytes (the round-first-unarmed-card leg and the uses long-rest-suffix leg —
// suffix text that never existed anywhere else), so the deleted REFUSAL_MESSAGES
// round/uses entries stay structurally unreachable. These legs pin the BONUS side:
// authored numerics (INCLUDING 0) pass through burstOfIngenuityBonus untouched;
// only missing/null/unparseable fall back to the documented RAW +2 default.
describe('#1091 bonus fallback honesty (zero-is-data, Number.isFinite gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { name: 'authored bonus:2 passes through', bonus: 2, expected: 2 },
    { name: 'authored bonus:0 stays 0 — never silently upgraded to 2', bonus: 0, expected: 0 },
    { name: 'missing bonus falls back to the documented RAW +2 default', bonus: undefined, expected: 2 },
    { name: 'null bonus is missing-not-zero: documented RAW +2 default', bonus: null, expected: 2 },
    { name: 'MA-1502 unparseable bonus string falls back to the documented RAW +2 default', bonus: 'two', expected: 2 },
  ])('burstOfIngenuityBonus: $name', ({ bonus, expected }) => {
    expect(burstOfIngenuityBonus({ automation: { bonus } })).toBe(expected);
  });

  it('bonus:0 is honest end to end: stamp carries saveBonus:0, the applied log reads "+0", consume returns bonus 0', () => {
    const zeroRow = { ...BURST_ROW, automation: { ...BURST_ROW.automation, bonus: 0 } };
    const buff = buildBurstOfIngenuityBuff(zeroRow, SPHINX, 3);
    expect(buff.saveBonus).toBe(0);
    let buffs = [buff];
    getRuntimeValue.mockReturnValue(buffs);
    setRuntimeValue.mockImplementation((key, prop, value) => { buffs = value; return Promise.resolve(); });
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'save', rollName: 'DEX' })).toEqual({ bonus: 0, applied: true });
    expect(addEntry.mock.calls[0][1].description).toBe(`Burst of Ingenuity: +0 folded into ${ROLLER}'s save (DEX) — buff consumed.`);
  });

  it('producer-inconsistent legacy stamp missing saveBonus: fold and log both honestly 0 (+2 bytes unchanged)', () => {
    let buffs = [{ effect: 'burst_of_ingenuity', grantedBy: SPHINX }];
    getRuntimeValue.mockReturnValue(buffs);
    setRuntimeValue.mockImplementation((key, prop, value) => { buffs = value; return Promise.resolve(); });
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'check' })).toEqual({ bonus: 0, applied: true });
    expect(addEntry.mock.calls[0][1].description).toBe(`Burst of Ingenuity: +0 folded into ${ROLLER}'s check — buff consumed.`);
  });
});
