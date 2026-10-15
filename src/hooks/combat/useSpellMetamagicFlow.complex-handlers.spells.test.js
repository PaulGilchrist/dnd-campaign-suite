// @maintained-by-ai: 2026-10-15
// Complex-spell routing table for the sheet-confirm metamagic flow.
// Owns: per-spell execute payloads for the area lane (Globe / Antimagic Field),
// the save-DC lane (Stinking Cloud / Confusion), the single-target heal transport
// (Cure Wounds lv1 payload pin — cited by complex-handlers.charm-heal), the
// trigger/apply payload shape for Hold Monster / Polymorph / True Polymorph
// (SP-124) and the Animal Shapes target-selection popup routing.
// Not owned here (covered by siblings): skip clearing (skip.test.js), popup-html
// payloads (confirm-payloads.test.js), simple-lane no-pending guards
// (handler-guards.test.js), upcast slot stamps (cla086-upcast-slot.test.js),
// two-stage path storage (multi-stage.test.js), animal-shapes beast stage
// (special-paths.animal-polymorph.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { executeHandler } from '../../services/automation/index.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { getAllyList } from '../useAllySelection.js';

// ─── Mocks (only what the tested lanes actually touch) ────────────────────────

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
  logMetamagicUse: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve()),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve()),
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
  executeHandler: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/charmPersonService.js', () => ({
  triggerCharmPerson: vi.fn(),
}));

vi.mock('../../services/rules/features/charmMonsterService.js', () => ({
  triggerCharmMonster: vi.fn(),
}));

vi.mock('../../services/rules/features/banishmentService.js', () => ({
  triggerBanishment: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/faerieFireService.js', () => ({
  triggerFaerieFire: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/healService.js', () => ({
  triggerHeal: vi.fn(),
}));

vi.mock('../../services/rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/revivifyService.js', () => ({
  triggerRevivify: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/regenerateService.js', () => ({
  confirmRegenerate: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
  applyPolymorph: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/spells/animalShapesService.js', () => ({
  applyAnimalShapes: vi.fn(() => Promise.resolve({ ok: false })),
}));

vi.mock('../../services/automation/handlers/spells/truePolymorphService.js', () => ({
  applyTruePolymorph: vi.fn(() => Promise.resolve(null)),
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

global.fetch = vi.fn((url) => {
  if (url && url.includes('combat-summary')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ creatures: [] }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn(),
  writable: true,
});

// ─── Fixtures (spell rows read straight from public/data/spells.json) ─────────

const CAMPAIGN = 'TestCampaign';

const SPELL_ROWS = Object.fromEntries(
  JSON.parse(readFileSync('public/data/spells.json', 'utf8')).map((s) => [s.name, s])
);

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

// Render the flow and gate the disk spell row so its sheet-confirm pending arms.
async function renderGated(spell, { onExecute = vi.fn(), setPopupHtml = vi.fn(), playerStats = makePlayerStats() } = {}) {
  const { result } = renderHook(() =>
    useSpellMetamagicFlow({ playerStats, campaignName: CAMPAIGN, onExecute, setSecondaryTargetModal: null, characters: [], setPopupHtml })
  );
  await act(async () => {
    await result.current.gateMetamagic(spell);
  });
  return { result, onExecute, setPopupHtml, playerStats, spell };
}

// ─── Area lane: manual cast log + executeHandler payload ──────────────────────
// Globe / Antimagic Field confirm (useAreaEffectHandlers): the handler logs the
// cast itself (no createConfirmHandler wrapper) and stamps automation.range from
// the gated spell row.

const AREA_LOGGED_ROWS = [
  { spell: 'Globe of Invulnerability', pending: 'pendingGlobe', handler: 'handleGlobeConfirm', automationType: 'globe_of_invulnerability' },
  { spell: 'Antimagic Field', pending: 'pendingAntimagicField', handler: 'handleAntimagicFieldConfirm', automationType: 'antimagic_field' },
];

describe('useSpellMetamagicFlow — area confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const row of AREA_LOGGED_ROWS) {
    it(`${row.spell}: logs the cast and executes the automation payload`, async () => {
      const spell = SPELL_ROWS[row.spell];
      const { result } = await renderGated(spell);
      expect(result.current[row.pending]).not.toBeNull();

      await act(async () => {
        await result.current[row.handler](['Goblin A', 'Goblin B']);
      });

      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'spell',
        characterName: 'TestSorcerer',
        targetName: 'Goblin A',
        targets: ['Goblin A', 'Goblin B'],
        spellName: row.spell,
        spellLevel: spell.level,
        castingTime: spell.casting_time,
        timestamp: expect.any(Number),
      });

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: { type: row.automationType, range: spell.range },
          metaCtx: { creatures: ['Goblin A', 'Goblin B'] },
        }),
        expect.any(Object),
        CAMPAIGN,
        null,
      );

      expect(result.current[row.pending]).toBeNull();
    });

    it(`${row.spell}: confirm without pending is a no-op`, async () => {
      const { result } = await renderGated(SPELL_ROWS['Fireball']);

      await act(async () => {
        await result.current[row.handler](['Goblin A']);
      });

      expect(addEntry).not.toHaveBeenCalled();
      expect(executeHandler).not.toHaveBeenCalled();
    });
  }

  it('area confirm with zero targets logs a null-target entry', async () => {
    const { result } = await renderGated(SPELL_ROWS['Globe of Invulnerability']);

    await act(async () => {
      await result.current.handleGlobeConfirm([]);
    });

    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      targetName: null,
      targets: [],
    }));
  });
});

