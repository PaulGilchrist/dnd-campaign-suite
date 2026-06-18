import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
import { isPsionicSpell, hasPsionicSorcery } from '../../services/rules/spells/metamagicRules.js';

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

describe('useSpellMetamagicFlow — spell-specific gate paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lesser restoration gate', () => {
    it('sets pendingLesserRestoration when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Lesser Restoration', range: undefined }));
      });

      expect(result.current.pendingLesserRestoration).not.toBeNull();
      expect(result.current.pendingLesserRestoration.spellName).toBe('Lesser Restoration');
      expect(result.current.pendingLesserRestoration.spellLevel).toBe(3);
      expect(result.current.pendingLesserRestoration.castingTime).toBe('1 Action');
      expect(result.current.pendingLesserRestoration.range).toBe('Touch');
      expect(result.current.pendingLesserRestoration.creatureTargets).toEqual(['Goblin A', 'Goblin B', 'Goblin C']);
      expect(result.current.pendingMetamagic).toBeNull();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('does not set pendingLesserRestoration when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Lesser Restoration' }));
      });

      expect(result.current.pendingLesserRestoration).toBeNull();
    });
  });

  describe('greater restoration gate', () => {
    it('sets pendingGreaterRestoration when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration' }));
      });

      expect(result.current.pendingGreaterRestoration).not.toBeNull();
      expect(result.current.pendingGreaterRestoration.spellName).toBe('Greater Restoration');
      expect(result.current.pendingGreaterRestoration.creatureTargets).toHaveLength(3);
      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration' }));
      });

      expect(result.current.pendingGreaterRestoration).toBeNull();
    });
  });

  describe('remove curse gate', () => {
    it('sets pendingRemoveCurse when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Remove Curse' }));
      });

      expect(result.current.pendingRemoveCurse).not.toBeNull();
      expect(result.current.pendingRemoveCurse.spellName).toBe('Remove Curse');
      expect(result.current.pendingRemoveCurse.creatureTargets).toHaveLength(3);
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Remove Curse' }));
      });

      expect(result.current.pendingRemoveCurse).toBeNull();
    });
  });

  describe('aid gate', () => {
    it('sets pendingAid when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid', range: undefined }));
      });

      expect(result.current.pendingAid).not.toBeNull();
      expect(result.current.pendingAid.spellName).toBe('Aid');
      expect(result.current.pendingAid.maxTargets).toBe(3);
      expect(result.current.pendingAid.range).toBe('30 feet');
      expect(result.current.pendingAid.creatureTargets).toHaveLength(3);
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid' }));
      });

      expect(result.current.pendingAid).toBeNull();
    });
  });

  describe("heroes' feast gate", () => {
    it("sets pendingHeroesFeast when creatures exist", () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: "Heroes' Feast", range: undefined }));
      });

      expect(result.current.pendingHeroesFeast).not.toBeNull();
      expect(result.current.pendingHeroesFeast.spellName).toBe("Heroes' Feast");
      expect(result.current.pendingHeroesFeast.maxTargets).toBe(12);
      expect(result.current.pendingHeroesFeast.range).toBe('Self');
      expect(result.current.pendingHeroesFeast.creatureTargets).toHaveLength(3);
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: "Heroes' Feast" }));
      });

      expect(result.current.pendingHeroesFeast).toBeNull();
    });
  });

  describe('mage armor gate', () => {
    it('sets pendingMageArmor when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Mage Armor', range: undefined }));
      });

      expect(result.current.pendingMageArmor).not.toBeNull();
      expect(result.current.pendingMageArmor.spellName).toBe('Mage Armor');
      expect(result.current.pendingMageArmor.range).toBe('Touch');
      expect(result.current.pendingMageArmor.creatureTargets).toHaveLength(3);
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Mage Armor' }));
      });

      expect(result.current.pendingMageArmor).toBeNull();
    });
  });

  describe('shield of faith gate', () => {
    it('sets pendingShieldOfFaith when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Shield of Faith', range: undefined }));
      });

      expect(result.current.pendingShieldOfFaith).not.toBeNull();
      expect(result.current.pendingShieldOfFaith.spellName).toBe('Shield of Faith');
      expect(result.current.pendingShieldOfFaith.range).toBe('60 feet');
      expect(result.current.pendingShieldOfFaith.creatureTargets).toHaveLength(3);
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Shield of Faith' }));
      });

      expect(result.current.pendingShieldOfFaith).toBeNull();
    });
  });

  describe('protection from energy gate', () => {
    it('sets pendingProtectionFromEnergy when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy', range: undefined }));
      });

      expect(result.current.pendingProtectionFromEnergy).not.toBeNull();
      expect(result.current.pendingProtectionFromEnergy.spellName).toBe('Protection from Energy');
      expect(result.current.pendingProtectionFromEnergy.range).toBe('Touch');
      expect(result.current.pendingProtectionFromEnergy.creatureTargets).toHaveLength(3);
      expect(result.current.pendingProtectionFromEnergy.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);
    });

    it('includes damageTypes from spell automation when present', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy', automation: { damageTypes: ['Fire', 'Cold'] } }));
      });

      expect(result.current.pendingProtectionFromEnergy.damageTypes).toEqual(['Fire', 'Cold']);
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy' }));
      });

      expect(result.current.pendingProtectionFromEnergy).toBeNull();
    });
  });

  describe('resistance gate', () => {
    it('sets pendingResistance when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Resistance', range: undefined }));
      });

      expect(result.current.pendingResistance).not.toBeNull();
      expect(result.current.pendingResistance.spellName).toBe('Resistance');
      expect(result.current.pendingResistance.range).toBe('Touch');
      expect(result.current.pendingResistance.creatureTargets).toHaveLength(3);
      expect(result.current.pendingResistance.damageTypes).toContain('Acid');
      expect(result.current.pendingResistance.damageTypes).toContain('Thunder');
    });

    it('does not set pending when no creatures', () => {
      getCombatSummary.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Resistance' }));
      });

      expect(result.current.pendingResistance).toBeNull();
    });
  });

  describe('multi-target spread gate', () => {
    it('sets pendingMultiTarget when getMultiTargetSpreadForSpell returns a spread', () => {
      getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
      getCombatSummary.mockReturnValueOnce({
        creatures: [{ name: 'Orc A' }, { name: 'Orc B' }],
      });

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      expect(result.current.pendingMultiTarget).not.toBeNull();
      expect(result.current.pendingMultiTarget.spellName).toBe('Fireball');
      expect(result.current.pendingMultiTarget.spellLevel).toBe(3);
      expect(result.current.pendingMultiTarget.range).toBe('20 ft');
      expect(result.current.pendingMultiTarget.creatureTargets).toEqual(['Orc A', 'Orc B']);
    });

    it('does not set pendingMultiTarget when creatureTargets is empty', () => {
      getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
      getCombatSummary.mockReturnValueOnce({
        creatures: [],
      });

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      expect(result.current.pendingMultiTarget).toBeNull();
    });

    it('proceeds to sorcerer metamagic path when no multi-target spread', () => {
      getMultiTargetSpreadForSpell.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMultiTarget).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spell).toBe(spell);
    });

    it('filters out self from creature targets in getCreatureTargets', () => {
      getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });
      getCombatSummary.mockReturnValueOnce({
        creatures: [{ name: 'TestSorcerer' }, { name: 'Orc A' }],
      });

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      expect(result.current.pendingMultiTarget.creatureTargets).toEqual(['Orc A']);
    });
  });

  describe('spell gate ordering — higher priority spells take precedence', () => {
    it('lesser restoration takes priority over multi-target spread', () => {
      getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '20 ft' });

      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Lesser Restoration' }));
      });

      expect(result.current.pendingLesserRestoration).not.toBeNull();
      expect(result.current.pendingMultiTarget).toBeNull();
      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('aid takes priority over sorcerer metamagic path', () => {
      const onExecute = vi.fn();
      const { result } = renderHook(() =>
        useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid' }));
      });

      expect(result.current.pendingAid).not.toBeNull();
      expect(result.current.pendingMetamagic).toBeNull();
    });
  });
});

