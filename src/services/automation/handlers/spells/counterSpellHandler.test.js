import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── QUAD seam map — counterSpellHandler.js ─────────────────────────────
// Subject is LIVE: automation/index.js imports `handle` (l.201) and registers
// it as `reaction_counterspell` in the dispatch table (l.525). Reaction
// CAST-1, CON save vs the attacker.
//
// THIS FILE (#1896) — MAIN lane: handle() up to (but NOT including)
// handleSaveResult.
//   • validation gates (5): no combat context / no lastAttack / no spell
//     detected / no attacker / attacker not in combat — exact refusal popup
//     envelopes, and every gate returns before ANY side effect (no build
//     SaveDc, no prompt, no ledger write, no log, no listener)
//   • spell detection: all four truthy branches of looksLikeSpellAttack
//     (damageFormula, attackName, saveType, rollType 'spell-save'), each
//     ISOLATED by nulling the higher-priority branches, plus spell-name
//     resolution ('unknown spell' when unnamed)
//   • spell-level honesty pin: the source performs NO spell-level
//     comparison anywhere in this chain — there is no auto-counter/auto-fail
//     path for equal/lower-level spells (2024 or 5e); handle() ALWAYS arms
//     the CON save prompt, saveType hardcoded 'CON' regardless of
//     auto.saveType. Pinned as-is.
//   • save prompt creation content: createSaveListener exact args,
//     buildSaveDc(auto, playerStats) inputs, metamagicHeighten disadvantage,
//     the initial ability_use trigger log (full string), exactly one
//     'save-result' listener armed per accepted trigger
//   • popup envelope: full strict-table payload pins, feature-name
//     override/default
// Owned elsewhere — not re-pinned here: handleSaveResult reactions,
// rollback args, broadcast payload and promptId guard (#1893); addEntry
// rejections, service-failure propagation, and the FLAGGED rollback-rejection
// listener leak — current contract reviewed from this lane 2026-10-16,
// stays pinned there, remains unfixed (#1894); Spell Breaker refund economy
// and the CLA-322 reaction-spent latch refuse/stamp/re-arm lifecycle,
// incl. the fresh-round latch stamp (#1895). No game timers — this lane
// never FIRES the captured listener; listeners are de-armed in afterEach.
// ─────────────────────────────────────────────────────────────────────────

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
  rollbackSpellEffects: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './counterSpellHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const PROMPT_ID = 'main-prompt';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Counterspell',
    // nested automation overrides MERGE; callers keep untouched fields
    automation: {
      type: 'counterspell',
      saveType: 'CON',
      ...automation,
    },
  };
}

