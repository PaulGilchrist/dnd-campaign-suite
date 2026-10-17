import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ArcaneWardRestoreModal from './ArcaneWardRestoreModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeBatch: vi.fn(),
}));

// Re-import mocked module after mocking
import { getRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const PLAYER = 'Sorcerer1';
const CAMPAIGN = 'test-campaign';

function makeProps(overrides) {
  return {
    action: { name: 'Arcane Ward Restore' },
    playerStats: { name: PLAYER },
    campaignName: CAMPAIGN,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

// Mirrors the component's runtime read path (ward HP, ward max, slot levels 1-9).
// setRuntimeBatch is the component's ONLY server-first write path — exact-arg
// assertions on it pin the write contract.
function stubRuntime(wardHp, wardMax, slots = {}) {
  getRuntimeValue.mockImplementation((key, prop) => {
    if (key !== PLAYER) return null;
    if (prop === 'arcaneWardHp') return wardHp;
    if (prop === 'arcaneWardMax') return wardMax;
    const match = prop.match(/^spell_slots_level_(\d+)$/);
    if (match) return slots[Number(match[1])] ?? 0;
    return null;
  });
}

// Label spans concatenate without spaces ("Level 12 available+2 HP"), so anchor
// on "Level N" — each digit 1-9 still uniquely identifies its radio.
function slotRadio(level) {
  return screen.getByRole('radio', { name: new RegExp(`^Level ${level}`) });
}

function slotOption(level) {
  return slotRadio(level).closest('label');
}

// ── Tests ──

describe('ArcaneWardRestoreModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRuntime(10, 20, { 1: 2, 2: 1 });
  });

  afterEach(() => {
    getRuntimeValue.mockReset();
    setRuntimeBatch.mockReset();
  });

  // ── Initial render / display ──

  it('renders header, ward HP, slot grid states, and a disabled Restore button with no selection', async () => {
    render(<ArcaneWardRestoreModal {...makeProps()} />);
    expect(screen.getByText('Arcane Ward Restore')).toBeInTheDocument();
    expect(screen.getByText('Arcane Ward HP:')).toBeInTheDocument();
    expect(await screen.findByText('10/20')).toBeInTheDocument();
    expect(screen.getByText(/Choose a spell slot level to expend/)).toBeInTheDocument();

    // Levels 1-2 have slots (selectable), levels 3-9 are exhausted and disabled
    for (let lvl = 1; lvl <= 9; lvl++) {
      const radio = slotRadio(lvl);
      expect(screen.getByText(`+${lvl * 2} HP`)).toBeInTheDocument();
      expect(radio).not.toBeChecked();
      if (lvl <= 2) {
        expect(radio).toBeEnabled();
      } else {
        expect(radio).toBeDisabled();
      }
    }
    expect(slotOption(1)).toHaveTextContent('2 available');
    expect(slotOption(3)).toHaveTextContent('0 available');

    expect(screen.queryByText('Preview:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Ward' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('defaults ward HP to 0/0 when runtime values are missing', async () => {
    getRuntimeValue.mockReturnValue(null);
    render(<ArcaneWardRestoreModal {...makeProps()} />);
    expect(await screen.findByText('0/0')).toBeInTheDocument();
  });

  // ── Selection behavior ──

  it('selects an available level, switches cleanly, and blocks exhausted levels', async () => {
    const { container } = render(<ArcaneWardRestoreModal {...makeProps()} />);
    await screen.findByText('10/20');

    fireEvent.click(slotOption(1));
    expect(slotRadio(1)).toBeChecked();
    expect(container.querySelector('.arcane-ward-preview').textContent).toContain('10 → 12/20');
    expect(screen.getByRole('button', { name: 'Restore Ward' })).toBeEnabled();

    fireEvent.click(slotOption(2));
    expect(slotRadio(2)).toBeChecked();
    expect(slotRadio(1)).not.toBeChecked();
    expect(container.querySelector('.arcane-ward-preview').textContent).toContain('10 → 14/20');

    // Exhausted level 3 stays inert: selection unchanged, button still enabled
    fireEvent.click(slotOption(3));
    expect(slotRadio(3)).not.toBeChecked();
    expect(slotRadio(2)).toBeChecked();
    expect(screen.getByRole('button', { name: 'Restore Ward' })).toBeEnabled();
  });

  // ── Restore flow — exact write payload + confirm args ──

  // Consolidates the old cap-HP, decrement-slot, zero-HP, and highest-level cases:
  // each row exercises the full flow (select → preview → apply) at a different
  // ward/slot boundary, asserting the exact setRuntimeBatch payload (the server-first
  // write contract), exact onConfirm args, and a single close.
  it.each([
    {
      label: 'restores from partial HP',
      wardHp: 10, wardMax: 20, slots: { 1: 2, 2: 1 }, level: 1,
      write: { arcaneWardHp: 12, spell_slots_level_1: 1 },
      confirm: [1, 2, 10, 12],
    },
    {
      label: 'caps at max and fully exhausts the slot',
      wardHp: 18, wardMax: 20, slots: { 1: 2, 2: 1 }, level: 2,
      write: { arcaneWardHp: 20, spell_slots_level_2: 0 },
      confirm: [2, 4, 18, 20],
    },
    {
      label: 'restores from an empty ward using the highest remaining slot',
      wardHp: 0, wardMax: 30, slots: { 9: 1 }, level: 9,
      write: { arcaneWardHp: 18, spell_slots_level_9: 0 },
      confirm: [9, 18, 0, 18],
    },
  ])('$label: spends exactly one slot with an exact batch write', async ({
    wardHp, wardMax, slots, level, write, confirm,
  }) => {
    stubRuntime(wardHp, wardMax, slots);
    const props = makeProps();
    const { container } = render(<ArcaneWardRestoreModal {...props} />);
    await screen.findByText(`${wardHp}/${wardMax}`);

    fireEvent.click(slotOption(level));
    expect(slotRadio(level)).toBeChecked();
    expect(container.querySelector('.arcane-ward-preview').textContent)
      .toContain(`${wardHp} → ${write.arcaneWardHp}/${wardMax}`);

    fireEvent.click(screen.getByRole('button', { name: 'Restore Ward' }));

    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).toHaveBeenCalledWith(PLAYER, write, CAMPAIGN);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(...confirm);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Restore inert when nothing is selected — no write, no confirm, no close', async () => {
    const props = makeProps();
    render(<ArcaneWardRestoreModal {...props} />);
    await screen.findByText('10/20');
    fireEvent.click(screen.getByRole('button', { name: 'Restore Ward' }));
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('still writes the ward and closes exactly once when onConfirm is omitted', async () => {
    const props = makeProps({ onConfirm: undefined });
    render(<ArcaneWardRestoreModal {...props} />);
    await screen.findByText('10/20');
    fireEvent.click(slotOption(1));
    fireEvent.click(screen.getByRole('button', { name: 'Restore Ward' }));
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).toHaveBeenCalledWith(
      PLAYER,
      { arcaneWardHp: 12, spell_slots_level_1: 1 },
      CAMPAIGN
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('disables every slot and blocks selection when no spell slots remain', async () => {
    stubRuntime(10, 20, {});
    const { container } = render(<ArcaneWardRestoreModal {...makeProps()} />);
    await screen.findByText('10/20');

    for (let lvl = 1; lvl <= 9; lvl++) {
      expect(slotRadio(lvl)).toBeDisabled();
      fireEvent.click(slotOption(lvl));
    }
    expect(container.querySelector('.arcane-ward-preview')).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore Ward' })).toBeDisabled();
    expect(setRuntimeBatch).not.toHaveBeenCalled();
  });

  // ── Close / dismiss behavior ──

  it('Cancel closes exactly once and submits nothing', () => {
    const props = makeProps();
    render(<ArcaneWardRestoreModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).not.toHaveBeenCalled();
  });

  it('clicking the overlay background is inert — no close, no write, selection kept', async () => {
    const props = makeProps();
    const { container } = render(<ArcaneWardRestoreModal {...props} />);
    await screen.findByText('10/20');
    fireEvent.click(slotOption(1));

    fireEvent.click(container.querySelector('.arcane-ward-restore-overlay'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(slotRadio(1)).toBeChecked();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders and ignores Cancel when onClose is omitted', () => {
    const props = makeProps();
    delete props.onClose;
    render(<ArcaneWardRestoreModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(setRuntimeBatch).not.toHaveBeenCalled();
  });
});
