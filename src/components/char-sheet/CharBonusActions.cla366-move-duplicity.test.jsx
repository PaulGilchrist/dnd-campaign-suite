// CLA-366 regression: the Invoke Duplicity "move the illusion" clause had no
// producer anywhere. While the create_illusion buff is active, a
// "Move Invoke Duplicity (Transposition)" bonus action row must render and
// route to the swap confirm (which persists te + ability_use log).
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

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
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

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

const { runtimeValues } = vi.hoisted(() => ({ runtimeValues: {} }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn((name, key) => runtimeValues[key] ?? null),
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
  buildFeatureDetailHtml: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="metamagic-popup" />),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="spell-detail-popup" />),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="hex-ability-modal" />),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal" />),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal" />),
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
  getCategories: vi.fn(() => ({ featuresToIgnore: [] })),
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

const basePlayerStats = {
  name: 'War_Cleric',
  rules: '2024',
  level: 6,
  attacks: [],
  // Real Trickery clerics always carry bonus actions/spells; the bonus grid
  // early-returns when it has no content at all.
  bonusActions: [{ name: 'Healing Word', casting_time: '1 bonus action' }],
  spellAbilities: { spells: [] },
};

describe('CLA-366 Move Invoke Duplicity bonus action row', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    Object.keys(runtimeValues).forEach(k => delete runtimeValues[k]);
  });

  it('renders a clickable move row while the create_illusion buff is active and routes to the swap confirm', () => {
    runtimeValues.activeBuffs = [{ name: 'Invoke Duplicity', effect: 'create_illusion', duration: '1_minute' }];
    const onAutomationAction = vi.fn();

    render(<CharBonusActions playerStats={basePlayerStats} campaignName="test-campaign" onAutomationAction={onAutomationAction} />);

    const row = screen.getByText(/Move Invoke Duplicity \(Transposition\):/);
    expect(row).toHaveClass('clickable');
    fireEvent.click(row);
    expect(onAutomationAction).toHaveBeenCalledWith(expect.objectContaining({
      name: "Trickster's Transposition",
      automation: expect.objectContaining({
        type: 'temp_buff',
        effect: 'teleport_swap_with_illusion',
        action: 'bonus_action',
        distance: '30 ft',
        moveIllusion: true,
      }),
    }));
  });

  it('does not render the move row when no illusion is active', () => {
    runtimeValues.activeBuffs = [];

    render(<CharBonusActions playerStats={basePlayerStats} campaignName="test-campaign" onAutomationAction={vi.fn()} />);

    expect(screen.queryByText(/Move Invoke Duplicity/)).toBeNull();
  });
});
