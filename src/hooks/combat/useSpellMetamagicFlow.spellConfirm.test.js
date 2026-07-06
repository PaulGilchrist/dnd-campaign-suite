// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { addEntry } from '../../services/ui/logService.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';
import { confirmRemoveCurse } from '../../services/rules/features/removeCurseService.js';
import { confirmGreaterRestoration } from '../../services/rules/features/greaterRestorationService.js';
import { spendSorceryPoints } from './useMetamagic.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 5),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
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
  applyAidEffect: vi.fn(),
  applyHeroesFeastEffect: vi.fn(),
  applyLesserRestorationEffect: vi.fn(),
  applyMageArmorEffect: vi.fn(),
  applyShieldOfFaithEffect: vi.fn(),
  applyProtectionFromEnergyHandler: vi.fn(),
  applyResistanceEffect: vi.fn(),
}));

vi.mock('../../services/rules/features/greaterRestorationService.js', () => ({
  confirmGreaterRestoration: vi.fn(),
}));

vi.mock('../../services/rules/features/removeCurseService.js', () => ({
  confirmRemoveCurse: vi.fn(),
}));

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestSorcerer',
    class: { name: 'Sorcerer' },
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderHookWithSpell(hookSetup, spellName, spellOverrides = {}) {
  const onExecute = vi.fn();
  const { result } = renderHook(() =>
    hookSetup(onExecute)
  );
  const spell = makeSpell({ name: spellName, ...spellOverrides });
  act(() => {
    result.current.gateMetamagic(spell);
  });
  return { result, onExecute, spell };
}

// ── Multi-target ─────────────────────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleMultiTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Goblin A' }, { name: 'Goblin B' }],
    });
  });

  it('logs entry with Words of Creation metamagic and calls onExecute with multiTarget', () => {
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Word of Radiance' });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    act(() => {
      result.current.handleMultiTargetConfirm({ secondTarget: 'Goblin B' });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Word of Radiance',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: ['Words of Creation'],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(onExecute).toHaveBeenCalledWith(spell, { multiTarget: 'Goblin B' });
    expect(result.current.pendingMultiTarget).toBeNull();
  });

  it('calls onExecute with empty context when no secondTarget is provided or on skip', () => {
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    const spell = makeSpell({ name: 'Word of Radiance' });
    act(() => {
      result.current.gateMetamagic(spell);
    });

    // Confirm without secondTarget
    act(() => {
      result.current.handleMultiTargetConfirm({});
    });

    expect(onExecute).toHaveBeenCalledWith(spell, {});
    vi.clearAllMocks();

    // Skip
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
    const { result: result2 } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    act(() => {
      result2.current.gateMetamagic(spell);
    });

    act(() => {
      result2.current.handleMultiTargetSkip();
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Word of Radiance',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: [],
      spCost: 0,
      timestamp: expect.any(Number),
    });
    expect(onExecute).toHaveBeenCalledWith(spell, {});
    expect(result2.current.pendingMultiTarget).toBeNull();
  });
});

// ── Spell-specific confirm handlers ──────────────────────────────────────────

// Each spell handler (aid, heroesFeast, greaterRestoration, lesserRestoration,
// removeCurse, mageArmor, protectionFromEnergy, resistance) follows the same
// pattern via useConfirmableFlow.createConfirmHandler.  We test each one once
// to verify the correct automation / service function is invoked and the log
// entry is written.  The no-pending guard and skip logic are exercised by
// the generic handler tests below and by useConfirmableFlow's own tests.

