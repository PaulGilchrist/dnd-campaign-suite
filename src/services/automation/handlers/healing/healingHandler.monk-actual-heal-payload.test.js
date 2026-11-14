// @maintained-by-ai
//
// ── Regression pin for bug-hand-of-healing-modal-overstates-restored-hp ──
// performMonkHeal computes BOTH healAmount (pre-clamp roll sum) and
// actualHeal (clamped, the amount really restored — what healDesc/the audit
// row reports), but the handOfHealing modal payload only carried healAmount,
// so the result modal over-reported healing on an at-max target. The payload
// must carry actualHeal, and the ability_use log line stays the honest
// "(Already at full HP)" annotation via healDesc.
// Mock set mirrors healingHandler.monk.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(),
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  resolveHealingBonusesWithDetails: vi.fn(),
  markFortifiedHealthUsed: vi.fn(),
  hasHealingMaximizationForTarget: vi.fn(),
  hasRerollHealingOnes: vi.fn(),
  hasTacticalShift: vi.fn(() => false),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(),
  computeHitDieRecovery: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { handle } from './healingHandler.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as healingRoll from '../../common/healingRoll.js';
import * as automationService from '../../../combat/automation/automationService.js';
import * as logService from '../../../ui/logService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHealer',
    level: 5,
    proficiency: 3,
    currentHitPoints: 10,
    maxHitPoints: 20,
    abilities: [{ name: 'Wisdom', bonus: 2 }],
    ...overrides,
  };
}

// self_healing + martial_arts_die/WIS expression → the monk healing lane.
function makeMonkAction() {
  return {
    name: 'Hand of Healing',
    automation: {
      type: 'self_healing',
      healExpression: 'martial_arts_die + WIS',
    },
  };
}

describe('healingHandler monk payload carries the clamped actualHeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The commit lane (performMonkHeal) is now the sole Focus writer — a readable
    // pool is required for the spend leg; no bucket HP truth (null) keeps the
    // self-heal capacity check on the makePlayerStats 10/20 face below.
    getRuntimeValue.mockImplementation((_name, key) => (key === 'focusPoints' ? 4 : null));
    diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0 });
    classFeatures.getClassFeatures.mockReturnValue({ martialArtsDie: 12 });
    automationService.resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [] });
    automationService.hasHealingMaximizationForTarget.mockReturnValue(false);
    automationService.hasRerollHealingOnes.mockReturnValue(false);
  });

  it('payload.actualHeal is 0 on an at-max target while healAmount keeps the pre-clamp roll sum', async () => {
    // Live repro face: 1d12 + 7 + 2 = 16 rolled into a 112/112 target.
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 112, maxHp: 112, actualHeal: 0 });
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 7 }] });

    const result = await handle(makeMonkAction(), ps, campaignName, null);

    expect(result.modalName).toBe('handOfHealing');
    expect(result.payload.healAmount).toBe(16); // roll 7 + WIS 7 + bonus 2
    expect(result.payload.actualHeal).toBe(0);
  });

  it('payload.actualHeal carries the clamped partial-heal amount on a damaged target', async () => {
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 134, maxHp: 143, actualHeal: 16 });
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 7 }] });

    const result = await handle(makeMonkAction(), ps, campaignName, null);

    expect(result.payload.actualHeal).toBe(16);
  });

  it('the ability_use audit row annotates the zero-restore heal exactly like the modal copy', async () => {
    healingRoll.applyHealingDirectly.mockReturnValue({ newHp: 112, maxHp: 112, actualHeal: 0 });
    const ps = makePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 7 }] });

    await handle(makeMonkAction(), ps, campaignName, null);

    const entry = logService.addEntry.mock.calls.find(([, e]) => e.type === 'ability_use');
    expect(entry).toBeTruthy();
    expect(entry[1].description).toContain('= 16 (Already at full HP).');
  });
});
