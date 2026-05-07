import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CascadingSelect from './CascadingSelect.jsx';

describe('CascadingSelect', () => {
  const baseProps = {
    label: 'Race',
    options: [
      { name: 'Human', subraces: [{ index: 'hill', name: 'Hill' }, { index: 'high', name: 'High' }] },
      { name: 'Elf', subraces: [{ index: 'wood', name: 'Wood' }] },
    ],
    subOptionsSelector: (selectedRace) => {
      const found = [{ name: 'Human', subraces: [{ index: 'hill', name: 'Hill' }, { index: 'high', name: 'High' }] }, { name: 'Elf', subraces: [{ index: 'wood', name: 'Wood' }] }].find(r => r.name === selectedRace);
      return found ? found.subraces : [];
    },
    fieldName: 'race',
    childFieldName: 'subrace',
    errorKey: 'subrace',
    loadingText: 'Loading races...',
    ruleset: '5e',
    formData: { race: { name: 'Human', subrace: { name: 'Hill', description: '' } } },
    onInputChange: vi.fn(),
    errors: {},
    childExtraFields: { description: '' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the parent label', () => {
    render(<CascadingSelect {...baseProps} />);
    const labels = document.querySelectorAll('label');
    expect(labels[0].textContent).toContain('Race');
  });

  it('should render parent dropdown options', () => {
    render(<CascadingSelect {...baseProps} />);
    expect(screen.getByText('Human')).toBeInTheDocument();
    expect(screen.getByText('Elf')).toBeInTheDocument();
  });

  it('should render child dropdown when subOptions exist', () => {
    render(<CascadingSelect {...baseProps} />);
    const childSelect = document.querySelectorAll('select')[1];
    expect(childSelect).toBeInTheDocument();
    expect(screen.getByText('Hill')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('should NOT render child dropdown when no subOptions', () => {
    const props = {
      ...baseProps,
      formData: { race: { name: 'Elf' } },
      options: [{ name: 'Elf', subraces: [] }],
      subOptionsSelector: (selectedRace) => {
        const found = [{ name: 'Elf', subraces: [] }].find(r => r.name === selectedRace);
        return found ? found.subraces : [];
      },
    };
    render(<CascadingSelect {...props} />);
    expect(screen.queryByText('Subrace *')).not.toBeInTheDocument();
  });

  it('should render loading text when options are empty', () => {
    render(<CascadingSelect {...baseProps} options={[]} />);
    expect(screen.getByText('Loading races...')).toBeInTheDocument();
  });

  it('should call onInputChange when parent changes', () => {
    render(<CascadingSelect {...baseProps} />);
    const parentSelect = document.querySelector('select');
    fireEvent.change(parentSelect, { target: { value: 'Elf' } });
    expect(baseProps.onInputChange).toHaveBeenCalledWith('race', { name: 'Elf' });
  });

  it('should call onInputChange with childExtraFields when child changes', () => {
    render(<CascadingSelect {...baseProps} />);
    const childSelect = document.querySelectorAll('select')[1];
    fireEvent.change(childSelect, { target: { value: 'High' } });
    expect(baseProps.onInputChange).toHaveBeenCalledWith(
      'race',
      expect.objectContaining({
        subrace: expect.objectContaining({ name: 'High', description: '' })
      })
    );
  });

  it('should display parent error when provided', () => {
    render(<CascadingSelect {...baseProps} errors={{ race: 'Race is required' }} />);
    expect(screen.getByText('Race is required')).toBeInTheDocument();
  });

  it('should display child error when provided', () => {
    render(<CascadingSelect {...baseProps} errors={{ subrace: 'Subrace is required' }} />);
    expect(screen.getByText('Subrace is required')).toBeInTheDocument();
  });

  it('should use (Major) suffix for 2024 ruleset', () => {
    render(<CascadingSelect {...baseProps} ruleset="2024" />);
    expect(screen.getByText('Race (Major) *')).toBeInTheDocument();
  });

  it('should handle undefined formData[fieldName]', () => {
    render(<CascadingSelect {...baseProps} formData={{}} />);
    expect(screen.getByText('Race *')).toBeInTheDocument();
  });

  it('should handle undefined formData[fieldName][childFieldName]', () => {
    render(<CascadingSelect {...baseProps} formData={{ race: { name: 'Human' } }} />);
    const childSelect = document.querySelectorAll('select')[1];
    expect(childSelect).toBeInTheDocument();
  });
});
