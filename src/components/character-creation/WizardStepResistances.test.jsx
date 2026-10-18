// @maintained-by-ai
// #386 audit. Disk-faithful fixtures (#387): the mocked fetch serves
// public/data/resistances-immunities.json verbatim — the prod list is versioned on disk
// (13 types), so empty-data states can never render and are not tested. The wizard always
// passes preSelected* as arrays (CharacterCreationWizard.jsx:456), so undefined-prop
// negatives are dropped as unreachable. Warning rendering, type-classing, and the
// null/empty guard are owned by WarningList.test.jsx — only the step's pass-through of
// `warnings` is pinned here. Step-number display is owned by WizardStepNumbering.test.jsx;
// stepNumber here is a plain props passthrough. Disabled pins, not clicks (#289);
// fresh props per test (#362). No selection cap exists at this step (useWizardResistances
// registers one non-limit slot), so there is no count-boundary to pin.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WizardStepResistances from './WizardStepResistances.jsx';
import DISK_TYPES from '../../../public/data/resistances-immunities.json';

function createProps(overrides = {}) {
  const { formData, ...rest } = overrides;
  return {
    stepNumber: 13,
    formData: { resistances: [], immunities: [], ...formData },
    onResistanceToggle: vi.fn(),
    onImmunityToggle: vi.fn(),
    warnings: [],
    preSelectedResistances: [],
    preSelectedImmunities: [],
    ...rest,
  };
}

function section(labelText) {
  return screen.getByText(labelText).closest('.form-group');
}

function checkboxFor(labelText, type) {
  const item = Array.from(section(labelText).querySelectorAll('.multi-select-item'))
    .find((el) => el.textContent.includes(type));
  return item.querySelector('input[type="checkbox"]');
}

function itemTexts(labelText) {
  return Array.from(section(labelText).querySelectorAll('.multi-select-item'))
    .map((el) => el.textContent.replace(/\u00a0/g, ' ').trim());
}

async function waitForLoaded(container) {
  await waitFor(() => {
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(DISK_TYPES.length * 2);
  });
}

describe('WizardStepResistances', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(DISK_TYPES),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches disk data and renders its exact ordered damage-type list in both sections', async () => {
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<WizardStepResistances {...createProps()} />);

    expect(fetchMock).toHaveBeenCalledWith('/data/resistances-immunities.json');
    expect(screen.getByRole('heading', { name: 'Step 13: Resistances & Immunities' })).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve(DISK_TYPES) });
    await waitForLoaded(container);

    expect(itemTexts('Resistances')).toEqual(DISK_TYPES);
    expect(itemTexts('Immunities')).toEqual(DISK_TYPES);
  });

  it('checks exactly the types listed in formData, independently per section', async () => {
    const { container } = render(<WizardStepResistances {...createProps({
      formData: { resistances: ['Fire'], immunities: ['Cold'] },
    })} />);
    await waitForLoaded(container);

    expect(checkboxFor('Resistances', 'Fire').checked).toBe(true);
    expect(checkboxFor('Immunities', 'Cold').checked).toBe(true);
    expect(checkboxFor('Resistances', 'Cold').checked).toBe(false);
    expect(checkboxFor('Immunities', 'Fire').checked).toBe(false);
  });

  it.each([
    ['Resistances', 'onResistanceToggle', 'onImmunityToggle'],
    ['Immunities', 'onImmunityToggle', 'onResistanceToggle'],
  ])('clicking a %s checkbox calls only %s with the exact damage type', async (sectionLabel, handlerName, otherName) => {
    const props = createProps();
    const { container } = render(<WizardStepResistances {...props} />);
    await waitForLoaded(container);

    fireEvent.click(checkboxFor(sectionLabel, 'Lightning'));

    expect(props[handlerName]).toHaveBeenCalledTimes(1);
    expect(props[handlerName]).toHaveBeenCalledWith('Lightning');
    expect(props[otherName]).not.toHaveBeenCalled();
  });

  it('suffixes pre-selected types with "(Granted)" and disables only granted-and-selected checkboxes', async () => {
    const { container } = render(<WizardStepResistances {...createProps({
      formData: { resistances: ['Fire'], immunities: [] },
      preSelectedResistances: ['Fire', 'Acid'],
      preSelectedImmunities: ['Cold'],
    })} />);
    await waitForLoaded(container);

    expect(screen.getByText('Acid (Granted)')).toBeInTheDocument();
    expect(screen.getByText('Cold (Granted)')).toBeInTheDocument();

    const locked = checkboxFor('Resistances', 'Fire');
    expect(locked.disabled).toBe(true);
    expect(locked.checked).toBe(true);

    const stillSelectable = checkboxFor('Resistances', 'Acid');
    expect(stillSelectable.disabled).toBe(false);
    expect(stillSelectable.checked).toBe(false);
  });

  it('passes warnings through to WarningList', () => {
    render(<WizardStepResistances {...createProps({
      warnings: [
        { type: 'warning', message: 'Consider your class limitations' },
        { type: 'error', message: 'Too many resistances selected' },
      ],
    })} />);

    expect(document.querySelector('.warning-container')).toBeInTheDocument();
    expect(screen.getByText('Consider your class limitations')).toBeInTheDocument();
    expect(screen.getByText('Too many resistances selected')).toBeInTheDocument();
  });

  it('logs the load failure and keeps the step rendered with no options', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const { container } = render(<WizardStepResistances {...createProps()} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading resistances/immunities:', expect.any(Error));
    });

    expect(screen.getByRole('heading', { name: 'Step 13: Resistances & Immunities' })).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});
