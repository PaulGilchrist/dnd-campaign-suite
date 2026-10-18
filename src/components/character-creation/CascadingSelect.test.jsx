// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CascadingSelect from './CascadingSelect.jsx';

const RACES = [
  { name: 'Human', subraces: [{ index: 'hill', name: 'Hill' }, { index: 'high', name: 'High' }] },
  { name: 'Elf', subraces: [{ index: 'wood', name: 'Wood' }] },
];

const subOptionsForSelected = (parentName) =>
  (RACES.find((r) => r.name === parentName) || {}).subraces;

// Fresh props (incl. a fresh onInputChange mock) per test so call
// attribution is exact — there is no global clearMocks in vitest config.
const makeProps = (overrides = {}) => ({
  label: 'Race',
  childLabel: 'Subrace',
  options: RACES,
  subOptionsSelector: subOptionsForSelected,
  fieldName: 'race',
  childFieldName: 'subrace',
  errorKey: 'subrace',
  loadingText: 'Loading races...',
  ruleset: '5e',
  formData: { race: { name: 'Human', subrace: { name: 'Hill', description: '' } } },
  onInputChange: vi.fn(),
  errors: {},
  childExtraFields: { description: '' },
  ...overrides,
});

// Selects and labels carry no accessible name (no htmlFor/aria), so
// positional container queries are the honest handle; option assertions
// pin the full textContent list of each dropdown.
const optionTexts = (select) => Array.from(select.querySelectorAll('option')).map((o) => o.textContent);

