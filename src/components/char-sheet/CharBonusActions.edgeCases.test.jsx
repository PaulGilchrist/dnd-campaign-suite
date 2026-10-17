// @maintained-by-ai
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

vi.mock('./modals/HexAbilityModal.jsx', () => ({
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
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { isWithinRange } from '../../services/rules/combat/rangeCheck.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { useSimpleDamageRoll } from '../../hooks/combat/useSimpleDamageRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';

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

  describe('Nick mastery Light-row filtering (WM-003)', () => {
    const nickDagger = {
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
    const vexShortsword = {
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
    const mainGauche = {
      name: 'Main Gauche',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
    };
    const kindMasteryPassives = [{ type: 'weapon_kind_mastery', name: 'Weapon Mastery' }];

    it.each([
      { label: 'hides the Nick Light row while the Nick latch matches the current round', nickRound: 1, attacks: [nickDagger], visible: [], hidden: ['Dagger'] },
      { label: 'keeps the Nick row when the latch belongs to another round', nickRound: 5, attacks: [nickDagger], visible: ['Dagger'], hidden: [] },
      { label: 'never filters Light rows under 5e rules', rules: '5e', nickRound: 1, attacks: [nickDagger], visible: ['Dagger'], hidden: [] },
      { label: 'keeps a non-Nick Light row alongside the hidden Nick row', nickRound: 1, attacks: [vexShortsword, nickDagger], visible: ['Shortsword'], hidden: ['Dagger'] },
      { label: 'keeps a non-Light row even while Nick is latched', nickRound: 1, attacks: [mainGauche], visible: ['Main Gauche'], hidden: [] },
      { label: 'keeps the Nick row when the kind-mastery bucket excludes it (WM-008 parity)', nickRound: 1, attacks: [nickDagger], chosen: ['Scimitar'], visible: ['Dagger'], hidden: [] },
      { label: 'hides the Nick row once the kind-mastery bucket includes it', nickRound: 1, attacks: [nickDagger], chosen: ['Scimitar', 'Dagger'], visible: [], hidden: ['Dagger'] },
    ])('$label', ({ rules = '2024', nickRound, attacks, chosen = null, visible, hidden }) => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === '_Nick_UsedRound') return nickRound;
        if (key === '_Weapon_Kind_Mastery_chosenWeapons') return chosen;
        return null;
      });
      const automation = chosen ? { passives: kindMasteryPassives, bonusActions: [] } : undefined;
      const stats = createStats({ rules, attacks, ...(automation ? { automation } : {}) });
      render(<CharBonusActions playerStats={stats} campaignName={CAMPAIGN} getWeaponMastery={() => null} />);
      visible.forEach((name) => expect(screen.getByText(name)).toBeInTheDocument());
      hidden.forEach((name) => expect(screen.queryByText(name)).not.toBeInTheDocument());
    });
  });

  describe('cannotAct gating on bonus attack rows', () => {
    const bonusActionAttack = {
      name: 'Main Gauche',
      range: 5,
      hitBonus: 5,
      damage: '1d4+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
    };

    it.each([
      { label: 'blocks damage rolls and marks the hit cell disabled', cannotAct: true, expectRolled: false },
      { label: 'allows damage rolls and leaves the hit cell enabled', cannotAct: false, expectRolled: true },
    ])('cannotAct $label', ({ cannotAct, expectRolled }) => {
      const roll = vi.fn();
      vi.mocked(useSimpleDamageRoll).mockReturnValue(roll);
      const stats = createStats({ attacks: [bonusActionAttack] });
      render(<CharBonusActions playerStats={stats} campaignName={CAMPAIGN} onAttackClick={vi.fn()} cannotAct={cannotAct} exhaustionPenalty={0} />);

      const hitCell = screen.getByText('+5');
      expect(hitCell).toHaveClass('clickable');
      if (cannotAct) {
        expect(hitCell).toHaveClass('disabled-attack', 'stat--penalized');
      }
      else {
        expect(hitCell).not.toHaveClass('disabled-attack');
      }

      fireEvent.click(screen.getByText('1d4+3'));
      if (expectRolled) {
        expect(roll).toHaveBeenCalledWith(expect.objectContaining({ name: 'Main Gauche', damage: '1d4+3' }));
      }
      else {
        expect(roll).not.toHaveBeenCalled();
      }
    });
  });

  describe('Horde Breaker conditional row', () => {
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

    function renderBonusActions(props = {}) {
      const stats = createStats({ attacks: [shortswordAttack, hordeBreakerAttack] });
      render(<CharBonusActions playerStats={stats} campaignName={CAMPAIGN} getWeaponMastery={() => null} exhaustionPenalty={0} {...props} />);
    }

    it.each([
      { label: 'no melee weapon hit has readied it', ready: null, visible: [], hidden: ['Horde Breaker', '1d4'] },
      { label: 'it was already used this round', usedRound: 1, visible: [], hidden: ['Horde Breaker'] },
      { label: 'the ready state is from a previous round', ready: { round: 99, targetName: 'Zombie 1', attackName: 'Shortsword' }, visible: [], hidden: ['Horde Breaker'] },
      { label: 'the Hunter\'s Prey choice is Colossus Slayer', choice: 'Colossus Slayer', visible: [], hidden: ['Horde Breaker'] },
      { label: 'a melee weapon hit this round readied it', visible: ['Horde Breaker', '1d6-1'], hidden: ['1d4'] },
    ])('hides/shows the row when $label', ({ choice, ready, usedRound, visible, hidden }) => {
      mockHbRuntime({ choice, ready, usedRound });
      renderBonusActions();
      visible.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
      hidden.forEach((text) => expect(screen.queryByText(text)).not.toBeInTheDocument());
    });

    it('opens a secondary target modal of valid creatures and rolls the attack against the selected one', async () => {
      mockHbRuntime();
      vi.mocked(getCombatContext).mockResolvedValue({
        creatures: [
          { name: 'Zombie 1', currentHp: 10 },
          { name: 'Zombie 2', currentHp: 10 },
          { name: 'Zombie 3', currentHp: 10 },
          { name: 'Zombie 4', currentHp: 0 },
        ],
      });
      vi.mocked(isWithinRange).mockImplementation(async (a, b) => b === 'Zombie 2');
      const rollAttack = vi.fn();
      renderBonusActions({ rollAttack });

      fireEvent.click(screen.getByText('Horde Breaker'));
      await waitFor(() => expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument());
      // Only a living, different creature within range of BOTH the original
      // target and the attacker qualifies (Zombie 3: out of range, 4: dead).
      expect(screen.getByRole('button', { name: 'Zombie 2' })).toBeInTheDocument();
      expect(screen.queryByText('Zombie 3')).not.toBeInTheDocument();
      expect(screen.queryByText('Zombie 4')).not.toBeInTheDocument();

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
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        abilityName: 'Horde Breaker',
        targetName: 'Zombie 2',
      }));
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
      renderBonusActions();

      fireEvent.click(screen.getByText('Horde Breaker'));
      await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
      expect(setPopupHtml.mock.calls[0][0]).toContain('No valid target');
      expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();
    });
  });
});
