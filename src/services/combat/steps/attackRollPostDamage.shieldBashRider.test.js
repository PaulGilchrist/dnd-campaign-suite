// @maintained-by-ai 2026-11-18
// Regression pins for bug-sheet-attack-shield-bash-rider-drops-weapon-damage:
// the Shield Bash rider mounts on the POST-damage seam 'shieldBashRider'
// (subscribe 'damage:applied', emit 'bash:resolved'), so a staged-HIT `Done`
// commits the weapon damage at proceedToDamage BEFORE the push/prone save
// chain ever arms. Before the fix, shieldBash ran inside the PRE-damage
// featureRiders loop and awaited its save prompt there: zero hp_change at
// commit, and a Dismiss (which never resolves per the savePrompt dismiss
// doctrine) stranded the committed hit forever.
//
// Lane map (owned elsewhere, not duplicated): step-chain wiring bytes →
// attackRollDamageSteps.test.js golden table · module prompt/dismiss logic →
// features/shieldBash.test.js · chooser pause resume →
// useAttackDamageResolution.shieldBashResume.test.js · modal close →
// CharActionModals.shieldBash-resume.test.jsx.
//
// The real step builders + the real single-path runner are the subject, so
// only two imports are mocked: the shieldBash MODULE boundary (the seam's
// contract is what this file pins, not the prompt internals) and the runtime
// store (proceedToDamage's poisoned-weapon prelude + stalkersFlurry's pending
// reads must not touch the live store).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./features/shieldBash.js', () => ({
  shieldBash: {
    name: 'shieldBash',
    condition: vi.fn(() => true),
    handler: vi.fn(),
  },
  restoreBaseAttackAfterBash: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

import { createPipeline } from '../actionPipeline.js';
import { buildProceedToDamageStep, buildShieldBashRiderStep, buildStalkersFlurryPostDamageStep } from './attackRollPostDamage.js';
import { shieldBash } from './features/shieldBash.js';

function makeCtx() {
  return {
    campaignName: 'test-campaign',
    attack: { name: 'Glaive', damageType: 'Slashing', weaponType: 'weapon' },
    playerStats: { name: 'EvasiveFighter', automation: { passives: [{ type: 'attack_rider', effect: 'push_or_prone', oncePerTurn: true }] } },
    formula: '1d10+3',
    total: 8,
    rolls: [5],
    modifier: 3,
    targetName: 'Goblin',
    proceedWithDamage: vi.fn(),
    setPopupHtml: vi.fn(),
    setModalState: vi.fn(),
  };
}

// Real three-step slice of the shipped attack chain: damage commit → bash
// rider → the first post-bash step (stalkersFlurry, re-pointed off
// 'damage:applied' onto 'bash:resolved') plus a terminal sentinel proving
// the tail still flows.
function buildLane() {
  const pipeline = createPipeline();
  pipeline.step(buildProceedToDamageStep());
  pipeline.step(buildShieldBashRiderStep());
  pipeline.step(buildStalkersFlurryPostDamageStep());
  const tailRan = { current: false };
  pipeline.step({
    name: 'cleaveSentinel',
    subscribe: 'cleave:check',
    emit: 'cleave:done',
    condition: () => true,
    handler: async () => { tailRan.current = true; return { data: {} }; },
  });
  return { pipeline, tailRan };
}

beforeEach(() => {
  vi.clearAllMocks();
  shieldBash.condition.mockReturnValue(true);
});

describe('buildShieldBashRiderStep — wiring contract', () => {
  it('rides the post-damage seam: subscribes damage:applied, emits bash:resolved', () => {
    const step = buildShieldBashRiderStep();
    expect(step.name).toBe('shieldBashRider');
    expect(step.subscribe).toBe('damage:applied');
    expect(step.emit).toBe('bash:resolved');
  });

  it('stalkersFlurryPostDamage now rides bash:resolved (the bash step owns damage:applied)', () => {
    expect(buildStalkersFlurryPostDamageStep().subscribe).toBe('bash:resolved');
  });
});