// ─── Save-DC lane: createConfirmHandler pays the slot, runner builds the
// area action at the caster's save DC (useSimpleSpellHandlers.areaExecute).

const SAVE_DC_ROWS = [
  { spell: 'Stinking Cloud', pending: 'pendingStinkingCloud', handler: 'handleStinkingCloudConfirm', automationType: 'stinking_cloud', saveType: 'CON' },
  { spell: 'Confusion', pending: 'pendingConfusion', handler: 'handleConfusionConfirm', automationType: 'confusion', saveType: 'WIS' },
];

describe('useSpellMetamagicFlow — save-DC confirm lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const row of SAVE_DC_ROWS) {
    it(`${row.spell}: pays the slot and executes with saveDc 8+prof / ${row.saveType}`, async () => {
      const spell = SPELL_ROWS[row.spell];
      const stats = makePlayerStats();
      const { result } = await renderGated(spell, { playerStats: stats });
      expect(result.current[row.pending]).not.toBeNull();

      await act(async () => {
        await result.current[row.handler](['Goblin A', 'Goblin B']);
      });

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          automation: {
            type: row.automationType,
            saveDc: 8 + stats.proficiency,
            saveType: row.saveType,
          },
          metaCtx: expect.objectContaining({ targets: ['Goblin A', 'Goblin B'] }),
        }),
        expect.any(Object),
        CAMPAIGN,
        null,
      );
      expect(prepareSpellCast).toHaveBeenCalled();
      expect(result.current[row.pending]).toBeNull();
    });
  }
});

// ─── Cure Wounds: single-target heal transport to onExecute.
// Pins the lv1 slotLevel payload (cited by complex-handlers.charm-heal);
// the lv3 upcast stamp is owned by cla086-upcast-slot.test.js.

describe('useSpellMetamagicFlow — Cure Wounds confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onExecute with the pending spell and the paid lv1 slot', async () => {
    const { result, onExecute, spell } = await renderGated(SPELL_ROWS['Cure Wounds']);

    await act(async () => {
      await result.current.handleCureWoundsConfirm({ targetName: 'Ally One' });
    });

    expect(onExecute).toHaveBeenCalledWith(spell, { targetName: 'Ally One', slotLevel: 1 });
    expect(result.current.pendingCureWounds).toBeNull();
  });

  it('does not call onExecute when targetName is missing', async () => {
    const { result, onExecute } = await renderGated(SPELL_ROWS['Cure Wounds']);

    await act(async () => {
      await result.current.handleCureWoundsConfirm({});
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});

// ─── Hold Monster: trigger payload + single-target normalization ──────────────

describe('useSpellMetamagicFlow — Hold Monster confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('threads array targets to triggerHoldMonster and clears pending', async () => {
    const { triggerHoldMonster } = await import('../../services/rules/features/holdMonsterService.js');
    const { result } = await renderGated(SPELL_ROWS['Hold Monster']);

    await act(async () => {
      await result.current.handleHoldMonsterConfirm(['Goblin A', 'Goblin B']);
    });

    expect(triggerHoldMonster).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hold Monster' }),
      { holdMonsterTargets: ['Goblin A', 'Goblin B'] },
      expect.any(Object),
      CAMPAIGN,
      null,
    );
    expect(result.current.pendingHoldMonster).toBeNull();
  });

  it('normalizes a single string target to an array', async () => {
    const { triggerHoldMonster } = await import('../../services/rules/features/holdMonsterService.js');
    const { result } = await renderGated(SPELL_ROWS['Hold Monster']);

    await act(async () => {
      await result.current.handleHoldMonsterConfirm('Goblin A');
    });

    expect(triggerHoldMonster).toHaveBeenCalledWith(
      expect.any(Object),
      { holdMonsterTargets: ['Goblin A'] },
      expect.any(Object),
      CAMPAIGN,
      null,
    );
  });
});

