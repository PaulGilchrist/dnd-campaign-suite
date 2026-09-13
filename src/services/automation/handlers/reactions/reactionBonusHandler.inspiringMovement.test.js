// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyInspiringMovement } from './reactionBonusHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as automationIndex from '../../index.js';

// ── Mocks (hoisted) ────────────────────────────────────────────

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../index.js', () => ({
  executeHandler: vi.fn(),
}));

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 2,
    level: 3,
    speed: 30,
    abilities: [
      { name: 'Strength', bonus: 3 },
      { name: 'Dexterity', bonus: 1 },
      { name: 'Constitution', bonus: 2 },
      { name: 'Intelligence', bonus: 0 },
      { name: 'Wisdom', bonus: 1 },
      { name: 'Charisma', bonus: 3 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Inspiring Movement',
    automation: {
      effect: 'self_and_ally_reactive_movement',
      duration: '',
      uses_expression: null,
      usesMax: null,
      uses: 0,
      resourceKey: null,
      allyRange: '30 ft',
      noOAs: true,
      ...automation,
    },
  };
}

function makeCombatSummary(creatures) {
  return { creatures };
}

// ── No map — no creatures — popup ──────────────────────────────

describe('handleInspiringMovement — no map, no creatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));
  });

  it('returns popup with movement description when no map and no creatures', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toContain('You may move up to 15 ft');
    expect(result.payload.description).toContain('does not provoke Opportunity Attacks');
  });

  it('uses player speed for half-speed calculation', async () => {
    const ps = makePlayerStats({ speed: 40 });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('20 ft');
  });

  it('defaults speed to 30 when playerStats.speed is falsy', async () => {
    const ps = makePlayerStats({ speed: undefined });
    const action = makeAction();

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('15 ft');
  });
});

// ── No map — with creatures — modal ────────────────────────────

describe('handleInspiringMovement — with creatures, no map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
  });

  it('returns a modal when there are creatures in combat', async () => {
    const ps = makePlayerStats();
    const action = makeAction();
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
      { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('inspiringMovementAlly');
    expect(result.payload.creatureTargets).toEqual([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
      { name: 'Wizard', currentHp: 15, maxHp: 20, size: 'Small', type: 'humanoid' },
    ]);
    expect(result.payload.halfSpeed).toBe(15);
    expect(result.payload.noOAs).toBe(true);
  });

  it('excludes self from creature targets', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction();
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Bard', currentHp: 30, maxHp: 30, size: 'Medium', type: 'humanoid' },
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.creatureTargets).toHaveLength(1);
    expect(result.payload.creatureTargets[0].name).toBe('Fighter');
  });
});

// ── Uses exhaustion ────────────────────────────────────────────

describe('handleInspiringMovement — uses exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns info popup when uses are exhausted (no modal)', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ usesMax: 3 });
    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'Fighter', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
    ]));

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ── applyInspiringMovement ─────────────────────────────────────

describe('applyInspiringMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(3);
  });

  it('decrements uses when usesMax > 0', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ usesMax: 3 });

    const result = await applyInspiringMovement({
    action,
    playerStats: ps,
    campaignName,
    allyName: 'Fighter',
    halfSpeed: 15,
    noOAs: true,
});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 2, campaignName
    );
    expect(result.type).toBe('popup');
  });

  it('grants no-OA to self', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement({
    action,
    playerStats: ps,
    campaignName,
    allyName: 'Fighter',
    halfSpeed: 15,
    noOAs: true,
});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard', targetName: 'Bard', effects: [{ type: 'inspiring_movement_no_oa' }], campaignName, rounds: undefined, expireOnCreatureName: 'Bard' });
  });

  it('grants no-OA and movement granted to ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement({
    action,
    playerStats: ps,
    campaignName,
    allyName: 'Fighter',
    halfSpeed: 15,
    noOAs: true,
});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Fighter', 'inspiringMovementGranted', true, campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Fighter', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard', targetName: 'Fighter', effects: [{ type: 'inspiring_movement_no_oa' }], campaignName, rounds: undefined, expireOnCreatureName: 'Bard' });
    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard', targetName: 'Fighter', effects: [{ type: 'inspiring_movement_granted' }], campaignName, rounds: undefined, expireOnCreatureName: 'Bard' });
  });

  it('logs to campaign with ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    await applyInspiringMovement({
    action,
    playerStats: ps,
    campaignName,
    allyName: 'Fighter',
    halfSpeed: 15,
    noOAs: true,
});

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Inspiring Movement',
        description: expect.stringContaining('Ally: Fighter'),
      })
    );
  });

  it('returns popup with correct description', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ noOAs: true });

    const result = await applyInspiringMovement({
    action,
    playerStats: ps,
    campaignName,
    allyName: 'Fighter',
    halfSpeed: 15,
    noOAs: true,
});

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Inspiring Movement');
    expect(result.payload.description).toContain('Bard used Inspiring Movement (Dance)');
    expect(result.payload.description).toContain('15 ft');
    expect(result.payload.description).toContain('Fighter');
    expect(result.payload.description).toContain('does not provoke Opportunity Attacks');
  });
});

