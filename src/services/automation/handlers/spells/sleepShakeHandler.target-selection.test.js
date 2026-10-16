/**
 * sleepShakeHandler.target-selection.test.js — #1958 (family quad #1957–#1959, seam map in sleepHandler.test.js header)
 *
 * Own lane: sleepShakeHandler.js handle(action, playerStats, campaignName, _mapName)
 * — the TARGET-SELECTION filter rules (which creatures land in payload.targets) +
 * the full-shape modal payload contract + range parsing (4-param; every call below passes 4 args).
 * Siblings: #1957 sleepShakeHandler.confirm.test.js owns handleConfirm (not imported here);
 * #1959 sleepShakeHandler.test.js (main) owns handle() press orchestration — the popup
 * branches ('returns popup when no combat context exists', 'returns popup when combat context
 * has no creatures', 'returns popup with no eligible targets when only caster exists') and the
 * map-wired branch ('target selection — with map': isWithinRange filtering, placedItems/players
 * position lookup, no-position skip). Every call below passes mapName null — the map-wired
 * branch is deliberately NOT pinned here.
 * DOUBLE-OWNERSHIP FLAG for the #1959 close (owner is HERE): #1959's 'prefers sleep targets
 * (incapacitated/unconscious) over eligible targets', 'falls back to eligible targets when no
 * sleep targets exist' and 'skips caster from eligible targets' restate this lane's filter-rule
 * pins — the exact-table target pins below already exclude TestCaster in every expect.
 *
 * FILTER RULES pinned at source (sleepShakeHandler.js:40-56, read 2026-10-16): two DISJOINT
 * condition sources feed one lowercase match on 'incapacitated'/'unconscious' —
 * - player creatures: server-first getRuntimeValue(name, 'activeConditions', campaignName),
 *   PLAIN STRINGS, || [] guard + Array.isArray guard (runtime-store branch);
 * - monster/other creatures: combatSummary creatures[].conditions[].key OBJECTS (no runtime read).
 * Sleep targets win when non-empty; otherwise payload falls back to the FULL eligible list
 * (every non-caster in context, asleep or not — shaking is only ever an action spent, never
 * a save; AUTO-SUCCESS mechanics are #1957's lane).
 *
 * HONEST QUIRK (pinned, do not "fix" silently): plain-string monster conditions NEVER match —
 * the monster branch reads cond.key, so String(undefined).toLowerCase() is 'undefined' and an
 * asleep-looking monster with conditions:['incapacitated'] falls through to the fallback list.
 *
 * LANE LIVENESS (verified honestly 2026-10-16): PENDING-WIRING, whole handle() contract.
 * - Registered: index.js imports handle ONLY (:227; 'sleep_shake' dispatch key :533), but
 *   ZERO producers exist — grep across public/ data and src/components finds no automation
 *   of type sleep_shake, so handle() has no production caller today.
 * - And its modalName 'sleepShake' is NOT in useCharActionsAutomation.js modalMap (:281+)
 *   → even a wired producer's modal result would be silently dropped.
 * - Manifest SP-107 gap: "shake-awake UI-unreachable (sleep_shake zero producers §70)";
 *   SaveAttackAoeModal.jsx:740: "Shaking awake within 5 ft stays GM-enforced (§7 sleep_shake residual)."
 * Kept as contract-preservation (grease #1922 precedent) so the selection contract is executable
 * the moment a producer AND a modal are wired.
 *
 * Notes: rangeValidation mock is import-graph isolation only — handle() calls neither
 * rangeToFeet nor getDistanceFeet (handler uses isWithinRange, map-wired branch = #1959).
 * makeAction MERGES automation overrides (never replaces) — fixture convention, pinned by the
 * payload.automation passthrough. No timers / no writes on this path: handle() is pure
 * selection — the setRuntimeValue no-side-effect guard below keeps writes in #1957's lane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}, name = 'Shake Asleep') {
  return {
    name,
    automation: {
      type: 'sleep_shake',
      range: '5 ft',
      ...automation,
    },
  };
}

const caster = { name: 'TestCaster', gridX: 5, gridY: 10 };

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    caster,
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

// caster + awake monster + one player creature (runtime-store branch under test)
function ctxWithAlly(allyType = 'player') {
  return {
    creatures: [
      { name: 'AllyPlayer', type: allyType },
      { name: 'Orc', type: 'monster' },
      caster,
    ],
    players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
    placedItems: [],
  };
}

const cast = (action = makeAction(), playerStats = makePlayerStats()) =>
  handle(action, playerStats, campaignName, null);

describe('sleepShakeHandler - target selection filter rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player creatures — runtime store source (plain strings)', () => {
    it('selects player creatures whose runtime activeConditions include incapacitated', async () => {
      getCombatContext.mockResolvedValue(ctxWithAlly());
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['incapacitated', 'poisoned']);

      const result = await cast();

      expect(result.payload.targets).toEqual(['AllyPlayer']);
      // server-first key pin: only the player creature is read, under the exact runtime key
      expect(getRuntimeValue).toHaveBeenCalledTimes(1);
      expect(getRuntimeValue).toHaveBeenCalledWith('AllyPlayer', 'activeConditions', campaignName);
    });

    it('selects player creatures whose runtime activeConditions include unconscious', async () => {
      getCombatContext.mockResolvedValue(ctxWithAlly());
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['unconscious', 'frightened']);

      const result = await cast();

      expect(result.payload.targets).toEqual(['AllyPlayer']);
    });

    it('fallback keeps awake players selectable when no sleep targets exist anywhere', async () => {
      // filter miss (awake player + awake monster) → sleepTargets empty → FULL eligible list,
      // players included (fallback semantics are this lane's; popup branches are #1959's)
      getCombatContext.mockResolvedValue(ctxWithAlly());
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(['frightened', 'poisoned']);

      const result = await cast();

      expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
    });

    it('guards null activeConditions from the runtime store', async () => {
      // || [] + Array.isArray guards: null conditions must not throw; caster is never a target
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'AllyPlayer', type: 'player' }, caster],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
        placedItems: [],
      });
      resolveMapPositions.mockResolvedValue(null);
      getRuntimeValue.mockReturnValue(null);

      const result = await cast();

      expect(result.payload.targets).toEqual(['AllyPlayer']);
    });
  });

  describe('monster creatures — combatSummary conditions[].key source (no runtime read)', () => {
    it('selects monsters with incapacitated condition from conditions array', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'incapacitated' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          caster,
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      resolveMapPositions.mockResolvedValue(null);

      const result = await cast();

      expect(result.payload.targets).toEqual(['Goblin']);
      expect(getRuntimeValue).not.toHaveBeenCalled(); // monsters never touch the runtime store
    });

    it('selects monsters with unconscious condition from conditions array', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'unconscious' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'frightened' }] },
          caster,
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      resolveMapPositions.mockResolvedValue(null);

      const result = await cast();

      expect(result.payload.targets).toEqual(['Goblin']);
    });

    it('matches conditions case-insensitively for monsters', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: [{ key: 'INCAPACITATED' }] },
          { name: 'Orc', type: 'monster', conditions: [{ key: 'Unconscious' }] },
          caster,
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      resolveMapPositions.mockResolvedValue(null);

      const result = await cast();

      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
    });

    it('quirk: plain-string monster conditions NEVER match (code expects cond.key) — full fallback', async () => {
      // cond.key is undefined → String(undefined).toLowerCase() === 'undefined' → no match;
      // BOTH monsters drop out of sleepTargets and reappear only via the eligible fallback.
      // Pinned as-is; do not "fix" silently.
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', conditions: ['incapacitated'] },
          { name: 'Orc', type: 'monster', conditions: ['frightened'] },
          caster,
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      resolveMapPositions.mockResolvedValue(null);

      const result = await cast();

      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
    });
  });

  describe('modal payload contract (full shape — pending-wiring pins)', () => {
    it('returns the exact full modal result: type, modalName, and complete payload shape', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      const result = await cast();

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('sleepShake');
      expect(result.payload).toEqual({
        attackerName: 'TestCaster',
        campaignName,
        targets: ['Goblin', 'Orc'],
        rangeFeet: 5,
        featureName: 'Shake Asleep',
        automation: { type: 'sleep_shake', range: '5 ft' },
      });
      // pure-selection guard: writes belong to #1957's handleConfirm lane
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('featureName is action.name passthrough with "Shake Asleep" default', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      const custom = await cast(makeAction({}, 'Custom Shake'));
      expect(custom.payload.featureName).toBe('Custom Shake');

      const nameless = makeAction();
      delete nameless.name;
      const fallback = await cast(nameless);
      expect(fallback.payload.featureName).toBe('Shake Asleep');
    });

    it('rangeFeet parses the automation range string, merges keep other keys, missing range defaults to 5', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      resolveMapPositions.mockResolvedValue(null);

      // '10 ft' → 10, and payload.automation is the MERGED object passed through verbatim
      const parsed = await cast(makeAction({ range: '10 ft' }));
      expect(parsed.payload.rangeFeet).toBe(10);
      expect(parsed.payload.automation).toEqual({ type: 'sleep_shake', range: '10 ft' });

      // absent range → ternary default 5
      const noRange = makeAction();
      delete noRange.automation.range;
      const defaulted = await cast(noRange);
      expect(defaulted.payload.rangeFeet).toBe(5);
    });
  });
});
