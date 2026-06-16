import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealingIllusionModal from './HealingIllusionModal.jsx';

// ── Mocked modules (before the component import) ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

// ── Re-import mocked modules ──
import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as healingRoll from '../../../services/automation/common/healingRoll.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Paladin1', level: 5, hitPoints: 40 };
const mockCampaignName = 'test-campaign';
const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    action: { name: 'Healing Illusion' },
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('HealingIllusionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Default mock for getRuntimeValue
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    useRuntimeState.setRuntimeValue.mockResolvedValue();
  });

  // ── Initial render ──

  it('renders the modal overlay', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders the modal structure (overlay, modal, header, body, actions)', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders the header with heart icon and title', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
    const icon = document.querySelector('.fa-solid.fa-heart');
    expect(icon).toBeInTheDocument();
  });

  it('displays the instruction text with heal amount', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    expect(screen.getByText(/Choose a target within 5 feet to regain 5 HP/)).toBeInTheDocument();
  });

  it('uses player level as heal amount', () => {
    render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level: 10 } })} />);
    expect(screen.getByText(/Choose a target within 5 feet to regain 10 HP/)).toBeInTheDocument();
  });

  it('defaults to 1 HP when level is falsy', () => {
    render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level: 0 } })} />);
    expect(screen.getByText(/Choose a target within 5 feet to regain 1 HP/)).toBeInTheDocument();
  });

  it('defaults to 1 HP when level is undefined', () => {
    render(<HealingIllusionModal {...makeProps({ playerStats: { name: 'Test' } })} />);
    expect(screen.getByText(/Choose a target within 5 feet to regain 1 HP/)).toBeInTheDocument();
  });

  // ── Self target radio option ──

  it('renders self target radio option with player name', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    expect(document.querySelector('input[type="radio"][value="Paladin1"]')).toBeInTheDocument();
    expect(screen.getByText(/Paladin1 \(self\)/)).toBeInTheDocument();
  });

  it('has self target radio selected by default', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const selfRadio = document.querySelector('input[type="radio"][value="Paladin1"]');
    expect(selfRadio.checked).toBe(true);
  });

  // ── Custom target radio option ──

  it('renders custom target radio option', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    expect(customRadio).toBeInTheDocument();
    expect(customRadio.checked).toBe(false);
  });

  it('renders a text input for custom target name', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customInput = document.querySelector('input[type="text"]');
    expect(customInput).toBeInTheDocument();
    expect(customInput).toHaveAttribute('placeholder', 'creature name');
  });

  it('has custom input disabled when not selected', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customInput = document.querySelector('input[type="text"]');
    expect(customInput.disabled).toBe(true);
  });

  it('enables custom input when custom target is selected', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    expect(customInput.disabled).toBe(false);
  });

  it('updates customName state when text input changes', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    expect(customInput.value).toBe('Orc Warrior');
  });

  // ── Heal button ──

  it('renders Heal button with heart icon', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const healBtn = screen.getByRole('button', { name: /Heal/ });
    expect(healBtn).toBeInTheDocument();
    expect(healBtn.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
    expect(healBtn.classList.contains('sp-roll-btn')).toBe(true);
  });

  it('renders Skip button', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  // ── Skip / close behavior ──

  it('calls onClose when Skip button is clicked', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal content', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // ── Healing action: self target ──

  it('heals self target when Heal button clicked', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1',
        'currentHitPoints',
        25,
        mockCampaignName
      );
    });
  });

  it('caps heal to max HP when current + heal exceeds max', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 38;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1',
        'currentHitPoints',
        40,
        mockCampaignName
      );
    });
  });

  it('logs healing to SSE with correct info for self', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(mockCampaignName, {
        targetName: 'Paladin1',
        sourceName: 'Healing Illusion',
        actualHeal: 5,
        newHp: 25,
        maxHp: 40,
      });
    });
  });

  it('dispatches combat-summary-updated event on heal', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
    });
    dispatchSpy.mockRestore();
  });

  // ── Healing action: custom target ──

  it('heals custom target when Heal button clicked with custom name', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 30;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Orc Warrior',
        'currentHitPoints',
        15,
        mockCampaignName
      );
    });
  });

  it('logs healing to SSE with correct info for custom target', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 30;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(mockCampaignName, {
        targetName: 'Orc Warrior',
        sourceName: 'Healing Illusion',
        actualHeal: 5,
        newHp: 15,
        maxHp: 30,
      });
    });
  });

  it('caps heal to max HP for custom target', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 28;
      if (key === 'hitPoints') return 30;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Orc Warrior',
        'currentHitPoints',
        30,
        mockCampaignName
      );
    });
  });

  // ── Healing action: empty custom name ──

  it('does not heal when custom name is empty string', async () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    });
  });

  it('does not heal when custom name is whitespace only', async () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── Applied / result state ──

  it('shows result message after healing self', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByText(/Healing Illusion restored 5 HP to Paladin1/)).toBeInTheDocument();
    });
  });

  it('shows result message after healing custom target', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 10;
      if (key === 'hitPoints') return 30;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByText(/Healing Illusion restored 5 HP to Orc Warrior/)).toBeInTheDocument();
    });
  });

  it('shows Cleric level in result message', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByText(/Cleric level 5/)).toBeInTheDocument();
    });
  });

  it('caps heal amount in result message', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 38;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      // Healed 2 HP (38 + 5 = 43, capped at 40, so actual heal = 2)
      expect(screen.getByText(/Healing Illusion restored 2 HP to Paladin1/)).toBeInTheDocument();
    });
  });

  it('hides selection options after healing', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.queryByText(/Choose a target within 5 feet/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    });
  });

  it('renders Done button in applied state', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('Done button has sp-roll-btn class', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      const doneBtn = screen.getByRole('button', { name: 'Done' });
      expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
    });
  });

  it('calls onClose when Done button is clicked', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking overlay in applied state', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close modal when clicking inside modal in applied state', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // ── Edge cases: runtime values ──

  it('handles missing currentHitPoints runtime value (defaults to 0)', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(null);

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1',
        'currentHitPoints',
        5,
        mockCampaignName
      );
    });
  });

  it('handles missing hitPoints for custom target (defaults to 0)', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 10;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      // newHp = Math.min(0, 10 + 5) = 0
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Orc Warrior',
        'currentHitPoints',
        0,
        mockCampaignName
      );
    });
  });

  it('handles non-numeric currentHitPoints by defaulting to 0', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue('not-a-number');

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1',
        'currentHitPoints',
        5,
        mockCampaignName
      );
    });
  });

  it('handles non-numeric hitPoints for custom target by defaulting to 0', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 10;
      return 'bad';
    });

    render(<HealingIllusionModal {...makeProps()} />);
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    fireEvent.click(customRadio);
    const customInput = document.querySelector('input[type="text"]');
    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Orc Warrior',
        'currentHitPoints',
        0,
        mockCampaignName
      );
    });
  });

  // ── Healing when already at max HP ──

  it('heals to max when already at max HP (actual heal = 0)', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 40;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1',
        'currentHitPoints',
        40,
        mockCampaignName
      );
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(mockCampaignName, {
        targetName: 'Paladin1',
        sourceName: 'Healing Illusion',
        actualHeal: 0,
        newHp: 40,
        maxHp: 40,
      });
    });
  });

  // ── Result state renders heart icon and proper structure ──

  it('renders heart icon in result state header', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      return null;
    });

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-solid.fa-heart');
      expect(icon).toBeInTheDocument();
    });
  });

  // ── Radio selection behavior ──

  it('switches from self to custom target selection', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const selfRadio = document.querySelector('input[type="radio"][value="Paladin1"]');
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');
    expect(selfRadio.checked).toBe(true);
    expect(customRadio.checked).toBe(false);

    fireEvent.click(customRadio);
    expect(selfRadio.checked).toBe(false);
    expect(customRadio.checked).toBe(true);
  });

  it('switches from custom back to self target selection', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const selfRadio = document.querySelector('input[type="radio"][value="Paladin1"]');
    const customRadio = document.querySelector('input[type="radio"][value="custom"]');

    fireEvent.click(customRadio);
    expect(customRadio.checked).toBe(true);

    fireEvent.click(selfRadio);
    expect(selfRadio.checked).toBe(true);
    expect(customRadio.checked).toBe(false);
  });
});