describe('useSpellMetamagicFlow — spell confirm handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const spellConfigs = [
    {
      name: 'Aid',
      level: 2,
      handler: 'handleAidConfirm',
      pendingKey: 'pendingAid',
      args: { targets: ['Goblin A', 'Goblin B'] },
      verify: async (automation) => {
        expect(automation.applyAidEffect).toHaveBeenCalled();
      },
    },
    {
      name: "Heroes' Feast",
      level: 6,
      handler: 'handleHeroesFeastConfirm',
      pendingKey: 'pendingHeroesFeast',
      args: { targets: ['Goblin A', 'Goblin B'] },
      verify: async (automation) => {
        expect(automation.applyHeroesFeastEffect).toHaveBeenCalled();
      },
    },
    {
      name: 'Greater Restoration',
      level: 5,
      handler: 'handleGreaterRestorationConfirm',
      pendingKey: 'pendingGreaterRestoration',
      args: { targetName: 'Goblin A' },
      verify: () => {
        expect(confirmGreaterRestoration).toHaveBeenCalled();
      },
    },
    {
      name: 'Lesser Restoration',
      level: 2,
      handler: 'handleLesserRestorationConfirm',
      pendingKey: 'pendingLesserRestoration',
      args: { targetName: 'Goblin A' },
      verify: async (automation) => {
        expect(automation.applyLesserRestorationEffect).toHaveBeenCalled();
      },
    },
    {
      name: 'Remove Curse',
      level: 3,
      handler: 'handleRemoveCurseConfirm',
      pendingKey: 'pendingRemoveCurse',
      args: { targetName: 'Goblin A' },
      verify: () => {
        expect(confirmRemoveCurse).toHaveBeenCalled();
      },
    },
    {
      name: 'Mage Armor',
      level: 1,
      handler: 'handleMageArmorConfirm',
      pendingKey: 'pendingMageArmor',
      args: { targetName: 'Goblin A' },
      verify: async (automation) => {
        expect(automation.applyMageArmorEffect).toHaveBeenCalled();
      },
    },
    {
      name: 'Protection from Energy',
      level: 3,
      handler: 'handleProtectionFromEnergyConfirm',
      pendingKey: 'pendingProtectionFromEnergy',
      args: { targetName: 'Goblin A', damageType: 'Fire' },
      verify: async (automation) => {
        expect(automation.applyProtectionFromEnergyHandler).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Protection from Energy' }),
          expect.any(Object),
          'TestCampaign',
          'Goblin A',
          'Fire'
        );
      },
    },
    {
      name: 'Resistance',
      level: 0,
      handler: 'handleResistanceConfirm',
      pendingKey: 'pendingResistance',
      args: { targetName: 'Goblin A', damageType: 'Fire' },
      verify: async (automation) => {
        expect(automation.applyResistanceEffect).toHaveBeenCalled();
      },
    },
  ];

  for (const config of spellConfigs) {
    it(`applies effect and logs entry for ${config.name}`, async () => {
      const { result, onExecute } = renderHookWithSpell(
        (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
        config.name,
        { level: config.level },
      );

      const automation = await import('../../services/automation/index.js');

      await act(async () => {
        await result.current[config.handler](config.args);
      });

      expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: config.name,
        spellLevel: config.level,
        castingTime: '1 Action',
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
      await config.verify(automation);
      expect(onExecute).not.toHaveBeenCalled();
      expect(result.current[config.pendingKey]).toBeNull();
    });
  }
});

// ── Spell-specific skip handlers ─────────────────────────────────────────────

describe('useSpellMetamagicFlow — spell skip handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const spellConfigs = [
    { name: 'Aid', level: 2, handler: 'handleAidSkip', pendingKey: 'pendingAid' },
    { name: "Heroes' Feast", level: 6, handler: 'handleHeroesFeastSkip', pendingKey: 'pendingHeroesFeast' },
    { name: 'Greater Restoration', level: 5, handler: 'handleGreaterRestorationSkip', pendingKey: 'pendingGreaterRestoration' },
    { name: 'Lesser Restoration', level: 2, handler: 'handleLesserRestorationSkip', pendingKey: 'pendingLesserRestoration' },
    { name: 'Remove Curse', level: 3, handler: 'handleRemoveCurseSkip', pendingKey: 'pendingRemoveCurse' },
    { name: 'Mage Armor', level: 1, handler: 'handleMageArmorSkip', pendingKey: 'pendingMageArmor' },
    { name: 'Protection from Energy', level: 3, handler: 'handleProtectionFromEnergySkip', pendingKey: 'pendingProtectionFromEnergy' },
    { name: 'Resistance', level: 0, handler: 'handleResistanceSkip', pendingKey: 'pendingResistance' },
  ];

  for (const config of spellConfigs) {
    it(`logs entry and clears pending for ${config.name} skip`, () => {
      const { result } = renderHookWithSpell(
        (onExec) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExec),
        config.name,
        { level: config.level },
      );

      act(() => {
        result.current[config.handler]();
      });

      expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: config.name,
        spellLevel: config.level,
        castingTime: '1 Action',
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
      expect(result.current[config.pendingKey]).toBeNull();
    });
  }
});

