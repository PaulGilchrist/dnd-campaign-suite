// @maintained-by-ai
// Regression: the generator's environment selection must cover ALL 12
// environments the bestiary models (public/data/monsters.json), including
// 'planar' — previously the group chips and the All preset listed only 11,
// making planar-only monsters (e.g. Tiamat) permanently un-generatable while
// the EB table's Planar filter chip served them fine.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { generateEncounterSuggestions } from '../../services/encounters/encounterGenerator.js';
import EncounterGeneratorModal from './EncounterGeneratorModal.jsx';

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  generateEncounterSuggestions: vi.fn(),
}));

const generateMock = vi.mocked(generateEncounterSuggestions);

// Tiamat-shaped planar-only monster + a forest control.
const MONSTERS = [
  { index: 'tiamat', name: 'Tiamat', challenge_rating: 30, xp: 155000, environments: ['planar'] },
  { index: 'goblin', name: 'Goblin', challenge_rating: 0.25, xp: 50, environments: ['forest', 'grassland'] },
];

function renderModal(overrides = {}) {
  return render(
    <EncounterGeneratorModal
      monsters={MONSTERS}
      playerLevels={[20]}
      difficulty={1}
      onApply={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

describe('EncounterGeneratorModal planar environment coverage', () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateMock.mockReturnValue([]);
  });

  it('opens with a checked Planar group and counts planar-only monsters in the census', () => {
    renderModal();
    const planarCheckbox = screen.getByLabelText('planar');
    expect(planarCheckbox).toBeChecked();
    expect(screen.getByText('2 monsters available')).toBeInTheDocument();
  });

  it('the All quick pick keeps planar selected and sends it to the suggestion generator', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByLabelText('planar')).toBeChecked();
    expect(screen.getByText('2 monsters available')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock.mock.calls[0][0].environments).toContain('planar');
  });

  it('unselecting planar alone drops the planar-only monster from the census', () => {
    renderModal();
    fireEvent.click(screen.getByLabelText('planar'));
    expect(screen.getByLabelText('planar')).not.toBeChecked();
    expect(screen.getByText('1 monster available')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(generateMock.mock.calls[0][0].environments).not.toContain('planar');
  });
});
