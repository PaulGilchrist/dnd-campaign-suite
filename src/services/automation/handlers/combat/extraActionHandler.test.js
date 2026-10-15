// @maintained-by-ai
// Generic-gates lane for extraActionHandler (extra_action / Action Surge),
// dispatched via automation/index.js `extra_action: handleExtraAction` and
// fed by thiefsReflexesService-style extra_action infos. Owns: oncePerCombat,
// firstRoundOnly, uses-limit (default uses, custom recharge label, custom
// resourceKey, decrement, oncePerCombat force-to-zero), the fresh-round
// fallback when no combat summary is loaded, gate precedence between the
// flags, and the unmocked automationInfoPopup success shape.
//
// The oncePerTurn latch seam (actionSurgeUsedThisRound round threading,
// CLA-004) is owned by extraActionHandler.cla004-once-per-turn.test.js with
// discriminating seeds (latch null / ==fresh round / stale stamp at wrap);
// this file pins only the oncePerCombat x oncePerTurn message precedence and
// defers round-threading there. Refusal + spend log shapes are pinned in
// that lane through the shared refusal()/logSurgeSpend helpers.
//
// Deterministic: every dependency mocked, every seed explicit and key-routed
// (no positional mockReturnValueOnce chains), no timers, no DOM.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './extraActionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../../services/encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerStats = { name: 'TestHero' };
const ACTION_NAME = 'Action Surge';

function makeAction(automation = {}) {
  return {
    name: ACTION_NAME,
    description: 'Instantly take another action',
    automation: { ...automation },
  };
}

// Key-routed store seed — never rely on call order of getRuntimeValue.
function seedStore(values = {}) {
  getRuntimeValue.mockImplementation((_name, key) => values[key]);
}

function expectUsesSet(key, value) {
  expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, key, value, campaignName, true);
}

function expectBlocked(result, description) {
  expect(result.type).toBe('popup');
  expect(result.payload.type).toBe('automation_info');
  expect(result.payload.name).toBe(ACTION_NAME);
  expect(result.payload.description).toBe(description);
  expect(setRuntimeValue).not.toHaveBeenCalled();
}

// Refusal popups share type/name with success popups; the discriminator is
// description — refusals use the `${name}: ${reason}` refusal() template,
// success passes the action's own description through automationInfoPopup.
function expectSuccess(result) {
  expect(result.type).toBe('popup');
  expect(result.payload.type).toBe('automation_info');
  expect(result.payload.description).toBe('Instantly take another action');
}

// ── Tests ──────────────────────────────────────────────────────

