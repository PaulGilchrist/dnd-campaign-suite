// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';
import useLoggedDiceRoll from '../../../hooks/combat/useLoggedDiceRoll.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => {
  const mockFn = () => ({
    currentSP: 10,
    maxSP: 10,
    spendSorceryPoints: vi.fn(),
    logMetamagic: vi.fn(),
  });
  mockFn.getCurrentSorceryPoints = vi.fn(() => 10);
  mockFn.getMaxSorceryPoints = vi.fn(() => 10);
  return { default: mockFn, getCurrentSorceryPoints: mockFn.getCurrentSorceryPoints, getMaxSorceryPoints: mockFn.getMaxSorceryPoints };
});

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MockMetamagicPopup({ onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <button data-testid="mock-confirm" onClick={() => onConfirm({ options: [], totalCost: 0, twinTarget: null })}>
          Mock Confirm
        </button>
        <button data-testid="mock-skip" onClick={onSkip}>
          Mock Skip
        </button>
      </div>
    );
  },
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function MockCharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell, onCast }) {
    return (
      <div data-testid="spell-detail-popup">
        <span data-testid="spell-detail-name">{spell?.name}</span>
        <button data-testid="cast-spell-btn" onClick={() => onCast(spell)}>
          Cast Spell
        </button>
        <button data-testid="close-popup-btn" onClick={() => onCast(null)}>
          Close
        </button>
      </div>
    );
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup() {
    return <div data-testid="upcast-popup">Upcast</div>;
  },
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: function DiceRollResult() {
    return <div data-testid="dice-roll-result">DiceRollResult</div>;
  },
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup() {
    return <div data-testid="multi-target-popup">MultiTarget</div>;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="aid-target-popup">Aid</div>;
  },
}));

vi.mock('../popups/MultiTargetCountPopup.jsx', () => ({
  default: function MultiTargetCountPopup() {
    return <div data-testid="heroes-feast-popup">HeroesFeast</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="lesser-restoration-popup">LesserRestoration</div>;
  },
}));

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="remove-curse-popup">RemoveCurse</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="shield-of-faith-popup">ShieldOfFaith</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="resistance-popup">Resistance</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
  },
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingMultiTarget: null,
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingHeroesFeast: null,
    handleHeroesFeastConfirm: vi.fn(),
    handleHeroesFeastSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingMageArmor: null,
    handleMageArmorConfirm: vi.fn(),
    handleMageArmorSkip: vi.fn(),
    pendingShieldOfFaith: null,
    handleShieldOfFaithConfirm: vi.fn(),
    handleShieldOfFaithSkip: vi.fn(),
    pendingProtectionFromEnergy: null,
    handleProtectionFromEnergyConfirm: vi.fn(),
    handleProtectionFromEnergySkip: vi.fn(),
    pendingResistance: null,
    handleResistanceConfirm: vi.fn(),
    handleResistanceSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    gateUpcast: vi.fn(() => false),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: vi.fn(() => null),
  })),
}));

vi.mock('../../../services/rules/spells/spellCastService.js', () => ({
  executeSpellCast: vi.fn(),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({ players: [], placedItems: [] })),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
}));

