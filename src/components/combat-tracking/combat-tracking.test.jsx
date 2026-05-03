import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatTracking from './combat-tracking.jsx';

vi.mock('../common/subscriber', () => ({
  default: () => <div data-testid="subscriber" />,
}));

vi.mock('../../services/storage', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../services/utils', () => ({
  default: {
    guid: vi.fn(() => 'test-guid'),
    getFirstName: vi.fn((name) => name?.split(' ')[0] || name),
  },
}));

vi.mock('lodash', () => ({
  cloneDeep: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
  isEqual: vi.fn(() => false),
}));

describe('CombatTracking', () => {
  it('should render without crashing', () => {
    render(<CombatTracking characters={[]} />);
    expect(screen.getByText(/Combat Tracking/)).toBeInTheDocument();
  });

  it('should render with characters', () => {
    render(<CombatTracking characters={[{ name: 'Gandalf' }]} />);
    expect(screen.getByText('Gandalf')).toBeInTheDocument();
  });

  it('should show armor class', () => {
    render(<CombatTracking characters={[{ name: 'Gandalf', armorClass: 15 }]} />);
    expect(document.querySelector('.combat-tracking')).toBeInTheDocument();
  });

  it('should show hit points', () => {
    render(<CombatTracking characters={[{ name: 'Gandalf', hitPoints: 45 }]} />);
    expect(document.querySelector('.combat-tracking')).toBeInTheDocument();
  });

  it('should show speed', () => {
    render(<CombatTracking characters={[{ name: 'Gandalf', speed: 30 }]} />);
    expect(document.querySelector('.combat-tracking')).toBeInTheDocument();
  });

  it('should show initiative', () => {
    render(<CombatTracking characters={[{ name: 'Gandalf' }]} />);
    const initiativeInputs = document.querySelectorAll('input[type="number"]');
    expect(initiativeInputs.length).toBeGreaterThan(0);
  });

  it('should show notes', () => {
    render(<CombatTracking characters={[{ name: 'Gandalf' }]} />);
    const textInputs = document.querySelectorAll('input[type="text"]');
    expect(textInputs.length).toBeGreaterThan(0);
  });
});
