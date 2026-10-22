// @maintained-by-ai
// Lane: masteryDone terminal-marker FIRING POINT (attackRollPostDamage.js:711-726) through the
// REAL event-chain runner (actionPipeline.js createPipeline). The runner is SINGLE-PATH:
// run() → steps.find(s => s.subscribe === eventType) selects exactly ONE subscriber per event
// (first in registration order) and chains via step.emit — a second subscriber on an already
// consumed event is unreachable dead wiring.
//
// FIXED contract pinned here (ledger: attackRollPostDamage.js 'cleave:check' subscribe defect):
//   the marker rides 'mastery:done' — emitted by toppleMastery (attackRollPostDamage.js:667),
//   the chain's last mastery handler — so 'pipeline:complete' / ctx._pipelineComplete is
//   guaranteed strictly AFTER mastery resolution. Pre-fix bytes ('cleave:check') never fired
//   the marker at all: cleaveMastery (:520, idx 20) consumes 'cleave:check' and the chain
//   never returns to it; run() then breaks at 'mastery:done' (no subscriber).
//
// Kill proofs (NEVER delete/weaken):
//   - t1 wiring bytes: reverting subscribe to 'cleave:check' fails instantly.
//   - t2 invocationCallOrder ledger (repo canonical ordering-pin form): toppleMastery resolves
//     before masteryDone runs, marker fires EXACTLY once, ctx._pipelineComplete stamped.
//   - t3 cleave-less/non-mastery OA: all mastery rider conditions relay (handler + condition
//     bytes untouched — relays are the runner's contract) yet the marker still marks done.
//     Reverting to 'cleave:check' kills t2 AND t3 (marker unreachable in both).
//
// Method: bare imports (zero module mocks, per attackRollDamageSteps.test.js composition-lane
// discipline). REAL steps from buildAttackRollDamageSteps(); handlers replaced with record-only
// spies — this lane owns FIRING ORDER, not handler behavior (behavior lanes: -cleaveMastery/
// -tacticalMaster/-toppleMastery, cleaveOncePerTurn). subscribe/emit/condition stay verbatim
// real, so chain path selection is exercised honestly. Campaign: test-campaign only.

import { describe, it, expect, vi } from 'vitest';
import { createPipeline } from '../actionPipeline.js';
import { buildAttackRollDamageSteps } from './attackRollDamageSteps.js';

// Assemble the REAL 24-step chain through the REAL runner; every handler is a spy that
// records its invocation and returns an inert { data: {} } (no modal → chain runs to end).
function runRealChain(ctx) {
  const spies = {};
  const order = [];
  const pipeline = createPipeline();
  for (const step of buildAttackRollDamageSteps()) {
    // The masteryDone handler is a pure inert marker ({ _pipelineComplete: true }) — run it
    // REAL so the ctx stamp is honest; all other handlers become record-only spies.
    spies[step.name] = vi.fn(async () => {
      order.push(step.name);
      return step.name === 'masteryDone' ? step.handler({}) : { data: {} };
    });
    pipeline.step({ ...step, handler: spies[step.name] });
  }
  const resumeRef = { current: null };
  return { spies, order, run: () => pipeline.run('housekeeping:do', ctx, resumeRef), resumeRef };
}

const MASTERY_TAIL = [
  'stalkersFlurryPostDamage',
  'cleaveMastery',
  'tacticalMaster',
  'toppleMastery',
  'masteryDone',
];

describe('masteryDone terminal marker — subscribes mastery:done, fires once, strictly after mastery', () => {
  it('t1 wiring bytes: masteryDone subscribes mastery:done and emits pipeline:complete (kill: reverting to cleave:check dies here)', () => {
    const step = buildAttackRollDamageSteps().find((s) => s.name === 'masteryDone');
    expect([step.subscribe, step.emit]).toEqual(['mastery:done', 'pipeline:complete']);
    // Emitter guarantee: toppleMastery is the sole mastery:done emitter in this chain and
    // sits immediately before the marker (idx 22 -> idx 23).
    const topple = buildAttackRollDamageSteps().find((s) => s.name === 'toppleMastery');
    expect(topple.emit).toBe('mastery:done');
  });

  it('t2 full mastery OA: invocationCallOrder ledger — toppleMastery resolves BEFORE masteryDone; marker fires exactly once and stamps _pipelineComplete', async () => {
    const ctx = {
      campaignName: 'test-campaign',
      attack: { name: 'Greataxe', weaponType: 'melee', damage: '1d12' },
      playerStats: { name: 'Testinator', automation: { passives: [], actions: [] } },
      setSecondaryTargetModal: () => {},
      hit: true,
    };
    const { spies, order, run, resumeRef } = runRealChain(ctx);

    await run();

    expect(order.slice(-MASTERY_TAIL.length)).toEqual(MASTERY_TAIL);
    expect(spies.masteryDone).toHaveBeenCalledTimes(1);
    // Canonical ordering-pin form: topple's resolution call precedes the marker's call.
    expect(spies.toppleMastery.mock.invocationCallOrder[0])
      .toBeLessThan(spies.masteryDone.mock.invocationCallOrder[0]);
    expect(ctx._pipelineComplete).toBe(true);
    expect(resumeRef.current).toBeNull();
  });

  it('t3 cleave-less / non-mastery OA: rider conditions relay, marker still marks done exactly once (kill: cleave:check subscription never fires)', async () => {
    const ctx = {
      campaignName: 'test-campaign',
      playerStats: {},
    };
    const { spies, order, run } = runRealChain(ctx);

    await run();

    expect(order).toEqual(['housekeeping', 'buildContext', 'targetEffects', 'superiorityDieBonuses', 'featureRiders', 'masteryDone']);
    expect(spies.cleaveMastery).not.toHaveBeenCalled();
    expect(spies.toppleMastery).not.toHaveBeenCalled();
    expect(spies.masteryDone).toHaveBeenCalledTimes(1);
    expect(ctx._pipelineComplete).toBe(true);
  });
});