describe('useSpellMetamagicFlow — psionic sorcery gate', () => {
  beforeEach(() => {
    getCombatSummary.mockClear();
    getMultiTargetSpreadForSpell.mockClear();
    isPsionicSpell.mockClear();
    hasPsionicSorcery.mockClear();
  });

  it('sets isPsionic and psionicCost on pendingMetamagic for psionic spells', () => {
    isPsionicSpell.mockImplementation(() => true);
    hasPsionicSorcery.mockImplementation(() => true);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 2 }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.isPsionic).toBe(true);
    expect(result.current.pendingMetamagic.psionicCost).toBe(2);
  });

  it('sets isPsionic to false when hasPsionicSorcery is false', () => {
    isPsionicSpell.mockImplementation(() => true);
    hasPsionicSorcery.mockImplementation(() => false);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 2 }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.isPsionic).toBe(false);
    expect(result.current.pendingMetamagic.psionicCost).toBe(0);
  });

  it('sets isPsionic to false when isPsionicSpell is false', () => {
    isPsionicSpell.mockImplementation(() => false);
    hasPsionicSorcery.mockImplementation(() => true);

    const onExecute = vi.fn();
    const { result } = renderHook(() =>
      useSpellMetamagicFlow(makePlayerStats(), 'TestCampaign', onExecute)
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.isPsionic).toBe(false);
    expect(result.current.pendingMetamagic.psionicCost).toBe(0);
  });
});
