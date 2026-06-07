import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  generateEncounterSuggestions: vi.fn(() => []),
}));

describe('EncounterGeneratorModal', () => {
  let props;

  beforeEach(() => {
    vi.clearAllMocks();
    props = {
      monsters: [
        { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, environments: ['forest', 'grassland'] },
        { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, environments: ['forest', 'hill'] },
        { index: 'dragon', name: 'Young Dragon', xp: 5900, challenge_rating: 10, environments: ['mountain'] },
      ],
      playerLevels: [5, 5],
      difficulty: 2,
      onApply: vi.fn(),
      onClose: vi.fn(),
    };
  });

  it('should render modal with title', () => {
    render(<EncounterGeneratorModal {...props} />);
    expect(screen.getByText('Generate Encounter')).toBeInTheDocument();
  });

  it('should render environment quick pick buttons', () => {
    render(<EncounterGeneratorModal {...props} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Dungeon')).toBeInTheDocument();
    expect(screen.getByText('Wilderness')).toBeInTheDocument();
  });

  it('should render environment group checkboxes', () => {
    render(<EncounterGeneratorModal {...props} />);
    expect(screen.getByLabelText('forest')).toBeInTheDocument();
    expect(screen.getByLabelText('mountain')).toBeInTheDocument();
    expect(screen.getByLabelText('swamp')).toBeInTheDocument();
  });

  it('should show available monster count', () => {
    render(<EncounterGeneratorModal {...props} />);
    const count = document.querySelector('.gen-env-count');
    expect(count.textContent).toContain('3 monsters available');
  });

  it('should render Generate button', () => {
    render(<EncounterGeneratorModal {...props} />);
    expect(screen.getByText('Generate')).toBeInTheDocument();
  });

  it('should show empty state before generating', () => {
    render(<EncounterGeneratorModal {...props} />);
    expect(screen.getByText(/Pick environments and click Generate/)).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', () => {
    render(<EncounterGeneratorModal {...props} />);
    fireEvent.click(screen.getByText('\u00D7'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should call onClose when overlay clicked', () => {
    render(<EncounterGeneratorModal {...props} />);
    const overlay = document.querySelector('.gen-modal-overlay');
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('should not close when modal content clicked', () => {
    render(<EncounterGeneratorModal {...props} />);
    const modal = document.querySelector('.gen-modal');
    fireEvent.click(modal);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('should toggle environment when checkbox clicked', () => {
    render(<EncounterGeneratorModal {...props} />);
    const forest = screen.getByLabelText('forest');
    expect(forest.checked).toBe(true);
    fireEvent.click(forest);
    expect(forest.checked).toBe(false);
  });

  it('should set environments when quick pick clicked', () => {
    render(<EncounterGeneratorModal {...props} />);
    fireEvent.click(screen.getByText('Dungeon'));
    const forest = screen.getByLabelText('forest');
    expect(forest.checked).toBe(false);
  });

  it('should disable generate button when no monsters available', () => {
    render(<EncounterGeneratorModal {...props} monsters={[]} />);
    const btn = screen.getByText('Generate').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('should disable generate button when no player levels', () => {
    render(<EncounterGeneratorModal {...props} playerLevels={[]} />);
    const btn = screen.getByText('Generate').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('should update available count when environments toggled', () => {
    render(<EncounterGeneratorModal {...props} />);
    const forest = screen.getByLabelText('forest');
    fireEvent.click(forest);
    const count = document.querySelector('.gen-env-count');
    expect(count.textContent).toContain('3 monsters available');
  });
});