describe('extraActionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset().mockResolvedValue(undefined);
    loadCombatSummary.mockReset().mockResolvedValue({ round: 1, creatures: [] });
  });

  describe('oncePerCombat check', () => {
    it('blocks when combat round > 1 and writes nothing', async () => {
      loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
      seedStore({ actionSurgeUses: 2 });

      const result = await handle(makeAction({ oncePerCombat: true, uses: 2 }), playerStats, campaignName);

      expectBlocked(result, 'Action Surge can only be used once per combat.');
    });

    it('forces uses to 0 on round 1 even when the bank shows 2 (spend-out, not decrement)', async () => {
      seedStore({ actionSurgeUses: 2 });

      const result = await handle(makeAction({ oncePerCombat: true, uses: 2 }), playerStats, campaignName);

      expectSuccess(result);
      expectUsesSet('actionSurgeUses', 0);
    });
  });

  describe('firstRoundOnly check', () => {
    it('blocks when current round > 1 and writes nothing', async () => {
      loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });
      seedStore({ actionSurgeUses: 1 });

      const result = await handle(makeAction({ firstRoundOnly: true, uses: 1 }), playerStats, campaignName);

      expectBlocked(result, 'Action Surge can only be used in the first round of combat.');
    });
  });

  describe('fresh round fallback (no combat summary loaded)', () => {
    it('both gates fall back to round 1 when loadCombatSummary resolves null', async () => {
      // gateOncePerCombat's `combatSummary &&` guard and freshRound's
      // `?? 1` fallback — the only summary shape that passes oncePerCombat
      // without a round number on it.
      loadCombatSummary.mockResolvedValue(null);
      seedStore({ actionSurgeUses: 2 });

      const result = await handle(
        makeAction({ oncePerCombat: true, firstRoundOnly: true, uses: 2 }), playerStats, campaignName,
      );

      expectSuccess(result);
      expectUsesSet('actionSurgeUses', 0);
    });
  });

  describe('uses limit (usesMax > 0)', () => {
    it('blocks when no uses remaining and writes nothing', async () => {
      seedStore({ actionSurgeUses: 0 });

      const result = await handle(makeAction({ uses: 2 }), playerStats, campaignName);

      expectBlocked(result, 'Action Surge has no uses remaining. Recharges on a Short Rest.');
    });

    it('uses custom recharge label from auto.recharge', async () => {
      seedStore({ actionSurgeUses: 0 });

      const result = await handle(makeAction({ uses: 2, recharge: 'Long Rest' }), playerStats, campaignName);

      expect(result.payload.description).toBe(
        'Action Surge has no uses remaining. Recharges on a Long Rest.',
      );
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('decrements uses when uses remain', async () => {
      seedStore({ actionSurgeUses: 2 });

      const result = await handle(makeAction({ uses: 2 }), playerStats, campaignName);

      expectSuccess(result);
      expectUsesSet('actionSurgeUses', 1);
    });

    it('threads custom resourceKey from automation', async () => {
      seedStore({ customUses: 3 });

      const result = await handle(makeAction({ uses: 3, resourceKey: 'customUses' }), playerStats, campaignName);

      expectSuccess(result);
      expectUsesSet('customUses', 2);
    });

    it('defaults uses to 1 and resourceKey to actionSurgeUses when missing', async () => {
      seedStore({ actionSurgeUses: 1 });

      const result = await handle(makeAction({}), playerStats, campaignName);

      expectSuccess(result);
      expectUsesSet('actionSurgeUses', 0);
    });
  });

  describe('gate precedence', () => {
    it('oncePerCombat passes round 1, then oncePerTurn refuses a latched second use', async () => {
      // Message precedence: with both flags set, a latched turn must report
      // the turn refusal, not the combat one. Discriminating round seeds
      // (null / == / stale) live in the cla004 once-per-turn lane.
      seedStore({ actionSurgeUses: 1, actionSurgeUsedThisRound: 1 });

      const result = await handle(
        makeAction({ oncePerCombat: true, oncePerTurn: true, uses: 1 }), playerStats, campaignName,
      );

      expectBlocked(result, 'Action Surge can only be used once per turn.');
    });

    it('oncePerCombat refuses before firstRoundOnly on a shared late round', async () => {
      loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
      seedStore({ actionSurgeUses: 1 });

      const result = await handle(
        makeAction({ oncePerCombat: true, firstRoundOnly: true, uses: 1 }), playerStats, campaignName,
      );

      expectBlocked(result, 'Action Surge can only be used once per combat.');
    });

    it('firstRoundOnly refuses before the uses check (zero-uses seed proves precedence)', async () => {
      // Upstream-of-turn refusal: ordering pin mirrored by cla004's
      // 'refuses at 0 uses before the turn gate'. With uses seeded to 0 the
      // message proves firstRoundOnly is evaluated first.
      loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });
      seedStore({ actionSurgeUses: 0 });

      const result = await handle(
        makeAction({ firstRoundOnly: true, uses: 2 }), playerStats, campaignName,
      );

      expectBlocked(result, 'Action Surge can only be used in the first round of combat.');
    });
  });

  describe('success popup payload', () => {
    it('returns the full automationInfoPopup shape including automationType', async () => {
      const auto = { type: 'action_surge', uses: 1 };
      seedStore({ actionSurgeUses: 1 });

      const result = await handle(makeAction(auto), playerStats, campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: ACTION_NAME,
          automationType: 'action_surge',
          description: 'Instantly take another action',
          automation: auto,
        },
      });
    });
  });
});
