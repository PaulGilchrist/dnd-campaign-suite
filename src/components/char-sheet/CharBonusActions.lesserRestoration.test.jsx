import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

const mockHandleConfirm = vi.fn();
const mockHandleSkip = vi.fn();

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingBarkskin: null,
    handleBarkskinConfirm: vi.fn(),
    handleBarkskinSkip: vi.fn(),
    pendingHealingWord: null,
    handleHealingWordConfirm: vi.fn(),
    handleHealingWordSkip: vi.fn(),
    pendingSanctuary: null,
    handleSanctuaryConfirm: vi.fn(),
    handleSanctuarySkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: mockHandleConfirm,
    handleLesserRestorationSkip: mockHandleSkip,
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

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Orc 1' }] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((name, key) => {
    if (key === 'activeConditions') return ['poisoned'];
    return null;
  }),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => null),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="metamagic-popup">MetamagicPopup</div>),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./HexAbilityModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="hex-ability-modal">HexAbilityModal</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';

const lesserRestorationSpell = {
  name: 'Lesser Restoration',
  level: 2,
  range: 'Touch',
  casting_time: 'Bonus Action',
  prepared: 'Prepared',
};

const basePlayerStats = {
  name: 'Divine_Cleric',
  rules: '2024',
  level: 17,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [lesserRestorationSpell], toHit: 9, saveDc: 17 },
};

function makePending() {
  return {
    spell: lesserRestorationSpell,
    spellName: 'Lesser Restoration',
    spellLevel: 2,
    castingTime: lesserRestorationSpell.casting_time,
    range: 'Touch',
    creatureTargets: ['Divine_Cleric', 'Orc 1'],
  };
}

function mountWithFlow(overrides = {}) {
  vi.mocked(useSpellMetamagicFlow).mockReturnValue({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingBarkskin: null,
    handleBarkskinConfirm: vi.fn(),
    handleBarkskinSkip: vi.fn(),
    pendingHealingWord: null,
    handleHealingWordConfirm: vi.fn(),
    handleHealingWordSkip: vi.fn(),
    pendingSanctuary: null,
    handleSanctuaryConfirm: vi.fn(),
    handleSanctuarySkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: mockHandleConfirm,
    handleLesserRestorationSkip: mockHandleSkip,
    ...overrides,
  });
  return render(<CharBonusActions playerStats={basePlayerStats} campaignName="test-campaign" />);
}

describe('CharBonusActions - Lesser Restoration pickers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('renders nothing when no Lesser Restoration pending op is staged', () => {
    mountWithFlow();
    expect(screen.queryByText('Lesser Restoration', { selector: '.sp-header' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cast Lesser Restoration')).not.toBeInTheDocument();
  });

  it('renders the target picker modal when pendingLesserRestoration is staged', () => {
    mountWithFlow({ pendingLesserRestoration: makePending() });
    expect(screen.getByText('Lesser Restoration', { selector: '.sp-header' })).toBeInTheDocument();
    expect(screen.getByText('Cast Lesser Restoration')).toBeInTheDocument();
    expect(screen.getByText('Divine_Cleric')).toBeInTheDocument();
    expect(screen.getByText('Orc 1')).toBeInTheDocument();
  });

  it('advances to the condition picker listing only conditions on the chosen target', async () => {
    mountWithFlow({ pendingLesserRestoration: makePending() });
    fireEvent.click(screen.getByText('Orc 1'));
    fireEvent.click(screen.getByText('Cast Lesser Restoration'));
    await waitFor(() => {
      expect(screen.getByText('Choose one condition to remove from Orc 1.')).toBeInTheDocument();
    });
    expect(screen.getByText('Poisoned condition')).toBeInTheDocument();
    expect(screen.getByText('Remove Condition')).toBeInTheDocument();
  });

  it('calls handleLesserRestorationConfirm with targetName and condition on confirm', async () => {
    mountWithFlow({ pendingLesserRestoration: makePending() });
    fireEvent.click(screen.getByText('Orc 1'));
    fireEvent.click(screen.getByText('Cast Lesser Restoration'));
    await waitFor(() => screen.getByText('Poisoned condition'));
    fireEvent.click(screen.getByText('Poisoned condition'));
    fireEvent.click(screen.getByText('Remove Condition'));
    expect(mockHandleConfirm).toHaveBeenCalledWith({ targetName: 'Orc 1', condition: 'poisoned' });
  });

  it('calls handleLesserRestorationSkip without confirming when skipped at the target stage', () => {
    mountWithFlow({ pendingLesserRestoration: makePending() });
    fireEvent.click(screen.getByText('Skip'));
    expect(mockHandleSkip).toHaveBeenCalled();
    expect(mockHandleConfirm).not.toHaveBeenCalled();
  });
});
