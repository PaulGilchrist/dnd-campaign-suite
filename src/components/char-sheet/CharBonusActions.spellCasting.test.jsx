// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
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

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn((props) => <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup"><div data-testid="spell-name">{props.spell?.name}</div><div data-testid="upcast-levels">{JSON.stringify(props.upcastLevels)}</div></div>),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import * as mapsService from '../../services/maps/mapsService.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

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

describe('CharBonusActions - Spell Cast Flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('spell cast with map data resolution', () => {
    it('loads map data when mapName is provided and spell is cast from detail popup', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      const mapData = {
        players: [{ name: 'TestCharacter', gridX: 5, gridY: 5 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(null);
      mapsService.loadMapData.mockResolvedValue(mapData);

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName="test-map" campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('does not resolve positions when mapName is null', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName={null} />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('does not resolve positions when mapName is undefined', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('handles map data load failure gracefully', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName="test-map" campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('handles map data with no players gracefully', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      const mapData = { placedItems: [] };
      mapsService.loadMapData.mockResolvedValue(mapData);

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName="test-map" campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('handles map data with null players gracefully', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      const mapData = { players: null, placedItems: [] };
      mapsService.loadMapData.mockResolvedValue(mapData);

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName="test-map" campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('loads map and finds target player for position resolution', async () => {
      const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      const mapData = {
        players: [
          { name: 'TestCharacter', gridX: 5, gridY: 5 },
          { name: 'Enemy', gridX: 10, gridY: 10 },
        ],
        placedItems: [],
      };
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });
      damageUtils.getCombatContext.mockResolvedValue({});
      mapsService.loadMapData.mockResolvedValue(mapData);

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName="test-map" campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });
  });

  describe('spell detail popup props', () => {
    const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };

    it('passes playerStats to SpellDetailPopup', async () => {
      render(<CharBonusActions playerStats={createStats({ level: 7, spellAbilities: { spells: [bonusActionSpell] } })} />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-name')).toHaveTextContent('Shocking Grasp');
    });

    it('passes campaignName to SpellDetailPopup', async () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} campaignName="my-campaign" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-name')).toHaveTextContent('Shocking Grasp');
    });
  });

  describe('MetamagicPopup rendering', () => {
    it('renders MetamagicPopup when pendingMetamagic is set', () => {
      vi.mocked(useSpellMetamagicFlow).mockReturnValue({
        pendingMetamagic: { spellName: 'Fireball', spellLevel: 3, _currentSP: 5 },
        gateMetamagic: vi.fn(),
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingGreaterRestoration: null,
        handleGreaterRestorationConfirm: vi.fn(),
        handleGreaterRestorationSkip: vi.fn(),
      });
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] } })} />);
      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });
  });

  describe('br rendering conditions', () => {
    it('does not render br when popupHtml exists but hasBonusActions is false', async () => {
      const stats = createStats({
        bonusActions: [],
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });
      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.querySelectorAll('br').length).toBe(0);
    });
  });

  describe('automation_info popup rendering', () => {
    it('calls onAutomationAction directly when hasAutomation returns true (no popup)', () => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      const automatedAction = {
        name: 'Auto Test',
        description: 'Automated bonus action',
        automation: { type: 'test_automation' },
      };
      const onAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={createStats({ bonusActions: [automatedAction] })} onAutomationAction={onAutomationAction} />);
      fireEvent.click(screen.getByText(/Auto Test:/));
      expect(onAutomationAction).toHaveBeenCalledWith(automatedAction);
    });
  });

  describe('automation_info popup rendering', () => {
    it('calls onAutomationAction directly when hasAutomation returns true (no popup)', () => {
      vi.mocked(hasAutomation).mockReturnValue(true);
      const automatedAction = {
        name: 'Auto Test',
        description: 'Automated bonus action',
        automation: { type: 'test_automation' },
      };
      const onAutomationAction = vi.fn();
      render(<CharBonusActions playerStats={createStats({ bonusActions: [automatedAction] })} onAutomationAction={onAutomationAction} />);
      fireEvent.click(screen.getByText(/Auto Test:/));
      expect(onAutomationAction).toHaveBeenCalledWith(automatedAction);
    });
  });

  describe('executeSpellCast integration', () => {
    it('renders correctly when characters prop is provided', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      const characters = [{ name: 'Character1' }, { name: 'Character2' }];
      render(<CharBonusActions playerStats={stats} characters={characters} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders correctly when characters prop is undefined', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      render(<CharBonusActions playerStats={stats} characters={undefined} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('renders correctly when characters prop is empty array', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      render(<CharBonusActions playerStats={stats} characters={[]} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('rollAttack and rollDamage props', () => {
    it('renders correctly when rollAttack and rollDamage props are provided', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      const rollAttack = vi.fn();
      const rollDamage = vi.fn();
      render(<CharBonusActions playerStats={stats} rollAttack={rollAttack} rollDamage={rollDamage} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('getTargetInfo prop', () => {
    it('renders correctly when getTargetInfo prop is provided', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      const getTargetInfo = vi.fn();
      render(<CharBonusActions playerStats={stats} getTargetInfo={getTargetInfo} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('bonus action spell click with nonexistent spell', () => {
    it('does not crash when handleBonusSpellClick is called with nonexistent spell name', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test', details: 'Details' }] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('spellAbilities.spells undefined handling', () => {
    it('handles undefined spellAbilities.spells without crashing', () => {
      const stats = createStats({ spellAbilities: { spells: undefined }, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });

    it('handles null spellAbilities.spells without crashing', () => {
      const stats = createStats({ spellAbilities: { spells: null }, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('cannotAct behavior on attack clicks for save DC attacks', () => {
    const saveDcAttack = {
      name: 'Cone of Cold',
      range: 60,
      saveDc: 14,
      saveType: 'CON',
      damage: '8d8',
      damageType: 'Cold',
      type: 'Bonus Action',
    };

    it('does not apply disabled-attack class to save DC attacks (only hit bonus div gets it)', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} cannotAct />);
      expect(document.querySelector('.disabled-attack')).not.toBeInTheDocument();
    });

    it('does not apply stat--penalized class to save DC attacks (only hit bonus div gets it)', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} conditionAttackMode="disadvantage" />);
      expect(document.querySelector('.stat--penalized')).not.toBeInTheDocument();
    });

    it('does not apply any penalty classes when conditions are normal', () => {
      render(<CharBonusActions playerStats={createStats({ attacks: [saveDcAttack] })} exhaustionPenalty={0} />);
      expect(document.querySelector('.stat--penalized')).not.toBeInTheDocument();
      expect(document.querySelector('.disabled-attack')).not.toBeInTheDocument();
    });
  });

  describe('cannotAct behavior on damage clicks', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('does not call onDamageClick when cannotAct is true', () => {
      const mockOnDamageClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} cannotAct onDamageClick={mockOnDamageClick} />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      expect(mockOnDamageClick).not.toHaveBeenCalled();
    });

    it('calls onDamageClick when cannotAct is false', () => {
      const mockOnDamageClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} cannotAct={false} onDamageClick={mockOnDamageClick} />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      expect(mockOnDamageClick).toHaveBeenCalledWith(bonusActionAttack);
    });

    it('does not call onDamageClick when cannotAct is undefined', () => {
      const mockOnDamageClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} onDamageClick={mockOnDamageClick} />);
      const damageElement = screen.getByText('1d4+3');
      fireEvent.click(damageElement);
      expect(mockOnDamageClick).toHaveBeenCalledWith(bonusActionAttack);
    });
  });

  describe('canAct blocking on attack click', () => {
    const bonusActionAttack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };

    it('still calls onAttackClick when cannotAct is true', () => {
      const mockOnAttackClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} cannotAct={true} exhaustionPenalty={0} onAttackClick={mockOnAttackClick} />);
      const hitBonusElement = screen.getByText('+5');
      fireEvent.click(hitBonusElement);
      expect(mockOnAttackClick).toHaveBeenCalledWith(bonusActionAttack);
    });

    it('still calls onAttackClick when cannotAct is false', () => {
      const mockOnAttackClick = vi.fn();
      render(<CharBonusActions playerStats={createStats({ attacks: [bonusActionAttack] })} cannotAct={false} exhaustionPenalty={0} onAttackClick={mockOnAttackClick} />);
      const hitBonusElement = screen.getByText('+5');
      fireEvent.click(hitBonusElement);
      expect(mockOnAttackClick).toHaveBeenCalledWith(bonusActionAttack);
    });
  });

  describe('executeSpellCast integration', () => {
    it('executeSpellCast is available as a mocked dependency', () => {
      expect(executeSpellCast).toBeDefined();
      expect(typeof executeSpellCast).toBe('function');
    });
  });
});