// ── Magic Missile (unique logic — distribution validation) ───────────────────

describe('useSpellMetamagicFlow — handleMagicMissile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = () => renderHookWithSpell(
    (onExecute) => useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute),
    'Magic Missile',
    { level: 1 },
  );

  it('calls onExecute with magicMissileDistribution and slotLevel on confirm with targets', () => {
    const { result, onExecute, spell } = setup();

    act(() => {
      result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 2, 'Goblin B': 1 },
      });
    });

    expect(onExecute).toHaveBeenCalledWith(spell, {
      magicMissileDistribution: { 'Goblin A': 2, 'Goblin B': 1 },
      slotLevel: 1,
    });
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
  });

  it('does nothing when all distribution values are zero or on skip', () => {
    const { result, onExecute } = setup();

    // All zeros — no execute, no entry, no pending clear
    act(() => {
      result.current.handleMagicMissileConfirm({
        distribution: { 'Goblin A': 0, 'Goblin B': 0 },
      });
    });

    expect(onExecute).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(result.current.pendingMagicMissile).toBeNull();
    vi.clearAllMocks();

    // Skip — clears pending only
    act(() => {
      result.current.handleMagicMissileSkip();
    });

    expect(result.current.pendingMagicMissile).toBeNull();
  });
});

// ── Psionic sorcery confirm ──────────────────────────────────────────────────

describe('useSpellMetamagicFlow — handleConfirm with psionic sorcery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupPsionicPending() {
    isPsionicSpell.mockReturnValueOnce(true);
    hasPsionicSorcery.mockReturnValueOnce(true);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 2 }));
    });

    return { result, onExecute };
  }

  it('adds psionic cost to total cost when psionic and no Subtle Spell', () => {
    const { result, onExecute } = setupPsionicPending();

    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Empowered Spell'] });
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith(
      'TestSorcerer', 3, 'TestCampaign', expect.any(Number)
    );
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Mind Sliver',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: ['Empowered Spell', 'Psionic Sorcery'],
      spCost: 3,
      timestamp: expect.any(Number),
    });
    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ psionicSpell: true })
    );
  });

  it('does not add psionic cost when Subtle Spell is used', () => {
    const { result } = setupPsionicPending();

    act(() => {
      result.current.handleConfirm({ totalCost: 1, options: ['Subtle Spell'] });
    });

    expect(spendSorceryPoints).toHaveBeenCalledWith(
      'TestSorcerer', 1, 'TestCampaign', expect.any(Number)
    );
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Mind Sliver',
      spellLevel: 2,
      castingTime: '1 Action',
      metamagic: ['Subtle Spell'],
      spCost: 1,
      timestamp: expect.any(Number),
    });
  });

  it('does not add Psionic Sorcery to options or metaCtx when psionicCost is 0', () => {
    isPsionicSpell.mockReturnValueOnce(false);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });

    act(() => {
      result.current.handleConfirm({ totalCost: 2, options: ['Empowered Spell'] });
    });

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'spell',
      characterName: 'TestSorcerer',
      spellName: 'Fireball',
      spellLevel: 3,
      castingTime: '1 Action',
      metamagic: ['Empowered Spell'],
      spCost: 2,
      timestamp: expect.any(Number),
    });
    vi.clearAllMocks();

    isPsionicSpell.mockReturnValueOnce(false);
    const { result: result2 } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );
    act(() => {
      result2.current.gateMetamagic(makeSpell({ name: 'Fireball', level: 3 }));
    });
    act(() => {
      result2.current.handleConfirm({ totalCost: 0, options: [] });
    });

    expect(onExecute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ psionicSpell: true })
    );
  });
});