// ─── Polymorph: apply payload + empty-target guard ────────────────────────────

describe('useSpellMetamagicFlow — Polymorph confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies polymorph with the first target and clears pending', async () => {
    const { applyPolymorph } = await import('../../services/automation/handlers/spells/polymorphService.js');
    const { result } = await renderGated(SPELL_ROWS['Polymorph']);

    await act(async () => {
      await result.current.handlePolymorphConfirm(['Goblin A']);
    });

    expect(applyPolymorph).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Polymorph' }),
      { polymorphTarget: 'Goblin A', characters: [] },
      expect.any(Object),
      CAMPAIGN,
      null,
    );
    expect(result.current.pendingPolymorph).toBeNull();
  });

  it('does nothing when the target list is empty', async () => {
    const { applyPolymorph } = await import('../../services/automation/handlers/spells/polymorphService.js');
    const { result } = await renderGated(SPELL_ROWS['Polymorph']);

    await act(async () => {
      await result.current.handlePolymorphConfirm([]);
    });

    expect(applyPolymorph).not.toHaveBeenCalled();
  });
});

// ─── True Polymorph: two-stage chooser lanes (SP-124) ─────────────────────────
// Path storage and skip are owned by multi-stage.test.js; popup payloads by
// confirm-payloads.test.js. This lane pins transport + slot payment timing.

describe('useSpellMetamagicFlow — True Polymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SP-124: target confirm injects the pending spell (not the names array) and pays the lv9 slot', async () => {
    const { applyTruePolymorph } = await import('../../services/automation/handlers/spells/truePolymorphService.js');
    const spell = SPELL_ROWS['True Polymorph'];
    const { result } = await renderGated(spell);

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });
    await act(async () => {
      await result.current.handleTruePolymorphTargetConfirm(['Goblin A']);
    });

    // Regression: the modal emits onConfirm(names) — the wrapper must inject pending
    // so applyTruePolymorph gets the real spell object, not undefined (the old crash).
    expect(applyTruePolymorph.mock.calls[0][0]).toBe(spell);
    expect(applyTruePolymorph).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        truePolymorphTarget: 'Goblin A',
        truePolymorphPath: 'creature_to_creature',
        slotLevel: 9,
      }),
      expect.any(Object),
      CAMPAIGN,
      null,
    );
    // DEFECT D: slot pays at confirm on this modal chain.
    expect(prepareSpellCast).toHaveBeenCalled();
    expect(result.current.pendingTruePolymorph).toBeNull();
  });

  it('SP-124: object_into_creature pays the slot at path-select and applies with a null target', async () => {
    const { applyTruePolymorph } = await import('../../services/automation/handlers/spells/truePolymorphService.js');
    const { result } = await renderGated(SPELL_ROWS['True Polymorph']);

    await act(async () => {
      await result.current.handleTruePolymorphPathSelect('object_into_creature');
    });

    expect(prepareSpellCast).toHaveBeenCalled();
    expect(applyTruePolymorph).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'True Polymorph' }),
      { truePolymorphTarget: null, truePolymorphPath: 'object_into_creature', characters: [] },
      expect.any(Object),
      CAMPAIGN,
      null,
    );
    expect(result.current.pendingTruePolymorph).toBeNull();
  });
});

// ─── Animal Shapes: target stage hands the chooser popup, then clears pending ──

describe('useSpellMetamagicFlow — Animal Shapes target confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the beast-selection popup for the selected allies with the lv8 gate CR', async () => {
    // Gate filters combatants by ally list — arm the picker with the goblins.
    getAllyList.mockReturnValueOnce(['Goblin A', 'Goblin B']);
    const setPopupHtml = vi.fn();
    const { result } = await renderGated(SPELL_ROWS['Animal Shapes'], { setPopupHtml });
    expect(result.current.pendingAnimalShapes).not.toBeNull();

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'animal_shapes_target_selection',
      targets: ['Goblin A'],
      casterName: 'TestSorcerer',
      campaignName: CAMPAIGN,
      spell: expect.any(Object),
      spellLevel: SPELL_ROWS['Animal Shapes'].level,
      maxCR: 4,
    });
    expect(result.current.pendingAnimalShapes).toBeNull();
  });
});
