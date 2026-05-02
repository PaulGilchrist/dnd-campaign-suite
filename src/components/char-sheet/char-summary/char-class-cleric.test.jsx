import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassCleric from './char-class-cleric';

// Mock the storage service
vi.mock('../../../services/storage', () => ({
  default: {
    getProperty: vi.fn(),
    setProperty: vi.fn(),
     },
}));

// Mock HiddenInput component
vi.mock('../../common/hidden-input', () => ({
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

import storage from '../../../services/storage';

const mockPlayerStats = {
  name: 'Test Character',
  level: 5,
  rules: '5e',
  class: {
    name: 'Cleric',
    class_levels: [
         { class_specific: { channel_divinity_charges: 1, destroy_undead_cr: '1/4' } },
         { class_specific: { channel_divinity_charges: 1, destroy_undead_cr: '1/4' } },
         { class_specific: { channel_divinity_charges: 2, destroy_undead_cr: '1/2' } },
         { class_specific: { channel_divinity_charges: 2, destroy_undead_cr: '1/2' } },
         { class_specific: { channel_divinity_charges: 2, destroy_undead_cr: '1' } },
       ],
     },
};

describe('CharClassCleric', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
     });

  it('should render cleric class features', () => {
    render(<CharClassCleric playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Channel Divinity Charges:/)).toBeInTheDocument();
     });

  it('should display max channel divinity charges from class level', () => {
    render(<CharClassCleric playerStats={mockPlayerStats} />);

    const chargesDiv = screen.getByText(/Channel Divinity Charges:/).parentElement;
    expect(chargesDiv.textContent).toContain('2');
     });

  it('should display destroy undead challenge rating for 5e rules', () => {
    render(<CharClassCleric playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Destroy Undead Challenge Rating:/)).toBeInTheDocument();
    const destroyUndeadDiv = screen.getByText(/Destroy Undead Challenge Rating:/).parentElement;
    expect(destroyUndeadDiv.textContent).toContain('1');
     });

  it('should not render when class is not Cleric', () => {
    const nonClericStats = {
         ...mockPlayerStats,
      class: {
        name: 'Wizard',
        class_levels: [],
         },
       };

    render(<CharClassCleric playerStats={nonClericStats} />);

    expect(screen.queryByText(/Channel Divinity Charges:/)).not.toBeInTheDocument();
     });

  it('should not show destroy undead for 2024 rules', () => {
    const stats2024 = {
         ...mockPlayerStats,
      rules: '2024',
      class: {
           ...mockPlayerStats.class,
        class_levels: [
             { channel_divinity: 1 },
             { channel_divinity: 1 },
             { channel_divinity: 2 },
             { channel_divinity: 2 },
             { channel_divinity: 2 },
           ],
         },
       };

    render(<CharClassCleric playerStats={stats2024} />);

    expect(screen.queryByText(/Destroy Undead Challenge Rating:/)).not.toBeInTheDocument();
     });

  it('should use channel_divinity for 2024 rules', () => {
    const stats2024 = {
         ...mockPlayerStats,
      rules: '2024',
      class: {
           ...mockPlayerStats.class,
        class_levels: [
             { channel_divinity: 1 },
             { channel_divinity: 1 },
             { channel_divinity: 2 },
             { channel_divinity: 2 },
             { channel_divinity: 3 },
           ],
         },
       };

    render(<CharClassCleric playerStats={stats2024} />);

    const chargesDiv = screen.getByText(/Channel Divinity Charges:/).parentElement;
    expect(chargesDiv.textContent).toContain('3');
     });

  it('should toggle input visibility when charges div is clicked', () => {
    render(<CharClassCleric playerStats={mockPlayerStats} />);

    const chargesElement = screen.getByText(/Channel Divinity Charges:/);
    fireEvent.click(chargesElement);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
     });

  it('should call storage.setProperty when channel divinity charges value changes', () => {
    render(<CharClassCleric playerStats={mockPlayerStats} />);

    const chargesElement = screen.getByText(/Channel Divinity Charges:/);
    fireEvent.click(chargesElement);

    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '1' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
         'Test Character',
         'channelDivinityCharges',
         '1'
       );
     });

  it('should use stored channel divinity charges when available', () => {
    storage.getProperty.mockReturnValue(1);

    render(<CharClassCleric playerStats={mockPlayerStats} />);

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('1');
     });

  it('should show max/cur label', () => {
    render(<CharClassCleric playerStats={mockPlayerStats} />);

    expect(screen.getByText(/max\/cur/)).toBeInTheDocument();
     });

  it('should handle missing class_specific gracefully', () => {
    const statsWithoutClassSpecific = {
         ...mockPlayerStats,
      class: {
           ...mockPlayerStats.class,
        class_levels: [
             { class_specific: null },
           ],
         },
      level: 1,
       };

    render(<CharClassCleric playerStats={statsWithoutClassSpecific} />);

    const chargesDiv = screen.getByText(/Channel Divinity Charges:/).parentElement;
    expect(chargesDiv.textContent).toContain('0');
     });

  it('should handle missing destroy_undead_cr gracefully', () => {
    const statsWithoutDestroyUndead = {
         ...mockPlayerStats,
      class: {
           ...mockPlayerStats.class,
        class_levels: [
             { class_specific: { channel_divinity_charges: 1, destroy_undead_cr: null } },
           ],
         },
      level: 1,
       };

    render(<CharClassCleric playerStats={statsWithoutDestroyUndead} />);

    expect(screen.queryByText(/Destroy Undead Challenge Rating:/)).not.toBeInTheDocument();
     });
});