// CLA-315 lane companion: Feather Fall — retroactive undo of stamped
// trigger:'falling' lastAttack damage; refusals spend nothing; same-fall
// re-cast refused by timestamp stamp.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));
vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));
vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));
vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import { handle } from './featherFallHandler.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';
const action = { name: 'Feather Fall', automation: { type: 'feather_fall', trigger: 'falling' } };
const caster = { name: 'TestHero' };

function fallingAttack(overrides = {}) {
  // findLastAttack returns timestamp ONLY on attackEvent (not top-level) —
  // fixture must match that real shape (live-caught defect 2026-10-10).
  return {
    attackEvent: { trigger: 'falling', timestamp: 1000 },
    trigger: 'falling',
    targetName: 'TestHero',
    totalDamage: 27,
    ...overrides,
  };
}

describe('featherFallHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(0);
    damageUtils.getCombatContext.mockResolvedValue({ round: 1 });
    applyHealing.applyHealingToTarget.mockImplementation((cs, name, amount) => ({ actualHeal: amount }));
  });

  it('negates fall damage: heals full amount, ability_use log, popup', async () => {
    damageRollback.findLastAttack.mockResolvedValue(fallingAttack());
    const result = await handle(action, caster, campaignName);
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith({ round: 1 }, 'TestHero', 27, campaignName);
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toMatch(/negated.*healed 27 HP/s);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Feather Fall',
      description: expect.stringMatching(/falling damage retroactively negated: healed 27 HP/),
    }));
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', '_Feather_Fall_negatedStamp', 1000, campaignName);
  });

  it('no falling event: refusal popup + feather_fall_refused log, zero heal', async () => {
    damageRollback.findLastAttack.mockResolvedValue({ attackEvent: null, trigger: null, targetName: null, totalDamage: 0 });
    const result = await handle(action, caster, campaignName);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(result.payload.description).toMatch(/Nothing is falling/);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ automationType: 'feather_fall_refused' }));
  });

  it('not-falling weapon attack (trigger leak) refused: trigger !== falling', async () => {
    damageRollback.findLastAttack.mockResolvedValue(fallingAttack({ trigger: null, attackEvent: {} }));
    const result = await handle(action, caster, campaignName);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(result.payload.description).toMatch(/Nothing is falling/);
  });

  it('same fall re-cast refused via timestamp stamp, zero second heal', async () => {
    damageRollback.findLastAttack.mockResolvedValue(fallingAttack());
    runtimeState.getRuntimeValue.mockImplementation((name, key) => (key === '_Feather_Fall_negatedStamp' ? 1000 : 0));
    const result = await handle(action, caster, campaignName);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(result.payload.description).toMatch(/already negated this fall/);
  });

  it('different caster not the falling creature: refusal', async () => {
    damageRollback.findLastAttack.mockResolvedValue(fallingAttack({ targetName: 'SomeoneElse' }));
    const result = await handle(action, caster, campaignName);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(result.payload.description).toMatch(/SomeoneElse is the falling creature/);
  });
});
