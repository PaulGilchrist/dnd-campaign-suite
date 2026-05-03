import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassWarlock from './char-class-warlock';
import classRules2024 from '../../../services/class-rules-2024';

vi.mock('../../../services/class-rules-2024', () => ({
  default: {
    getEldritchInvocations: vi.fn(() => 4),
  },
}));

  const mockPlayerStats5e = {
  name: 'Test Warlock',
  level: 11,
  rules: '5e',
  class: {
    name: 'Warlock',
    invocations: ['Agonizing Blast', 'Devils Sight'],
    eldritchInvocations: ['Arcane Charge', 'Beast Aspect'],
    pactBoon: 'Pact of the Blade',
    arcanums: ['Cone of Cold', 'Conjure Elemental', 'Dominate Person', 'Apocalypse'],
    class_levels: Array(11).fill(null).map((_, i) => ({
      class_specific: {
        invocations_known: Math.floor(i / 2) + 1,
        mystic_arcanum_level_6: i >= 6 ? 1 : 0,
        mystic_arcanum_level_7: i >= 7 ? 1 : 0,
        mystic_arcanum_level_8: i >= 8 ? 1 : 0,
        mystic_arcanum_level_9: i >= 9 ? 1 : 0,
      },
    })),
  },
};

const mockPlayerStats2024 = {
  name: 'Test Warlock 2024',
  level: 5,
  rules: '2024',
  class: {
    name: 'Warlock',
    invocations: ['Agonizing Blast'],
    eldritchInvocations: ['Arcane Charge'],
  },
};

describe('CharClassWarlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classRules2024.getEldritchInvocations.mockReturnValue(4);
  });

  it('should render warlock class features', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Invocations Known/)).toBeInTheDocument();
  });

  it('should display invocations known (5e)', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Invocations Known/)).toBeInTheDocument();
  });

   it('should display eldritch invocations (2024)', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats2024} />);

    expect(screen.getByText(/Eldritch Invocations:/)).toBeInTheDocument();
  });

   it('should display invocations list when defined', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Invocations:/)).toBeInTheDocument();
    expect(screen.getByText(/Agonizing Blast.*Devils Sight/)).toBeInTheDocument();
  });

   it('should display pact boon when defined', () => {
     render(<CharClassWarlock playerStats={mockPlayerStats5e} />);
 
     expect(screen.getByText(/Pact Boon:/)).toBeInTheDocument();
     const pactDiv = screen.getByText('Pact of the Blade').closest('div');
     expect(pactDiv.textContent).toContain('Pact of the Blade');
   });

  it('should display eldritch invocations list when defined', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Eldritch Invocations List:/)).toBeInTheDocument();
  });

  it('should show arcanums for level > 10 (5e)', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Arcanums Known \(levels 6-9\):/)).toBeInTheDocument();
  });

  it('should show arcanums when defined (5e)', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Arcanums:/)).toBeInTheDocument();
  });

  it('should not show arcanums for level <= 10', () => {
    const statsLevel5 = {
      ...mockPlayerStats5e,
      level: 5,
      class: {
        ...mockPlayerStats5e.class,
        class_levels: Array(5).fill({
          class_specific: { invocations_known: 3, mystic_arcanum_level_6: 0, mystic_arcanum_level_7: 0, mystic_arcanum_level_8: 0, mystic_arcanum_level_9: 0 },
        }),
      },
    };

    render(<CharClassWarlock playerStats={statsLevel5} />);

    expect(screen.queryByText(/Arcanums Known \(levels 6-9\):/)).not.toBeInTheDocument();
  });

  it('should not show arcanums for 2024', () => {
    render(<CharClassWarlock playerStats={mockPlayerStats2024} />);

    expect(screen.queryByText(/Arcanums Known \(levels 6-9\):/)).not.toBeInTheDocument();
  });

  it('should not render when class is not Warlock', () => {
    const nonWarlock = {
      ...mockPlayerStats5e,
      class: { name: 'Wizard', class_levels: [{ class_specific: {} }] },
    };

    const { container } = render(<CharClassWarlock playerStats={nonWarlock} />);

    expect(container.querySelector('div')).toBeNull();
  });

  it('should not show invocations list when not defined', () => {
    const statsNoInvocations = {
      ...mockPlayerStats5e,
      class: {
        name: 'Warlock',
        class_levels: [{ class_specific: { invocations_known: 0, mystic_arcanum_level_6: 0 } }],
      },
    };

    const { container } = render(<CharClassWarlock playerStats={statsNoInvocations} />);
    expect(screen.queryByText(/Invocations:/)).not.toBeInTheDocument();
  });

  it('should not show pact boon when not defined', () => {
    const statsNoPact = {
      ...mockPlayerStats5e,
      class: {
        name: 'Warlock',
        class_levels: [{ class_specific: { invocations_known: 0, mystic_arcanum_level_6: 0 } }],
      },
    };

    const { container } = render(<CharClassWarlock playerStats={statsNoPact} />);
    expect(screen.queryByText(/Pact Boon:/)).not.toBeInTheDocument();
  });

  it('should not show eldritch invocations list when empty', () => {
    const statsNoEldritch = {
      ...mockPlayerStats5e,
      class: {
        name: 'Warlock',
        invocations: [],
        eldritchInvocations: [],
        class_levels: [{ class_specific: { invocations_known: 0, mystic_arcanum_level_6: 0 } }],
      },
    };

    render(<CharClassWarlock playerStats={statsNoEldritch} />);
    expect(screen.queryByText(/Eldritch Invocations List:/)).not.toBeInTheDocument();
  });

  it('should handle missing class_levels gracefully', () => {
    const statsNoLevels = {
      ...mockPlayerStats5e,
      class: { name: 'Warlock' },
    };

    render(<CharClassWarlock playerStats={statsNoLevels} />);
    const container = document.querySelector('.warlock-stats');
    expect(document.querySelector('.fas')).not.toBeInTheDocument();
  });

  it('should use classRules2024.getEldritchInvocations for 2024', () => {
    classRules2024.getEldritchInvocations.mockReturnValue(6);
    render(<CharClassWarlock playerStats={mockPlayerStats2024} />);

    expect(classRules2024.getEldritchInvocations).toHaveBeenCalledWith(mockPlayerStats2024);
  });
});
