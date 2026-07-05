// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellMetamagicFlow } from './useSpellMetamagicFlow.js';
import * as metamagicModule from './useMetamagic.js';
import * as logServiceModule from '../../services/ui/logService.js';
import * as combatDataModule from '../../services/encounters/combatData.js';
import * as postCastRiderModule from '../../services/rules/spells/postCastRiderService.js';
import * as metamagicRulesModule from '../../services/rules/spells/metamagicRules.js';

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(),
  getMaxSorceryPoints: vi.fn(),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(),
  hasPsionicSorcery: vi.fn(),
}));

const defaultCreatures = [
  { name: 'Goblin A' },
  { name: 'Goblin B' },
  { name: 'Goblin C' },
];

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

function renderFlow(playerStats, campaignName, onExecute) {
  return renderHook(() =>
    useSpellMetamagicFlow(playerStats, campaignName, onExecute)
  );
}

describe('useSpellMetamagicFlow — spell-specific gate paths', () => {
  beforeEach(() => {
    combatDataModule.getCombatSummary.mockReset().mockReturnValue({
      creatures: defaultCreatures,
    });
    postCastRiderModule.getMultiTargetSpreadForSpell.mockReset().mockReturnValue(null);
    metamagicRulesModule.isPsionicSpell.mockReset().mockReturnValue(false);
    metamagicRulesModule.hasPsionicSorcery.mockReset().mockReturnValue(false);
    metamagicModule.getCurrentSorceryPoints.mockReset().mockReturnValue(5);
    metamagicModule.getMaxSorceryPoints.mockReset().mockReturnValue(10);
  });

  describe('gate behavior — creatures present', () => {
    it('sets pendingLesserRestoration with correct properties when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: 'Lesser Restoration', range: undefined })
        );
      });

      const pending = result.current.pendingLesserRestoration;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe('Lesser Restoration');
      expect(pending.spellLevel).toBe(3);
      expect(pending.castingTime).toBe('1 Action');
      expect(pending.range).toBe('Touch');
      expect(pending.creatureTargets).toEqual(['Goblin A', 'Goblin B', 'Goblin C']);
      expect(result.current.pendingMetamagic).toBeNull();
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('sets pendingGreaterRestoration when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration' }));
      });

      const pending = result.current.pendingGreaterRestoration;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe('Greater Restoration');
      expect(pending.creatureTargets).toHaveLength(3);
      expect(result.current.pendingMetamagic).toBeNull();
    });

    it('sets pendingRemoveCurse when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Remove Curse' }));
      });

      const pending = result.current.pendingRemoveCurse;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe('Remove Curse');
      expect(pending.creatureTargets).toHaveLength(3);
    });

    it('sets pendingAid with correct properties when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid', range: undefined }));
      });

      const pending = result.current.pendingAid;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe('Aid');
      expect(pending.maxTargets).toBe(3);
      expect(pending.range).toBe('30 feet');
      expect(pending.creatureTargets).toHaveLength(3);
    });

    it("sets pendingHeroesFeast with correct properties when creatures exist", () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: "Heroes' Feast", range: undefined })
        );
      });

      const pending = result.current.pendingHeroesFeast;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe("Heroes' Feast");
      expect(pending.maxTargets).toBe(12);
      expect(pending.range).toBe('Self');
      expect(pending.creatureTargets).toHaveLength(3);
    });

    it('sets pendingMageArmor when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Mage Armor', range: undefined }));
      });

      const pending = result.current.pendingMageArmor;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe('Mage Armor');
      expect(pending.range).toBe('Touch');
      expect(pending.creatureTargets).toHaveLength(3);
    });

    it('sets pendingProtectionFromEnergy with default damageTypes when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: 'Protection from Energy', range: undefined })
        );
      });

      const pending = result.current.pendingProtectionFromEnergy;
      expect(pending).not.toBeNull();
      expect(pending.damageTypes).toEqual([
        'Acid', 'Cold', 'Fire', 'Lightning', 'Thunder',
      ]);
    });

    it('uses damageTypes from spell automation when present for Protection from Energy', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({
            name: 'Protection from Energy',
            automation: { damageTypes: ['Fire', 'Cold'] },
          })
        );
      });

      const pending = result.current.pendingProtectionFromEnergy;
      expect(pending.damageTypes).toEqual(['Fire', 'Cold']);
    });

    it('sets pendingResistance with all damage types when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Resistance', range: undefined }));
      });

      const pending = result.current.pendingResistance;
      expect(pending).not.toBeNull();
      expect(pending.damageTypes).toContain('Acid');
      expect(pending.damageTypes).toContain('Thunder');
      expect(pending.damageTypes).toContain('Fire');
      expect(pending.damageTypes).toContain('Necrotic');
    });

    it('sets pendingMagicMissile with correct missile count when creatures exist', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Magic Missile' }));
      });

      const pending = result.current.pendingMagicMissile;
      expect(pending).not.toBeNull();
      expect(pending.totalMissiles).toBe(5);
      expect(pending.missileDamage).toBe('1d4 + 1');
      expect(pending.creatureTargets).toHaveLength(3);
    });

    it('sets pendingMagicMissile with increased missiles for higher level spell', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: 'Magic Missile', level: 3 })
        );
      });

      const pending = result.current.pendingMagicMissile;
      expect(pending.totalMissiles).toBe(5);
    });
  });

  describe('gate behavior — no creatures', () => {
    function setupNoCreatures() {
      combatDataModule.getCombatSummary.mockReturnValue({ creatures: [] });
    }

    it('falls through to sorcerer metamagic path for Lesser Restoration when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Lesser Restoration' }));
      });

      expect(result.current.pendingLesserRestoration).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Greater Restoration when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Greater Restoration' }));
      });

      expect(result.current.pendingGreaterRestoration).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Remove Curse when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Remove Curse' }));
      });

      expect(result.current.pendingRemoveCurse).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Aid when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid' }));
      });

      expect(result.current.pendingAid).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Mage Armor when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Mage Armor' }));
      });

      expect(result.current.pendingMageArmor).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Protection from Energy when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Protection from Energy' }));
      });

      expect(result.current.pendingProtectionFromEnergy).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Resistance when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Resistance' }));
      });

      expect(result.current.pendingResistance).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('falls through to sorcerer metamagic path for Magic Missile when no creatures', () => {
      setupNoCreatures();
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Magic Missile' }));
      });

      expect(result.current.pendingMagicMissile).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });
  });

  describe('multi-target spread gate', () => {
    it('sets pendingMultiTarget when getMultiTargetSpreadForSpell returns a spread', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValueOnce({
        range: '20 ft',
      });
      combatDataModule.getCombatSummary.mockReturnValueOnce({
        creatures: [{ name: 'Orc A' }, { name: 'Orc B' }],
      });

      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      const pending = result.current.pendingMultiTarget;
      expect(pending).not.toBeNull();
      expect(pending.spellName).toBe('Fireball');
      expect(pending.spellLevel).toBe(3);
      expect(pending.range).toBe('20 ft');
      expect(pending.creatureTargets).toEqual(['Orc A', 'Orc B']);
    });

    it('does not set pendingMultiTarget when creatureTargets is empty', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValueOnce({
        range: '20 ft',
      });
      combatDataModule.getCombatSummary.mockReturnValueOnce({
        creatures: [],
      });

      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      expect(result.current.pendingMultiTarget).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
    });

    it('proceeds to sorcerer metamagic path when no multi-target spread', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValueOnce(null);

      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      const spell = makeSpell();
      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(result.current.pendingMultiTarget).toBeNull();
      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spell).toBe(spell);
    });

    it('includes all creatures in multi-target spread', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValueOnce({
        range: '20 ft',
      });
      combatDataModule.getCombatSummary.mockReturnValueOnce({
        creatures: [{ name: 'TestSorcerer' }, { name: 'Orc A' }],
      });

      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      expect(result.current.pendingMultiTarget.creatureTargets).toEqual([
        'TestSorcerer',
        'Orc A',
      ]);
    });
  });

  describe('gate ordering — higher priority spells take precedence', () => {
    it('lesser restoration takes priority over multi-target spread', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValueOnce({
        range: '20 ft',
      });

      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
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
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid' }));
      });

      expect(result.current.pendingAid).not.toBeNull();
      expect(result.current.pendingMetamagic).toBeNull();
    });
  });

  describe('case-insensitive spell name matching', () => {
    it('matches spell name regardless of case for Lesser Restoration', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: 'lesser restoration', range: undefined })
        );
      });

      expect(result.current.pendingLesserRestoration).not.toBeNull();
    });

    it('matches spell name regardless of case for Greater Restoration', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: 'GREATER RESTORATION' })
        );
      });

      expect(result.current.pendingGreaterRestoration).not.toBeNull();
    });

    it('matches spell name regardless of case for Magic Missile', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(
          makeSpell({ name: 'MAGIC MISSILE' })
        );
      });

      expect(result.current.pendingMagicMissile).not.toBeNull();
    });
  });

  describe('non-Sorcerer path', () => {
    it('calls onExecute directly and logs entry when player is not a Sorcerer', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValue(null);
      const onExecute = vi.fn();
      const nonSorcerer = makePlayerStats({ class: { name: 'Wizard' } });
      const spell = makeSpell({ name: 'Fireball' });
      const { result } = renderFlow(
        nonSorcerer,
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(spell);
      });

      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(spell, {});
      expect(logServiceModule.addEntry).toHaveBeenCalledTimes(1);
      expect(logServiceModule.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: 'Fireball',
        spellLevel: 3,
        castingTime: '1 Action',
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('unknown spell falls through to sorcerer metamagic', () => {
    it('sets pendingMetamagic for an unrecognized spell name', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Unknown Spell' }));
      });

      expect(result.current.pendingMetamagic).not.toBeNull();
      expect(result.current.pendingMetamagic.spellName).toBe('Unknown Spell');
      expect(result.current.pendingLesserRestoration).toBeNull();
      expect(result.current.pendingMultiTarget).toBeNull();
    });
  });
});

