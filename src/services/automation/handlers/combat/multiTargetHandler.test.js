// @maintained-by-ai
// Router-contract oracle for the LIVE `multi_target_spread` route:
// automation/index.js HANDLER_MAP (:369) → executeHandler ← CharSpecialActions
// handleAutomationClick (row click via automationRouter routePassiveSpecial).
//
// ⚠️ VESTIGIAL FLOW — FLAGGED FOR OWNERS: the emitted `multi_target_selection`
// popup has NO dedicated UI consumer (zero hits in src/components/ outside this
// handler; sibling `applyMultiTarget` apply-lane export was confirmed dead and
// its test deleted). A row click therefore renders only the generic
// buildAutomationPopupHtml dismiss popup (name + description), and the two-step
// second-target selection can never complete. Real multi-target spell selection
// lives on other lanes (spellCastService/modalSpells.js, useSpellMetamagicGates,
// postCastRiderService.getMultiTargetSpreads) — deliberately NOT covered here.
// Source owners to decide: build the missing selection UI or delete
// handler + this test wholesale.
//
// Pins kept to the honest minimum: the user-visible automation_info popups
// (buildAutomationPopupHtml renders payload.name + payload.description), the
// popup type the live route still returns, first-target exclusion, and the
// resolveMapPositions side effect. Deep payload structure of the unconsumed
// selection popup (range defaults, spellFilter, full payload shape) is
// deliberately NOT pinned.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockImplementation(() => Promise.resolve(true)),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './multiTargetHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { addEntry } from '../../../ui/logService.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';

import {
  campaignName,
  mapName,
  makePlayerStats,
  makeAction,
  makeCombatSummary,
} from './multiTargetHandler.test-utils.js';

const creatures = [
  { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
  { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
  { name: 'Ally', type: 'player' },
];

describe('multiTargetHandler.handle (router contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatContext.mockResolvedValue(makeCombatSummary(creatures));
    getCombatSummary.mockReturnValue(makeCombatSummary(creatures));
  });

  // automation_info popups ARE user-visible: handleAutomationClick renders
  // payload.name + payload.description through buildAutomationPopupHtml.

  it('returns an automation_info popup when no combat context exists', async () => {
    getCombatContext.mockResolvedValue(null);

    const result = await handle(
      makeAction({}, { payload: { targetName: 'Goblin' } }),
      makePlayerStats(),
      campaignName,
      mapName
    );

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Word of Creation');
    expect(result.payload.description).toBe('No combat context found. Cannot apply Word of Creation.');
  });

  it('returns an automation_info popup when the first target is missing (unknown name or no payload)', async () => {
    getCombatContext.mockResolvedValue(makeCombatSummary([{ name: 'Orc' }]));

    const unknownTarget = await handle(
      makeAction({}, { payload: { targetName: 'Goblin' } }),
      makePlayerStats(),
      campaignName,
      mapName
    );
    const noPayload = await handle(
      makeAction({}, { payload: null }),
      makePlayerStats(),
      campaignName,
      mapName
    );

    for (const result of [unknownTarget, noPayload]) {
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No first target found. Word of Creation requires a target to spread to a second creature.');
    }
  });

  it('returns the multi_target_selection popup, excluding the first target from candidates, after resolving caster map positions', async () => {
    const result = await handle(
      makeAction({}, { payload: { targetName: 'Goblin' } }),
      makePlayerStats(),
      campaignName,
      mapName
    );

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('multi_target_selection');
    expect(result.payload.name).toBe('Word of Creation');
    expect(result.payload.firstTargetName).toBe('Goblin');
    expect(result.payload.creatureTargets).toEqual(['Orc', 'Ally']);
    expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestHero');
  });

  it('is read-only: never logs, writes runtime state, or applies damage/healing', async () => {
    await handle(
      makeAction({}, { payload: { targetName: 'Goblin' } }),
      makePlayerStats(),
      campaignName,
      mapName
    );

    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(applyHealingToTarget).not.toHaveBeenCalled();
  });
});
