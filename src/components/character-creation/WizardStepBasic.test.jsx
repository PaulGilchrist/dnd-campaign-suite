// @maintained-by-ai
/**
 * Unit lane for WizardStepBasic (name / level / alignment / portrait).
 *
 * Lane partition (do not restate here):
 *  - flow glue, live duplicate-name guard, step-2 heading in context
 *    -> CharacterCreationWizard.integration.test.jsx
 *  - heading numbering via shared getDisplayNumber -> WizardStepNumbering.test.jsx
 *  - validator copy for name/level/alignment -> config/utils validators
 * This file pins only component behavior: exact ('key', value) onChange
 * payloads, portrait src resolution branches, and verbatim display of
 * props-supplied errors on the correct field only.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WizardStepBasic from './WizardStepBasic.jsx';

// Disk-faithful fixture: mirrors public/data/alignments.json exactly
// (9 entries, same order) so the option-population pin is real.
const mockAlignments = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];

// Fresh props per test so mock call histories never leak across tests.
function createProps(overrides = {}) {
  return {
    formData: {
      name: 'Test Character',
      level: 5,
      alignment: 'Lawful Good',
      background: '',
      image: '',
      imagePath: '',
      ...overrides.formData,
    },
    errors: overrides.errors || {},
    onInputChange: overrides.onInputChange || vi.fn(),
    campaignName: overrides.campaignName || undefined,
    ...overrides,
  };
}

function renderBasic(props = {}) {
  const stepProps = createProps(props);
  render(<WizardStepBasic stepNumber={2} {...stepProps} />);
  return stepProps;
}

describe('WizardStepBasic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAlignments),
    });
  });

  it('renders default state: fields reflect formData, alignments populate in exact order, upload placeholder with no remove button', async () => {
    renderBasic();

    expect(screen.getByRole('textbox')).toHaveValue('Test Character');
    expect(screen.getByRole('spinbutton')).toHaveValue(5);

    // Wait for fetch-populated options (last option), then pin exact order.
    await screen.findByText('Chaotic Evil');
    const alignmentSelect = screen.getByRole('combobox');
    expect(optionLabels(alignmentSelect)).toEqual(mockAlignments);
    expect(alignmentSelect).toHaveValue('Lawful Good');

    expect(screen.getByText('Click to upload')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Image' })).not.toBeInTheDocument();
  });

  it.each([
    {
      label: 'base64 image takes precedence over imagePath',
      campaignName: undefined,
      formData: { image: 'data:image/png;base64,aaa', imagePath: '/should/be/ignored.jpg' },
      expectedSrc: 'data:image/png;base64,aaa',
    },
    {
      label: 'relative imagePath is prefixed with campaigns/:name',
      campaignName: 'my-campaign',
      formData: { imagePath: 'portraits/hero.jpg' },
      expectedSrc: 'campaigns/my-campaign/portraits/hero.jpg',
    },
    {
      label: 'absolute URL imagePath is left untouched',
      campaignName: 'my-campaign',
      formData: { imagePath: 'https://example.com/hero.jpg' },
      expectedSrc: 'https://example.com/hero.jpg',
    },
    {
      label: 'relative imagePath without campaignName is left untouched',
      campaignName: undefined,
      formData: { imagePath: '/path/to/portrait.jpg' },
      expectedSrc: '/path/to/portrait.jpg',
    },
  ])('portrait preview: $label', async ({ campaignName, formData, expectedSrc }) => {
    renderBasic({ campaignName, formData });

    const preview = screen.getByRole('img');
    expect(preview).toHaveAttribute('alt', 'Character');
    expect(preview).toHaveAttribute('src', expectedSrc);
    expect(screen.queryByText('Click to upload')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Image' })).toBeInTheDocument();
  });

  it('typing the name sends the exact ("name", value) payload', () => {
    const { onInputChange } = renderBasic();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } });

    expect(onInputChange).toHaveBeenCalledTimes(1);
    expect(onInputChange).toHaveBeenCalledWith('name', 'New Name');
  });

  it.each([
    { input: '10', expected: 10 },
    { input: '0', expected: 0 }, // falsy level must pass through as a number, not be defaulted away
    { input: '', expected: NaN }, // cleared field sends NaN; the validator owns rejection copy
  ])('changing level to "%s" sends parsed integer level %p', ({ input, expected }) => {
    const { onInputChange } = renderBasic({ formData: { level: 1 } });

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: input } });

    expect(onInputChange).toHaveBeenCalledWith('level', expected);
  });

  it('changing alignment sends ("alignment", value)', async () => {
    const { onInputChange } = renderBasic();

    const alignmentSelect = await screen.findByRole('combobox');
    fireEvent.change(alignmentSelect, { target: { value: 'Chaotic Neutral' } });

    expect(onInputChange).toHaveBeenCalledWith('alignment', 'Chaotic Neutral');
  });

  it.each([
    { field: 'name', role: 'textbox' },
    { field: 'level', role: 'spinbutton' },
    { field: 'alignment', role: 'combobox' },
  ])(
    'displays a props-supplied error verbatim on the $field field only (copy owned by validators)',
    async ({ field, role }) => {
      const message = `${field} failed validation`;
      renderBasic({ errors: { [field]: message } });

      // Flush the alignment fetch so no act noise leaks after assertions.
      await screen.findByRole('combobox');

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByRole(role)).toHaveClass('error');

      // Pin BOTH states: no message for the other fields, and they stay clean.
      const others = ['textbox', 'spinbutton', 'combobox'].filter((r) => r !== role);
      others.forEach((otherRole) => {
        expect(screen.getByRole(otherRole)).not.toHaveClass('error');
      });
    },
  );

  it('Remove Image click clears both image and imagePath', () => {
    const { onInputChange } = renderBasic({
      formData: { image: 'data:image/png;base64,test', imagePath: '/path/to/img.jpg' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));

    expect(onInputChange).toHaveBeenCalledWith('image', '');
    expect(onInputChange).toHaveBeenCalledWith('imagePath', '');
  });

  it('selecting a file reads it via FileReader and sends image data URL plus filename', async () => {
    const { onInputChange } = renderBasic();

    const file = new File(['test'], 'test-image.png', { type: 'image/png' });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });

    // Real jsdom FileReader — deterministic base64 for content "test".
    await waitFor(() => {
      expect(onInputChange).toHaveBeenCalledWith('image', 'data:image/png;base64,dGVzdA==');
    });
    expect(onInputChange).toHaveBeenCalledWith('imageName', 'test-image.png');
  });

  it('logs the fetch error and still renders usable fields when alignments fail to load', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    renderBasic();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading alignments:', expect.any(Error));
    });
    // No crash: the rest of the step stays interactive.
    expect(screen.getByRole('textbox')).toHaveValue('Test Character');
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
  });
});

// Helper: exact ordered option labels of a <select>.
function optionLabels(select) {
  return Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
}
