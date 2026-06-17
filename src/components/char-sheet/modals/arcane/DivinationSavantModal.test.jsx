import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DivinationSavantModal from './DivinationSavantModal.jsx';

// ── Test fixtures ──

const divinationSpells = [
  'Identify',
  'Nystul\'s Magic Aura',
  'Secret Page',
  'Detect Thoughts',
  'Comprehend Languages',
  'Augury',
  'Silent Image',
  'Minor Illusion',
];

const basePayload = {
  divinationOptions: divinationSpells,
  selectedSpells: [],
};

const baseProps = {
  payload: basePayload,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('DivinationSavantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay with test id', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(document.querySelector('[data-testid="divination-savant-modal"]')).toBeInTheDocument();
  });

  it('renders modal header with title', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByText('Divination Savant')).toBeInTheDocument();
  });

  it('renders description text explaining the feature', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByText(/Choose two Wizard spells from the Divination school/)).toBeInTheDocument();
  });

  it('renders two spell select dropdowns', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    expect(selects).toHaveLength(2);
  });

  it('renders labels for both spell selectors', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByText('Divination spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Divination spell 2:')).toBeInTheDocument();
  });

  it('renders all divination options in each dropdown', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    selects.forEach((select) => {
      divinationSpells.forEach((spell) => {
        expect(select.querySelector(`option[value="${spell}"]`)).toBeInTheDocument();
      });
    });
  });

  it('renders confirm button', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('disables confirm button when no spells selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('disables confirm button when both spells are the same', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Identify' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
  });

  it('enables confirm button when two different spells are selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeEnabled();
  });

  // ── Existing selection display ──

  it('shows current selection text when spells are pre-selected', () => {
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: ['Secret Page', 'Silent Image'] } })} />);
    expect(screen.getByText(/Current:/)).toBeInTheDocument();
    const paragraphs = document.querySelectorAll('p');
    const currentPara = Array.from(paragraphs).find(p => p.textContent.includes('Current:'));
    expect(currentPara.textContent).toContain('Secret Page');
    expect(currentPara.textContent).toContain('Silent Image');
  });

  it('does not show current selection text when no spells pre-selected', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
  });

  // ── Spell selection via dropdowns ──

  it('updates first spell selection onChange', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    expect(selects[0].value).toBe('Identify');
  });

  it('updates second spell selection onChange', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    expect(selects[1].value).toBe('Augury');
  });

  it('initializes first spell from pre-selected spells', () => {
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: ['Secret Page', 'Silent Image'] } })} />);
    const selects = document.querySelectorAll('select');
    expect(selects[0].value).toBe('Secret Page');
    expect(selects[1].value).toBe('Silent Image');
  });

  // ── Confirm interaction ──

  it('calls onConfirm with selected spells when confirm clicked', () => {
    const onConfirm = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onConfirm })} />);
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Identify' } });
    fireEvent.change(selects[1], { target: { value: 'Augury' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Identify', 'Augury');
  });

  it('calls onConfirm with pre-selected values when confirm clicked without changes', () => {
    const onConfirm = vi.fn();
    render(<DivinationSavantModal {...makeProps({ payload: { ...basePayload, selectedSpells: ['Augury', 'Secret Page'] }, onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).toHaveBeenCalledWith('Augury', 'Secret Page');
  });

  it('does not call onConfirm when confirm is disabled', () => {
    const onConfirm = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.popup-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Modal structure ──

  it('renders with popup-overlay and popup-modal CSS classes', () => {
    render(<DivinationSavantModal {...makeProps()} />);
    expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    expect(document.querySelector('.popup-modal')).toBeInTheDocument();
  });

  it('does not trigger onClose when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<DivinationSavantModal {...makeProps({ onClose })} />);
    const modal = document.querySelector('.popup-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });
});
