// @maintained-by-ai
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardStepLanguages from './WizardStepLanguages.jsx';

// Disk-faithful fixtures, verbatim from public/data (never test-the-mock, #382):
// languages.json is string[] and fighting-styles.json is {name, description}[],
// so one fixture pair pins both item shapes the component renders.
const diskLanguages = JSON.parse(readFileSync('public/data/languages.json', 'utf8'));
const diskFightingStyles = JSON.parse(readFileSync('public/data/fighting-styles.json', 'utf8'));
const diskStyleNames = diskFightingStyles.map((s) => s.name);

const LANG_URL = '/data/languages.json';
const STYLES_URL = '/data/fighting-styles.json';

function mockFetch({ fail = [] } = {}) {
  global.fetch = vi.fn((url) => {
    if (fail.includes(url)) return Promise.reject(new Error('Network error'));
    const body = url === LANG_URL ? diskLanguages : url === STYLES_URL ? diskFightingStyles : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
}

// Fresh props per test (#362). Two distinct pre-selected concepts, kept separate:
// - limits.preSelected   → drives the auto-select effect (calls the toggle handlers)
// - preSelectedLanguages → locks the checkbox (disabled only once also checked)
function createProps(overrides = {}) {
  return {
    formData: { languages: ['Common'], class: { fightingStyles: ['Defense'] } },
    errors: {},
    languageLimits: {
      allowed: 3,
      details: 'Your race grants 2 languages. Your level grants 1.',
      preSelected: ['Common'],
    },
    fightingStyleLimits: {
      allowed: 1,
      details: 'Fighters get 1 fighting style.',
      preSelected: ['Defense'],
    },
    preSelectedLanguages: ['Common'],
    preSelectedFightingStyles: ['Defense'],
    warnings: [],
    onLanguageToggle: vi.fn(),
    onFightingStyleToggle: vi.fn(),
    ...overrides,
  };
}

// Full ordered checkbox set across both sections (languages render first).
const diskCheckboxNames = [...diskLanguages, ...diskStyleNames];
const checkboxNames = () => screen.getAllByRole('checkbox')
  .map((cb) => cb.closest('label').textContent.replace(/\u00a0/g, ' ').trim());

async function waitForLists() {
  await waitFor(() => expect(checkboxNames()).toEqual(diskCheckboxNames));
}

describe('WizardStepLanguages', () => {
  it('renders the full disk-faithful step: header, rules text, exact counts, warnings, options, and steady state', async () => {
    mockFetch();
    const props = createProps({ warnings: [{ type: 'warning', message: 'You have exceeded the limit.' }] });
    render(<WizardStepLanguages stepNumber={12} {...props} />);
    await waitForLists();

    expect(screen.getByText('Step 12: Languages & Fighting Styles')).toBeInTheDocument();
    expect(screen.getByText('Languages')).toBeInTheDocument();
    expect(screen.getByText('Fighting Styles')).toBeInTheDocument();

    // Every language and fighting style, in exact disk order and nothing else.
    expect(checkboxNames()).toEqual(diskCheckboxNames);

    // Exact count lines (would catch a flipped count/allowed render).
    expect(screen.getByText(/Your race grants 2 languages\. Your level grants 1\./)).toBeInTheDocument();
    expect(screen.getByText('You have selected 1 of 3 allowed language(s).')).toBeInTheDocument();
    expect(screen.getByText(/Fighters get 1 fighting style\./)).toBeInTheDocument();
    expect(screen.getByText('You have selected 1 of 1 allowed fighting style(s).')).toBeInTheDocument();

    // Pre-selected + selected → checked and locked; plain item → free.
    expect(screen.getByRole('checkbox', { name: 'Common' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Common' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Elvish' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Elvish' })).not.toBeDisabled();

    // Warnings prop flows through to WarningList (upstream wiring gap pinned in steps-config.test.js).
    expect(screen.getByText('You have exceeded the limit.')).toBeInTheDocument();

    // Everything already consistent: no spurious error nodes, no handler echo.
    expect(document.querySelectorAll('.error-message')).toHaveLength(0);
    expect(props.onLanguageToggle).not.toHaveBeenCalled();
    expect(props.onFightingStyleToggle).not.toHaveBeenCalled();
  });

  it.each([
    ['languageLimits', /You have selected \d+ of \d+ allowed language/, /Your race grants/],
    ['fightingStyleLimits', /You have selected \d+ of \d+ allowed fighting style/, /Fighters get/],
  ])('omits the entire %s rule block when null, keeping the other section intact', async (prop, ownCount, ownDetails) => {
    mockFetch();
    render(<WizardStepLanguages stepNumber={12} {...createProps({ [prop]: null })} />);
    await waitForLists();

    expect(screen.queryByText(ownCount)).not.toBeInTheDocument();
    expect(screen.queryByText(ownDetails)).not.toBeInTheDocument();
    const otherCount = prop === 'languageLimits' ? /allowed fighting style/ : /allowed language/;
    expect(screen.getByText(otherCount)).toBeInTheDocument();
  });

  it.each([
    ['languages', 'SENTINEL: language error copy'],
    ['fightingStyles', 'SENTINEL: fighting style error copy'],
  ])('displays a %s validation error as the only error message (copy is owned by validateLanguagesAndFightingStyles)', async (key, message) => {
    mockFetch();
    render(<WizardStepLanguages stepNumber={12} {...createProps({ errors: { [key]: message } })} />);
    await waitForLists();

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(document.querySelectorAll('.error-message')).toHaveLength(1);
  });

  it.each([
    ['already in formData', ['Common'], ['Defense'], true],
    ['not yet in formData', [], [], false],
  ])('pre-selected checkbox %s → disabled=%s in both sections', async (_desc, langs, styles, selected) => {
    mockFetch();
    const props = createProps({
      formData: { languages: langs, class: { fightingStyles: styles } },
      // Empty limits.preSelected isolates the disabled pin from the auto-select effect.
      languageLimits: { allowed: 3, details: 'd', preSelected: [] },
      fightingStyleLimits: { allowed: 1, details: 'd', preSelected: [] },
    });
    render(<WizardStepLanguages stepNumber={12} {...props} />);
    await waitForLists();

    const common = screen.getByRole('checkbox', { name: 'Common' });
    const defense = screen.getByRole('checkbox', { name: 'Defense' });
    if (selected) {
      expect(common).toBeDisabled();
      expect(defense).toBeDisabled();
    } else {
      expect(common).not.toBeDisabled();
      expect(defense).not.toBeDisabled();
    }
    // Checkbox checked state mirrors formData membership in both legs.
    expect(common.checked).toBe(selected);
    expect(defense.checked).toBe(selected);
    expect(props.onLanguageToggle).not.toHaveBeenCalled();
    expect(props.onFightingStyleToggle).not.toHaveBeenCalled();
  });

  it.each([
    {
      title: 'missing from formData → toggled once each',
      langLimits: { allowed: 3, details: 'd', preSelected: ['Elvish'] },
      styleLimits: { allowed: 1, details: 'd', preSelected: ['Dueling'] },
      formData: { languages: [], class: { fightingStyles: [] } },
      langCall: 'Elvish',
      styleCall: 'Dueling',
    },
    {
      title: 'already in formData → untouched',
      langLimits: { allowed: 3, details: 'd', preSelected: ['Elvish'] },
      styleLimits: { allowed: 1, details: 'd', preSelected: ['Dueling'] },
      formData: { languages: ['Elvish'], class: { fightingStyles: ['Dueling'] } },
      langCall: null,
      styleCall: null,
    },
    {
      title: 'limits null → untouched',
      langLimits: null,
      styleLimits: null,
      formData: { languages: [], class: { fightingStyles: [] } },
      langCall: null,
      styleCall: null,
    },
  ])('auto-select effect: $title', async ({ langLimits, styleLimits, formData, langCall, styleCall }) => {
    mockFetch();
    const props = createProps({ formData, languageLimits: langLimits, fightingStyleLimits: styleLimits });
    render(<WizardStepLanguages stepNumber={12} {...props} />);
    await waitForLists();

    if (langCall) expect(props.onLanguageToggle).toHaveBeenCalledWith(langCall);
    else expect(props.onLanguageToggle).not.toHaveBeenCalled();
    if (styleCall) expect(props.onFightingStyleToggle).toHaveBeenCalledWith(styleCall);
    else expect(props.onFightingStyleToggle).not.toHaveBeenCalled();
  });

  it('clicking a language and a fighting style checkbox toggles the exact names', async () => {
    mockFetch();
    const props = createProps({
      formData: { languages: [], class: { fightingStyles: [] } },
      languageLimits: { allowed: 3, details: 'd', preSelected: [] },
      fightingStyleLimits: { allowed: 1, details: 'd', preSelected: [] },
      preSelectedLanguages: [],
      preSelectedFightingStyles: [],
    });
    render(<WizardStepLanguages stepNumber={12} {...props} />);
    await waitForLists();
    expect(props.onLanguageToggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Elvish' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dueling' }));

    expect(props.onLanguageToggle).toHaveBeenCalledTimes(1);
    expect(props.onLanguageToggle).toHaveBeenCalledWith('Elvish');
    expect(props.onFightingStyleToggle).toHaveBeenCalledTimes(1);
    expect(props.onFightingStyleToggle).toHaveBeenCalledWith('Dueling');
  });

  it.each([
    {
      title: 'languages fetch fails',
      fail: [LANG_URL],
      expectedNames: ['Common', ...diskStyleNames],
      logged: ['Error loading languages:'],
    },
    {
      title: 'both fetches fail',
      fail: [LANG_URL, STYLES_URL],
      expectedNames: ['Common', 'Defense'],
      logged: ['Error loading languages:', 'Error loading fighting styles:'],
    },
  ])('keeps rendering with merged formData names when $title', async ({ fail, expectedNames, logged }) => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ fail });
    render(<WizardStepLanguages stepNumber={12} {...createProps()} />);

    // Fetched names stay absent; formData selections still render (merged list) in section order.
    await waitFor(() => expect(checkboxNames()).toEqual(expectedNames));
    for (const prefix of logged) {
      expect(consoleSpy).toHaveBeenCalledWith(prefix, expect.any(Error));
    }
    expect(consoleSpy).toHaveBeenCalledTimes(logged.length);
    consoleSpy.mockRestore();
  });

  it('merges formData-only names after the fetched list, in order', async () => {
    mockFetch();
    // 'Kuo-Toa' is genuinely absent from public/data/languages.json (disk-faithful extra).
    const withExtra = [...diskLanguages, 'Kuo-Toa', ...diskStyleNames];
    render(
      <WizardStepLanguages stepNumber={12}
        {...createProps({ formData: { languages: ['Common', 'Kuo-Toa'], class: { fightingStyles: ['Defense'] } } })}
      />
    );
    await waitFor(() => expect(checkboxNames()).toEqual(withExtra));
    expect(screen.getByRole('checkbox', { name: 'Kuo-Toa' })).toBeChecked();
  });
});
