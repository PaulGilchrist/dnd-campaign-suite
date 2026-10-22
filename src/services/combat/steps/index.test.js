// @maintained-by-ai
// Lane: ROUTING DECISIONS of buildPipelineForAction (index.js) ONLY — which builder is
// assembled for which action shape, and the campaignName gate on SSE observer registration.
// Step internals are CITED, never re-pinned here: attack census lives in
// attackRollDamageSteps.test.js (#1039 template), spell census in
// directSpellDamageSteps-structure.test.js (#1039/#1048 golden), observer bodies in
// observers.test.js / sseObservers.test.js.
//
// Mock discipline (#744/#786): the two step-builders and both observer factories are
// inert spies returning distinguishable sentinel lanes (two chained steps each, unique
// recorder names). No real step body ever executes here; routing is falsifiable because
// the RIGHT spy must be called once (zero args — builders take none, exact-bytes #993),
// the WRONG spies never, and the executed recorder must byte-equal the lane's sentinel
// sequence (pins which pipeline was assembled #1022 + step registration count/order).
//
// Routing table census (every reachable branch of selectStepBuilders):
//   attack : type==='weapon_attack' | weaponType | (damage|damageExpression|hasDamage
//            when not spell) — attack wins precedence even when spellType also present
//   spell  : type==='spell' | spellType | autoDamageSchool (also when damage present —
//            the :39 non-spell guard keeps spell damage out of the attack lane)
//   none   : no damage, no spell/weapon flags (and degenerate undefined action) → zero
//            steps, log observers still registered.
//   generic: REMOVED (fix #1063/#1064, verified dead-by-removal here). buildGenericSteps
//            was aspirational-from-birth: wired in the same commit that added it
//            (9447923a2) yet unreachable at every predicate since — :39 claims ALL bare
//            damage (damage/damageExpression/hasDamage rows above are permanent ABSORPTION
//            pins of the generic lane's former target shapes), :45 captures every
//            spell-flagged escape, so the old :47 arm was the empty set; and its chain
//            started at 'generic:do', never run by production callers ('housekeeping:do'
//            only, useAttackDamageResolution.js:102/:447). Builder file genericSteps.js +
//            lane golden genericSteps.test.js (#1063) removed with it; the lane's roll
//            contract is absorbed verbatim by attackRollDamageCalc.js:62-67 and
//            directSpellDamageSteps.js:126/:142. The genericBuilder spy/mock is removed
//            with the module — re-adding a generic lane requires re-adding a routed
//            producer plus fresh falsifiable rows here, not a resurrected empty arm.
//
// old→new map (old 9 tests → new 3):
//   :5-11 toHaveProperty smoke + :13-16/:18-21/:23-26/:75-81 expect(run).toBeDefined()
//   (assert nothing about registration #1048) + :28-31/:83-90/:92-98 (toBeDefined proves
//   nothing) → routing table test below (each old weapon-shape fixture is a distinct
//   falsifiable row) + campaignName gate tests below.
//   :33-36 spell fixture → spell row of the routing table.
//   :38-47 'spell pipeline includes featureRiders step' weak toContain + one lessThan →
//   REMOVED per applied rec #1048: strictly subsumed by the golden census in
//   directSpellDamageSteps-structure.test.js (exact ordered [name, subscribe, emit] for
//   all 6 spell steps, spellFeatureRiders idx 3 before spellOverchannel idx 4).
//   :67-73 'runs through weapon damage steps without error' → REMOVED: it executed REAL
//   step bodies (illegal here #744); the sentinel-chain run below proves wiring instead.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const S = vi.hoisted(() => {
  const executed = [];
  const lane = (prefix) => [
    {
      name: `${prefix}-1`,
      subscribe: 'chain:start',
      emit: 'chain:mid',
      handler: vi.fn(() => { executed.push(`${prefix}-1`); return { data: {} }; }),
    },
    {
      name: `${prefix}-2`,
      subscribe: 'chain:mid',
      emit: 'chain:end',
      handler: vi.fn(() => { executed.push(`${prefix}-2`); return { data: {} }; }),
    },
  ];
  const logObserverHandler = vi.fn();
  const sseObserverHandler = vi.fn();
  return {
    executed,
    attackBuilder: vi.fn(() => lane('attack')),
    spellBuilder: vi.fn(() => lane('spell')),
    logObserverHandler,
    sseObserverHandler,
    createObservers: vi.fn(() => [{ event: '*', handler: logObserverHandler }]),
    createSseObservers: vi.fn(() => [{ event: '*', handler: sseObserverHandler }]),
  };
});

import { buildPipelineForAction } from './index.js';

vi.mock('./attackRollDamageSteps.js', () => ({ buildAttackRollDamageSteps: S.attackBuilder }));
vi.mock('./directSpellDamageSteps.js', () => ({ buildDirectSpellDamageSteps: S.spellBuilder }));
vi.mock('./observers.js', () => ({ createObservers: S.createObservers }));
vi.mock('./sseObservers.js', () => ({ createSseObservers: S.createSseObservers }));