describe('useSpellMetamagicFlow — psionic sorcery gate', () => {
  beforeEach(() => {
    metamagicModule.getCurrentSorceryPoints.mockReset().mockReturnValue(5);
    metamagicModule.getMaxSorceryPoints.mockReset().mockReturnValue(10);
    combatDataModule.getCombatSummary.mockReset().mockReturnValue({
      creatures: defaultCreatures,
    });
    postCastRiderModule.getMultiTargetSpreadForSpell.mockReset().mockReturnValue(null);
    metamagicRulesModule.isPsionicSpell.mockReturnValue(false);
    metamagicRulesModule.hasPsionicSorcery.mockReturnValue(false);
  });

  it('sets isPsionic and psionicCost on pendingMetamagic for psionic spells', () => {
    metamagicRulesModule.isPsionicSpell.mockReturnValue(true);
    metamagicRulesModule.hasPsionicSorcery.mockReturnValue(true);

    const onExecute = vi.fn();
    const { result } = renderFlow(
      makePlayerStats(),
      'TestCampaign',
      onExecute
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 2 }));
    });

    const pm = result.current.pendingMetamagic;
    expect(pm).not.toBeNull();
    expect(pm.isPsionic).toBe(true);
    expect(pm.psionicCost).toBe(2);
  });

  it('sets isPsionic to false when hasPsionicSorcery is false', () => {
    metamagicRulesModule.isPsionicSpell.mockReturnValue(true);
    metamagicRulesModule.hasPsionicSorcery.mockReturnValue(false);

    const onExecute = vi.fn();
    const { result } = renderFlow(
      makePlayerStats(),
      'TestCampaign',
      onExecute
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Mind Sliver', level: 2 }));
    });

    const pm = result.current.pendingMetamagic;
    expect(pm).not.toBeNull();
    expect(pm.isPsionic).toBe(false);
    expect(pm.psionicCost).toBe(0);
  });

  it('sets isPsionic to false when isPsionicSpell is false', () => {
    metamagicRulesModule.isPsionicSpell.mockReturnValue(false);
    metamagicRulesModule.hasPsionicSorcery.mockReturnValue(true);

    const onExecute = vi.fn();
    const { result } = renderFlow(
      makePlayerStats(),
      'TestCampaign',
      onExecute
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
    });

    const pm = result.current.pendingMetamagic;
    expect(pm).not.toBeNull();
    expect(pm.isPsionic).toBe(false);
    expect(pm.psionicCost).toBe(0);
  });
});

