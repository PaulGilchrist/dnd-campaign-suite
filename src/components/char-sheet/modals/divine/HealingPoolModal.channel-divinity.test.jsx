import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
}));

vi.mock('../../../../services/combat/conditions/conditionUtils.js', () => ({
  CONDITIONS: [
    { key: 'blinded', label: 'Blinded' },
    { key: 'poisoned', label: 'Poisoned' },
  ],
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as applyHealingService from '../../../../services/rules/combat/applyHealing.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Test fixtures ──

const campaignName = 'test-campaign';

const clericStats = {
  name: 'Divine_Cleric',
  level: 17,
  hitPoints: 90,
  abilities: { CHA: 16 },
  class: {
    class_levels: Array.from({ length: 17 }, (_, i) => ({
      level: i + 1,
      channel_divinity: i === 16 ? 3 : undefined,
    })),
  },
};

const playerTarget = {
  name: 'LightfootHalfling',
  type: 'player',
  maxHp: 21,
  currentHp: 10,
  conditions: [],
};

const mockCombatSummary = {
  creatures: [
    { name: 'Divine_Cleric', type: 'player' },
    playerTarget,
  ],
};

let updateFn;

function setupPoolMock(current = 85, max = 85) {
  updateFn = vi.fn();
  useTrackedResource.mockReturnValue({ current, max, update: updateFn });
}

function makeProps(overrides) {
  return {
    playerStats: clericStats,
    campaignName,
    name: 'Preserve Life',
    bloodiedOnly: true,
    resourceCost: 'channel_divinity',
    onClose: vi.fn(),
    ...(overrides ?? {}),
  };
}

async function renderModal(overrides) {
  setupPoolMock();
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  return { ...rendered, updateFn };
}

function cdWrites() {
  return useRuntimeState.setRuntimeValue.mock.calls.filter(
    ([, key]) => key === 'channelDivinityCharges',
  );
}

// ── Tests ──

describe('HealingPoolModal - Channel Divinity consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    applyHealingService.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      actualHeal: amount,
      oldHp: 10,
      newHp: 10 + amount,
    }));
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'channelDivinityCharges') return 3;
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 21;
      if (key === 'activeConditions') return [];
      return null;
    });
    setupPoolMock();
  });

  it('expend exactly one Channel Divinity charge on first heal of a session', async () => {
    await renderModal();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(cdWrites()).toEqual([['Divine_Cleric', 'channelDivinityCharges', 2, campaignName]]);
  });

  it('does not expend additional charges on subsequent heals in the same session', async () => {
    await renderModal();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(cdWrites()).toHaveLength(1);
    expect(updateFn).toHaveBeenCalledTimes(3);
  });

  it('logs an ability_use entry when expending Channel Divinity', async () => {
    await renderModal();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    await waitFor(() => {
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Divine_Cleric',
          abilityName: 'Preserve Life',
          description: 'Divine_Cleric expended 1 Channel Divinity to use Preserve Life (2/3 remaining).',
        }),
      );
    });
  });

  it('does not spend Channel Divinity for non-CD healing_pool features (Lay on Hands)', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'channelDivinityCharges') return 3;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      return null;
    });

    setupPoolMock(50, 50);
    render(
      <HealingPoolModal
        {...makeProps({
          name: 'Lay On Hands',
          resourceCost: '',
          resourceKey: 'layOnHandsPool',
          bloodiedOnly: false,
        })}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(cdWrites()).toHaveLength(0);
  });
});
