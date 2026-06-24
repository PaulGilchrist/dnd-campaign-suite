// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionBonusHandler.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as rangeValidation from '../../../rules/combat/rangeValidation.js';

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

// ── Constants & Helpers ────────────────────────────────────────

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

function inRangeAlly() {
  useRuntimeState.getRuntimeValue.mockReturnValue(0);
  rangeValidation.rangeToFeet.mockReturnValue(30);
  targetResolver.resolveMapPositions.mockResolvedValue({
    attackerPos: { gridX: 0, gridY: 0 },
    targetPos: { gridX: 2, gridY: 0 },
  });
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });
  rangeValidation.getDistanceFeet.mockReturnValue(15);
}

// ── No map / no ally ───────────────────────────────────────────

describe('handleInspiringMovement — no map or ally', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns popup description with movement only when no map', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('You move up to 15 ft');
    expect(result.payload.description).not.toContain('Select an ally');
  });

  it('returns popup description with custom ally range', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', allyRange: '50 ft' });
    rangeValidation.rangeToFeet.mockReturnValue(50);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('Select an ally within 50 ft');
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

  it('skips ally resolution when allyRangeFt is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });
    rangeValidation.rangeToFeet.mockReturnValue(null);

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    expect(result.payload.description).not.toContain('Select an ally');
  });

  it('grants no-OA to self when noOAs is true', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('This movement does not provoke Opportunity Attacks');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'inspiringMovementNoOA', true, campaignName
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Bard', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('omits no-OA text when noOAs is false', async () => {
    const ps = makePlayerStats({ speed: 30 });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('Opportunity Attacks');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      expect.any(String), 'inspiringMovementNoOA', expect.any(Boolean), expect.any(String)
    );
  });
});

// ── Ally resolution via map ────────────────────────────────────

describe('handleInspiringMovement — ally resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grants movement to an in-range ally', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });
    inRangeAlly();

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('Ally1 can also move');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally1', 'inspiringMovementGranted', true, campaignName
    );
  });

  it('grants no-OA to ally when noOAs is true', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: true });
    inRangeAlly();

    await handle(action, ps, campaignName, mapName);

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_granted' }], campaignName, 1
    );
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Bard', 'Ally1', [{ type: 'inspiring_movement_no_oa' }], campaignName, 1
    );
  });

  it('skips no-OA on ally when noOAs is false', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', noOAs: false });
    inRangeAlly();

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Ally1', 'inspiringMovementNoOA', expect.any(Boolean), expect.any(String)
    );
  });

  it('skips ally resolution when target is out of range', async () => {
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
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Ally1', 'inspiringMovementGranted', expect.any(Boolean), expect.any(String)
    );
  });

  it('skips ally movement when no target is selected', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue(null);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('can also move');
  });

  it('skips ally movement when targetPos is missing from map', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Ally1' } });

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('can also move');
  });

  it('skips ally movement when getDistanceFeet returns null', async () => {
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

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('can also move');
  });

  it('handles resolveMapPositions returning empty object', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({});

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('can also move');
  });

  it('handles targetInfo without target property', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    rangeValidation.rangeToFeet.mockReturnValue(30);
    targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 0, gridY: 0 } });
    targetResolver.resolveTarget.mockResolvedValue({});

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('can also move');
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

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).not.toContain('can also move');
  });
});

// ── Uses tracking ──────────────────────────────────────────────

describe('handleInspiringMovement — uses tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early with "no uses remaining" when all uses exhausted (usesMax)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early with "no uses remaining" when numeric uses match used count', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', uses: 2, usesMax: null });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('no uses remaining');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('decrements uses when not exhausted (usesMax)', async () => {
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

  it('treats null getRuntimeValue result as max uses (no decrement)', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 3 });

    useRuntimeState.getRuntimeValue.mockReturnValueOnce(null);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Bard', 'bardicInspirationUses', 2, campaignName
    );
  });

  it('skips uses tracking when usesMax is 0', async () => {
    const ps = makePlayerStats({ name: 'Bard' });
    const action = makeAction({ effect: 'inspiring_movement', usesMax: 0 });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    await handle(action, ps, campaignName, mapName);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      expect.any(String), expect.stringMatching(/Uses$/i), expect.any(Number), expect.any(String)
    );
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

  it('proceeds normally when expression evaluates to 0 (no tracking)', async () => {
    const ps = makePlayerStats({});
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'INVALID_EXPR' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.type).toBe('popup');
    expect(result.payload.description).not.toContain('no uses remaining');
  });

  it('handles missing level on playerStats for evaluateUses', async () => {
    const ps = makePlayerStats({});
    delete ps.level;
    const action = makeAction({ effect: 'inspiring_movement', uses_expression: 'level * 2' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(action, ps, campaignName, mapName);

    expect(result.payload.description).toContain('no uses remaining');
  });
});

// ── Log entry and payload structure ────────────────────────────

describe('handleInspiringMovement — log and payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    inRangeAlly();

    await handle(action, ps, campaignName, mapName);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        description: 'Bard used Test Reaction. Ally: Ally1.',
      })
    );
  });

  it('catches and swallows addEntry errors', async () => {
    const ps = makePlayerStats();
    const action = makeAction({ effect: 'inspiring_movement' });

    useRuntimeState.getRuntimeValue.mockReturnValue(0);
    logService.addEntry.mockRejectedValue(new Error('fail'));

    await expect(handle(action, ps, campaignName, mapName)).resolves.toBeDefined();
  });
});