// ── CLA-199: bardic inspiration consumption + Agile Strikes popup ───

function make2024Action(overrides = {}) {
  return makeAction({
    resourceCost: 'bardic_inspiration',
    uses_expression: null,
    usesMax: null,
    uses: 0,
    ...overrides,
  });
}

function trackedBard(max = 5) {
  return makePlayerStats({
    name: 'Bard',
    _trackedResources: { bardicInspirationUses: { current: max, max } },
  });
}

function biCalls() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'bardicInspirationUses');
}

describe('CLA-199 — handleInspiringMovement resolves bardic uses from tracked resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([
      { name: 'HexWarlock', currentHp: 20, maxHp: 30, size: 'Medium', type: 'humanoid' },
    ]));
  });

  it('opens ally picker when tracked Bardic Inspiration has uses (data has no uses metadata)', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    const result = await handle(make2024Action(), trackedBard(5), campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.payload.usesMax).toBe(5);
    expect(result.payload.usesKey).toBe('bardicInspirationUses');
  });

  it('returns no-uses popup when bardic inspiration runtime is 0 (usesMax gated via _trackedResources)', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(make2024Action(), trackedBard(5), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
  });
});

describe('CLA-199 — applyInspiringMovement expends Bardic Inspiration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));
  });

  it('decrements bardicInspirationUses 5→4 when runtime key unset (defaults to tracked max)', async () => {
    const result = await applyInspiringMovement({
    action: make2024Action(),
    playerStats: trackedBard(5),
    campaignName,
    allyName: 'HexWarlock',
    halfSpeed: 15,
    noOAs: true,
});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 4, campaignName
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        description: expect.stringContaining('Expended 1 Bardic Inspiration (4 remaining)'),
      })
    );
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('Expended 1 Bardic Inspiration');
  });

  it('consumes from live runtime value when set', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(3);

    await applyInspiringMovement({
    action: make2024Action(),
    playerStats: trackedBard(5),
    campaignName,
    allyName: 'HexWarlock',
    halfSpeed: 15,
    noOAs: true,
});

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 2, campaignName
    );
  });

  it('never decrements below zero at 0 uses', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await applyInspiringMovement({
    action: make2024Action(),
    playerStats: trackedBard(5),
    campaignName,
    allyName: 'HexWarlock',
    halfSpeed: 15,
    noOAs: true,
});

    expect(biCalls()).toHaveLength(0);
  });

  it('does not consume when resourceCost is not bardic_inspiration', async () => {
    await applyInspiringMovement({
    action: makeAction({ usesMax: null, uses: 0 }),
    playerStats: trackedBard(5),
    campaignName,
    allyName: 'HexWarlock',
    halfSpeed: 15,
    noOAs: true,
});

    expect(biCalls()).toHaveLength(0);
  });
});

describe('CLA-199 — Agile Strikes chain does not hijack the Inspiring Movement popup', () => {
  const agilePlayer = () => makePlayerStats({
    name: 'Bard',
    automation: { passives: [{ type: 'passive_rule', effect: 'agile_strike' }] },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(5);
    damageUtils.getCombatContext.mockResolvedValue(makeCombatSummary([]));
  });

  it('skips agile_strike entirely when no enemy target is resolved', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue(null);

    const result = await applyInspiringMovement({
    action: make2024Action(),
    playerStats: agilePlayer(),
    campaignName,
    allyName: 'HexWarlock',
    halfSpeed: 15,
    noOAs: true,
});

    expect(automationIndex.executeHandler).not.toHaveBeenCalled();
    expect(result.payload.name).toBe('Inspiring Movement');
    expect(result.payload.description).not.toContain('No target selected');
  });

  it('appends agile strike result but keeps the Inspiring Movement popup when a target exists', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Wight 1' });
    automationIndex.executeHandler.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Agile Strikes', description: 'Hit for 5 Bludgeoning damage' },
    });

    const result = await applyInspiringMovement({
    action: make2024Action(),
    playerStats: agilePlayer(),
    campaignName,
    allyName: 'HexWarlock',
    halfSpeed: 15,
    noOAs: true,
});

    expect(automationIndex.executeHandler).toHaveBeenCalled();
    expect(result.payload.name).toBe('Inspiring Movement');
    expect(result.payload.description).toContain('HexWarlock');
    expect(result.payload.description).toContain('Agile Strikes: Hit for 5 Bludgeoning damage');
  });
});
