import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSummary2 from '../char-summary2';

vi.mock('../../services/storage', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
    },
}));

const mockPlayerStats = {
  resistances: ['Fire', 'Cold'],
  immunities: ['Poison'],
  vulnerabilities: ['Lightning'],
  senses: [
    { name: 'Darkvision', value: '60 ft.' },
    { name: 'Passive Perception', value: '11' },
    ],
  proficiencies: ['Light armor', 'Simple weapons'],
  languages: ['Common', 'Elvish'],
};

describe('CharSummary2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    });

  it('should render resistances', () => {
    render(<CharSummary2 playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Resistances/)).toBeInTheDocument();
    expect(screen.getByText(/Fire, Cold/)).toBeInTheDocument();
    });

  it('should render immunities', () => {
    render(<CharSummary2 playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Immunities/)).toBeInTheDocument();
    expect(screen.getByText('Poison')).toBeInTheDocument();
    });

  it('should render vulnerabilities', () => {
    render(<CharSummary2 playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Vulnerabilities/)).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
    });

  it('should render senses', () => {
    render(<CharSummary2 playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Senses/)).toBeInTheDocument();
    });

  it('should render proficiencies', () => {
    render(<CharSummary2 playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Proficiencies/)).toBeInTheDocument();
    });

  it('should render languages', () => {
    render(<CharSummary2 playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Languages/)).toBeInTheDocument();
    });

  it('should not render resistances section when empty', () => {
    const stats = { ...mockPlayerStats, resistances: [] };
    render(<CharSummary2 playerStats={stats} />);

    expect(screen.queryByText(/Resistances/)).not.toBeInTheDocument();
    });

  it('should not render immunities section when empty', () => {
    const stats = { ...mockPlayerStats, immunities: [] };
    render(<CharSummary2 playerStats={stats} />);

    expect(screen.queryByText(/Immunities/)).not.toBeInTheDocument();
    });

  it('should not render vulnerabilities section when empty', () => {
    const stats = { ...mockPlayerStats, vulnerabilities: [] };
    render(<CharSummary2 playerStats={stats} />);

    expect(screen.queryByText(/Vulnerabilities/)).not.toBeInTheDocument();
    });

  it('should handle null resistances gracefully', () => {
    const stats = { ...mockPlayerStats, resistances: null };
    render(<CharSummary2 playerStats={stats} />);

    expect(screen.queryByText(/Resistances/)).not.toBeInTheDocument();
    });

  it('should handle proficiencies correctly', () => {
    const stats = { ...mockPlayerStats, proficiencies: ['Test'] };
    render(<CharSummary2 playerStats={stats} />);

    expect(screen.getByText(/Proficiencies/)).toBeInTheDocument();
    });

  it('should handle empty languages array', () => {
    const stats = { ...mockPlayerStats, languages: [] };
    render(<CharSummary2 playerStats={stats} />);

    expect(screen.getByText(/Languages/)).toBeInTheDocument();
    });
});
