// @maintained-by-ai 2026-11-27
// CharBonusActions host wiring for the shared TargetSpellPopups mount gate
// (targetSpellPopupsArmed = pendingLesserRestoration || pendingHex — CLA-066):
// the Lesser Restoration armed mount, the host-owned two-step target→condition
// state round-trip, and confirm/skip routing back to the useSpellMetamagicFlow
// handlers. Shared popup internals (condition filtering/dedup, confirm payload
// byte shapes, condition-step back-skip, no-conditions empty state) are owned
// by char-spells/CharSpells.Popups.restoration.test.jsx; the idle "popup-free"
// leg of this gate is owned by CharBonusActions.spellCasting.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

// Full shape of the mocked useSpellMetamagicFlow return — every key the
// component destructures at CharBonusActions.jsx:884. Tests override only what
// they assert; a per-mount flow object is kept so assertions read the very
// handlers this render received (no stale cross-test spies).
const { flowShape } = vi.hoisted(() => ({
  flowShape: () => ({
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
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
    pendingHex: null,
    handleHexConfirm: vi.fn(),
    handleHexSkip: vi.fn(),
  }),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => flowShape()),
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
  // getStore is imported by assertCanAct (loaded via useSpellCastExecutor).
  getStore: vi.fn(() => new Map()),
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

const basePlayerStats = {
  name: 'Divine_Cleric',
  rules: '2024',
  level: 17,
  attacks: [],
  bonusActions: [],
  spellAbilities: {
    spells: [{ name: 'Lesser Restoration', level: 2, range: 'Touch', casting_time: 'Bonus Action', prepared: 'Prepared' }],
    toHit: 9,
    saveDc: 17,
  },
};

// Only the fields this lane's renderers read: stage-1 target list + range copy.
const lesserRestorationPending = {
  range: 'Touch',
  creatureTargets: ['Divine_Cleric', 'Orc 1'],
};

let flow;

function mount(overrides = {}) {
  flow = { ...flowShape(), ...overrides };
  vi.mocked(useSpellMetamagicFlow).mockReturnValue(flow);
  return render(<CharBonusActions playerStats={basePlayerStats} campaignName="test-campaign" />);
}

function castOnOrc() {
  fireEvent.click(screen.getByRole('radio', { name: 'Select Orc 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cast Lesser Restoration' }));
}

describe('CharBonusActions - Lesser Restoration pickers', () => {
  beforeEach(() => {
    // resetAllMocks restores each vi.fn's original implementation (Vitest 4)
    // and clears mockReturnValue, so mount() re-seeds the flow every test.
    vi.resetAllMocks();
  });

  it('mounts the armed target picker, advances to a target-specific condition step, and routes confirm to the hook handler', async () => {
    mount({ pendingLesserRestoration: lesserRestorationPending });

    // Armed mount lists every candidate target.
    expect(screen.getByText('Lesser Restoration', { selector: '.sp-header' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Select Divine_Cleric' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Select Orc 1' })).toBeInTheDocument();

    castOnOrc();

    // Host-owned two-step state: the condition step (fed by the CHOSEN
    // target's activeConditions) replaces the target step.
    await waitFor(() => {
      expect(screen.getByText('Choose one condition to remove from Orc 1.')).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: 'Select Poisoned condition' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cast Lesser Restoration' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Select Poisoned condition' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Condition' }));
    expect(flow.handleLesserRestorationConfirm).toHaveBeenCalledTimes(1);
    // Payload bytes are popup-owned (CharSpells.Popups.restoration pins them);
    // here prove the host routes to the hook with the chosen target back.
    expect(flow.handleLesserRestorationConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ targetName: 'Orc 1', condition: 'poisoned' })
    );
  });

  it('routes Skip at the target stage to handleLesserRestorationSkip without confirming', () => {
    mount({ pendingLesserRestoration: lesserRestorationPending });
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(flow.handleLesserRestorationSkip).toHaveBeenCalledTimes(1);
    expect(flow.handleLesserRestorationConfirm).not.toHaveBeenCalled();
  });

  it('arms the shared popup mount for a pendingHex cast alone and routes its skip (CLA-066)', () => {
    mount({ pendingHex: { creatureTargets: ['Orc 1'] } });

    expect(screen.getByText('Hex', { selector: '.sp-header' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Select Orc 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Target' })).toBeInTheDocument();
    // Only the Hex leg of the gate armed — no Lesser Restoration popup leaked in.
    expect(screen.queryByRole('button', { name: 'Cast Lesser Restoration' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(flow.handleHexSkip).toHaveBeenCalledTimes(1);
    expect(flow.handleHexConfirm).not.toHaveBeenCalled();
  });
});