describe('CascadingSelect', () => {
  describe('rendering', () => {
    it('renders parent and child dropdowns with exact option lists, placeholders and formData selections', () => {
      const { container } = render(<CascadingSelect {...makeProps()} />);
      const [parent, child] = container.querySelectorAll('select');

      expect(screen.getByText('Race *')).toBeInTheDocument();
      expect(screen.getByText('Subrace *')).toBeInTheDocument();
      expect(optionTexts(parent)).toEqual(['Select a race', 'Human', 'Elf']);
      expect(parent.value).toBe('Human');
      expect(optionTexts(child)).toEqual(['Select a subrace', 'Hill', 'High']);
      expect(child.value).toBe('Hill');
    });

    it('renders parent unselected with no child dropdown when formData is empty', () => {
      const { container } = render(<CascadingSelect {...makeProps()} formData={{}} />);
      const [parent] = container.querySelectorAll('select');

      expect(parent.value).toBe('');
      expect(container.querySelectorAll('select')).toHaveLength(1);
    });

    it.each([
      ['an empty array', []],
      ['null', null],
      ['undefined', undefined],
    ])('renders only the parent dropdown when subOptionsSelector returns %s', (_name, subOptions) => {
      const { container } = render(
        <CascadingSelect {...makeProps()} subOptionsSelector={() => subOptions} />
      );

      expect(container.querySelectorAll('select')).toHaveLength(1);
      expect(screen.queryByRole('option', { name: /Hill|High|Wood/ })).not.toBeInTheDocument();
    });

    it('shows loading text as the placeholder choice when options are empty', () => {
      const { container } = render(
        <CascadingSelect {...makeProps()} options={[]} subOptionsSelector={() => []} />
      );
      const [parent] = container.querySelectorAll('select');

      expect(optionTexts(parent)).toEqual(['Select a race', 'Loading races...']);
      expect(parent.value).toBe('');
    });

    it.each([
      ['parent optionsKey', {
        options: [{ id: 'human', displayName: 'Humanoid' }],
        optionsKey: 'displayName',
        subOptionsSelector: () => [],
      }, ['Select a race', 'Humanoid']],
      ['parent optionsKey falls back to index', {
        options: [{ index: 'human', name: 'Human' }],
        optionsKey: 'nonexistent',
        subOptionsSelector: () => [],
      }, ['Select a race', 'human']],
      ['child childOptionsKey', {
        options: [{ name: 'Human', subraces: [{ key: 'hill', label: 'Hill Dwarf' }] }],
        subOptionsSelector: () => [{ key: 'hill', label: 'Hill Dwarf' }],
        childOptionsKey: 'label',
      }, ['Select a subrace', 'Hill Dwarf']],
      ['child key falls back to childOptionsIndexKey', {
        options: [{ name: 'Human', subraces: [{ index: 'hill', name: 'Hill' }] }],
        subOptionsSelector: () => [{ index: 'hill', name: 'Hill' }],
        childOptionsKey: 'nonexistent',
      }, ['Select a subrace', 'hill']],
    ])('resolves %s for rendered option values', (_name, overrides, expected) => {
      const { container } = render(<CascadingSelect {...makeProps()} {...overrides} />);
      const selects = container.querySelectorAll('select');

      expect(optionTexts(selects[selects.length - 1])).toEqual(expected);
    });

    it.each([
      ['5e with custom childLabel', '5e', 'Subrace Type', 'Subrace Type *'],
      ['2024 with custom childLabel', '2024', 'Subrace Type', 'Subrace Type (Major) *'],
      ['2024 falls back to parent label', '2024', undefined, 'Race (Major) *'],
    ])('child label: %s', (_name, ruleset, childLabel, expected) => {
      render(<CascadingSelect {...makeProps()} ruleset={ruleset} childLabel={childLabel} />);

      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('repopulates the child list and resets it when the parent selection changes', () => {
      const props = makeProps();
      const { rerender, container } = render(<CascadingSelect {...props} />);
      const child = () => container.querySelectorAll('select')[1];

      expect(optionTexts(child())).toEqual(['Select a subrace', 'Hill', 'High']);
      expect(child().value).toBe('Hill');

      rerender(<CascadingSelect {...props} formData={{ race: { name: 'Elf' } }} />);
      expect(optionTexts(child())).toEqual(['Select a subrace', 'Wood']);
      expect(child().value).toBe('');
    });

    it.each([
      ['selecting a new race', 'Elf', { name: 'Elf' }],
      ['clearing the selection', '', { name: '' }],
    ])('parent change (%s) emits exact payload once', (_name, value, expectedPayload) => {
      const props = makeProps();
      const { container } = render(<CascadingSelect {...props} />);

      fireEvent.change(container.querySelectorAll('select')[0], { target: { value } });

      expect(props.onInputChange).toHaveBeenCalledTimes(1);
      expect(props.onInputChange).toHaveBeenCalledWith('race', expectedPayload);
    });

    it('child change emits parent payload preserving parent fields and merging childExtraFields', () => {
      const props = makeProps({ childExtraFields: { description: '', feat: '' } });
      const { container } = render(<CascadingSelect {...props} />);

      fireEvent.change(container.querySelectorAll('select')[1], { target: { value: 'High' } });

      expect(props.onInputChange).toHaveBeenCalledTimes(1);
      expect(props.onInputChange).toHaveBeenCalledWith('race', {
        name: 'Human',
        subrace: { name: 'High', description: '', feat: '' },
      });
    });
  });

  describe('error display', () => {
    it.each([
      ['parent', 'race', 'subrace'],
      ['child', 'subrace', 'race'],
    ])('flags only the %s field with message and error styling', (_name, errKey, otherKey) => {
      const message = `${errKey} is required`;
      const { container } = render(<CascadingSelect {...makeProps()} errors={{ [errKey]: message }} />);
      const [parent, child] = container.querySelectorAll('select');
      const [errored, other] = errKey === 'race' ? [parent, child] : [child, parent];

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(errored).toHaveClass('error');
      expect(other).not.toHaveClass('error');
      expect(screen.queryByText(`${otherKey} is required`)).not.toBeInTheDocument();
    });

    it('renders no error styling or messages when errors are empty', () => {
      const { container } = render(<CascadingSelect {...makeProps()} />);

      container.querySelectorAll('select').forEach((select) => {
        expect(select).not.toHaveClass('error');
      });
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    });
  });
});
