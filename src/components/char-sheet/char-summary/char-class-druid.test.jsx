import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharClassDruid from './char-class-druid';

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

// Mock classRules (5e)
vi.mock('../../../services/class-rules', () => ({
  default: {
    getDruidMaxWildShapeChallengeRating: vi.fn(),
    getDruidWildShapeUses: vi.fn(),
    getDruidBeastKnownForms: vi.fn(),
    getDruidBeastFlySpeed: vi.fn(),
  },
}));

// Mock classRules2024
vi.mock('../../../services/class-rules-2024', () => ({
  default: {
    getDruidMaxWildShapeChallengeRating: vi.fn(),
    getDruidWildShapeUses: vi.fn(),
    getDruidBeastKnownForms: vi.fn(),
    getDruidBeastFlySpeed: vi.fn(),
  },
}));

import storage from '../../../services/storage';
import classRules from '../../../services/class-rules';
import classRules2024 from '../../../services/class-rules-2024';

const mockPlayerStats5e = {
  name: 'Test Druid',
  level: 5,
  rules: '5e',
  class: {
    name: 'Druid',
    class_levels: [
       { class_specific: { wild_shape_max_cr: 0, wild_shape_fly: false, wild_shape_swim: false } },
       { class_specific: { wild_shape_max_cr: 1, wild_shape_fly: false, wild_shape_swim: false } },
       { class_specific: { wild_shape_max_cr: 1, wild_shape_fly: false, wild_shape_swim: false } },
       { class_specific: { wild_shape_max_cr: 1, wild_shape_fly: false, wild_shape_swim: false } },
       { class_specific: { wild_shape_max_cr: 2, wild_shape_fly: false, wild_shape_swim: true } },
     ],
   },
};

const mockPlayerStats2024 = {
  name: 'Test Druid 2024',
  level: 5,
  rules: '2024',
  class: {
    name: 'Druid',
    class_levels: [
       { beast_max_cr: 0, wild_shape: 2, beast_known_forms: 2, beast_fly_speed: 'No' },
       { beast_max_cr: 1, wild_shape: 2, beast_known_forms: 2, beast_fly_speed: 'No' },
       { beast_max_cr: 1, wild_shape: 2, beast_known_forms: 2, beast_fly_speed: 'No' },
       { beast_max_cr: 1, wild_shape: 2, beast_known_forms: 2, beast_fly_speed: 'No' },
       { beast_max_cr: 2, wild_shape: 3, beast_known_forms: 3, beast_fly_speed: 'Yes' },
     ],
   },
};

