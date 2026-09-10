// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { executeHandler } from '../../services/automation/index.js';

// ─── Mocks (only what the tested handlers actually use) ─────────────────────

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

// ─── Factories ────────────────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    casting_time: '1 Action',
    range: '150 ft.',
    ...overrides,
  };
}

function setupHook(onExecute, spellOverrides = {}) {
  const stats = makePlayerStats();
  const spell = makeSpell(spellOverrides);
  const { result } = renderHook(() =>
    useSpellMetamagicFlow(stats, 'TestCampaign', onExecute)
  );
  act(() => {
    result.current.gateMetamagic(spell);
  });
  return { result, onExecute, stats, spell };
}

// ─── Globe of Invulnerability ────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Globe of Invulnerability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs entry with correct payload and calls executeHandler on confirm', async () => {
    const { result } = setupHook(vi.fn(), { name: 'Globe of Invulnerability', level: 4 });

    await act(async () => {
      await result.current.handleGlobeConfirm(['Goblin A', 'Goblin B']);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A', 'Goblin B'],
      spellName: 'Globe of Invulnerability',
      spellLevel: 4,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: { type: 'globe_of_invulnerability', range: '150 ft.' },
        metaCtx: { creatures: ['Goblin A', 'Goblin B'] },
      }),
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingGlobe).toBeNull();
  });

  it('logs entry with null targetName and empty targets when no targets given', async () => {
    const { result } = setupHook(vi.fn(), { name: 'Globe of Invulnerability', level: 4 });

    await act(async () => {
      await result.current.handleGlobeConfirm([]);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      targetName: null,
      targets: [],
    }));
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Globe of Invulnerability', level: 4 });

    act(() => {
      result.current.handleGlobeSkip();
    });

    expect(result.current.pendingGlobe).toBeNull();
  });

  it('does nothing when confirming without pending state', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleGlobeConfirm(['Goblin A']);
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();
  });
});

// ─── Antimagic Field ─────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Antimagic Field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs entry with correct payload and calls executeHandler on confirm', async () => {
    const { result } = setupHook(vi.fn(), { name: 'Antimagic Field', level: 4 });

    await act(async () => {
      await result.current.handleAntimagicFieldConfirm(['Goblin A']);
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      targetName: 'Goblin A',
      targets: ['Goblin A'],
      spellName: 'Antimagic Field',
      spellLevel: 4,
      castingTime: '1 Action',
      timestamp: expect.any(Number),
    });

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: { type: 'antimagic_field', range: '150 ft.' },
        metaCtx: { creatures: ['Goblin A'] },
      }),
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingAntimagicField).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Antimagic Field', level: 4 });

    act(() => {
      result.current.handleAntimagicFieldSkip();
    });

    expect(result.current.pendingAntimagicField).toBeNull();
  });

  it('does nothing when confirming without pending state', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleAntimagicFieldConfirm(['Goblin A']);
    });

    expect(addEntry).not.toHaveBeenCalled();
    expect(executeHandler).not.toHaveBeenCalled();
  });
});

// ─── Stinking Cloud ──────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Stinking Cloud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executeHandler with correct action shape on confirm', async () => {
    const stats = makePlayerStats();
    const spell = makeSpell({ name: 'Stinking Cloud', level: 1 });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(stats, 'TestCampaign', vi.fn())
    );
    act(() => {
      result.current.gateMetamagic(spell);
    });

    await act(async () => {
      await result.current.handleStinkingCloudConfirm(['Goblin A', 'Goblin B']);
    });

    const expectedSaveDc = 8 + stats.proficiency;

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: {
          type: 'stinking_cloud',
          saveDc: expectedSaveDc,
          saveType: 'CON',
        },
        metaCtx: { targets: ['Goblin A', 'Goblin B'] },
      }),
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingStinkingCloud).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Stinking Cloud', level: 1 });

    act(() => {
      result.current.handleStinkingCloudSkip();
    });

    expect(result.current.pendingStinkingCloud).toBeNull();
  });
});

