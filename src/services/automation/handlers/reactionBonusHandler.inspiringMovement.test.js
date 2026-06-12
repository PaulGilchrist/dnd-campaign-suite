import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionBonusHandler.js';
import * as targetResolver from '../common/targetResolver.js';
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import * as expirations from '../../rules/expirations.js';
import * as logService from '../../ui/logService.js';
import * as rangeValidation from '../../rules/rangeValidation.js';

// ── Mocks (hoisted) ────────────────────────────────────────────

vi.mock('../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/expirations.js', () => ({
  addExpiration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../rules/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'DungeonMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Paladin',
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
    name: 'Test Reaction',
    automation: {
      effect: '',
      duration: '',
      uses_expression: null,
      usesMax: null,
      uses: 0,
      resourceKey: null,
      allyRange: '30 ft',
      noOAs: false,
      ...automation,
    },
  };
}

function resetMocks() {
  useRuntimeState.getRuntimeValue.mockClear().mockReset();
  useRuntimeState.setRuntimeValue.mockClear().mockResolvedValue(undefined);
  targetResolver.resolveTarget.mockClear().mockReset();
  targetResolver.resolveMapPositions.mockClear().mockReset();
  rangeValidation.getDistanceFeet.mockClear().mockReset();
  rangeValidation.rangeToFeet.mockClear().mockReturnValue(30);
  expirations.addExpiration.mockClear().mockReset();
  logService.addEntry.mockClear().mockResolvedValue({});
}

// ── No map / no ally ───────────────────────────────────────────

describe('handleInspiringMovement — no map or ally', () => {
  beforeEach(() => resetMocks());

  it('does not call resolveMapPositions when mapName is falsy', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, null);

    expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
  });

  it('describes movement but no ally when mapName is falsy', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('You move up to 15 ft');
    expect(result.payload.description).toContain('Select an ally within 30 ft');
  });

  it('does not call resolveMapPositions when allyRangeFt is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });
    rangeValidation.rangeToFeet.mockReturnValue(null);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
  });

  it('does not grant inspiring movement to self when noOAs is false', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    const noOACall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementNoOA'
    );
    expect(noOACall).toBeUndefined();
  });

  it('sets inspiringMovementNoOA on self when noOAs is true', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'inspiringMovementNoOA', true, campaignName
    );

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Bard', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('description mentions Opportunity Attacks when noOAs is true', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('This movement does not provoke Opportunity Attacks.');
  });

  it('description does NOT mention Opportunity Attacks when noOAs is false', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Opportunity Attacks');
  });

  it('uses player speed for half-speed calculation', async () => {
    const ps = makePlayerStats({ speed: 40 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('You move up to 20 ft');
  });

  it('defaults speed to 30 when playerStats.speed is missing', async () => {
    const ps = makePlayerStats({});
    delete ps.speed;
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('You move up to 15 ft');
  });

  it('defaults speed to 30 when playerStats.speed is 0', async () => {
    const ps = makePlayerStats({ speed: 0 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('You move up to 15 ft');
  });
});

// ── Ally resolution via map ────────────────────────────────────

describe('handleInspiringMovement — ally resolution', () => {
  beforeEach(() => resetMocks());

  it('resolves an in-range ally and grants inspiring movement', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('Ally1 can also move');
  });

  it('sets inspiringMovementGranted on the ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally1', 'inspiringMovementGranted', true, campaignName
    );
  });

  it('sets inspiringMovementNoOA on ally when noOAs is true', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_granted' }], campaignName, 1
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('does NOT set inspiringMovementNoOA on ally when noOAs is false', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    const allyNoOACall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[0] === 'Ally1' && c[1] === 'inspiringMovementNoOA'
    );
    expect(allyNoOACall).toBeUndefined();
  });

  it('does not grant ally movement when target is out of allyRange', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', allyRange: '10 ft' });
    rangeValidation.rangeToFeet.mockReturnValue(10);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 10, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(50);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Ally1 can also move');
    expect(result.payload.description).toContain('Select an ally within 10 ft');
  });

  it('does not resolve map positions when no target found', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('does not resolve map positions when targetPos is missing from map', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('does not resolve positions when getDistanceFeet returns null', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(null);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Ally1 can also move');
  });

  it('handles resolveMapPositions returning null', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('handles resolveTarget returning null', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue(null);

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });
});

