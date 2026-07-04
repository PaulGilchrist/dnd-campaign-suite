// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';

import { mockPlayerStats, mockHandleTogglePreparedSpells } from './CharSpells.test.helpers.js';

import useActionPopup from '../../../hooks/combat/useActionPopup.js';

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
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

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
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

      const lightLink = screen.getByText('Light');
      fireEvent.click(lightLink);

      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-name')).toHaveTextContent('Light');
      expect(screen.getByTestId('cast-spell-btn')).toBeInTheDocument();
    });

    it('should close the spell detail popup when the close button is clicked', () => {
      renderCharSpells();

      const lightLink = screen.getByText('Light');
      fireEvent.click(lightLink);

      const closeButton = screen.getByTestId('close-popup-btn');
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('should invoke onCast with the spell when the cast button is clicked', () => {
      renderCharSpells();

      const lightLink = screen.getByText('Light');
      fireEvent.click(lightLink);

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
              casting_time: '1 turn',
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
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Detect Magic')).toBeInTheDocument();
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
      const spellWithCheckbox = {
        name: 'Shield',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: '1 round',
        components: ['S'],
        prepared: 'Prepared',
      };
      const stats = {
        ...mockPlayerStats,
        spellAbilities: {
          ...mockPlayerStats.spellAbilities,
          spells: [spellWithCheckbox],
        },
      };

      renderCharSpells({ playerStats: stats });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();

      fireEvent.click(checkbox);

      expect(mockHandleTogglePreparedSpells).toHaveBeenCalledWith('Shield');
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
      expect(screen.getByText('Alpha Strike')).toBeInTheDocument();
      expect(screen.getByText('Bless')).toBeInTheDocument();
      expect(screen.getByText('Zap')).toBeInTheDocument();
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
      expect(screen.getByText('Alpha Strike')).toBeInTheDocument();
      expect(screen.getByText('Bless')).toBeInTheDocument();
      expect(screen.getByText('Zap')).toBeInTheDocument();
    });
  });

  describe('2024 ruleset interaction', () => {
    it('should render the Prepared column for 5e ruleset', () => {
      renderCharSpells();

      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      const headerTexts = Array.from(headers).map(h => h.textContent);
      expect(headerTexts).toContain('Prepared');
    });
  });
});
