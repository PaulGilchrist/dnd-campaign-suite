// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SavantModal from './SavantModal.jsx';

// ── Test fixtures ──

const spellOptions = [
  'Burning Hands',
  'Charm Person',
  'Color Spray',
  'Detect Magic',
  'Disguise Self',
  'Enthrall',
  'Feather Fall',
  'Find Familiar',
  'Gust of Wind',
  'Hypnotic Pattern',
  'Identify',
  'Illusory Script',
  'Jump',
  'Longstrider',
  'Machete',
  'Protection from Evil and Good',
  'Silent Image',
  'Sleep',
  'Tasha\'s Caustic Brew',
  'Tenser\'s Floating Disk',
  'Tongues',
  'Unseen Servant',
  'Water Breathing',
  'Water Walk',
  'Web',
  'Whirlwind',
];

const basePayload = {
  school: 'Evocation',
  spellOptions,
  selectedSpells: [],
};

// onConfirm(selected1, selected2) is the component's ONLY write path — the parent
// adds the pair to the spellbook and owns closing (the modal never self-closes on
// confirm, so onClose-not-called here is the pinned contract, not a gap). Clear
// writes an explicit null,null reset. Callbacks are fresh vi.fn per test via
// makeProps and the modal has no module-level write path, so there is nothing to
// reset in afterEach.
function makeProps(overrides) {
  return {
    payload: { ...basePayload },
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

const PLACEHOLDER = '-- Select a Evocation spell (level 2 or lower) --';

function getSelects(container) {
  return container.querySelectorAll('select');
}

// ── Tests ──

describe('SavantModal', () => {
  it('renders header, rules text, two placeholder-only dropdowns, disabled Confirm, no Clear', () => {
    const props = makeProps();
    const { container } = render(<SavantModal {...props} />);
    expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
    expect(screen.getByText(/Choose two Wizard spells from the Evocation school/)).toBeInTheDocument();
    expect(screen.getByTestId('evocation-savant-modal')).toBeInTheDocument();

    const selects = getSelects(container);
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select.value).toBe('');
      expect([...select.options].map(o => o.value)).toEqual(['', ...spellOptions]);
      expect(select.options[0].textContent).toBe(PLACEHOLDER);
    }

    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
  });

  // ── Existing selections ──

  // Consolidates the old "shows current selections" and "pre-selects a single
  // existing spell" cases: the Current line and dropdown pre-selection are both
  // driven by payload.selectedSpells, so one parameterised flow covers both arity.
  it.each([
    { selectedSpells: ['Sleep', 'Web'], values: ['Sleep', 'Web'] },
    { selectedSpells: ['Sleep'], values: ['Sleep', ''] },
  ])('pre-selects $selectedSpells and pins the payload Current line', ({ selectedSpells, values }) => {
    const props = makeProps({ payload: { ...basePayload, selectedSpells } });
    const { container } = render(<SavantModal {...props} />);

    // Current line renders every selected spell joined by " and "
    expect(screen.getByText(/Current:/).textContent).toBe(`Current: ${selectedSpells.join(' and ')}`);

    const selects = getSelects(container);
    expect(selects[0]).toHaveValue(values[0]);
    expect(selects[1]).toHaveValue(values[1]);
    expect(screen.getByRole('button', { name: 'Clear Selection' })).toBeEnabled();

    // Current line is payload-derived — editing the dropdowns never rewrites it
    fireEvent.change(selects[1], { target: { value: 'Sleep' } });
    expect(screen.getByText(/Current:/).textContent).toBe(`Current: ${selectedSpells.join(' and ')}`);
  });

  // Both undefined and [] must hide the Current line AND the Clear button
  // (the same selectedSpells?.length > 0 gate drives both).
  it.each([undefined, []])('hides Current line and Clear when selectedSpells is %p', (selectedSpells) => {
    render(<SavantModal {...makeProps({ payload: { ...basePayload, selectedSpells } })} />);
    expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
    expect(screen.queryByText(/Current:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Selection' })).not.toBeInTheDocument();
  });

  it('submits pre-selected spells verbatim when Confirm is clicked without interaction', () => {
    const props = makeProps({ payload: { ...basePayload, selectedSpells: ['Sleep', 'Web'] } });
    render(<SavantModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith('Sleep', 'Web');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  // ── Selection gating + submit — exact write payload ──

  // Each row sets both dropdowns (pinning both change handlers, including the
  // '' placeholder reset), asserts gating, clicks Confirm, and asserts either
  // the exact submitted pair or total inertness. The old reversed-pair row is
  // covered by the school test below, which submits in explicit non-list order.
  it.each([
    { first: '', second: '', enabled: false },
    { first: 'Sleep', second: '', enabled: false },
    { first: '', second: 'Web', enabled: false },
    { first: 'Sleep', second: 'Sleep', enabled: false },
    { first: 'Sleep', second: 'Web', enabled: true },
  ])('gates Confirm and submit on first="$first" second="$second"', ({ first, second, enabled }) => {
    const props = makeProps();
    const { container } = render(<SavantModal {...props} />);
    const selects = getSelects(container);
    fireEvent.change(selects[0], { target: { value: first } });
    fireEvent.change(selects[1], { target: { value: second } });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });
    fireEvent.click(confirmBtn);
    if (enabled) {
      expect(confirmBtn).toBeEnabled();
      expect(props.onConfirm).toHaveBeenCalledTimes(1);
      expect(props.onConfirm).toHaveBeenCalledWith(first, second);
    } else {
      expect(confirmBtn).toBeDisabled();
      expect(props.onConfirm).not.toHaveBeenCalled();
    }
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('re-disables Confirm when a valid pair reverts to duplicate or placeholder', () => {
    const props = makeProps();
    const { container } = render(<SavantModal {...props} />);
    const selects = getSelects(container);
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Selection' });

    fireEvent.change(selects[0], { target: { value: 'Sleep' } });
    fireEvent.change(selects[1], { target: { value: 'Web' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.change(selects[1], { target: { value: 'Sleep' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);

    fireEvent.change(selects[1], { target: { value: '' } });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);

    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  // ── Clear selection ──

  it('Clear Selection writes an exact null,null reset once without closing', () => {
    const props = makeProps({ payload: { ...basePayload, selectedSpells: ['Sleep', 'Web'] } });
    render(<SavantModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith(null, null);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  // ── Close / dismiss behavior ──

  // Overlay closes (unlike the sp-overlay siblings — this modal opts in via its
  // overlay onClick guard); clicks inside .popup-modal bubble up but are inert.
  // Neither path may ever touch onConfirm — writing is button-only.
  it.each([
    { target: '.popup-overlay', expectClose: true },
    { target: '.popup-modal', expectClose: false },
  ])('clicking $target with a pending selection never submits and closes=$expectClose', ({ target, expectClose }) => {
    const props = makeProps();
    const { container } = render(<SavantModal {...props} />);
    fireEvent.change(getSelects(container)[0], { target: { value: 'Sleep' } });

    fireEvent.click(container.querySelector(target));
    if (expectClose) {
      expect(props.onClose).toHaveBeenCalledTimes(1);
    } else {
      expect(props.onClose).not.toHaveBeenCalled();
    }
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  it('renders and survives an overlay click when onClose is omitted', () => {
    const props = makeProps();
    delete props.onClose;
    const { container } = render(<SavantModal {...props} />);
    fireEvent.click(container.querySelector('.popup-overlay'));
    expect(screen.getByText('Evocation Savant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Selection' })).toBeInTheDocument();
  });

  // ── School interpolation + custom options ──

  it('interpolates the school into header, labels, options, and testid, and submits custom spell strings', () => {
    const conjurationOptions = ['Summon Animals', 'Melf\'s Acid Arrow'];
    const props = makeProps({
      payload: { school: 'Conjuration', spellOptions: conjurationOptions, selectedSpells: [] },
    });
    const { container } = render(<SavantModal {...props} />);

    expect(screen.getByText('Conjuration Savant')).toBeInTheDocument();
    expect(screen.getByText(/Choose two Wizard spells from the Conjuration school/)).toBeInTheDocument();
    expect(screen.getByText('Conjuration spell 1:')).toBeInTheDocument();
    expect(screen.getByText('Conjuration spell 2:')).toBeInTheDocument();
    expect(screen.getByTestId('conjuration-savant-modal')).toBeInTheDocument();

    const selects = getSelects(container);
    expect([...selects[0].options].map(o => o.value)).toEqual(['', ...conjurationOptions]);

    // Non-list order + apostrophe string survive round-trip through the selects
    fireEvent.change(selects[0], { target: { value: 'Melf\'s Acid Arrow' } });
    fireEvent.change(selects[1], { target: { value: 'Summon Animals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith('Melf\'s Acid Arrow', 'Summon Animals');
  });

  it('renders placeholder-only dropdowns and keeps Confirm inert when spellOptions is empty', () => {
    const props = makeProps({ payload: { ...basePayload, spellOptions: [] } });
    const { container } = render(<SavantModal {...props} />);

    const selects = getSelects(container);
    expect(selects[0].options).toHaveLength(1); // placeholder only
    expect(selects[1].options).toHaveLength(1);
    expect(selects[0].options[0].textContent).toBe(PLACEHOLDER);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Selection' }));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
