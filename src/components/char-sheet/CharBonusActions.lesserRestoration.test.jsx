// @maintained-by-ai
// CharBonusActions host wiring for the Lesser Restoration bonus-action lane:
// the armed TargetSpellPopups mount, the host-owned two-step target→condition
// state, and confirm/skip routing. Shared popup internals (condition filtering,
// no-conditions empty state) are covered in char-spells/CharSpells.Popups.restoration.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

const mockHandleConfirm = vi.fn();
const mockHandleSkip = vi.fn();

function flowStub(overrides = {}) {
  return {
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
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
    pendingHex: null,
    handleHexConfirm: vi.fn(),
    handleHexSkip: vi.fn(),
    ...overrides,
  };
}

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => flowStub()),
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
  // Target-scoped so the two-step flow proves it looks up the CHOSEN target.
  getRuntimeValue: vi.fn((name, key) => {
    if (key === 'activeConditions') return name === 'Orc 1' ? ['poisoned'] : [];
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

function mount(overrides = {}) {
  vi.mocked(useSpellMetamagicFlow).mockReturnValue(flowStub(overrides));
  return render(<CharBonusActions playerStats={basePlayerStats} campaignName="test-campaign" />);
}

function castOnOrc() {
  fireEvent.click(screen.getByRole('radio', { name: 'Orc 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cast Lesser Restoration' }));
}

describe('CharBonusActions - Lesser Restoration pickers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does not mount the Lesser Restoration popup when no pending op is staged', () => {
    mount();
    expect(screen.queryByText('Lesser Restoration', { selector: '.sp-header' })).not.toBeInTheDocument();
    expect(screen.queryByText('Cast Lesser Restoration')).not.toBeInTheDocument();
  });

  it('mounts the target picker listing every candidate target when staged', () => {
    mount({ pendingLesserRestoration: makePending() });
    expect(screen.getByText('Lesser Restoration', { selector: '.sp-header' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cast Lesser Restoration' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Divine_Cleric' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Orc 1' })).toBeInTheDocument();
  });

  it('advances target step to a target-specific condition picker and confirms with targetName and condition', async () => {
    mount({ pendingLesserRestoration: makePending() });
    castOnOrc();

    await waitFor(() => {
      expect(screen.getByText('Choose one condition to remove from Orc 1.')).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: 'Poisoned condition' })).toBeInTheDocument();
    // Host-owned two-step state: the condition step replaces the target step.
    expect(screen.queryByRole('button', { name: 'Cast Lesser Restoration' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Poisoned condition' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Condition' }));
    expect(mockHandleConfirm).toHaveBeenCalledTimes(1);
    expect(mockHandleConfirm).toHaveBeenCalledWith({ targetName: 'Orc 1', condition: 'poisoned' });
  });

  it('routes Skip at the target stage to handleLesserRestorationSkip without confirming', () => {
    mount({ pendingLesserRestoration: makePending() });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockHandleSkip).toHaveBeenCalledTimes(1);
    expect(mockHandleConfirm).not.toHaveBeenCalled();
  });
});