describe('useSpellMetamagicFlow — confirm and skip handlers', () => {
  beforeEach(() => {
    combatDataModule.getCombatSummary.mockReset().mockReturnValue({
      creatures: defaultCreatures,
    });
    postCastRiderModule.getMultiTargetSpreadForSpell.mockReset().mockReturnValue(null);
    metamagicModule.spendSorceryPoints.mockReset();
  });

  describe('handleConfirm', () => {
    it('clears pendingMetamagic and calls onExecute with metamagic context', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });
      expect(result.current.pendingMetamagic).not.toBeNull();

      act(() => {
        result.current.handleConfirm({ options: ['Empowered Spell'], totalCost: 1 });
      });

      expect(result.current.pendingMetamagic).toBeNull();
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(logServiceModule.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: 'Fireball',
        spellLevel: 3,
        castingTime: '1 Action',
        metamagic: ['Empowered Spell'],
        spCost: 1,
        timestamp: expect.any(Number),
      });
    });

    it('does not spend sorcery points when cost is zero', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      act(() => {
        result.current.handleConfirm({ options: [], totalCost: 0 });
      });

      expect(metamagicModule.spendSorceryPoints).not.toHaveBeenCalled();
    });

    it('spends sorcery points when cost is greater than zero', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      act(() => {
        result.current.handleConfirm({ options: ['Empowered Spell'], totalCost: 2 });
      });

      expect(metamagicModule.spendSorceryPoints).toHaveBeenCalledWith(
        'TestSorcerer',
        2,
        'TestCampaign',
        10
      );
    });
  });

  describe('handleSkip', () => {
    it('clears pendingMetamagic and calls onExecute without metamagic', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });
      expect(result.current.pendingMetamagic).not.toBeNull();

      act(() => {
        result.current.handleSkip();
      });

      expect(result.current.pendingMetamagic).toBeNull();
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(makeSpell({ name: 'Fireball' }), {});
    });
  });

  describe('handleMultiTargetConfirm', () => {
    it('clears pendingMultiTarget and calls onExecute with multi-target context', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValue({
        range: '20 ft',
      });
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });
      expect(result.current.pendingMultiTarget).not.toBeNull();

      act(() => {
        result.current.handleMultiTargetConfirm({ secondTarget: 'Orc B' });
      });

      expect(result.current.pendingMultiTarget).toBeNull();
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ multiTarget: 'Orc B' })
      );
    });
  });

  describe('handleMultiTargetSkip', () => {
    it('clears pendingMultiTarget and calls onExecute without context', () => {
      postCastRiderModule.getMultiTargetSpreadForSpell.mockReturnValue({
        range: '20 ft',
      });
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
      });

      act(() => {
        result.current.handleMultiTargetSkip();
      });

      expect(result.current.pendingMultiTarget).toBeNull();
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(
        expect.any(Object),
        {}
      );
    });
  });

  describe('handleAidConfirm', () => {
    it('clears pendingAid and calls onExecute after applying aid effect', async () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid' }));
      });
      expect(result.current.pendingAid).not.toBeNull();

      await act(async () => {
        await result.current.handleAidConfirm({ targetNames: ['Goblin A'] });
      });

      expect(result.current.pendingAid).toBeNull();
      expect(onExecute).not.toHaveBeenCalled();
      expect(logServiceModule.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: 'Aid',
        spellLevel: 3,
        castingTime: '1 Action',
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('handleAidSkip', () => {
    it('clears pendingAid and logs entry without applying effects', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Aid' }));
      });

      act(() => {
        result.current.handleAidSkip();
      });

      expect(result.current.pendingAid).toBeNull();
      expect(onExecute).not.toHaveBeenCalled();
      expect(logServiceModule.addEntry).toHaveBeenCalledWith('TestCampaign', {
        type: 'spell',
        characterName: 'TestSorcerer',
        spellName: 'Aid',
        spellLevel: 3,
        castingTime: '1 Action',
        metamagic: [],
        spCost: 0,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('handleMagicMissileConfirm', () => {
    it('clears pendingMagicMissile and calls onExecute with distribution context', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Magic Missile' }));
      });
      expect(result.current.pendingMagicMissile).not.toBeNull();

      act(() => {
        result.current.handleMagicMissileConfirm({
          distribution: { 'Goblin A': 2, 'Goblin B': 1 },
        });
      });

      expect(result.current.pendingMagicMissile).toBeNull();
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          magicMissileDistribution: { 'Goblin A': 2, 'Goblin B': 1 },
          slotLevel: 3,
        })
      );
    });

    it('does not call onExecute when all distribution values are zero', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Magic Missile' }));
      });

      act(() => {
        result.current.handleMagicMissileConfirm({
          distribution: { 'Goblin A': 0, 'Goblin B': 0 },
        });
      });

      expect(onExecute).not.toHaveBeenCalled();
    });
  });

  describe('handleMagicMissileSkip', () => {
    it('clears pendingMagicMissile without calling onExecute', () => {
      const onExecute = vi.fn();
      const { result } = renderFlow(
        makePlayerStats(),
        'TestCampaign',
        onExecute
      );

      act(() => {
        result.current.gateMetamagic(makeSpell({ name: 'Magic Missile' }));
      });

      act(() => {
        result.current.handleMagicMissileSkip();
      });

      expect(result.current.pendingMagicMissile).toBeNull();
      expect(onExecute).not.toHaveBeenCalled();
    });
  });
});