describe('CharClassDruid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getProperty.mockReturnValue(null);
    
    // Default mocks for 5e
    classRules.getDruidMaxWildShapeChallengeRating.mockReturnValue(2);
    classRules.getDruidWildShapeUses.mockReturnValue(2);
    classRules.getDruidBeastKnownForms.mockReturnValue(0);
    classRules.getDruidBeastFlySpeed.mockReturnValue(undefined);
    
    // Default mocks for 2024
    classRules2024.getDruidMaxWildShapeChallengeRating.mockReturnValue(2);
    classRules2024.getDruidWildShapeUses.mockReturnValue(3);
    classRules2024.getDruidBeastKnownForms.mockReturnValue(3);
    classRules2024.getDruidBeastFlySpeed.mockReturnValue(true);
  });

  it('should not render when class is not Druid', () => {
    const nonDruidStats = {
      ...mockPlayerStats5e,
      class: {
        name: 'Wizard',
        class_levels: [
            { class_specific: { wild_shape_max_cr: 0, wild_shape_fly: false, wild_shape_swim: false } },
            { class_specific: { wild_shape_max_cr: 0, wild_shape_fly: false, wild_shape_swim: false } },
            { class_specific: { wild_shape_max_cr: 0, wild_shape_fly: false, wild_shape_swim: false } },
            { class_specific: { wild_shape_max_cr: 0, wild_shape_fly: false, wild_shape_swim: false } },
            { class_specific: { wild_shape_max_cr: 0, wild_shape_fly: false, wild_shape_swim: false } },
          ],
        },
      };

    render(<CharClassDruid playerStats={nonDruidStats} />);

    expect(screen.queryByText(/Wild Shape Uses:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wild Shape Max Challenge Rating:/)).not.toBeInTheDocument();
  });

  it('should not render when level is less than 2', () => {
    const lowLevelStats = {
      ...mockPlayerStats5e,
      level: 1,
    };

    render(<CharClassDruid playerStats={lowLevelStats} />);

    expect(screen.queryByText(/Wild Shape Uses:/)).not.toBeInTheDocument();
  });

  it('should render druid class features for 5e rules', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/Wild Shape Uses:/)).toBeInTheDocument();
    expect(screen.getByText(/Wild Shape Max Challenge Rating:/)).toBeInTheDocument();
    expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
  });

  it('should render druid class features for 2024 rules', () => {
    render(<CharClassDruid playerStats={mockPlayerStats2024} />);

    expect(screen.getByText(/Wild Shape Uses:/)).toBeInTheDocument();
    expect(screen.getByText(/Wild Shape Max Challenge Rating:/)).toBeInTheDocument();
    expect(screen.getByText(/Beast Forms Known:/)).toBeInTheDocument();
    expect(screen.getByText(/Wild Shape Limitations:/)).toBeInTheDocument();
  });

  it('should display max wild shape challenge rating', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    const crDiv = screen.getByText(/Wild Shape Max Challenge Rating:/).parentElement;
    expect(crDiv.textContent).toContain('2');
  });

  it('should display wild shape limitations for 5e with swim', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    const limitationsDiv = screen.getByText(/Wild Shape Limitations:/).parentElement;
    expect(limitationsDiv.textContent).toContain('walk or swim only');
  });

  it('should display beast forms known for 2024 rules', () => {
    render(<CharClassDruid playerStats={mockPlayerStats2024} />);

    const formsDiv = screen.getByText(/Beast Forms Known:/).parentElement;
    expect(formsDiv.textContent).toContain('3');
  });

  it('should display fly limitation when canFly is true for 2024', () => {
    classRules2024.getDruidBeastFlySpeed.mockReturnValue(true);
    
    render(<CharClassDruid playerStats={mockPlayerStats2024} />);

    const limitationsDiv = screen.getByText(/Wild Shape Limitations:/).parentElement;
    expect(limitationsDiv.textContent).toContain('walk, swim, or fly');
  });

  it('should toggle input visibility when wild shape uses div is clicked', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    const wildShapeDiv = screen.getByText(/Wild Shape Uses:/).parentElement;
    fireEvent.click(wildShapeDiv);

    expect(screen.getByTestId('hidden-input')).toBeInTheDocument();
  });

  it('should call storage.setProperty when wild shape uses value changes', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    const wildShapeDiv = screen.getByText(/Wild Shape Uses:/).parentElement;
    fireEvent.click(wildShapeDiv);

    const input = screen.getByTestId('hidden-input');
    fireEvent.change(input, { target: { value: '1' } });

    expect(storage.setProperty).toHaveBeenCalledWith(
       'Test Druid',
       'wildShapeUses',
       '1'
     );
    });

  it('should use stored wild shape uses when available', () => {
    storage.getProperty.mockReturnValue(1);

    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    expect(screen.getByTestId('hidden-value')).toHaveTextContent('1');
  });

  it('should show max/cur label', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    expect(screen.getByText(/max\/cur/)).toBeInTheDocument();
  });

  it('should call classRules2024 functions for 2024 rules', () => {
    render(<CharClassDruid playerStats={mockPlayerStats2024} />);

    expect(classRules2024.getDruidMaxWildShapeChallengeRating).toHaveBeenCalled();
    expect(classRules2024.getDruidWildShapeUses).toHaveBeenCalled();
    expect(classRules2024.getDruidBeastKnownForms).toHaveBeenCalled();
    expect(classRules2024.getDruidBeastFlySpeed).toHaveBeenCalled();
  });

  it('should call classRules functions for 5e rules', () => {
    render(<CharClassDruid playerStats={mockPlayerStats5e} />);

    expect(classRules.getDruidMaxWildShapeChallengeRating).toHaveBeenCalled();
  });
});