function makeCombatContext(overrides = {}) {
  return {
    round: 1,
    creatures: [
      { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
      { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    players: [
      { name: 'TestCaster', gridX: 5, gridY: 10 },
    ],
    placedItems: [],
    ...overrides,
  };
}

function makeLastAttack(overrides = {}) {
  const { attackEvent: attackEventOverrides = {}, ...rest } = overrides;
  return {
    attackEvent: {
      attackerName: 'Goblin',
      targetName: 'TestCaster',
      damageFormula: '3d6',
      damageName: 'Fire Bolt',
      attackName: 'Fire Bolt',
      saveType: null,
      primaryDamage: 9,
      secondaryDamage: 0,
      affectedTargets: ['TestCaster'],
      statusEffects: null,
      // attackEvent overrides MERGE (caller keeps untouched identity fields)
      ...attackEventOverrides,
    },
    attackerName: 'Goblin',
    targetName: 'TestCaster',
    primaryDamage: 9,
    secondaryDamage: 0,
    totalDamage: 9,
    damageTypes: ['Fire'],
    ...rest,
  };
}

// Capture every 'save-result' registration this lane makes and de-arm it in
// afterEach — the main lane arms the prompt but never resolves it (save
// results are #1893's lane), so leaked listeners can't fire into later tests.
let addEventListenerSpy;

function armedListeners() {
  return addEventListenerSpy.mock.calls.filter(call => call[0] === 'save-result');
}

// ── Tests ──────────────────────────────────────────────────────

describe('counterSpellHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm happy-path defaults every test (clearAllMocks drains them).
    // getRuntimeValue stays a bare vi.fn() → undefined → latch reads as
    // round 0, so the fresh trigger (round 1) is never refused.
    getCombatContext.mockResolvedValue(makeCombatContext());
    findLastAttack.mockResolvedValue(makeLastAttack());
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({ promptId: PROMPT_ID });
    rollbackSpellEffects.mockResolvedValue({ logDescription: '' });
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    armedListeners().forEach(([, cb]) => window.removeEventListener('save-result', cb));
    addEventListenerSpy.mockRestore();
  });

  describe('validation gates', () => {
    it.each([
      [
        'no combat context',
        () => getCombatContext.mockResolvedValue(null),
        'Counterspell requires an active combat. Select a creature in combat and try again.',
      ],
      [
        'no recent attack',
        () => findLastAttack.mockResolvedValue({ attackEvent: null }),
        'Counterspell — No recent attack to counter.',
      ],
      [
        'no spell detected (all four spell indicators neutral)',
        () => findLastAttack.mockResolvedValue(makeLastAttack({
          attackEvent: { damageFormula: null, attackName: null, saveType: null },
        })),
        'Counterspell — No spell detected in the most recent attack.',
      ],
      [
        'no attacker identified',
        () => findLastAttack.mockResolvedValue(makeLastAttack({
          attackEvent: { attackerName: null },
        })),
        'Counterspell — Could not identify the spellcaster.',
      ],
      [
        'attacker not in combat',
        () => findLastAttack.mockResolvedValue(makeLastAttack({
          attackEvent: { attackerName: 'Wizard' },
        })),
        'Counterspell — Wizard is not in combat.',
      ],
    ])('%s — exact refusal popup, zero side effects', async (_label, stub, description) => {
      stub();
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, null);

      // infoPopup envelope, strict
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Counterspell',
          description,
          automation: action.automation,
        },
      });

      // Every gate returns before DC resolution, prompt, ledger, logs,
      // listener arming, and rollback
      expect(buildSaveDc).not.toHaveBeenCalled();
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(armedListeners()).toHaveLength(0);
      expect(rollbackSpellEffects).not.toHaveBeenCalled();
    });
  });

  describe('spell detection (looksLikeSpellAttack branches, isolated)', () => {
    it.each([
      ['damageFormula (canonical lastAttack)', {}, 'Fire Bolt'],
      ['attackName alone', { damageFormula: null }, 'Fire Bolt'],
      ['saveType alone', { damageFormula: null, attackName: null, saveType: 'CON' }, 'unknown spell'],
      ['rollType spell-save alone', { damageFormula: null, attackName: null, rollType: 'spell-save' }, 'unknown spell'],
      ['named spell save-roll', { damageFormula: null, saveType: null, attackName: 'Ray of Frost', rollType: 'spell-save' }, 'Ray of Frost'],
    ])('detects via %s — spell resolves to \'%s\' full-string popup', async (_label, attackEvent, spellName) => {
      findLastAttack.mockResolvedValue(makeLastAttack({ attackEvent }));
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Counterspell',
          targetName: 'Goblin',
          description: `Goblin's '${spellName}' is being countered — Goblin must make a CON saving throw (DC 15).`,
          automation: action.automation,
        },
      });
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(armedListeners()).toHaveLength(1);
    });
  });

  describe('spell-level honesty (no auto-counter path exists)', () => {
    // Source check: handle() never compares spell levels — there is no
    // auto-counter for lower-level spells and no auto-fail shortcut. It
    // ALWAYS prompts; saveType is hardcoded CON on the prompt. Pinned as-is.
    it.each([
      ['no spell metadata on the action (cantrip target)', {}],
      ['level-9 upcast target', { spell: { level: 9, isUpcast: true, upcastLevel: 9 } }],
      ['automation declares a DEX save', { automation: { type: 'counterspell', saveType: 'DEX' } }],
    ])('still arms the CON save prompt when %s', async (_label, patch) => {
      const action = { ...makeAction(), ...patch };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toBe(
        "Goblin's 'Fire Bolt' is being countered — Goblin must make a CON saving throw (DC 15).");
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        disadvantage: false,
      });
    });
  });

  describe('save prompt creation', () => {
    it('arms a CON save prompt on the attacker via buildSaveDc(auto, playerStats)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      await handle(action, ps, campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledTimes(1);
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        disadvantage: false,
      });
    });

    it('arms with disadvantage when metaCtx.metamagicHeighten is set', async () => {
      const action = { ...makeAction(), metaCtx: { metamagicHeighten: true } };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        disadvantage: true,
      });
    });

    it('logs the ability_use trigger with full composition and promptId', async () => {
      const action = makeAction();

      await handle(action, makePlayerStats(), campaignName, null);

      // Initial trigger log is the only log this lane writes
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Counterspell',
        description: "Counterspell triggered — Countering Goblin's 'Fire Bolt'. Goblin must make CON save (DC 15)",
        promptId: PROMPT_ID,
      });
    });

    it('arms exactly one save-result listener per accepted trigger', async () => {
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(armedListeners()).toHaveLength(1);
      expect(typeof armedListeners()[0][1]).toBe('function');
    });
  });

  describe('popup envelope', () => {
    it('returns the exact automation_info popup on an accepted trigger', async () => {
      const action = makeAction();

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Counterspell',
          targetName: 'Goblin',
          description: "Goblin's 'Fire Bolt' is being countered — Goblin must make a CON saving throw (DC 15).",
          automation: action.automation,
        },
      });
    });

    it('uses action.name as the feature name when provided', async () => {
      const action = { ...makeAction(), name: 'Heightened Counterspell' };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Heightened Counterspell');
      // Feature name flows into the trigger log too
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Heightened Counterspell',
        description: "Heightened Counterspell triggered — Countering Goblin's 'Fire Bolt'. Goblin must make CON save (DC 15)",
        promptId: PROMPT_ID,
      });
    });

    it('falls back to default name \'Counterspell\' when action.name is falsy', async () => {
      const action = { ...makeAction(), name: null };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.name).toBe('Counterspell');
    });
  });
});
