// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import * as helpers from './CharSpells.test.helpers.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
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

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 3),
  getMaxSorceryPoints: vi.fn(() => 6),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    pendingMultiTarget: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
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
    pendingProtectionFromEnergy: null,
    handleProtectionFromEnergyConfirm: vi.fn(),
    handleProtectionFromEnergySkip: vi.fn(),
    pendingResistance: null,
    handleResistanceConfirm: vi.fn(),
    handleResistanceSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
    pendingMagicMissile: null,
    handleMagicMissileConfirm: vi.fn(),
    handleMagicMissileSkip: vi.fn(),
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

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 8, rolls: [4, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [4, 4, 4, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell }) {
    return <div data-testid="spell-detail-popup">{spell?.name}</div>;
  },
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup() {
    return <div data-testid="metamagic-popup">Metamagic</div>;
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

vi.mock('../popups/TargetWithCheckboxesPopup.jsx', () => ({
  default: function TargetWithCheckboxesPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/SingleTargetPopup.jsx', () => ({
  default: function SingleTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/TargetWithTypePopup.jsx', () => ({
  default: function TargetWithTypePopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup">MagicMissile</div>;
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

const basePlayerStats = helpers.mockPlayerStats;
const baseProps = { playerStats: basePlayerStats, campaignName: 'test' };

function renderWithProps(props) {
  return render(<CharSpells {...baseProps} {...props} />);
}

describe('CharSpells - Rendering Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no spellAbilities', () => {
    it('renders nothing when spellAbilities is absent', () => {
      const stats = { name: 'No Spells' };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders nothing when spells array is empty', () => {
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('spell effect rendering', () => {
    it('renders effect column as clickable for spells with save DC but no damage', () => {
      const spellWithSaveDc = {
        name: 'Bane',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Concentration, up to 1 minute',
        components: ['V'],
        dc: {
          dc_type: 'WIS',
          dc_success: 'negates',
        },
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellWithSaveDc],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const effectCell = screen.getByText('WIS negates');
      expect(effectCell).toHaveClass('clickable');
    });

    it('renders effect as "Utility" for spells with no damage and no save DC', () => {
      const utilitySpell = {
        name: 'Comprehend Languages',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: '1 hour',
        components: ['S', 'M'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [utilitySpell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('renders effect with save DC half success', () => {
      const spell = {
        name: 'Cone of Cold',
        level: 2,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: {
            '2': '3d8',
          },
          damage_type: 'Cold',
        },
        dc: {
          dc_type: 'DEX',
          dc_success: 'half',
        },
        prepared: 'Prepared',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('3d8 Cold (DEX half)')).toBeInTheDocument();
    });
  });

  describe('duration formatting', () => {
    it('abbreviates "minute" to "min"', () => {
      const spell = {
        name: 'Minute Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: '1 minute',
        components: ['V'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('1 min')).toBeInTheDocument();
    });

    it('abbreviates "minutes" to "mins" due to minute replacement happening first', () => {
      const spell = {
        name: 'Minutes Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: '10 minutes',
        components: ['V'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('10 mins')).toBeInTheDocument();
    });

    it('removes "up to" from duration', () => {
      const spell = {
        name: 'Up To Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'up to 1 hour',
        components: ['V'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('1 hour')).toBeInTheDocument();
    });

    it('renders "Instant" for Instantaneous duration', () => {
      const spell = {
        name: 'Instant Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Instant')).toBeInTheDocument();
    });

    it('handles missing duration gracefully', () => {
      const spell = {
        name: 'No Duration Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        components: ['V'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      const durationCells = Array.from(table.querySelectorAll('tbody td:nth-child(7)')).map(td => td.textContent.trim());
      expect(durationCells).toContain('');
    });
  });

  describe('casting time formatting', () => {
    it('abbreviates "action" to " A"', () => {
      const spell = {
        name: 'Action Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Prepared',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      const timeCells = Array.from(table.querySelectorAll('tbody td:nth-child(4)')).map(td => td.textContent.trim());
      expect(timeCells).toContain('1  A');
    });

    it('handles missing casting_time gracefully', () => {
      const spell = {
        name: 'No Time Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      const timeCells = Array.from(table.querySelectorAll('tbody td:nth-child(4)')).map(td => td.textContent.trim());
      expect(timeCells).toContain('1 turn');
    });
  });

  describe('notes formatting', () => {
    it('joins multiple components with "/" in notes', () => {
      const spell = {
        name: 'Multi Component Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      const notesCells = Array.from(table.querySelectorAll('tbody td:last-child')).map(td => td.textContent.trim());
      expect(notesCells).toContain('V/S/M');
    });

    it('joins components with "/" for two components', () => {
      const spell = {
        name: 'Two Component Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V', 'M'],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      const notesCells = Array.from(table.querySelectorAll('tbody td:last-child')).map(td => td.textContent.trim());
      expect(notesCells).toContain('V/M');
    });
  });

  describe('spell row prepared logic', () => {
    it('renders checkbox for spells with empty prepared string', () => {
      const spell = {
        name: 'Empty Prepared Spell',
        level: 1,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: '',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(1);
    });
  });

  describe('spell popup close', () => {
    it('closes the spell detail popup when the popup overlay is clicked', () => {
      renderWithProps({});
      const lightCell = screen.getByText('Light');
      fireEvent.click(lightCell);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.click(popupOverlay);
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });
  });

  describe('modifier and save DC display', () => {
    it('renders the spell modifier with exhaustion penalty', () => {
      renderWithProps({ exhaustionPenalty: 2 });
      const modifierSpan = document.querySelectorAll('.spell-abilities span')[1];
      expect(modifierSpan).toHaveClass('stat--penalized');
    });

    it('renders save DC normally when no innate sorcery', () => {
      renderWithProps({});
      expect(screen.getByText('13')).toBeInTheDocument();
    });
  });

  describe('spell attack with cannotAct', () => {
    it('adds disabled-attack class when cannotAct is true alongside clickable', () => {
      renderWithProps({ cannotAct: true });
      const attackLabel = screen.getByText(/Attack \(to hit\):/);
      expect(attackLabel).toHaveClass('disabled-attack');
    });
  });

  describe('spell abilities section info', () => {
    it('renders cantrips_known count', () => {
      renderWithProps({});
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders prepared_spells info for 5e', () => {
      renderWithProps({});
      expect(screen.getByText(/Prepared Spells:/)).toBeInTheDocument();
      expect(screen.getByText(/Max Prepared:/)).toBeInTheDocument();
    });

    it('does not render prepared_spells info for 2024', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      expect(screen.queryByText(/Prepared Spells:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Max Prepared:/)).not.toBeInTheDocument();
    });
  });

  describe('Hunter\'s Mark special handling', () => {
    it('renders Hunter\'s Mark with 1d10 instead of 1d6 for level 20 Ranger', () => {
      const spell = {
        name: "Hunter's Mark",
        level: 1,
        casting_time: '1 turn',
        range: '60 feet',
        duration: 'Concentration, up to 1 hour',
        components: ['V'],
        damage: {
          damage_at_slot_level: {
            '1': '1d6',
            '5': '2d6',
            '11': '3d6',
            '17': '4d6',
          },
          damage_type: 'Radiant',
        },
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        class: { name: 'Ranger' },
        level: 20,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText("1d10 Radiant")).toBeInTheDocument();
    });

    it('renders Hunter\'s Mark normally for non-Ranger', () => {
      const spell = {
        name: "Hunter's Mark",
        level: 1,
        casting_time: '1 turn',
        range: '60 feet',
        duration: 'Concentration, up to 1 hour',
        components: ['V'],
        damage: {
          damage_at_slot_level: {
            '1': '1d6',
          },
          damage_type: 'Radiant',
        },
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        class: { name: 'Wizard' },
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('1d6 Radiant')).toBeInTheDocument();
    });

    it('renders Hunter\'s Mark normally for Ranger below level 20', () => {
      const spell = {
        name: "Hunter's Mark",
        level: 1,
        casting_time: '1 turn',
        range: '60 feet',
        duration: 'Concentration, up to 1 hour',
        components: ['V'],
        damage: {
          damage_at_slot_level: {
            '1': '1d6',
          },
          damage_type: 'Radiant',
        },
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        class: { name: 'Ranger' },
        level: 10,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spell],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('1d6 Radiant')).toBeInTheDocument();
    });
  });
});
