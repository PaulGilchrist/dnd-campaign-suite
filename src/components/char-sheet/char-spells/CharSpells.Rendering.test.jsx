// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import * as helpers from './CharSpells.test-utils.js';

const { useSpellMetamagicFlow } = vi.hoisted(() => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    gateMetamagic: vi.fn(),
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

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

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../hooks/combat/useDiceRoll.js', () => ({
  useDiceRoll: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 3),
  getMaxSorceryPoints: vi.fn(() => 6),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({ useSpellMetamagicFlow }));

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

vi.mock('../../../services/ui/spellSectionUtils.js', () => ({
  getExcludedSpellNames: vi.fn(() => new Set()),
  isSpellBreakerBonusActionSpell: vi.fn(() => false),
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

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn().mockResolvedValue(undefined),
  isFreeCastAuthorized: vi.fn(() => false),
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

vi.mock('./CharSpellSlotLevel.jsx', () => ({
  default: function CharSpellSlotLevel() {
    return <div data-testid="char-spell-slot-level">SlotLevel</div>;
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

vi.mock('../popups/TruePolymorphPathModal.jsx', () => ({
  default: function TruePolymorphPathModal() {
    return <div data-testid="true-polymorph-path-modal">TruePolymorphPath</div>;
  },
}));

vi.mock('../modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function SecondaryTargetModal() {
    return <div data-testid="secondary-target-modal">SecondaryTarget</div>;
  },
}));

vi.mock('../modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function CreatureSelectionModal() {
    return <div data-testid="creature-selection-modal">CreatureSelection</div>;
  },
}));

vi.mock('../modals/SingleResistanceSelectionModal.jsx', () => ({
  default: function SingleResistanceSelectionModal() {
    return <div data-testid="single-resistance-selection-modal">SingleResistance</div>;
  },
}));

vi.mock('../modals/HexAbilityModal.jsx', () => ({
  default: function HexAbilityModal() {
    return <div data-testid="hex-ability-modal">HexAbility</div>;
  },
}));

const basePlayerStats = helpers.mockPlayerStats;
const baseProps = { playerStats: basePlayerStats, campaignName: 'test' };

function renderWithProps(props) {
  return render(<CharSpells {...baseProps} {...props} />);
}

// Helper to create a minimal stats object with a single spell, replacing the default spells list.
function statsWithSpell(spell) {
  return {
    ...basePlayerStats,
    spellAbilities: {
      ...basePlayerStats.spellAbilities,
      spells: [spell],
    },
  };
}

describe('CharSpells - Rendering Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spell effect rendering', () => {
    it('renders damage with DEX half save DC', () => {
      const spell = {
        name: 'Cone of Cold',
        level: 2,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V', 'S', 'M'],
        damage: {
          damage_at_slot_level: { '2': '3d8' },
          damage_type: 'Cold',
        },
        dc: { dc_type: 'DEX', dc_success: 'half' },
        prepared: 'Prepared',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText('3d8 Cold (DEX half)')).toBeInTheDocument();
    });

    it('renders damage with CON negates save DC', () => {
      const spell = {
        name: 'Frostbite',
        level: 0,
        casting_time: '1 turn',
        range: '60 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: { '1': '1d6' },
          damage_type: 'Cold',
        },
        dc: { dc_type: 'CON', dc_success: 'negates' },
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText('1d6 Cold (CON negates)')).toBeInTheDocument();
    });

    it('renders damage from damage_at_character_level when damage_at_slot_level is absent', () => {
      const spell = {
        name: 'Character Level Spell',
        level: 1,
        casting_time: '1 action',
        range: '60 feet',
        duration: 'Instantaneous',
        components: ['V'],
        damage: {
          damage_at_character_level: { '1': '3d6' },
          damage_type: 'Thunder',
        },
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText('3d6 Thunder')).toBeInTheDocument();
    });

    it('renders Utility when spell has no damage and no DC', () => {
      const spell = {
        name: 'Comprehend Languages',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: '1 hour',
        components: ['S'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('renders Utility when damage property is null or empty object', () => {
      const spell = {
        name: 'Null Damage Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        damage: null,
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('renders cantrip damage using highest level at or below player level', () => {
      const cantrip = {
        name: 'Fire Bolt',
        level: 0,
        casting_time: '1 turn',
        range: '120 feet',
        duration: 'Instantaneous',
        components: ['V', 'S'],
        damage: {
          damage_at_slot_level: { '1': '1d10', '5': '2d10', '11': '3d10' },
          damage_type: 'Fire',
        },
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        level: 5,
        spellAbilities: { ...basePlayerStats.spellAbilities, spells: [cantrip] },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('2d10 Fire')).toBeInTheDocument();
    });

    it('falls back to first damage key when player level is below all cantrip damage keys', () => {
      const cantrip = {
        name: 'Custom Cantrip',
        level: 0,
        casting_time: '1 turn',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        damage: {
          damage_at_slot_level: { '5': '2d10', '11': '3d10' },
          damage_type: 'Lightning',
        },
        prepared: 'Always',
      };
      const stats = {
        ...basePlayerStats,
        level: 0,
        spellAbilities: { ...basePlayerStats.spellAbilities, spells: [cantrip] },
      };
      render(<CharSpells playerStats={stats} campaignName="test" />);
      expect(screen.getByText('2d10 Lightning')).toBeInTheDocument();
    });

    it.each`
      dc_success    | expectedOutput
      ${'half'}     | ${'WIS half'}
      ${'negates'}  | ${'WIS negates'}
    `('renders DC-only effect (no damage) with $dc_success success', ({ dc_success, expectedOutput }) => {
      const spell = {
        name: 'DC Effect Spell',
        level: 1,
        casting_time: '1 action',
        range: '60 feet',
        duration: '1 minute',
        components: ['V'],
        dc: { dc_type: 'WIS', dc_success },
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText(expectedOutput)).toBeInTheDocument();
    });
  });

  describe('duration formatting', () => {
    it.each`
      durationInput                         | expectedOutput
      ${'1 minute'}                         | ${'1 min'}
      ${'10 minutes'}                       | ${'10 mins'}
      ${'up to 1 hour'}                     | ${'1 hour'}
      ${'Instantaneous'}                    | ${'Instant'}
      ${'Concentration, up to 10 minutes'}  | ${'Concentration, 10 mins'}
      ${'1 hour'}                           | ${'1 hour'}
    `('formats duration "$durationInput" as "$expectedOutput"', ({ durationInput, expectedOutput }) => {
      const spell = {
        name: 'Duration Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: durationInput,
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText(expectedOutput)).toBeInTheDocument();
    });

    it('renders empty cell when duration property is missing or null', () => {
      const spell = {
        name: 'No Duration Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: null,
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      const table = screen.getByRole('table');
      const allCellTexts = Array.from(table.querySelectorAll('tbody td')).map(td => td.textContent.trim());
      expect(allCellTexts).toContain('');
    });
  });

  describe('casting time formatting', () => {
    it('abbreviates "1 action" to "1  A" (double space)', async () => {
      const spell = {
        name: 'Casting Time Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      const table = await screen.findByRole('table');
      const row = Array.from(table.querySelectorAll('tbody tr')).find(r => r.textContent.includes('Casting Time Test Spell'));
      const cells = Array.from(row.querySelectorAll('td'));
      expect(cells[3].textContent).toBe('1  A');
    });

    it('abbreviates "1 bonus action" to "1 BA"', async () => {
      const spell = {
        name: 'Bonus Action Test',
        level: 1,
        casting_time: '1 bonus action',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(await screen.findByText('1 BA')).toBeInTheDocument();
    });

    it('abbreviates "1 reaction" to "1 Reaction"', async () => {
      const spell = {
        name: 'Reaction Test',
        level: 1,
        casting_time: '1 reaction',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(await screen.findByText('1 Reaction')).toBeInTheDocument();
    });

    it('renders empty cell when casting_time is missing or null', () => {
      const spell = {
        name: 'No Casting Time Spell',
        level: 1,
        casting_time: null,
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      const table = screen.getByRole('table');
      const allCellTexts = Array.from(table.querySelectorAll('tbody td')).map(td => td.textContent.trim());
      expect(allCellTexts).toContain('');
    });
  });

  describe('notes formatting', () => {
    it.each`
      components                        | expectedNotes
      ${['V', 'S', 'M']}                | ${'V/S/M'}
      ${['V', 'S']}                     | ${'V/S'}
      ${['V', 'M']}                     | ${'V/M'}
      ${['V', 'Concentration']}         | ${'V/Con'}
      ${['S', 'M', 'Concentration']}    | ${'S/M/Con'}
    `('formats components $components as notes "$expectedNotes"', ({ components, expectedNotes }) => {
      const spell = {
        name: 'Notes Test Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components,
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      expect(screen.getByText(expectedNotes)).toBeInTheDocument();
    });

    it.each`
      components
      ${[]}
      ${null}
      ${undefined}
    `('renders empty notes cell for components: $components', ({ components }) => {
      const spell = {
        name: 'Empty Components Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components,
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      const table = screen.getByRole('table');
      const allCellTexts = Array.from(table.querySelectorAll('tbody td')).map(td => td.textContent.trim());
      expect(allCellTexts).toContain('');
    });
  });

  describe('spell row prepared logic', () => {
    it('renders checkbox for spells with empty prepared string', () => {
      const spell = {
        name: 'Empty Prepared Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: '',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(1);
    });

    it('does not render checkbox for spells with "Always" prepared value', () => {
      const spell = {
        name: 'Always Prepared Spell',
        level: 1,
        casting_time: '1 action',
        range: 'Self',
        duration: 'Instantaneous',
        components: ['V'],
        prepared: 'Always',
      };
      render(<CharSpells playerStats={statsWithSpell(spell)} campaignName="test" />);
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes).toHaveLength(0);
    });
  });

  describe('spell popup close', () => {
    it('does not close the spell detail popup when the popup overlay is clicked', () => {
      renderWithProps({});
      const lightCell = screen.getByText('Light');
      fireEvent.click(lightCell);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.click(popupOverlay);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });
  });

  describe('spell abilities section info', () => {
    it('renders cantrips_known count', () => {
      renderWithProps({});
      expect(screen.getByText('Cantrips Known:')).toBeInTheDocument();
    });

    it('renders prepared_spells info for 5e', () => {
      renderWithProps({});
      expect(screen.getByText(/Prepared Spells:/)).toBeInTheDocument();
      expect(screen.getByText(/Max Prepared:/)).toBeInTheDocument();
    });

    it('does not render prepared_spells info for 2024 non-wizard', () => {
      renderWithProps({ playerStats: helpers.mockPlayerStats2024 });
      expect(screen.queryByText(/Prepared Spells:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Max Prepared:/)).not.toBeInTheDocument();
    });
  });
});
