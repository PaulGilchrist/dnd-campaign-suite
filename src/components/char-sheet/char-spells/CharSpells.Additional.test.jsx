// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('CharSpells - Additional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('structure rendering', () => {
    it('renders char-spells wrapper and spell-popup-parent containers', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(document.querySelector('.char-spells')).toBeInTheDocument();
      expect(document.querySelector('.spell-popup-parent')).toBeInTheDocument();
    });

    it('renders hr separator between popup area and spell abilities', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(document.querySelector('hr')).toBeInTheDocument();
    });

    it('renders spell abilities section header', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const header = document.querySelector('.sectionHeader h4');
      expect(header).toHaveTextContent('Spells');
    });

    it('renders spell slots component', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
    });
  });

  describe('spell abilities display', () => {
    it('renders attack to hit with clickable class when able to act', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const attackText = screen.getByText(/attack.*to hit/i);
      expect(attackText).toHaveClass('clickable');
    });

    it('renders spell modifier display', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText(/modifier/i)).toBeInTheDocument();
    });

    it('renders save DC value in spell abilities', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const abilitiesDiv = document.querySelector('.spell-abilities');
      expect(abilitiesDiv.textContent).toContain('Save DC');
    });

    it('renders cantrips known label and value', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText(/cantrips known/i)).toBeInTheDocument();
    });

    it('renders prepared spells label for 5e rules', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText(/prepared spells/i)).toBeInTheDocument();
    });

    it('renders max prepared label for 5e rules', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText(/max prepared/i)).toBeInTheDocument();
    });

    it('does not render prepared or max prepared labels for 2024 rules', () => {
      render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
      expect(screen.queryByText(/prepared spells/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/max prepared/i)).not.toBeInTheDocument();
    });
  });

  describe('exhaustion and condition modifiers', () => {
    it('adds disabled-attack class when cannotAct is true', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" cannotAct={true} />);
      const attackText = screen.getByText(/attack.*to hit/i);
      expect(attackText).toHaveClass('disabled-attack');
    });

    it('adds stat--penalized class to to hit span when exhaustionPenalty is set', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" exhaustionPenalty={2} />);
      const toHitSpan = document.querySelector('.spell-abilities span');
      expect(toHitSpan).toHaveClass('stat--penalized');
    });

    it('adds stat--penalized class to modifier span when exhaustionPenalty is set', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" exhaustionPenalty={1} />);
      const modifierSpan = document.querySelectorAll('.spell-abilities span')[1];
      expect(modifierSpan).toHaveClass('stat--penalized');
    });

    it('adds stat--penalized class to attack text when conditionAttackMode is disadvantage', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" conditionAttackMode="disadvantage" />);
      const attackText = screen.getByText(/attack.*to hit/i);
      expect(attackText).toHaveClass('stat--penalized');
    });
  });

  describe('spell table rendering', () => {
    it('renders a table with table-striped class', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table).toHaveClass('table-striped');
    });

    it('renders 8 header columns for 5e rules (including Prepared)', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      expect(headers.length).toBe(8);
    });

    it('renders 7 header columns for 2024 rules (excluding Prepared)', () => {
      render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
      const table = screen.getByRole('table');
      const headers = table.querySelectorAll('thead th');
      expect(headers.length).toBe(7);
    });

    it('renders correct header column labels for 5e', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const headers = Array.from(table.querySelectorAll('th')).map(h => h.textContent.trim());
      expect(headers).toEqual(['Spell', 'Level', 'Prepared', 'Time', 'Range', 'Effect', 'Duration', 'Notes']);
    });

    it('renders correct header column labels for 2024 (no Prepared)', () => {
      render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
      const table = screen.getByRole('table');
      const headers = Array.from(table.querySelectorAll('th')).map(h => h.textContent.trim());
      expect(headers).toEqual(['Spell', 'Level', 'Time', 'Range', 'Effect', 'Duration', 'Notes']);
    });

    it('renders a row for each spell in the list', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(3);
    });

    it('renders all spell names in the table', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('renders spell names in clickable cells', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellCells = document.querySelectorAll('.spell-name');
      expect(spellCells.length).toBe(3);
      spellCells.forEach(cell => expect(cell).toHaveClass('clickable'));
    });

    it('renders correct level values including Cantrip for 0-level spells', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      const levelCells = Array.from(rows).map(row => row.children[1].textContent.trim());
      expect(levelCells).toContain('3');
      expect(levelCells).toContain('1');
      expect(levelCells).toContain('Cantrip');
    });

    it('renders spell ranges from the data', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('150 feet')).toBeInTheDocument();
      expect(screen.getByText('120 feet')).toBeInTheDocument();
      expect(screen.getByText('Touch')).toBeInTheDocument();
    });
  });

  describe('spell row content formatting', () => {
    it('abbreviates casting time action as A', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain(' A');
    });

    it('abbreviates Instantaneous duration as Instant', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Instant');
    });

    it('abbreviates minutes duration as min', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('min');
    });

    it('renders components joined with slashes in notes', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('V');
      expect(table.textContent).toContain('S');
      expect(table.textContent).toContain('M');
    });

    it('renders damage type in effect column', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Fire');
      expect(table.textContent).toContain('Force');
    });

    it('displays Utility for spells without damage', () => {
      const spellNoDmg = {
        ...basePlayerStats.spellAbilities.spells[2],
        damage: null,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellNoDmg],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Utility');
    });
  });

  describe('notes field formatting', () => {
    it('abbreviates Concentration as Con in notes', () => {
      const spellWithConc = {
        ...basePlayerStats.spellAbilities.spells[0],
        concentration: true,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellWithConc],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Con');
    });

    it('shows Ritual in notes when spell has ritual flag', () => {
      const spellWithRitual = {
        ...basePlayerStats.spellAbilities.spells[0],
        ritual: true,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellWithRitual],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Ritual');
    });
  });

  describe('prepared column rendering', () => {
    it('renders checkbox for spells with prepared: Pre', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('renders prepared text for spells with prepared: Always', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBeGreaterThan(0);
    });

    it('does not render prepared column for 2024 rules even when spells have prepared field', () => {
      render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
      const headers = screen.getByRole('table').querySelectorAll('th');
      const headerTexts = Array.from(headers).map(h => h.textContent.trim());
      expect(headerTexts).not.toContain('Prepared');
    });
  });

  describe('spell interactions', () => {
    it('clicking a spell name opens the spell detail popup', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const fireballCell = screen.getByText('Fireball');
      fireEvent.click(fireballCell);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('damage effect cells are clickable when a damage formula exists', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const effectCells = table.querySelectorAll('tbody td:nth-child(6)');
      expect(effectCells.length).toBe(3);
      // Fireball and Magic Missile have damage formulas → clickable
      // Light has no damage → Utility text → not clickable
      expect(effectCells[0]).toHaveClass('clickable');
      expect(effectCells[1]).toHaveClass('clickable');
      expect(effectCells[2]).not.toHaveClass('clickable');
    });
  });

  describe('sorting and filtering', () => {
    it('sorts spells by level ascending when Level header is clicked', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('sorts spells alphabetically by name when Spell header is clicked', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellHeader = screen.getByText('Spell');
      fireEvent.click(spellHeader);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('toggles prepared filter when Prepared header is clicked', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const preparedHeader = screen.getByText('Prepared');
      fireEvent.click(preparedHeader);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  describe('null/edge case handling', () => {
    it('renders spell row when components is null', () => {
      const spellNoComponents = {
        name: 'Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: '1 round',
        components: null,
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellNoComponents],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Test Spell')).toBeInTheDocument();
    });

    it('renders spell row when components is empty array', () => {
      const spellEmptyComponents = {
        name: 'Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: '1 round',
        components: [],
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellEmptyComponents],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Test Spell')).toBeInTheDocument();
    });

    it('renders spell row when duration is null', () => {
      const spellNoDuration = {
        name: 'Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: null,
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellNoDuration],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Test Spell')).toBeInTheDocument();
    });

    it('renders spell row when casting_time is null', () => {
      const spellNoCastTime = {
        name: 'Test Spell',
        level: 1,
        casting_time: null,
        range: 'Self',
        duration: '1 round',
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellNoCastTime],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Test Spell')).toBeInTheDocument();
    });

    it('renders spell row when range is null', () => {
      const spellNoRange = {
        name: 'Test Spell',
        level: 1,
        casting_time: '1 action',
        range: null,
        duration: '1 round',
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellNoRange],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Test Spell')).toBeInTheDocument();
    });

    it('renders table when only cantrips exist', () => {
      const cantripOnly = {
        ...basePlayerStats.spellAbilities.spells[2],
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [cantripOnly],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });
  });
});
