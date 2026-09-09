// CLA-374 regression: the Special Actions "Use Magic Device:" row must render
// clickable (real isInteractiveAutomation, NOT mocked — locks INTERACTIVE_
// HANDLER_TYPES membership) and dispatch through executeHandler to
// handleUseMagicDevice, showing the activation popup (previously the row was
// inert <b className=""> with zero popup/log/state — pitfall 42l family).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock executeHandler — assert dispatch reachability for use_magic_device
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

// NOTE: automationService.js is deliberately NOT mocked — the real
// isInteractiveAutomation/INTERACTIVE_HANDLER_TYPES is the fix under test.

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));

const runtimeStore = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, runtimeKey) => runtimeStore[runtimeKey] ?? null),
  setRuntimeValue: vi.fn((_key, runtimeKey, value, _campaign) => {
    runtimeStore[runtimeKey] = value;
    return Promise.resolve();
  }),
  useRuntimeValue: vi.fn((_key, runtimeKey) => runtimeStore[runtimeKey] ?? null),
}));

let _capturedPopup = null;
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({
    setPopupHtml: (html) => { _capturedPopup = html; },
  })),
}));

vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: {}, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('./CharSpecialActionsModals.jsx', () => ({
  default: () => null,
}));

import { executeHandler } from '../../services/automation/index.js';

const basePlayerStats = {
  name: 'AasimarTest',
  level: 20,
  rules: '2024',
  specialActions: [],
  class: { fightingStyles: [] },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 6,
};

function makeUseMagicDeviceRow() {
  return {
    name: 'Use Magic Device',
    description: 'Attune to up to 4 magic items at once.',
    automation: {
      type: 'use_magic_device',
      attunementLimit: 4,
      chargeReroll: '1d6',
      chargeRerollSuccess: 6,
      scrollAbility: 'INT',
      scrollCheckDC: '10 + spell_level',
      scrollDisintegratesOnFail: true,
      casting_time: 'passive',
      hasAutomation: true,
    },
  };
}

describe('CharSpecialActions - Use Magic Device row (CLA-374)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _capturedPopup = null;
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
  });

  it('renders the row clickable (real INTERACTIVE_HANDLER_TYPES membership)', () => {
    render(<CharSpecialActions playerStats={{ ...basePlayerStats, specialActions: [makeUseMagicDeviceRow()] }} campaignName="test" />);
    const label = screen.getByText('Use Magic Device:');
    expect(label.className).toBe('clickable');
  });

  it('row click dispatches executeHandler for use_magic_device', async () => {
    const row = makeUseMagicDeviceRow();
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Use Magic Device',
        automationType: 'use_magic_device',
        description: 'Use Magic Device activated. Attune to up to 4 magic items.',
      },
    });

    render(<CharSpecialActions playerStats={{ ...basePlayerStats, specialActions: [row] }} campaignName="test" />);

    fireEvent.click(screen.getByText('Use Magic Device:'));

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledWith(row, expect.objectContaining({ name: 'AasimarTest' }), 'test', undefined, undefined);
    });
    await waitFor(() => {
      expect(_capturedPopup).toContain('Attune to up to 4 magic items');
    });
  });
});