const BUILDERS = {
  attack: S.attackBuilder,
  spell: S.spellBuilder,
};

// Distinguishable fixtures (#1022): each row pins ONE router branch, verbatim.
const ROUTING_ROWS = [
  ['weapon_attack type alone (no damage) → attack', { name: 'Greataxe', type: 'weapon_attack' }, 'attack'],
  ['weaponType alone (no damage) → attack', { name: 'Longsword', weaponType: 'one-handed' }, 'attack'],
  ['bare damage → attack', { name: 'Greataxe', damage: '1d12' }, 'attack'],
  ['damageExpression → attack', { name: 'Shortsword', damageExpression: '1d6+3' }, 'attack'],
  ['hasDamage flag → attack', { name: 'Unarmed Strike', hasDamage: true }, 'attack'],
  ['weapon+spell flags → attack wins precedence', { name: 'Shadow Blade', weaponType: 'longsword', spellType: 'spell' }, 'attack'],
  ['type spell → spell', { name: 'Magic Missile', type: 'spell' }, 'spell'],
  ['spellType alone → spell', { name: 'Fireball', spellType: 'spell' }, 'spell'],
  ['autoDamageSchool alone → spell', { name: 'Sacred Flame', autoDamageSchool: 'radiant' }, 'spell'],
  ['spell damage stays out of attack lane → spell', { name: 'Green-Flame Blade', damage: '2d8', autoDamageSchool: 'fire' }, 'spell'],
  ['non-damage action → no builder, no steps', { name: 'Dash' }, 'none'],
  ['degenerate undefined action → no builder, no steps', undefined, 'none'],
];

function reArm() {
  // determinism re-arm (#1057): mockClear() wipes call history but preserves the
  // sentinel implementations (clearAllMocks would destroy the builder factories).
  [
    S.attackBuilder, S.spellBuilder,
    S.createObservers, S.createSseObservers,
    S.logObserverHandler, S.sseObserverHandler,
  ].forEach((spy) => spy.mockClear());
  S.executed.length = 0;
}

beforeEach(reArm);

describe('buildPipelineForAction — router: which pipeline is assembled', () => {
  it('routes every action shape to exactly one builder and registers its steps in order (full routing table)', async () => {
    for (const [label, action, lane] of ROUTING_ROWS) {
      reArm();

      const pipeline = buildPipelineForAction(action, {});
      await pipeline.run('chain:start', {}, { current: null });

      for (const [name, spy] of Object.entries(BUILDERS)) {
        if (name === lane) {
          expect(spy, label).toHaveBeenCalledTimes(1);
          expect(spy.mock.calls[0], label).toEqual([]); // builders take zero args — exact bytes
        } else {
          expect(spy, `${label} (wrong builder ${name})`).not.toHaveBeenCalled();
        }
      }
      // Which pipeline ran, proven by executed sentinel identity; [] pins zero-step assembly.
      expect(S.executed, label).toEqual(lane === 'none' ? [] : [`${lane}-1`, `${lane}-2`]);
    }
  });
});

describe('buildPipelineForAction — observer registration gate', () => {
  const ATTACK = { name: 'Greataxe', damage: '1d12' };

  it('registers log AND SSE observers when campaignName present — exact campaignName bytes and ctx identity passthrough', async () => {
    const ctx = { attack: ATTACK, setPopupHtml: vi.fn() };
    const pipeline = buildPipelineForAction(ATTACK, { name: 'Gimli', campaignName: 'test-campaign' });
    await pipeline.run('chain:start', ctx, { current: null });

    expect(S.createObservers).toHaveBeenCalledTimes(1);
    expect(S.createObservers.mock.calls[0]).toEqual([]);
    expect(S.createSseObservers).toHaveBeenCalledTimes(1);
    expect(S.createSseObservers).toHaveBeenCalledWith('test-campaign'); // exact bytes #993
    expect(S.logObserverHandler).toHaveBeenCalledWith(ctx, expect.anything(), 'chain:start');
    expect(S.sseObserverHandler).toHaveBeenCalledWith(ctx, expect.anything(), 'chain:start');
  });

  it('without campaignName registers log observers only — createSseObservers never invoked', async () => {
    const ctx = { attack: ATTACK };
    const pipeline = buildPipelineForAction(ATTACK, { name: 'Gimli' });
    await pipeline.run('chain:start', ctx, { current: null });

    expect(S.createObservers).toHaveBeenCalledTimes(1);
    expect(S.createSseObservers).not.toHaveBeenCalled();
    expect(S.logObserverHandler).toHaveBeenCalled();
    expect(S.sseObserverHandler).not.toHaveBeenCalled();
  });
});