// ─── Confusion ───────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Confusion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executeHandler with correct action shape on confirm', async () => {
    const stats = makePlayerStats();
    const spell = makeSpell({ name: 'Confusion', level: 4 });
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(stats, 'TestCampaign', vi.fn())
    );
    act(() => {
      result.current.gateMetamagic(spell);
    });

    await act(async () => {
      await result.current.handleConfusionConfirm(['Goblin A']);
    });

    const expectedSaveDc = 8 + stats.proficiency;

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: {
          type: 'confusion',
          saveDc: expectedSaveDc,
          saveType: 'WIS',
        },
        metaCtx: { targets: ['Goblin A'] },
      }),
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingConfusion).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Confusion', level: 4 });

    act(() => {
      result.current.handleConfusionSkip();
    });

    expect(result.current.pendingConfusion).toBeNull();
  });
});

// ─── Cure Wounds ─────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Cure Wounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onExecute with spell and target context on confirm', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Cure Wounds', level: 1 });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    await act(async () => {
      await result.current.handleCureWoundsConfirm({ targetName: 'Ally One' });
    });

    expect(onExecute).toHaveBeenCalledWith(spell, { targetName: 'Ally One', slotLevel: 1 });
    expect(result.current.pendingCureWounds).toBeNull();
  });

  it('does not call onExecute when targetName is missing', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Cure Wounds', level: 1 });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    await act(async () => {
      await result.current.handleCureWoundsConfirm({});
    });

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('does nothing when confirming without pending state', async () => {
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    await act(async () => {
      await result.current.handleCureWoundsConfirm({ targetName: 'Ally One' });
    });

    expect(onExecute).not.toHaveBeenCalled();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Cure Wounds', level: 1 });

    act(() => {
      result.current.handleCureWoundsSkip();
    });

    expect(result.current.pendingCureWounds).toBeNull();
  });
});

// ─── Hold Monster ────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Hold Monster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls triggerHoldMonster with holdMonsterTargets on confirm', async () => {
    const { triggerHoldMonster } = await import('../../services/rules/features/holdMonsterService.js');
    const { result } = setupHook(vi.fn(), { name: 'Hold Monster', level: 5 });

    await act(async () => {
      await result.current.handleHoldMonsterConfirm(['Goblin A', 'Goblin B']);
    });

    expect(triggerHoldMonster).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Hold Monster' }),
      { holdMonsterTargets: ['Goblin A', 'Goblin B'] },
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingHoldMonster).toBeNull();
  });

  it('normalizes single target to array', async () => {
    const { triggerHoldMonster } = await import('../../services/rules/features/holdMonsterService.js');
    const { result } = setupHook(vi.fn(), { name: 'Hold Monster', level: 5 });

    await act(async () => {
      await result.current.handleHoldMonsterConfirm('SingleTarget');
    });

    expect(triggerHoldMonster).toHaveBeenCalledWith(
      expect.any(Object),
      { holdMonsterTargets: ['SingleTarget'] },
      expect.any(Object),
      expect.any(String),
      null,
    );
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Hold Monster', level: 5 });

    act(() => {
      result.current.handleHoldMonsterSkip();
    });

    expect(result.current.pendingHoldMonster).toBeNull();
  });
});



// ─── Polymorph ───────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Polymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls applyPolymorph with target and characters on confirm', async () => {
    const { applyPolymorph } = await import('../../services/automation/handlers/spells/polymorphService.js');
    const { result } = setupHook(vi.fn(), { name: 'Polymorph', level: 4 });

    await act(async () => {
      await result.current.handlePolymorphConfirm(['Goblin A']);
    });

    expect(applyPolymorph).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Polymorph' }),
      { polymorphTarget: 'Goblin A', characters: [] },
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingPolymorph).toBeNull();
  });

  it('does nothing when target is empty', async () => {
    const { applyPolymorph } = await import('../../services/automation/handlers/spells/polymorphService.js');
    const { result } = setupHook(vi.fn(), { name: 'Polymorph', level: 4 });

    await act(async () => {
      await result.current.handlePolymorphConfirm([]);
    });

    expect(applyPolymorph).not.toHaveBeenCalled();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Polymorph', level: 4 });

    act(() => {
      result.current.handlePolymorphSkip();
    });

    expect(result.current.pendingPolymorph).toBeNull();
  });
});

