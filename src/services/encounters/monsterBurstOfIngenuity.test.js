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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMonsterBurstOfIngenuityRow,
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
const LATCH_KEY = '_burst_of_ingenuity_usedRound';

const sphinx = monstersData.find(m => m.index === 'sphinx-of-wonder');
const BURST_ROW = sphinx.reactions[0];

function makeCs({ rollerArmed = true } = {}) {
  return {
    round: 3,
    creatures: [
      { name: SPHINX, size: 'Tiny', targetName: rollerArmed ? ROLLER : null },
      { name: ROLLER, size: 'Medium' },
    ],
  };
}

function makeDeps({ rollerBuffs = [] } = {}) {
  const store = { buffs: { [ROLLER]: rollerBuffs }, logs: [], latches: {}, uses: {} };
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

  it('arms the gated chip via getGatedMonsterReaction (registry lookup keys off automation.effect only)', () => {
    const def = getGatedMonsterReaction(BURST_ROW);
    expect(def).toEqual({ effect: 'burst_of_ingenuity', trigger: 'ability_check_or_save', label: 'Burst of Ingenuity', icon: 'fa-lightbulb' });
    expect(getGatedMonsterReaction({ name: 'Burst of Ingenuity' })).toBeNull();
  });
});

describe('MA-1510 roller + economy gates', () => {
  it('roller gate: no_target refuses unarmed; SELF is RAW-legal ("the sphinx or another creature"); already-armed refuses a double arm', () => {
    const d = makeDeps();
    expect(burstRollerGate({ cs: makeCs({ rollerArmed: false }), monsterName: SPHINX, getRV: d.getRV }).reason).toBe('no_target');
    const selfArmed = { creatures: [{ name: SPHINX, targetName: SPHINX }] };
    expect(burstRollerGate({ cs: selfArmed, monsterName: SPHINX, getRV: d.getRV }).roller.name).toBe(SPHINX);
    const armed = makeDeps({ rollerBuffs: [{ effect: 'burst_of_ingenuity', oneShot: true }] });
    expect(burstRollerGate({ cs: makeCs(), monsterName: SPHINX, getRV: armed.getRV }).reason).toBe('already_armed');
    expect(burstRollerGate({ cs: makeCs(), monsterName: SPHINX, getRV: d.getRV }).roller.name).toBe(ROLLER);
  });

  it('round latch refuses FIRST; uses gate refuses at the numeric limit; bonus rides the automation', () => {
    const latch = burstOfIngenuityGate({ currentRound: 3, usedRound: 3, storedUses: {}, action: BURST_ROW });
    expect(latch.ok).toBe(false);
    expect(latch.reason).toBe('round');
    const spent = burstOfIngenuityGate({ currentRound: 3, usedRound: 2, storedUses: { burst_of_ingenuity: 2 }, action: BURST_ROW });
    expect(spent.ok).toBe(false);
    expect(spent.reason).toBe('uses');
    const ok = burstOfIngenuityGate({ currentRound: 3, usedRound: 2, storedUses: { burst_of_ingenuity: 1 }, action: BURST_ROW });
    expect(ok.ok).toBe(true);
    expect(ok.used).toBe(1);
    expect(ok.limit).toBe(2);
  });
});

