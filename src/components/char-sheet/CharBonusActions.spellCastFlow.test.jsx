// @improved-by-ai
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

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => {
    return (
      <div data-testid="spell-detail-popup">
        <div data-testid="spell-name">{props.spell?.name}</div>
        <div data-testid="upcast-levels">{JSON.stringify(props.upcastLevels)}</div>
        {props.onClose && <button data-testid="close-btn" onClick={props.onClose}>Close</button>}
        {props.onCast && <button data-testid="cast-btn" onClick={() => props.onCast(props.spell, {})}>Cast</button>}
      </div>
    );
  }),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
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

  describe('spell casting from detail popup', () => {
    const bonusActionSpell = { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };

    it('clears selectedBonusSpell and closes popup when spell is cast', async () => {
      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

      const castBtn = screen.getByTestId('cast-btn');
      fireEvent.click(castBtn);
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('resolves spell positions when mapName is provided', async () => {
      const mapData = {
        players: [
          { name: 'TestCharacter', gridX: 5, gridY: 5 },
          { name: 'Enemy', gridX: 10, gridY: 10 },
        ],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue({});
      damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });
      mapsService.loadMapData.mockResolvedValue(mapData);

      const mockGateMetamagic = vi.fn();
      vi.mocked(useSpellMetamagicFlow).mockReturnValue({
        pendingMetamagic: null,
        gateMetamagic: mockGateMetamagic,
        handleConfirm: vi.fn(),
        handleSkip: vi.fn(),
        pendingAid: null,
        handleAidConfirm: vi.fn(),
        handleAidSkip: vi.fn(),
        pendingGreaterRestoration: null,
        handleGreaterRestorationConfirm: vi.fn(),
        handleGreaterRestorationSkip: vi.fn(),
      });

      render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [bonusActionSpell] } })} mapName="test-map" campaignName="test" />);
      const spellLink = screen.getByText('Shocking Grasp');
      fireEvent.click(spellLink);

      const castBtn = screen.getByTestId('cast-btn');
      fireEvent.click(castBtn);

      await waitFor(() => {
        expect(mockGateMetamagic).toHaveBeenCalled();
      });
    });
  });

  describe('popupHtml and br rendering', () => {
    it('does not render br when popupHtml is null (default mock)', () => {
      const stats = createStats({
        bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }],
      });
      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.querySelectorAll('br').length).toBe(0);
    });

    it('does not render br when popupHtml is truthy but hasBonusActions is false', () => {
      const stats = createStats({
        bonusActions: [],
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
      });
      const { container } = render(<CharBonusActions playerStats={stats} />);
      expect(container.querySelectorAll('br').length).toBe(0);
    });
  });

  describe('isActionSpell filtering', () => {
    it('does not render non-bonus-action spells', () => {
      const spells = [
        { name: 'Fireball', range: '150 ft.', casting_time: '1 action', prepared: 'Prepared' },
        { name: 'Reaction Spell', range: '60 ft.', casting_time: '1 reaction', prepared: 'Prepared' },
        { name: 'Empty Casting Time', range: 'Touch', casting_time: '', prepared: 'Prepared' },
        { name: 'Undefined Casting Time', range: 'Touch', casting_time: undefined, prepared: 'Prepared' },
      ];
      const stats = createStats({ spellAbilities: { spells } });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
      expect(screen.queryByText('Reaction Spell')).not.toBeInTheDocument();
      expect(screen.queryByText('Empty Casting Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Undefined Casting Time')).not.toBeInTheDocument();
    });
  });

  describe('Horde Breaker visibility', () => {
    const hordeBreakerAttack = {
      name: 'Horde Breaker',
      range: 30,
      hitBonus: 5,
      damage: '1d8+3',
      damageType: 'Piercing',
      type: 'Bonus Action',
      isHordeBreaker: true,
    };

    it('does not show Horde Breaker when cannotAct is true', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === "_Hunter's Prey_choice") return 'Horde Breaker';
        if (key === '_Hunters_Prey_HordeBreaker_UsedRound') return 0;
        return null;
      });
      render(<CharBonusActions playerStats={createStats({ attacks: [hordeBreakerAttack] })} campaignName="test" cannotAct />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('does not show Horde Breaker when Hunter\'s Prey is not set to Horde Breaker', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === "_Hunter's Prey_choice") return 'Something Else';
        if (key === '_Hunters_Prey_HordeBreaker_UsedRound') return 0;
        return null;
      });
      render(<CharBonusActions playerStats={createStats({ attacks: [hordeBreakerAttack] })} campaignName="test" />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });

    it('does not show Horde Breaker when hordeBreakerAttack is not found', () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === "_Hunter's Prey_choice") return 'Horde Breaker';
        if (key === '_Hunters_Prey_HordeBreaker_UsedRound') return 0;
        return null;
      });
      render(<CharBonusActions playerStats={createStats({ attacks: [] })} campaignName="test" />);
      expect(screen.queryByText('Horde Breaker')).not.toBeInTheDocument();
    });
  });

  describe('spells matching attack names', () => {
    it('renders both spell and attack when they share the same name', () => {
      const spell = { name: 'Main Gauche', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' };
      const attack = { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' };
      render(<CharBonusActions playerStats={createStats({ attacks: [attack], spellAbilities: { spells: [spell] } })} />);
      expect(screen.getAllByText('Main Gauche').length).toBe(2);
    });
  });

  describe('grid layout', () => {
    it('renders hit/damage columns when only spells exist', () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] },
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Hit')).toBeInTheDocument();
      expect(screen.getByText('Damage')).toBeInTheDocument();
    });

    it('renders half-line div between attacks/spells and bonus actions', () => {
      const stats = createStats({
        attacks: [{ name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' }],
        bonusActions: [{ name: 'Cunning Action', description: 'Test', details: 'Test details' }],
      });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('null spellAbilities handling', () => {
    it('handles null spellAbilities without crashing', () => {
      const stats = createStats({ spellAbilities: null, bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      render(<CharBonusActions playerStats={stats} />);
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });

  describe('full prop combinations', () => {
    it('renders correctly with all props provided', () => {
      const stats = createStats({ bonusActions: [{ name: 'Test', description: 'Test desc', details: 'Test details' }] });
      const characters = [{ name: 'Character1' }];
      const rollAttack = vi.fn();
      const rollDamage = vi.fn();
      const getTargetInfo = vi.fn();
      render(
        <CharBonusActions
          playerStats={stats}
          characters={characters}
          rollAttack={rollAttack}
          rollDamage={rollDamage}
          getTargetInfo={getTargetInfo}
          campaignName="test"
          mapName="test-map"
        />
      );
      expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
    });
  });
});
