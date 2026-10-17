// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

const { setPopupHtmlMock } = vi.hoisted(() => ({ setPopupHtmlMock: vi.fn() }));

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
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: setPopupHtmlMock })),
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
  default: vi.fn((props) => <div data-testid="secondary-target-modal">{props.title}</div>),
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

import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';

const CAMPAIGN = 'test-campaign';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharBonusActions - Interactive', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('bonus feature rows', () => {
    const automatedRow = {
      name: 'War Priest',
      description: 'You can make one weapon attack as a bonus action.',
      automation: { type: 'bonus_action_attack', trigger: 'after_action' },
    };
    const detailsRow = { name: 'Cunning Action', description: 'Dash, Hide, or Disengage.', details: 'Quick movement.' };
    const inertRow = { name: 'Quiet Prayer', description: 'A quiet prayer.' };

    // Runtime resource keys (e.g. ragePoints for a consumable rage feature)
    // are never consulted by this lane — a row with automation is always
    // clickable and always dispatches; the handler enforces resource rules.
    it.each([
      { label: 'automated rows dispatch the row payload, ignoring runtime resource state', row: automatedRow, automated: true, outcome: 'dispatch' },
      { label: 'non-automated rows with details open the feature detail popup', row: detailsRow, automated: false, outcome: 'popup' },
      { label: 'rows with neither automation nor details are inert', row: inertRow, automated: false, outcome: 'inert' },
    ])('$label', ({ row, automated, outcome }) => {
      vi.mocked(hasAutomation).mockReturnValue(automated);
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => (key === 'ragePoints' ? 0 : null));
      const onAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={createStats({ bonusActions: [row] })} campaignName={CAMPAIGN} onAutomationAction={onAutomationAction} />);

      const nameCell = screen.getByText(`${row.name}:`);
      fireEvent.click(nameCell);

      if (outcome === 'dispatch') {
        expect(nameCell).toHaveClass('clickable');
        expect(onAutomationAction).toHaveBeenCalledWith(row);
        expect(setPopupHtmlMock).not.toHaveBeenCalled();
      } else if (outcome === 'popup') {
        expect(nameCell).toHaveClass('clickable');
        expect(onAutomationAction).not.toHaveBeenCalled();
        expect(setPopupHtmlMock).toHaveBeenCalledWith(expect.stringContaining('Quick movement.'));
      } else {
        expect(nameCell).not.toHaveClass('clickable');
        expect(onAutomationAction).not.toHaveBeenCalled();
      }
    });
  });

  describe('bonus attack row click lanes', () => {
    it('dispatches onAttackClick when the hit bonus is clicked', () => {
      const attack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };
      const onAttackClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [attack] })} campaignName={CAMPAIGN} onAttackClick={onAttackClick} exhaustionPenalty={0} />);

      const hitCell = screen.getByText('+5');
      expect(hitCell).toHaveClass('clickable');
      fireEvent.click(hitCell);
      expect(onAttackClick).toHaveBeenCalledWith(attack);
    });

    it('dispatches onResolveSpellDamage when a save DC attack\'s damage is clicked', () => {
      const saveDcAttack = { name: 'Cone of Cold', range: 60, saveDc: 14, saveType: 'CON', damage: '8d8', damageType: 'Cold', type: 'Bonus Action' };
      const onResolveSpellDamage = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} campaignName={CAMPAIGN} onResolveSpellDamage={onResolveSpellDamage} />);

      // Hit column shows the save DC instead of a to-hit bonus.
      expect(screen.getByText('DC 14 CON')).toBeInTheDocument();
      fireEvent.click(screen.getByText('8d8'));
      expect(onResolveSpellDamage).toHaveBeenCalledWith(saveDcAttack);
    });
  });

  describe('Eat Bolstering Treat row', () => {
    function mockTreatCounts(bolstering, chef) {
      const counts = { bolsteringTreat: bolstering, chefBolsteringTreats: chef };
      vi.mocked(useRuntimeValue).mockImplementation((name, key) => counts[key] ?? null);
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => counts[key] ?? null);
    }

    it.each([
      { bolstering: 2, chef: 0, show: true },
      { bolstering: 0, chef: 1, show: true },
      { bolstering: 0, chef: 0, show: false },
    ])('visible when bolsteringTreat=$bolstering chefBolsteringTreats=$chef is $show', ({ bolstering, chef, show }) => {
      mockTreatCounts(bolstering, chef);
      render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'TestFeature', description: 'test' }] })} campaignName={CAMPAIGN} />);
      expect(!!screen.queryByText('Eat Bolstering Treat:')).toBe(show);
    });

    it.each([
      { label: 'regular treat spends a bolsteringTreat', bolstering: 2, chef: 0, cannotAct: false, spentKey: 'bolsteringTreat', remaining: 1 },
      { label: 'chef count takes precedence', bolstering: 2, chef: 2, cannotAct: false, spentKey: 'chefBolsteringTreats', remaining: 1 },
      { label: 'cannotAct blocks all consumption', bolstering: 2, chef: 0, cannotAct: true, spentKey: null },
    ])('click: $label', async ({ bolstering, chef, cannotAct, spentKey, remaining }) => {
      mockTreatCounts(bolstering, chef);
      const stats = createStats({ proficiency: 3, bonusActions: [{ name: 'TestFeature', description: 'test' }] });
      render(<CharBonusActions playerStats={stats} campaignName={CAMPAIGN} cannotAct={cannotAct} />);
      fireEvent.click(screen.getByText('Eat Bolstering Treat:'));

      if (spentKey) {
        await waitFor(() => {
          expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', spentKey, remaining, CAMPAIGN);
        });
        expect(setTempHp).toHaveBeenCalledWith('TestCharacter', 3, CAMPAIGN);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ type: 'ability_use', abilityName: 'Bolstering Treat' }));
      } else {
        expect(setTempHp).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
      }
    });
  });

  describe('Apply Poison row', () => {
    const poisonStats = () => createStats({
      name: 'PoisonCharacter',
      proficiency: 3,
      abilities: [{ name: 'Dexterity', bonus: 3 }, { name: 'Intelligence', bonus: 1 }],
      automation: { bonusActions: [{ type: 'apply_poison', name: 'Apply Poison' }] },
      bonusActions: [{ name: 'TestFeature', description: 'test' }],
    });

    function mockPoisonDoses(doses) {
      vi.mocked(useRuntimeValue).mockImplementation((name, key) => (key === 'poisonDoses' ? doses : null));
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => (key === 'poisonDoses' ? doses : null));
    }

    it.each([
      { doses: 3, cannotAct: false, show: true },
      { doses: 0, cannotAct: false, show: false },
      { doses: 3, cannotAct: true, show: false },
    ])('visible when doses=$doses cannotAct=$cannotAct is $show', ({ doses, cannotAct, show }) => {
      mockPoisonDoses(doses);
      render(<CharBonusActions playerStats={poisonStats()} campaignName={CAMPAIGN} cannotAct={cannotAct} />);
      expect(!!screen.queryByText('Apply Poison:')).toBe(show);
      if (show) {
        // DC = 8 + max(DEX 3, INT 1) + proficiency 3 — pins the higher-ability pick.
        expect(screen.getByText(/CON save \(DC 14\)/)).toBeInTheDocument();
      }
    });

    it('click spends a dose, arms poisoned weapons, and logs the use', async () => {
      mockPoisonDoses(2);
      render(<CharBonusActions playerStats={poisonStats()} campaignName={CAMPAIGN} />);
      fireEvent.click(screen.getByText('Apply Poison:'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('PoisonCharacter', 'poisonDoses', 1, CAMPAIGN);
      });
      expect(setRuntimeValue).toHaveBeenCalledWith('PoisonCharacter', 'poisonedWeaponsActive', true, CAMPAIGN);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ type: 'ability_use', abilityName: 'Apply Poison' }));
    });
  });

  describe('Sacred Weapon hit bonus on bonus attacks', () => {
    it.each([
      { label: 'adds CHA to melee attacks', weaponType: 'melee', cha: 4, hasBuff: true, hit: '+9', title: 'Base: +5, Sacred Weapon: +4' },
      { label: 'adds CHA to unarmed attacks', weaponType: 'unarmed', cha: 4, hasBuff: true, hit: '+9', title: 'Base: +5, Sacred Weapon: +4' },
      { label: 'does not add CHA to ranged attacks', weaponType: 'ranged', cha: 4, hasBuff: true, hit: '+5', title: null },
      { label: 'adds nothing when the buff is inactive', weaponType: 'melee', cha: 4, hasBuff: false, hit: '+5', title: null },
      { label: 'CHA 0 still grants the rules minimum of +1', weaponType: 'melee', cha: 0, hasBuff: true, hit: '+6', title: 'Base: +5, Sacred Weapon: +1' },
    ])('$label', ({ weaponType, cha, hasBuff, hit, title }) => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => (key === 'activeBuffs' && hasBuff ? [{ effect: 'sacred_weapon' }] : null));
      const stats = createStats({
        abilities: [{ name: 'Charisma', bonus: cha }],
        attacks: [{ name: 'Rapier', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Piercing', type: 'Bonus Action', weaponType }],
      });
      render(<CharBonusActions playerStats={stats} campaignName={CAMPAIGN} exhaustionPenalty={0} />);

      const hitCell = screen.getByText(hit);
      expect(hitCell).toBeInTheDocument();
      if (title) {
        expect(hitCell).toHaveAttribute('title', title);
      } else {
        expect(hitCell).not.toHaveAttribute('title');
      }
    });
  });
});
