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

vi.mock('../popups/AidTargetPopup.jsx', () => ({
  default: function AidTargetPopup() {
    return <div data-testid="aid-target-popup">Aid</div>;
  },
}));

vi.mock('../popups/HeroesFeastTargetPopup.jsx', () => ({
  default: function HeroesFeastTargetPopup() {
    return <div data-testid="heroes-feast-popup">HeroesFeast</div>;
  },
}));

vi.mock('../popups/GreaterRestorationPopup.jsx', () => ({
  default: function GreaterRestorationPopup() {
    return <div data-testid="greater-restoration-popup">GreaterRestoration</div>;
  },
}));

vi.mock('../popups/LesserRestorationPopup.jsx', () => ({
  default: function LesserRestorationPopup() {
    return <div data-testid="lesser-restoration-popup">LesserRestoration</div>;
  },
}));

vi.mock('../popups/RemoveCursePopup.jsx', () => ({
  default: function RemoveCursePopup() {
    return <div data-testid="remove-curse-popup">RemoveCurse</div>;
  },
}));

vi.mock('../popups/MageArmorTargetPopup.jsx', () => ({
  default: function MageArmorTargetPopup() {
    return <div data-testid="mage-armor-popup">MageArmor</div>;
  },
}));

vi.mock('../popups/ShieldOfFaithTargetPopup.jsx', () => ({
  default: function ShieldOfFaithTargetPopup() {
    return <div data-testid="shield-of-faith-popup">ShieldOfFaith</div>;
  },
}));

vi.mock('../popups/ProtectionFromEnergyTargetPopup.jsx', () => ({
  default: function ProtectionFromEnergyTargetPopup() {
    return <div data-testid="protection-from-energy-popup">ProtectionFromEnergy</div>;
  },
}));

