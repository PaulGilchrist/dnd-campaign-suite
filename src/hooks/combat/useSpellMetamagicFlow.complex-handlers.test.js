// @maintained-by-ai: 2026-10-15
// Complex-handler dispatch/gate seam for useSpellMetamagicFlow.
// Owns: the dispatch registry that routes gated spells into their dedicated lanes
// (two-stage Enhance Ability, custom Protection from Poison / Stone Skin) and the
// unarmed-lane no-op guard those confirms share. Spell routing tables live in the
// twins: per-spell execute payloads → complex-handlers.spells, charm/heal routing →
// complex-handlers.charm-heal. Skip lanes → skip.test.js / special-paths.rollback,
// stage machines → gate-two-stage.test.js / useTwoStageHandlers.enhanceAbility,
// poison slot semantics → useCustomHandlers.protectionFromPoison, popup payloads →
// confirm-payloads.test.js. Stone Skin fields are disk-derived from
// public/data/2024/spells.json (lv4, Action, Touch — the old lv3 fixture was stale).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { applyStoneSkinHandler } from '../../services/automation/index.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';

// ─── Mocks (only what the dispatch/gate lanes actually touch) ─────────────────

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// useConfirmableFlow.fireConfirmLaneRider imports both riders on every confirm —
// stub them so the riders seam stays out of this dispatch lane's assertions.
vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve({ type: 'humanoid' })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A' },
      { name: 'Goblin B' },
      { name: 'Goblin C' },
    ],
  })),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  applyEnhanceAbilityEffect: vi.fn(() => Promise.resolve(null)),
  applyProtectionFromPoisonHandler: vi.fn(() => Promise.resolve(null)),
  applyStoneSkinHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 3),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../useAllySelection.js', () => ({
  getAllyList: vi.fn((casterName) => [casterName.toLowerCase()]),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ creatures: [] }),
  text: () => Promise.resolve(''),
}));

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const CAMPAIGN = 'TestCampaign';

const SPELL_ROWS = Object.fromEntries(
  JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8')).map((s) => [s.name, s])
);

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    ...overrides,
  };
}

// Render the flow and gate the spell so its lane pending arms.
async function renderGated(spell, { onExecute = vi.fn(), playerStats = makePlayerStats() } = {}) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({ playerStats, campaignName: CAMPAIGN, onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml: vi.fn() })
  );
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
  return { result, onExecute, spell };
}

// ─── Dispatch registry: each complex spell arms its own lane ──────────────────

const DISPATCH_ROWS = [
  // two-stage lane (useTwoStageHandlers): stage machine opens at 'ability';
  // gate includes the caster among target candidates
  { spell: 'Enhance Ability', pending: 'pendingEnhanceAbility', handler: 'handleEnhanceAbilityConfirm', stage: 'enhanceAbilityStage', stageValue: 'ability', arg: { targetName: 'Goblin A' }, targets: ['TestSorcerer', 'Goblin A', 'Goblin B', 'Goblin C'] },
  // custom lane (useCustomHandlers): confirm takes the target array directly;
  // gate includes the caster among target candidates
  { spell: 'Protection from Poison', pending: 'pendingProtectionFromPoison', handler: 'handleProtectionFromPoisonConfirm', arg: ['Goblin A'], targets: ['TestSorcerer', 'Goblin A', 'Goblin B', 'Goblin C'] },
  // custom consume lane (useCustomHandlers): confirm takes a string target;
  // gate arms willing creatures only (no caster)
  { spell: 'Stone Skin', pending: 'pendingStoneSkin', handler: 'handleStoneSkinConfirm', arg: 'Goblin A', targets: ['Goblin A', 'Goblin B', 'Goblin C'] },
];

describe('useSpellMetamagicFlow — complex lane dispatch registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const row of DISPATCH_ROWS) {
    const spell = SPELL_ROWS[row.spell];

    it(`${row.spell}: gateMetamagic routes to ${row.pending} armed with combat targets`, async () => {
      const { result } = await renderGated(spell);

      expect(result.current[row.pending]).not.toBeNull();
      if (row.stage) {
        expect(result.current[row.stage]).toBe(row.stageValue);
      }
      expect(result.current[row.pending].creatureTargets).toEqual(row.targets);
    });

    it(`${row.spell}: confirm on an unarmed lane is a silent no-op`, async () => {
      const { result, onExecute } = await renderGated(SPELL_ROWS['Fireball']);

      await act(async () => {
        await result.current[row.handler](row.arg);
      });

      expect(addEntry).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();
    });
  }
});

// ─── Stone Skin confirm: the consume → apply → log → clear lifecycle seam ─────
// Unique to this file — no sibling pins the diamond-dust consumption or the
// protection_from_energy automation payload (skip rollback lives in
// special-paths.rollback, popup payload in confirm-payloads).

describe('useSpellMetamagicFlow — Stone Skin consume lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes the diamond dust, applies the protection automation, logs the cast, clears pending', async () => {
    const spell = SPELL_ROWS['Stone Skin'];
    const { result } = await renderGated(spell);

    await act(async () => {
      await result.current.handleStoneSkinConfirm('Goblin A');
    });

    expect(consumeMaterial).toHaveBeenCalledWith(expect.any(Object), 'Diamond Dust (100 gp)', CAMPAIGN);

    expect(applyStoneSkinHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Stone Skin',
        automation: expect.objectContaining({
          type: 'protection_from_energy',
          damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
        }),
      }),
      expect.any(Object),
      CAMPAIGN,
      'Goblin A',
    );

    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A'],
      spellName: 'Stone Skin',
      spellLevel: spell.level,
      castingTime: spell.casting_time,
      timestamp: expect.any(Number),
    });

    expect(result.current.pendingStoneSkin).toBeNull();
  });
});
