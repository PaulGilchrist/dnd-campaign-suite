// @maintained-by-ai
// EffectAdder conditions-TAB UI lane: registry census by name, field defaults,
// DC sanitizer bytes, selection → exact dispatch payload, cancel zero-write.
//
// condition-badge-saveless-dc-noise (2026-10-29-Y) label-build rule, input side:
//   saveless condition + untouched (empty) DC → dispatch dc: undefined (badge bare);
//   save-declaring condition (conditionUtils.conditionDeclaresSave) → default DC
//   CONDITION_SAVE_DC pre-filled → dispatch dc: 10;
//   GM types any number on a saveless condition → dispatch that DC (intent wins).
// The badge-side half of the rule (stored dc gates the suffix) is pinned in
// CreatureCard.conditions.test.jsx; the predicate itself in conditionUtils.test.js.
// NOT owned here (cited, not cloned):
//   #839 createEffectAdderHandlers.test.jsx — handler write-side landing, guard
//        battery, unknown-condition-key rejection, undefined-dc pass-through + log.
//   #855 EffectAdder.concentration.test.jsx — concentration tab face (own DC
//        sanitizer + disabled-state-machine bytes there). Concentration ALWAYS
//        keeps its DC — untouched by the saveless-DC rule.
//   EffectAdder.rendering.test.jsx — tab bar existence, overlay/modal clicks
//        never cancelling (:40).
//   EffectAdder.effects-*.test.jsx — effects browse/config tab machinery.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

// Census BY NAME — pins exactly what the GM sees in the conditions tab.
// If the registry changes, this list forces a deliberate review here too.
const CONDITION_NAMES = [
  'Blinded',
  'Charmed',
  'Cursed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Slow',
  'Stunned',
  'Unconscious',
];

describe('EffectAdder - conditions tab', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
    };
  });

  it('renders every condition by name with an EMPTY default DC, Save con, and Apply disabled until a selection', () => {
    const { container } = render(<EffectAdder {...props} />);

    // Census by name: each condition is a button, and the grid holds exactly
    // one badge per name (no duplicates, none missing).
    CONDITION_NAMES.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.ea-grid button')).toHaveLength(CONDITION_NAMES.length);

    // Field defaults — this tab's own bytes (concentration DC is #855's).
    // Empty number input reads null via jest-dom. The old "default 10" stamp
    // was the saveless-DC noise: it leaked "DC 10" onto saveless badges.
    expect(screen.getByLabelText('DC')).toHaveValue(null);
    const save = screen.getByLabelText('Save');
    expect(save).toHaveValue('con');
    expect(Array.from(save.options).map(o => o.value)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);

    // Disabled byte before selection — assert the byte, never rely on click-blocking.
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

    // DC-optional hint (AC4 coherence): present, and names the no-save case
    // once a saveless chip is selected.
    const hint = document.querySelector('.ea-dc-hint');
    expect(hint).toBeInTheDocument();
    expect(hint.textContent).toContain('DC is optional');
    fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
    expect(document.querySelector('.ea-dc-hint').textContent)
      .toBe('No saving throw — the badge shows no DC unless you type one.');
  });

  it('single-selects conditions, applies default save ability, and pre-fills DC only for declared saves', () => {
    const { container } = render(<EffectAdder {...props} />);
    const save = screen.getByLabelText('Save');
    const dc = screen.getByLabelText('DC');

    // grappled defaults to 'str' (registry CONDITION_SAVE_MAP) AND pre-fills
    // the default DC — it declares a condition-level save.
    fireEvent.click(screen.getByRole('button', { name: 'Grappled' }));
    expect(save).toHaveValue('str');
    expect(dc).toHaveValue(10);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();

    // blinded has no default save, so the previously chosen 'str' is retained;
    // switching to a saveless chip CLEARS the prefilled DC.
    fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
    expect(save).toHaveValue('str');
    expect(dc).toHaveValue(null);

    // Poisoned: CONDITION_SAVE_MAP carries 'con' (the save against BECOMING
    // poisoned) but the condition declares no own save — DC stays empty.
    fireEvent.click(screen.getByRole('button', { name: 'Poisoned' }));
    expect(save).toHaveValue('con');
    expect(dc).toHaveValue(null);

    // paralyzed declares CON and restrains via STR — both pre-fill DC 10.
    fireEvent.click(screen.getByRole('button', { name: 'Paralyzed' }));
    expect(dc).toHaveValue(10);
    fireEvent.click(screen.getByRole('button', { name: 'Restrained' }));
    expect(dc).toHaveValue(10);

    // Selection is single: exactly one badge carries the selected state.
    expect(container.querySelectorAll('.ea-badge--selected')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Restrained' })).toHaveClass('ea-badge--selected');
  });

  it('DC sanitizer: empty/invalid input means no DC; a typed number is kept', () => {
    render(<EffectAdder {...props} />);
    const dc = screen.getByLabelText('DC');

    // Blinded is saveless → starts empty; garbage/zero collapses back to
    // empty (= no DC wired), a valid number is kept verbatim.
    fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
    fireEvent.change(dc, { target: { value: 'abc' } });
    expect(dc).toHaveValue(null);
    fireEvent.change(dc, { target: { value: '0' } });
    expect(dc).toHaveValue(null);
    fireEvent.change(dc, { target: { value: '15' } });
    expect(dc).toHaveValue(15);

    // A declared-save chip re-select RESETS the typed DC back to its default.
    fireEvent.click(screen.getByRole('button', { name: 'Paralyzed' }));
    expect(dc).toHaveValue(10);

    // Clearing a declared-save DC is honored (GM intent both directions).
    fireEvent.change(dc, { target: { value: '' } });
    expect(dc).toHaveValue(null);
  });

  it('dispatches the exact conditions payload once (untouched DC → undefined for saveless)', () => {
    render(<EffectAdder {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Poisoned' }));
    // Poisoned's chip click pre-selects its source-save ability ('con') in the
    // dropdown — pre-selection alone is unchanged; only the DC lane moved.
    expect(screen.getByLabelText('Save')).toHaveValue('con');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith('conditions', {
      target: 'Goblin',
      conditionKey: 'poisoned',
      dc: undefined,
      ability: 'con',
    });
  });

  it.each([
    {
      name: 'saveless condition typed DC → dispatched (GM intent wins)',
      chip: 'Blinded',
      type: '15',
      expected: { conditionKey: 'blinded', dc: 15, ability: 'con' },
    },
    {
      name: 'declared-save condition default DC → dispatched as 10',
      chip: 'Paralyzed',
      type: null,
      expected: { conditionKey: 'paralyzed', dc: 10, ability: 'con' },
    },
    {
      name: 'declared-save condition cleared DC → dispatched as undefined',
      chip: 'Restrained',
      type: '',
      expected: { conditionKey: 'restrained', dc: undefined, ability: 'str' },
    },
  ])('dispatches once — $name', async ({ chip, type, expected }) => {
    render(<EffectAdder {...props} />);
    fireEvent.click(screen.getByRole('button', { name: chip }));
    if (type !== null) {
      fireEvent.change(screen.getByLabelText('DC'), { target: { value: type } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith('conditions', {
      target: 'Goblin',
      ...expected,
    });
  });

  it('Cancel dispatches onCancel exactly once with zero writes', () => {
    render(<EffectAdder {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();
    // Overlay-background click is owned by EffectAdder.rendering.test.jsx:40 — not re-pinned.
  });
});