// ── Uses tracking ──────────────────────────────────────────────

describe('handleInspiringMovement — uses tracking', () => {
  beforeEach(() => resetMocks());

  it('returns early when all uses are exhausted (usesMax)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
  });

  it('returns early when uses (numeric) matches used count', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', uses: 2, usesMax: null });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('no uses remaining');
  });

  it('increments uses count when not exhausted (usesMax)', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3, resourceKey: 'customUses' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(1);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'customUses', 0, campaignName
    );
  });

  it('defaults resourceKey to bardicInspirationUses when not provided', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3, resourceKey: null });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(2);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 1, campaignName
    );
  });

  it('treats null getRuntimeValue as 0 uses used', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(2);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 1, campaignName
    );
  });

  it('does NOT increment uses when usesMax is 0 (no tracking)', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 0 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    const usesCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'bardicInspirationUses' || c[1].includes('Uses')
    );
    expect(usesCall).toBeUndefined();
  });

  it('evaluates string expression for usesMax', async () => {
    const ps = makePlayerStats({ proficiency: 2, level: 3 });
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'proficiency_bonus' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(1);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('uses level placeholder in expression', async () => {
    const ps = makePlayerStats({ proficiency: 4, level: 8 });
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'level / 2' });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(3);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });

  it('treats invalid expression as 0 uses (no tracking)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'INVALID_EXPR' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin', 'bardicInspirationUses', expect.any(Number), campaignName
    );
  });

  it('does not call setRuntimeValue for uses on early exit', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 2 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ── Log entry and payload ──────────────────────────────────────

describe('handleInspiringMovement — log and payload', () => {
  beforeEach(() => resetMocks());

  it('adds log entry without ally when no ally resolved', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Test Reaction',
        description: 'Bard used Test Reaction.',
      })
    );
  });

  it('adds log entry with ally name when ally is resolved', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
    rangeValidation.getDistanceFeet.mockReturnValue(15);

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        description: 'Bard used Test Reaction. Ally: Ally1.',
      })
    );
  });

  it('catches and swallows addEntry errors on Inspiring Movement', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('returns popup with correct payload structure', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Test Reaction');
    expect(result.payload.automation).toBe(action.automation);
  });

  it('uses allyRange from auto in "select an ally" description', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', allyRange: '50 ft' });
    rangeValidation.rangeToFeet.mockReturnValue(50);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('Select an ally within 50 ft');
  });

  it('uses default "30 ft" in description when auto.allyRange is not custom', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('Select an ally within 30 ft');
  });
});

// ── evaluateUses edge cases ────────────────────────────────────

describe('handleInspiringMovement — evaluateUses edge cases', () => {
  beforeEach(() => resetMocks());

  it('treats null expression as 0 uses', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin', 'bardicInspirationUses', expect.any(Number), campaignName
    );
  });

  it('handles proficiency_bonus in expression correctly', async () => {
    const ps = makePlayerStats({ proficiency: 3, level: 5 });
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'proficiency_bonus + 1' });

    useRuntimeState.getRuntimeValue.mockReturnValue(2);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
  });
});

// ── Null safety ────────────────────────────────────────────────

describe('Inspiring Movement null safety', () => {
  beforeEach(() => resetMocks());

  it('handles missing level on playerStats for evaluateUses', async () => {
    const ps = makePlayerStats({});
    delete ps.level;
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'level * 2' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });

  it('handles resolveMapPositions returning empty object', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({});

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('handles targetInfo without target property', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue({});

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });

  it('handles targetInfo.target without name property', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 0, gridY: 0 },
      targetPos: { gridX: 2, gridY: 0 },
    });
    targetResolver.resolveTarget.mockResolvedValue({ target: {} });

    await handle(action, ps, campaignName, mapName);

    const grantCall = useRuntimeState.setRuntimeValue.mock.calls.find(
      c => c[1] === 'inspiringMovementGranted'
    );
    expect(grantCall).toBeUndefined();
  });
});