describe('buildShieldBashRiderStep — damage commits BEFORE the rider arms', () => {
  it('resolved rider lane: exactly ONE damage commit, then the module is consulted, then the tail flows', async () => {
    const order = [];
    shieldBash.handler.mockImplementation(async (ctx, data) => {
      order.push('rider');
      expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1); // damage already committed at the seam entry
      expect(data).toEqual({ formula: '1d10+3', total: 8, rolls: [5] });
      return { data: { formula: '1d10+3', total: 8, rolls: [5] } };
    });
    const ctx = makeCtx();
    ctx.proceedWithDamage.mockImplementation(() => order.push('damage'));
    const { pipeline, tailRan } = buildLane();

    await pipeline.run('damage:ready', ctx, { current: null });

    // The regression itself: commit happens FIRST, once; the rider rides behind.
    expect(order).toEqual(['damage', 'rider']);
    expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1);
    expect(tailRan.current).toBe(true);
  });

  it('ABANDON leg: a rider that never resolves (Dismissed save) can no longer strand the committed damage', async () => {
    // Promise-race lives in the module lane (shieldBash.test.js); at the
    // seam the failure shape is a handler whose promise never settles. The
    // damage was already pushed synchronously at proceedToDamage, so a
    // parked chain loses nothing.
    shieldBash.handler.mockReturnValue(new Promise(() => {}));
    const ctx = makeCtx();
    const { pipeline } = buildLane();

    const run = pipeline.run('damage:ready', ctx, { current: null });

    // Damage truth is checked BEFORE awaiting the (never-settling) run —
    // this is the exact "target stays 7/7 with two hits parked" face killed.
    await Promise.resolve();
    expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1);
    expect(ctx.proceedWithDamage.mock.calls[0][0]).toEqual({
      attack: ctx.attack, formula: '1d10+3', total: 8, rolls: [5], modifier: 3, critLabels: undefined, pipelineCtx: ctx,
    });
    void run;
  });

  it('chooser pause lanes through the runner: damage already landed, _pausedStep is shieldBashRider with the shieldBash modal', async () => {
    const modal = { type: 'shieldBash', props: { name: 'Shield Bash', targetName: 'Goblin', saveDc: 17 } };
    shieldBash.handler.mockResolvedValue({ modal, data: { formula: '1d10+3', total: 8, rolls: [5] } });
    const ctx = makeCtx();
    const resumeRef = { current: null };
    const { pipeline, tailRan } = buildLane();

    await pipeline.run('damage:ready', ctx, resumeRef);

    expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1); // committed despite the open chooser
    expect(resumeRef.current?._pausedStep).toBe('shieldBashRider');
    expect(resumeRef.current?._modalType).toBe('shieldBash');
    expect(tailRan.current).toBe(false); // tail waits for the chooser close → resume

    await pipeline.resume(ctx, resumeRef);
    expect(tailRan.current).toBe(true);
    expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1); // resume NEVER re-commits (no merged flush)
  });

  it('null module result (no shield-bash passive) degrades to a pass-through — the tail must not abort', async () => {
    shieldBash.handler.mockResolvedValue(null);
    const ctx = makeCtx();
    const { pipeline, tailRan } = buildLane();

    await pipeline.run('damage:ready', ctx, { current: null });

    expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1);
    expect(tailRan.current).toBe(true);
  });

  it('FT-103: condition is the module gate — an opportunity attack never mounts the rider', () => {
    const step = buildShieldBashRiderStep();
    const ctx = { ...makeCtx(), isOpportunityAttack: true };
    shieldBash.condition.mockImplementation((c) => !!c.playerStats.automation?.passives && !c.isOpportunityAttack);
    expect(step.condition(ctx)).toBe(false);
    expect(step.condition(makeCtx())).toBe(true);
  });
});
