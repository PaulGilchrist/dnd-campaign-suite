// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="hex-ability-modal"><button onClick={props.onCancel}>Cancel</button></div>),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="secondary-target-modal">
      {props.title}
      {(props.targets || []).map((t) => (
        <button key={t.name} onClick={() => props.onTargetSelected(t.name)}>{t.name}</button>
      ))}
      <button onClick={props.onSkip}>SkipTarget</button>
    </div>
  )),
}));

vi.mock('../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set()),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: ['Spellcasting'] })),
}));

vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));

vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn(), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => range || ''),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn(() => null),
}));

import { getRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getBonusActionSpellNames } from '../../services/ui/spellSectionUtils.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { isWithinRange } from '../../services/rules/combat/rangeCheck.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '2024',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharBonusActions - Edge Cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('Nick mastery round check (2024 rules)', () => {
    const lightWeaponAttack = {
      name: 'Dagger',
      weaponName: 'Dagger',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
      properties: ['Light'],
      mastery: 'Nick',
    };

    it.each([
      { label: 'filters out', nickRound: 1, currentRound: 1, shouldShow: false },
      { label: 'shows when rounds differ', nickRound: 5, currentRound: 1, shouldShow: true },
    ])('Nick mastery: $label Light weapon when _Nick_UsedRound=$nickRound and currentRound=$currentRound', ({ shouldShow }) => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return shouldShow ? 5 : 1;
        return null;
      });
      const stats = createStats({ attacks: [lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      if (shouldShow) {
        expect(screen.getByText('Dagger')).toBeInTheDocument();
      }
      else {
        expect(screen.queryByText('Dagger')).not.toBeInTheDocument();
      }
    });

    it('does not filter Light weapons when not using 2024 rules', () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 1;
        return null;
      });
      const stats = createStats({ rules: '5e', attacks: [lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    // WM-003 F2: the latch must hide ONLY the Nick-consumed weapon row.
    it('WM-003: keeps non-Nick Light rows (Vex Shortsword) while hiding the Nick-consumed row', () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => (key === '_Nick_UsedRound' ? 1 : null));
      const shortswordRow = {
        name: 'Shortsword',
        weaponName: 'Shortsword',
        range: 5,
        hitBonus: 5,
        damage: '1d6+2',
        damageType: 'Piercing',
        type: 'Bonus Action',
        properties: ['Finesse', 'Light', 'Monk'],
        mastery: 'Vex',
      };
      const stats = createStats({ attacks: [shortswordRow, lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Shortsword')).toBeInTheDocument();
      expect(screen.queryByText('Dagger')).not.toBeInTheDocument();
    });

    it('WM-003: keeps a Nick weapon row when the kind-bucket gate excludes it (WM-008 parity)', () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 1;
        if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Scimitar'];
        return null;
      });
      const stats = createStats({
        automation: { passives: [{ type: 'weapon_kind_mastery', name: 'Weapon Mastery' }], bonusActions: [] },
        attacks: [lightWeaponAttack],
      });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    it('WM-003: hides the Nick weapon row once the kind bucket includes it and Nick is latched', () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 1;
        if (key === '_Weapon_Kind_Mastery_chosenWeapons') return ['Scimitar', 'Dagger'];
        return null;
      });
      const stats = createStats({
        automation: { passives: [{ type: 'weapon_kind_mastery', name: 'Weapon Mastery' }], bonusActions: [] },
        attacks: [lightWeaponAttack],
      });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.queryByText('Dagger')).not.toBeInTheDocument();
    });

    it('WM-003: keeps the Nick weapon row visible when the latch belongs to an earlier round', () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 2;
        return null;
      });
      const stats = createStats({ attacks: [lightWeaponAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });
  });

  describe('Elder Champion spell conversion', () => {
    it('shows both bonus action and converted action spells when Elder Champion is active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      vi.mocked(getBonusActionSpellNames).mockImplementation(() => {
        return new Set(['Shocking Grasp', 'Shooting Star', 'Misty Step']);
      });
      const spells = [
        { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        { name: 'Shooting Star', range: '60 ft.', casting_time: '1 action', prepared: 'Prepared' },
        { name: 'Misty Step', range: '30 ft.', casting_time: '1 bonus action', prepared: 'Prepared' },
      ];
      const stats = createStats({ spellAbilities: { spells } });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
      expect(screen.getByText('Shooting Star')).toBeInTheDocument();
      expect(screen.getByText('Misty Step')).toBeInTheDocument();
    });
  });

  describe('cannotAct blocking edge cases', () => {
    const bonusActionAttack = {
      name: 'Main Gauche',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
    };

    it('adds disabled-attack class to hit bonus when cannotAct is true', () => {
      const mockOnAttackClick = vi.fn();
      const stats = createStats({ attacks: [bonusActionAttack] });
      render(<CharBonusActions playerStats={stats} onAttackClick={mockOnAttackClick} cannotAct={true} exhaustionPenalty={0} />);
      const hitBonusElement = screen.getByText('+5');
      expect(hitBonusElement).toHaveClass('disabled-attack');
    });
  });

  describe('non-Light bonus action attacks in 2024 rules', () => {
    const nonLightAttack = {
      name: 'Main Gauche',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
    };

    it('shows non-Light bonus action attacks regardless of Nick mastery round', () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return 1;
        return null;
      });
      const stats = createStats({ attacks: [nonLightAttack] });
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
      expect(screen.getByText('Main Gauche')).toBeInTheDocument();
    });
  });

  describe('Horde Breaker conditional rendering', () => {
    const shortswordAttack = {
      name: 'Shortsword',
      range: 5,
      hitBonus: 5,
      damage: '1d6-1',
      damageType: 'Piercing',
      type: 'Action',
      weaponType: 'melee',
    };
    const hordeBreakerAttack = {
      name: 'Horde Breaker',
      range: 5,
      hitBonus: 5,
      damage: '1d4',
      damageType: 'Slashing',
      type: 'Bonus Action',
      weaponType: 'melee',
      isHordeBreaker: true,
    };

    function mockHbRuntime({ choice = 'Horde Breaker', ready = { round: 1, targetName: 'Zombie 1', attackName: 'Shortsword' }, usedRound = null } = {}) {
      vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
        if (key === "_Hunter's_Prey_choice") return choice;
        if (key === '_Hunters_Prey_HordeBreaker_Ready') return ready;
        if (key === '_Hunters_Prey_HordeBreaker_UsedRound') return usedRound;
        return null;
      });
    }

    it('hides the placeholder until a melee weapon hit readies it', () => {
      mockHbRuntime({ ready: null });
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('shows the row after a ready hit, using the actual weapon damage', () => {
      mockHbRuntime();
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} />);
      expect(screen.getByText('Horde Breaker')).toBeInTheDocument();
      expect(screen.getByText('1d6-1')).toBeInTheDocument();
      expect(screen.queryByText('1d4')).not.toBeInTheDocument();
    });

    it('hides the row once used this round', () => {
      mockHbRuntime({ usedRound: 1 });
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('hides the row when the ready state is from a previous round', () => {
      mockHbRuntime({ ready: { round: 99, targetName: 'Zombie 1', attackName: 'Shortsword' } });
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('hides the row when the Hunter\'s Prey choice is Colossus Slayer', () => {
      mockHbRuntime({ choice: 'Colossus Slayer' });
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('opens a secondary target modal of valid creatures and rolls the attack against the selected one', async () => {
      mockHbRuntime();
      vi.mocked(getCombatContext).mockResolvedValue({
        creatures: [
          { name: 'Zombie 1', currentHp: 10 },
          { name: 'Zombie 2', currentHp: 10 },
          { name: 'Zombie 3', currentHp: 10 },
        ],
      });
      vi.mocked(isWithinRange).mockImplementation(async (a, b) => b === 'Zombie 2');
      const rollAttack = vi.fn();
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} rollAttack={rollAttack} />);

      fireEvent.click(screen.getByText('Horde Breaker'));
      await waitFor(() => expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument());
      expect(screen.getByText('Zombie 2')).toBeInTheDocument();
      expect(screen.queryByText('Zombie 3')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Zombie 2' }));
      expect(rollAttack).toHaveBeenCalledWith(
        'Horde Breaker',
        5,
        expect.objectContaining({
          targetName: 'Zombie 2',
          damageType: 'Piercing',
          autoDamageFormula: '1d6-1',
          autoDamageName: 'Horde Breaker',
        }),
      );
      expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();
    });

    it('shows an info popup instead of a modal when no valid secondary target exists', async () => {
      mockHbRuntime();
      vi.mocked(getCombatContext).mockResolvedValue({
        creatures: [
          { name: 'Zombie 1', currentHp: 10 },
          { name: 'Zombie 3', currentHp: 10 },
        ],
      });
      vi.mocked(isWithinRange).mockResolvedValue(false);
      const setPopupHtml = vi.fn();
      vi.mocked(useDiceRollPopup).mockReturnValue({ popupHtml: null, setPopupHtml });
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName="any-campaign" getWeaponMastery={() => null} exhaustionPenalty={0} setPopupHtml={setPopupHtml} />);

      fireEvent.click(screen.getByText('Horde Breaker'));
      await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
      expect(setPopupHtml.mock.calls[0][0]).toContain('No valid target');
      expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();
    });
  });
});