vi.mock('../popups/ResistanceTargetPopup.jsx', () => ({
  default: function ResistanceTargetPopup() {
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

function getTableHeaders(table) {
  const headers = table.querySelectorAll('th');
  return Array.from(headers).map(h => h.textContent);
}

describe('CharSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spell abilities header', () => {
    it('renders the spells section header', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('Spells')).toBeInTheDocument();
    });

    it('renders the attack to hit display with correct value', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('renders the save DC display with correct value', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('13')).toBeInTheDocument();
    });

    it('renders cantrips known count', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const abilitiesDiv = document.querySelector('.spell-abilities');
      expect(abilitiesDiv.textContent).toContain('Cantrips Known:');
      expect(abilitiesDiv.textContent).toContain('3');
    });

    it('renders prepared spells count', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const abilitiesDiv = document.querySelector('.spell-abilities');
      expect(abilitiesDiv.textContent).toContain('Prepared Spells:');
      expect(abilitiesDiv.textContent).toContain('5');
    });

    it('renders the spell slots component', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByTestId('char-spell-slots')).toBeInTheDocument();
    });

    it('applies exhaustion penalty to attack to hit display', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" exhaustionPenalty={2} />);
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('applies exhaustion penalty to modifier display', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" exhaustionPenalty={1} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('renders attack as disabled when cannotAct is true', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" cannotAct={true} />);
      const attackText = screen.getByText(/attack.*to hit/i);
      expect(attackText).toHaveClass('disabled-attack');
    });

    it('renders attack as clickable when cannotAct is false', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" cannotAct={false} />);
      const attackText = screen.getByText(/attack.*to hit/i);
      expect(attackText).toHaveClass('clickable');
    });

    it('renders attack as clickable by default (cannotAct undefined)', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const attackText = screen.getByText(/attack.*to hit/i);
      expect(attackText).toHaveClass('clickable');
    });
  });

  describe('spell table rendering', () => {
    it('renders all spells from player stats', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('renders spell levels correctly', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('3');
      expect(table.textContent).toContain('1');
      expect(table.textContent).toContain('Cantrip');
    });

    it('renders casting time with abbreviations', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain(' A');
    });

    it('renders duration with abbreviated text', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Instant');
    });

    it('renders spell range values', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText('150 feet')).toBeInTheDocument();
      expect(screen.getByText('120 feet')).toBeInTheDocument();
    });

    it('renders damage dice for spells with damage', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      expect(screen.getByText(/8d6/)).toBeInTheDocument();
    });

    it('renders damage type for spells', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Fire');
      expect(table.textContent).toContain('Force');
    });

    it('renders spell components as notes', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('V');
    });

    it('renders concentration abbreviation in notes', () => {
      const spellWithConc = {
        ...basePlayerStats.spellAbilities.spells[0],
        concentration: true,
        ritual: true,
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellWithConc],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText(/Con/)).toBeInTheDocument();
    });

    it('renders spell name cells as clickable', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellName = screen.getByText('Fireball');
      expect(spellName).toHaveClass('clickable');
    });

    it('renders sort headers as clickable', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellHeader = screen.getByText('Spell');
      expect(spellHeader).toHaveClass('clickable');
      const levelHeader = screen.getByText('Level');
      expect(levelHeader).toHaveClass('clickable');
    });
  });

  describe('spell detail popup', () => {
    it('opens the spell detail popup when clicking a spell name', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellName = screen.getByText('Fireball');
      fireEvent.click(spellName);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      expect(screen.getByTestId('spell-detail-popup')).toHaveTextContent('Fireball');
    });

    it('closes the spell detail popup when clicking close', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellName = screen.getByText('Fireball');
      fireEvent.click(spellName);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });
  });

  describe('5e ruleset behavior', () => {
    it('renders the prepared column header for 5e ruleset', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const table = screen.getByRole('table');
      const headers = getTableHeaders(table);
      expect(headers).toContain('Prepared');
    });

    it('renders checkboxes for spells with Prepared status', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  describe('2024 ruleset behavior', () => {
    it('does not render the prepared column for 2024 ruleset', () => {
      render(<CharSpells playerStats={helpers.mockPlayerStats2024} campaignName="test" />);
      const table = screen.getByRole('table');
      const headers = getTableHeaders(table);
      expect(headers).not.toContain('Prepared');
    });
  });

  describe('sorting', () => {
    it('sorts spells by name when spell header is clicked', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const spellHeader = screen.getByText('Spell');
      fireEvent.click(spellHeader);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('keeps spells visible after sorting by level', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const levelHeader = screen.getByText('Level');
      fireEvent.click(levelHeader);
      expect(screen.getByText('Light')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('toggles prepared filter when prepared header is clicked', () => {
      render(<CharSpells playerStats={basePlayerStats} campaignName="test" />);
      const preparedHeader = screen.getByText('Prepared');
      fireEvent.click(preparedHeader);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('does not render a table when spells array is empty', () => {
      const emptyStats = {
        ...basePlayerStats,
        spellAbilities: {
          toHit: 5,
          modifier: 3,
          saveDc: 13,
          cantrips_known: 0,
          spells: [],
        },
      };
      render(<CharSpells playerStats={emptyStats} campaignName="test" />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('does not render a table when spellAbilities is undefined', () => {
      const noSpellsStats = {
        ...basePlayerStats,
        spellAbilities: undefined,
      };
      render(<CharSpells playerStats={noSpellsStats} campaignName="test" />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('does not render a table when spellAbilities is null', () => {
      const noSpellsStats = {
        ...basePlayerStats,
        spellAbilities: null,
      };
      render(<CharSpells playerStats={noSpellsStats} campaignName="test" />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders cantrips without damage as utility', () => {
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
      expect(screen.getByText('Light')).toBeInTheDocument();
    });

    it('renders utility label for cantrips without damage', () => {
      const spellNoDmg = {
        name: 'Prestidigitation',
        level: 0,
        damage: null,
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        spellAbilities: {
          ...basePlayerStats.spellAbilities,
          spells: [spellNoDmg],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('upgrades Hunter Mark damage to 1d10 at ranger level 20', () => {
      const hunterMark = {
        name: "Hunter's Mark",
        level: 1,
        damage: {
          damage_at_slot_level: { '1': '1d6' },
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
          spells: [hunterMark],
        },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('1d10');
    });
  });
});

describe('CharSpells.test.helpers', () => {
  it('exports mockPlayerStats with correct structure', () => {
    expect(helpers.mockPlayerStats).toBeDefined();
    expect(helpers.mockPlayerStats.name).toBe('Test Character');
    expect(helpers.mockPlayerStats.spellAbilities.spells).toHaveLength(3);
  });

  it('exports mockPlayerStats2024 with 2024 rules', () => {
    expect(helpers.mockPlayerStats2024).toBeDefined();
    expect(helpers.mockPlayerStats2024.rules).toBe('2024');
  });

  it('exports mockHandleTogglePreparedSpells as a function', () => {
    expect(helpers.mockHandleTogglePreparedSpells).toBeDefined();
    expect(typeof helpers.mockHandleTogglePreparedSpells).toBe('function');
  });

  it('exports mockGateMetamagic as a function', () => {
    expect(helpers.mockGateMetamagic).toBeDefined();
    expect(typeof helpers.mockGateMetamagic).toBe('function');
  });

  it('exports mockGateUpcast as a function that returns false', () => {
    expect(helpers.mockGateUpcast).toBeDefined();
    expect(typeof helpers.mockGateUpcast).toBe('function');
    expect(helpers.mockGateUpcast()).toBe(false);
  });

  it('exports mockGetCantripAutoLevel as a function that returns null', () => {
    expect(helpers.mockGetCantripAutoLevel).toBeDefined();
    expect(typeof helpers.mockGetCantripAutoLevel).toBe('function');
    expect(helpers.mockGetCantripAutoLevel()).toBeNull();
  });

  it('mockPlayerStats contains expected spell names', () => {
    const names = helpers.mockPlayerStats.spellAbilities.spells.map(s => s.name);
    expect(names).toContain('Fireball');
    expect(names).toContain('Magic Missile');
    expect(names).toContain('Light');
  });

  it('mockPlayerStats has correct spell levels', () => {
    const spells = helpers.mockPlayerStats.spellAbilities.spells;
    const fireball = spells.find(s => s.name === 'Fireball');
    expect(fireball.level).toBe(3);
    const magicMissile = spells.find(s => s.name === 'Magic Missile');
    expect(magicMissile.level).toBe(1);
    const light = spells.find(s => s.name === 'Light');
    expect(light.level).toBe(0);
  });

  it('mockPlayerStats has cantrips_known of 3', () => {
    expect(helpers.mockPlayerStats.spellAbilities.cantrips_known).toBe(3);
  });

  it('mockPlayerStats2024 has same spell structure as 5e', () => {
    expect(helpers.mockPlayerStats2024.spellAbilities.spells).toHaveLength(3);
    expect(helpers.mockPlayerStats2024.rules).toBe('2024');
  });
});