describe('MA-1510 resolver press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants: latch + uses spend awaited, ONE-SHOT +2 buff on the ROLLER, ONE anchor clock, spend log, NO popupHtml', async () => {
    const { store, setRV, call } = resolveCall();
    const result = await call();
    expect(result.ok).toBe(true);
    expect(result.popupHtml).toBeUndefined();
    expect(result.bonus).toBe(2);
    expect(result.rollerName).toBe(ROLLER);
    expect(result.remaining).toBe(1);

    const stamped = store.buffs[ROLLER];
    expect(stamped).toHaveLength(1);
    expect(stamped[0].effect).toBe('burst_of_ingenuity');
    expect(stamped[0].name).toBe(BURST_OF_INGENUITY_BUFF_NAME);
    expect(stamped[0].saveBonus).toBe(2);
    expect(stamped[0].oneShot).toBe(true);
    expect(stamped[0].grantedBy).toBe(SPHINX);
    expect(store.buffs[SPHINX]).toBeUndefined();

    expect(store.latches[SPHINX]).toBe(3);
    expect(store.uses[SPHINX]).toEqual({ burst_of_ingenuity: 1 });
    const latchWrite = setRV.mock.calls.find(c => c[1] === LATCH_KEY);
    const spendWrite = setRV.mock.calls.find(c => c[1] === 'monsterReactionUses');
    expect(latchWrite && spendWrite && latchWrite[0]).toBe(spendWrite[0]);

    expect(addExpiration).toHaveBeenCalledTimes(1);
    const clock = addExpiration.mock.calls[0][0];
    expect(clock.expireOnCreatureName).toBe(SPHINX);
    expect(clock.rounds).toBeUndefined();
    expect(clock.targetName).toBe(ROLLER);
    expect(clock.effects).toEqual([{ type: 'remove_active_buff', buffName: BURST_OF_INGENUITY_BUFF_NAME }]);

    expect(store.logs.some(l => l.type === 'ability_use' && l.characterName === SPHINX)).toBe(true);
    expect(store.logs.every(l => l.automationType !== 'burst_of_ingenuity_refused')).toBe(true);
  });

  it('press with no roller armed refuses ZERO-spend: no latch, no uses write, no buff, log-only', async () => {
    const { store, setRV, call } = resolveCall();
    const r = await call(makeCs({ rollerArmed: false }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_target');
    expect(r.popupHtml).toBeUndefined();
    expect(store.latches[SPHINX]).toBeUndefined();
    expect(store.uses[SPHINX]).toBeUndefined();
    expect(store.buffs[ROLLER]).toEqual([]);
    const refused = store.logs.filter(l => l.automationType === 'burst_of_ingenuity_refused');
    expect(refused).toHaveLength(1);
    expect(refused[0].automationDetail).toBe('no_target');
    expect(setRV).not.toHaveBeenCalled();
  });

  it('same-round re-press refuses (round latch) and 0-uses press refuses (uses) — both zero-spend', async () => {
    const latched = resolveCall();
    const r1 = await latched.call(makeCs(), 3, 3);
    expect(r1.reason).toBe('round');
    expect(latched.store.uses[SPHINX]).toBeUndefined();
    expect(latched.store.buffs[ROLLER]).toEqual([]);

    const exhausted = resolveCall();
    const r2 = await exhausted.call(makeCs(), 3, 2, { burst_of_ingenuity: 2 });
    expect(r2.reason).toBe('uses');
    expect(exhausted.store.latches[SPHINX]).toBeUndefined();
    expect(exhausted.store.uses[SPHINX]).toBeUndefined();
    expect(exhausted.store.buffs[ROLLER]).toEqual([]);
    expect(exhausted.store.logs.map(l => l.automationDetail)).toEqual(['uses']);
  });

  it('already-armed roller refuses a double arm, zero spend', async () => {
    const dup = resolveCall({ rollerBuffs: [buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3)] });
    const r = await dup.call();
    expect(r.reason).toBe('already_armed');
    expect(dup.store.uses[SPHINX]).toBeUndefined();
    expect(dup.store.buffs[ROLLER]).toHaveLength(1);
  });

  it('counter spends 2→1→0: second press rides storedUses, third refuses at 0', async () => {
    const first = resolveCall();
    expect((await first.call()).remaining).toBe(1);
    const second = resolveCall();
    expect((await second.call(makeCs(), 4, 3, { burst_of_ingenuity: 1 })).remaining).toBe(0);
    const third = resolveCall();
    expect((await third.call(makeCs(), 5, 4, { burst_of_ingenuity: 2 })).reason).toBe('uses');
  });
});

describe('MA-1510 roll-seam consume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consume folds +2 on the armed roller check/skill/save, strips the ONE-SHOT stamp, logs applied', () => {
    const buff = buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3);
    const other = { effect: 'warding_bond', saveBonus: 1 };
    getRuntimeValue.mockReturnValue([other, buff]);
    const folded = consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'check', rollName: 'Acrobatics' });
    expect(folded).toEqual({ bonus: 2, applied: true });
    const strip = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs');
    expect(strip[0]).toBe(ROLLER);
    expect(strip[2]).toEqual([other]);
    const applied = addEntry.mock.calls.map(c => c[1]).find(e => e && e.automationType === 'burst_of_ingenuity_applied');
    expect(applied).toBeTruthy();
    expect(applied.targetName).toBe(ROLLER);
    expect(applied.characterName).toBe(SPHINX);
  });

  it('consumes once — the armed buff never re-folds a second roll (clear on roll, not press)', () => {
    const buff = buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3);
    let store = [buff];
    getRuntimeValue.mockImplementation(() => store);
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'save', rollName: 'DEX' }).bonus).toBe(2);
    store = [];
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'save', rollName: 'DEX' }).bonus).toBe(0);
  });

  it('initiative NEVER folds (RAW: ability check or saving throw only); unarmed roller is byte-inert zero', () => {
    getRuntimeValue.mockReturnValue([buildBurstOfIngenuityBuff(BURST_ROW, SPHINX, 3)]);
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'initiative' }).applied).toBe(false);
    getRuntimeValue.mockReturnValue([]);
    expect(consumeBurstOfIngenuityBuff(ROLLER, CAMPAIGN, { rollType: 'check' })).toEqual({ bonus: 0, applied: false });
    expect(consumeBurstOfIngenuityBuff(null, CAMPAIGN, { rollType: 'save' })).toEqual({ bonus: 0, applied: false });
  });
});