// ─── True Polymorph ──────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — True Polymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SP-124: injects pending spell (not the names array) at target confirm and pays the slot', async () => {
    const { applyTruePolymorph } = await import('../../services/automation/handlers/spells/truePolymorphService.js');
    const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
    const { result } = setupHook(vi.fn(), { name: 'True Polymorph', level: 9 });

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });

    await act(async () => {
      await result.current.handleTruePolymorphTargetConfirm(['Goblin A']);
    });

    // Regression: the modal emits onConfirm(names) — the wrapper must inject pending so
    // applyTruePolymorph gets the real spell object, not undefined (the old crash).
    expect(applyTruePolymorph).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'True Polymorph' }),
      expect.objectContaining({ truePolymorphTarget: 'Goblin A' }),
      expect.any(Object),
      'TestCampaign',
      null,
    );
    // DEFECT D: slot pays at confirm on this modal chain.
    expect(prepareSpellCast).toHaveBeenCalled();
    expect(result.current.pendingTruePolymorph).toBeNull();
  });

  it('SP-124: object_into_creature pays the slot at path-select', async () => {
    const { prepareSpellCast } = await import('../../services/rules/spells/spellPreparationService.js');
    const { result } = setupHook(vi.fn(), { name: 'True Polymorph', level: 9 });

    await act(async () => {
      await result.current.handleTruePolymorphPathSelect('object_into_creature');
    });

    expect(prepareSpellCast).toHaveBeenCalled();
    expect(result.current.pendingTruePolymorph).toBeNull();
  });
});

// ─── Animal Shapes ───────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — Animal Shapes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens beast selection popup on target confirm', async () => {
    const setPopupHtml = vi.fn();
    // Override getAllyList to return a matching ally name so gate sets pending
    const allySel = await import('../useAllySelection.js');
    allySel.getAllyList.mockReturnValueOnce(['Goblin A', 'Goblin B']);

    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Animal Shapes', level: 8 }));
    });

    expect(result.current.pendingAnimalShapes).not.toBeNull();

    await act(async () => {
      await result.current.handleAnimalShapesTargetConfirm(['Goblin A']);
    });

    expect(setPopupHtml).toHaveBeenCalledWith({
      type: 'animal_shapes_target_selection',
      targets: ['Goblin A'],
      casterName: 'TestSorcerer',
      campaignName: 'TestCampaign',
      spell: expect.any(Object),
      spellLevel: 8,
      maxCR: 4,
    });

    expect(result.current.pendingAnimalShapes).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'Animal Shapes', level: 8 });

    act(() => {
      result.current.handleAnimalShapesSkip();
    });

    expect(result.current.pendingAnimalShapes).toBeNull();
  });
});

// ─── True Polymorph ──────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — True Polymorph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores path on pending when selecting non-object path', () => {
    const { result } = setupHook(vi.fn(), { name: 'True Polymorph', level: 9 });

    act(() => {
      result.current.handleTruePolymorphPathSelect('creature_to_creature');
    });

    expect(result.current.pendingTruePolymorph.path).toBe('creature_to_creature');
  });

  it('applies true polymorph and clears pending for object_into_creature', async () => {
    const { applyTruePolymorph } = await import('../../services/automation/handlers/spells/truePolymorphService.js');
    const setPopupHtml = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', vi.fn(), null, [], setPopupHtml)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'True Polymorph', level: 9 }));
    });

    await act(async () => {
      await result.current.handleTruePolymorphPathSelect('object_into_creature');
    });

    expect(applyTruePolymorph).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'True Polymorph' }),
      { truePolymorphTarget: null, truePolymorphPath: 'object_into_creature', characters: [] },
      expect.any(Object),
      'TestCampaign',
      null,
    );

    expect(result.current.pendingTruePolymorph).toBeNull();
  });

  it('clears pending on skip', () => {
    const { result } = setupHook(vi.fn(), { name: 'True Polymorph', level: 9 });

    act(() => {
      result.current.handleTruePolymorphSkip();
    });

    expect(result.current.pendingTruePolymorph).toBeNull();
  });
});