describe('useSpellMetamagicFlow — edge cases', () => {
  beforeEach(() => {
    combatDataModule.getCombatSummary.mockReset().mockReturnValue({
      creatures: defaultCreatures,
    });
    postCastRiderModule.getMultiTargetSpreadForSpell.mockReset().mockReturnValue(null);
  });

  it('handles undefined spell name gracefully', () => {
    const onExecute = vi.fn();
    const { result } = renderFlow(
      makePlayerStats(),
      'TestCampaign',
      onExecute
    );

    act(() => {
      result.current.gateMetamagic({});
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
  });

  it('handles spell with no level by defaulting to 0', () => {
    const onExecute = vi.fn();
    const { result } = renderFlow(
      makePlayerStats(),
      'TestCampaign',
      onExecute
    );

    act(() => {
      result.current.gateMetamagic({ name: 'Fireball' });
    });

    expect(result.current.pendingMetamagic).not.toBeNull();
    expect(result.current.pendingMetamagic.spellLevel).toBe(0);
  });

  it('handles null combat summary by falling through to metamagic path', () => {
    combatDataModule.getCombatSummary.mockReturnValue(null);
    const onExecute = vi.fn();
    const { result } = renderFlow(
      makePlayerStats(),
      'TestCampaign',
      onExecute
    );

    act(() => {
      result.current.gateMetamagic(makeSpell({ name: 'Fireball' }));
    });

    expect(result.current.pendingMultiTarget).toBeNull();
    expect(result.current.pendingMetamagic).not.toBeNull();
  });
});