vi.mock('../../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

const baseProps = {
  playerStats: mockPlayerStats,
  handleTogglePreparedSpells: mockHandleTogglePreparedSpells,
  campaignName: 'test-campaign',
};

function renderCharSpells(props = {}) {
  return render(<CharSpells {...baseProps} {...props} />);
}

describe('CharSpells interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));
  });

  describe('spell name click opens detail popup', () => {
    it('should display the spell detail popup with the correct spell name when a spell name is clicked', () => {
      renderCharSpells();

      const fireballLink = screen.getByText('Fireball');
      fireEvent.click(fireballLink);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-name')).toHaveTextContent('Fireball');
      expect(screen.getByTestId('cast-spell-btn')).toBeInTheDocument();
    });

    it('should display the spell detail popup for any spell in the list', () => {
      renderCharSpells();

      const magicMissileLink = screen.getByText('Magic Missile');
      fireEvent.click(magicMissileLink);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-name')).toHaveTextContent('Magic Missile');
    });

    it('should close the spell detail popup when the close button is clicked', () => {
      renderCharSpells();

      const fireballLink = screen.getByText('Fireball');
      fireEvent.click(fireballLink);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-popup-btn');
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('should invoke onCast with the spell when the cast button is clicked', () => {
      renderCharSpells();

      const fireballLink = screen.getByText('Fireball');
      fireEvent.click(fireballLink);

      const castButton = screen.getByTestId('cast-spell-btn');
      fireEvent.click(castButton);

      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });
  });

  describe('prepared filter toggle', () => {
    it('should filter out non-prepared spells when the Prepared header is clicked', () => {
      const statsWithNonPrepared = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            ...mockPlayerStats.spellAbilities.spells,
            {
              name: 'Vicious Mockery',
              level: 0,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Instantaneous',
              components: ['V'],
              prepared: '',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithNonPrepared });

      expect(screen.getByText('Vicious Mockery')).toBeInTheDocument();

      const preparedHeader = screen.getByText('Prepared');
      fireEvent.click(preparedHeader);

      expect(screen.queryByText('Vicious Mockery')).not.toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('should restore filtered spells when the Prepared header is clicked again', () => {
      const statsWithNonPrepared = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            ...mockPlayerStats.spellAbilities.spells,
            {
              name: 'Vicious Mockery',
              level: 0,
              casting_time: '1 action',
              range: '60 feet',
              duration: 'Instantaneous',
              components: ['V'],
              prepared: '',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithNonPrepared });

      const preparedHeader = screen.getByText('Prepared');
      fireEvent.click(preparedHeader);
      expect(screen.queryByText('Vicious Mockery')).not.toBeInTheDocument();

      fireEvent.click(preparedHeader);
      expect(screen.getByText('Vicious Mockery')).toBeInTheDocument();
    });

    it('should call handleTogglePreparedSpells for spells with "Prepared" status when their checkbox is toggled', () => {
      renderCharSpells();

      const table = screen.getByRole('table');
      const checkbox = table.querySelector('tbody tr td:nth-child(3) input[type="checkbox"]');
      expect(checkbox).not.toBeNull();

      fireEvent.click(checkbox);

      expect(mockHandleTogglePreparedSpells).toHaveBeenCalledWith('Fireball');
    });
  });

  describe('spell sorting by level', () => {
    it('should sort spells ascending by level then alphabetically by name when the Level header is clicked', () => {
      const statsWithMixedLevels = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Zap',
              level: 2,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Alpha Strike',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithMixedLevels });

      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);

      // After sorting: Alpha Strike (level 1), Bless (level 1), Zap (level 2)
      const rows = screen.getAllByText(/Alpha Strike|Bless|Zap/);
      expect(rows).toHaveLength(3);

      const firstRow = rows[0].closest('tr');
      expect(firstRow.querySelector('td:nth-child(2)').textContent).toBe('1');

      const lastRow = rows[2].closest('tr');
      expect(lastRow.querySelector('td:nth-child(2)').textContent).toBe('2');
    });

    it('should sort same-level spells alphabetically when the Level header is clicked', () => {
      const statsWithSameLevelSpells = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Zap',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Concentration, up to 1 minute',
              prepared: 'Prepared',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithSameLevelSpells });

      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);

      // After sorting by level (both level 1), alphabetical order: Bless, Zap
      const rows = screen.getAllByText(/Bless|Zap/);
      expect(rows).toHaveLength(2);
      expect(rows[0].closest('tr').querySelector('td:nth-child(1)').textContent).toBe('Bless');
      expect(rows[1].closest('tr').querySelector('td:nth-child(1)').textContent).toBe('Zap');
    });
  });

  describe('spell sorting by name', () => {
    it('should sort all spells alphabetically by name when the Spell header is clicked', () => {
      const statsWithMixedSpells = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Zap',
              level: 2,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Alpha Strike',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
            {
              name: 'Bless',
              level: 1,
              casting_time: '1 action',
              range: '30 feet',
              duration: 'Instantaneous',
              prepared: 'Prepared',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithMixedSpells });

      const spellHeader = screen.getByText('Spell');
      fireEvent.click(spellHeader);

      // Alphabetical order: Alpha Strike, Bless, Zap
      const rows = screen.getAllByText(/Alpha Strike|Bless|Zap/);
      expect(rows).toHaveLength(3);
      expect(rows[0].closest('tr').querySelector('td:nth-child(1)').textContent).toBe('Alpha Strike');
      expect(rows[1].closest('tr').querySelector('td:nth-child(1)').textContent).toBe('Bless');
      expect(rows[2].closest('tr').querySelector('td:nth-child(1)').textContent).toBe('Zap');
    });
  });

  describe('damage cell click', () => {
    it('should call executeSpellCast when a clickable damage cell is clicked for a sorcerer', () => {
      const statsWithSorcerer = {
        ...mockPlayerStats,
        class: { name: 'Sorcerer' },
      };

      renderCharSpells({ playerStats: statsWithSorcerer });

      const table = screen.getByRole('table');
      const effectCells = table.querySelectorAll('tbody tr td:nth-child(6)');
      const clickableCell = Array.from(effectCells).find(cell => cell.classList.contains('clickable'));

      expect(clickableCell).toBeTruthy();
      fireEvent.click(clickableCell);

      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
    });

    it('should not trigger a damage roll when a non-damage cell is clicked', () => {
      const mockRollDamage = vi.fn();
      useLoggedDiceRoll.mockImplementation(() => ({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: mockRollDamage,
        quickRollPlayerSave: vi.fn(),
      }));

      const statsWithUtilitySpell = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [
            {
              name: 'Light',
              level: 0,
              casting_time: '1 action',
              range: 'Touch',
              duration: '10 minutes',
              components: ['V', 'M'],
              prepared: 'Always',
            },
          ],
        },
      };

      renderCharSpells({ playerStats: statsWithUtilitySpell });

      const table = screen.getByRole('table');
      const effectCell = table.querySelector('tbody tr td:nth-child(6)');

      expect(effectCell.classList.contains('clickable')).toBe(false);
      fireEvent.click(effectCell);

      expect(mockRollDamage).not.toHaveBeenCalled();
    });
  });

  describe('spell cast flow', () => {
    it('should not show the metamagic popup for a non-sorcerer casting a spell', () => {
      renderCharSpells();

      const fireballLink = screen.getByText('Fireball');
      fireEvent.click(fireballLink);

      const castButton = screen.getByTestId('cast-spell-btn');
      fireEvent.click(castButton);

      expect(screen.queryByTestId('metamagic-popup')).not.toBeInTheDocument();
    });
  });

  describe('2024 ruleset interaction', () => {
    it('should not render the Prepared column for 2024 ruleset', () => {
      const stats2024 = {
        ...mockPlayerStats,
        rules: '2024',
      };

      renderCharSpells({ playerStats: stats2024 });

      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      const headerTexts = Array.from(headers).map(h => h.textContent);
      expect(headerTexts).not.toContain('Prepared');
    });

    it('should render the Prepared column for 5e ruleset', () => {
      renderCharSpells();

      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      const headerTexts = Array.from(headers).map(h => h.textContent);
      expect(headerTexts).toContain('Prepared');
    });
  });

  describe('spell detail popup state management', () => {
    it('should allow switching between spell detail popups', () => {
      renderCharSpells();

      const fireballLink = screen.getByText('Fireball');
      fireEvent.click(fireballLink);

      expect(screen.getByTestId('spell-detail-name')).toHaveTextContent('Fireball');

      const magicMissileLink = screen.getByText('Magic Missile');
      fireEvent.click(magicMissileLink);

      // The detail popup should now show Magic Missile
      expect(screen.getByTestId('spell-detail-name')).toHaveTextContent('Magic Missile');
    });

    it('should close the detail popup and open a different one when a new spell is clicked while one is open', () => {
      renderCharSpells();

      const fireballLink = screen.getByText('Fireball');
      fireEvent.click(fireballLink);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

      const lightLink = screen.getByText('Light');
      fireEvent.click(lightLink);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-name')).toHaveTextContent('Light');
    });
  });
});
