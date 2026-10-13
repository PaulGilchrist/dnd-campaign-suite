// @improved-by-ai
// @cleaned-by-ai
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
    rangeToFeet: vi.fn(() => null),
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
  default: vi.fn((_props) => <div data-testid="metamagic-popup">{_props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="hex-ability-modal"><button onClick={props.onCancel}>Cancel</button></div>),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="secondary-target-modal">{props.title}</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

import { getRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

function makeStatsWithWisdom(wisBonus, level = 5) {
  return createStats({
    level,
    abilities: [{ name: 'Wisdom', bonus: wisBonus }],
    spellAbilities: { toHit: 7 },
    bonusActions: [{ name: 'TestFeature', description: 'test' }],
  });
}

describe('CharBonusActions - Wrath of the Sea', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('renders Wrath of the Sea when wrathOfTheSeaActive is true and not already in bonusActions', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === 'wrathOfTheSeaActive') return true;
      return null;
    });
    render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'TestFeature', description: 'test' }] })} onAutomationAction={vi.fn()} />);
    expect(screen.getByText(/Wrath of the Sea:/)).toBeInTheDocument();
    expect(screen.getByText(/Force a creature to make a CON save or take WIS modifier d6 Cold damage/)).toBeInTheDocument();
  });

  it('does not render Wrath of the Sea when already present in bonusActions', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === 'wrathOfTheSeaActive') return true;
      return null;
    });
    render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'Wrath of the Sea', description: '...' }, { name: 'TestFeature', description: 'test' }] })} onAutomationAction={vi.fn()} />);
    const allWrathElements = screen.queryAllByText(/Wrath of the Sea/);
    expect(allWrathElements.length).toBe(1);
  });

  it('does not render Wrath of the Sea when the buff is not active', () => {
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'TestFeature', description: 'test' }] })} onAutomationAction={vi.fn()} />);
    expect(screen.queryByText(/Wrath of the Sea:/)).not.toBeInTheDocument();
  });

  it('renders Wrath of the Sea even when cannotAct is true (component does not check cannotAct for this feature)', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === 'wrathOfTheSeaActive') return true;
      return null;
    });
    render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'TestFeature', description: 'test' }] })} campaignName="test" cannotAct={true} />);
    expect(screen.getByText(/Wrath of the Sea:/)).toBeInTheDocument();
  });

  it('calls onAutomationAction with correct automation payload when clicked', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === 'wrathOfTheSeaActive') return true;
      return null;
    });
    const mockOnAutomationAction = vi.fn();
    render(<CharBonusActions playerStats={createStats({ bonusActions: [{ name: 'TestFeature', description: 'test' }] })} onAutomationAction={mockOnAutomationAction} />);
    fireEvent.click(screen.getByText(/Wrath of the Sea:/));
    expect(mockOnAutomationAction).toHaveBeenCalledWith({
      name: 'Wrath of the Sea',
      description: 'Force a creature to make a CON save or take WIS modifier d6 Cold damage.',
      automation: {
        type: 'wrath_of_the_sea',
        action: 'bonus_action',
        allyAttack: true,
      },
    });
  });
});

describe('CharBonusActions - Starry Form: Luminous Arrow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('renders Starry Form: Luminous Arrow when Archer constellation buff is active', () => {
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Archer' }];
      return null;
    });
    const stats = makeStatsWithWisdom(3, 5);
    render(<CharBonusActions playerStats={stats} onAutomationAction={vi.fn()} />);
    expect(screen.getByText(/Starry Form: Luminous Arrow:/)).toBeInTheDocument();
    expect(screen.getByText(/Ranged spell attack, 60 ft/)).toBeInTheDocument();
  });

  it.each([
    { label: 'level 10+', level: 10, expectedDice: /2d8/ },
    { label: 'level < 10', level: 5, expectedDice: /1d8/ },
  ])('shows $expectedDice damage dice for $level characters', ({ level, expectedDice }) => {
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Archer' }];
      return null;
    });
    const stats = makeStatsWithWisdom(3, level);
    render(<CharBonusActions playerStats={stats} onAutomationAction={vi.fn()} />);
    expect(screen.getByText(expectedDice)).toBeInTheDocument();
  });

  it.each([
    { label: 'buff is absent', buffs: null, expected: false },
    { label: 'constellation is not Archer', buffs: [{ name: 'Starry Form', constellation: 'Hunter' }], expected: false },
  ])('does not render Starry Form when $label', ({ buffs }) => {
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return buffs;
      return null;
    });
    render(<CharBonusActions playerStats={createStats({ level: 10, bonusActions: [{ name: 'TestFeature', description: 'test' }] })} onAutomationAction={vi.fn()} />);
    expect(screen.queryByText(/Starry Form: Luminous Arrow:/)).not.toBeInTheDocument();
  });

  it('renders Starry Form even when cannotAct is true (component does not check cannotAct for this feature)', () => {
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Archer' }];
      return null;
    });
    render(<CharBonusActions playerStats={makeStatsWithWisdom(3, 5)} campaignName="test" cannotAct={true} />);
    expect(screen.getByText(/Starry Form: Luminous Arrow:/)).toBeInTheDocument();
  });

  it('calls onAutomationAction with correct payload including WisMod and spellAttackMod', () => {
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Archer' }];
      return null;
    });
    const mockOnAutomationAction = vi.fn();
    const stats = makeStatsWithWisdom(3, 5);
    render(<CharBonusActions playerStats={stats} onAutomationAction={mockOnAutomationAction} />);
    fireEvent.click(screen.getByText(/Starry Form: Luminous Arrow:/));
    expect(mockOnAutomationAction).toHaveBeenCalledWith({
      name: 'Starry Form: Luminous Arrow',
      description: 'Ranged spell attack, 60 ft. On a hit: 1d8 + 3 Radiant damage.',
      automation: {
        type: 'starry_form_arrow',
        action: 'bonus_action',
        damageDice: '1d8',
        damageType: 'Radiant',
        damageBonus: 3,
        spellAttackMod: 7,
        range: '60_ft',
      },
    });
  });

  it('uses spellAbilities.toHit for spellAttackMod in payload', () => {
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Archer' }];
      return null;
    });
    const mockOnAutomationAction = vi.fn();
    const stats = createStats({
      level: 5,
      abilities: [{ name: 'Wisdom', bonus: 2 }],
      spellAbilities: { toHit: 9 },
      bonusActions: [{ name: 'TestFeature', description: 'test' }],
    });
    render(<CharBonusActions playerStats={stats} onAutomationAction={mockOnAutomationAction} />);
    fireEvent.click(screen.getByText(/Starry Form: Luminous Arrow:/));
    expect(mockOnAutomationAction).toHaveBeenCalledWith(expect.objectContaining({
      automation: expect.objectContaining({ spellAttackMod: 9, damageBonus: 2 }),
    }));
  });
});

describe('CharBonusActions - Multiple buffs active simultaneously', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('renders both Wrath of the Sea and Starry Form when both buffs are active', () => {
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === 'wrathOfTheSeaActive') return true;
      return null;
    });
    vi.mocked(useRuntimeValue).mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Archer' }];
      return null;
    });
    const stats = makeStatsWithWisdom(3, 5);
    render(<CharBonusActions playerStats={stats} onAutomationAction={vi.fn()} />);
    expect(screen.getByText(/Wrath of the Sea:/)).toBeInTheDocument();
    expect(screen.getByText(/Starry Form: Luminous Arrow:/)).toBeInTheDocument();
  });
});
