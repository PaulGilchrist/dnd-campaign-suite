import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharHitPoints from './CharHitPoints.jsx';

vi.mock('../../../services/ui/storage.js', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { useRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../common/HiddenInput.jsx', () => ({
  default: vi.fn(({ value, showInput, handleInputToggle, handleValueChange }) => {
    if (showInput) {
      return (
        <input
          data-testid="hidden-input"
          type="number"
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleInputToggle}
        />
      );
    }
    return <span data-testid="hidden-value">{value}</span>;
  }),
}));

// Mock DeathSavingThrows
vi.mock('./DeathSavingThrows.jsx', () => ({
  default: vi.fn(() => <div>DeathSavingThrows</div>),
}));

// Mock savePromptService
vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
}));

describe('CharHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue(null);
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  });

  const mockPlayerStats = {
    name: 'Test Character',
    hitPoints: 45,
  };

  it('should render hit points label', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    expect(screen.getByText(/Hit Points/)).toBeInTheDocument();
  });

  it('should display max hit points', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    const clickable = document.querySelector('.clickable');
    expect(clickable.textContent).toContain('45');
  });

  it('should render HiddenInput with initial value 0', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    const hiddenVal = screen.getByTestId('hidden-value');
    expect(hiddenVal).toBeInTheDocument();
  });

  it('should use stored current HP when available', () => {
    useRuntimeValue.mockReturnValue(30);
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    expect(screen.getByTestId('hidden-value')).toHaveTextContent('30');
  });

  it('should toggle input visibility when clicked', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    const clickable = document.querySelector('.clickable');
    expect(screen.queryByTestId('hidden-input')).not.toBeInTheDocument();
    fireEvent.click(clickable);
    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
  });

  it('should toggle input visibility when keydown', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.keyDown(clickable);
    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
  });

  it('should call setRuntimeValue when HP value changes', () => {
    useRuntimeValue.mockReturnValue(30);
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '20' } });
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'currentHitPoints', 20, undefined);
  });

  it('should show cur/max label', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    expect(screen.getByText(/\(cur\/max\)/)).toBeInTheDocument();
 });

  it('should have tabIndex for accessibility', () => {
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    const clickable = document.querySelector('.clickable');
    expect(clickable).toHaveAttribute('tabIndex', '0');
  });

  it('should show DeathSavingThrows when HP is 0', () => {
    useRuntimeValue.mockReturnValue(0);
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    expect(screen.getByText(/DeathSavingThrows/)).toBeInTheDocument();
  });

  it('should hide DeathSavingThrows when HP is > 0', () => {
    useRuntimeValue.mockReturnValue(10);
    render(<CharHitPoints playerStats={mockPlayerStats} />);
    expect(screen.queryByText(/DeathSavingThrows/)).not.toBeInTheDocument();
  });

  it('should reset death saves when HP is raised above 0', () => {
    useRuntimeValue.mockReturnValue(0);
    render(<CharHitPoints playerStats={mockPlayerStats} />);

    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '10' } });

    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'currentHitPoints', 10, undefined);
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'deathSaves', [false, false, false], undefined);
    expect(setRuntimeValue).toHaveBeenCalledWith('Test Character', 'deathFailures', [false, false, false], undefined);
  });
});
