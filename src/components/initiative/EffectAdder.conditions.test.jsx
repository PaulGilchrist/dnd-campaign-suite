// @maintained-by-ai
// EffectAdder conditions-TAB UI lane: registry census by name, field defaults,
// DC sanitizer bytes, selection → exact dispatch payload, cancel zero-write.
// NOT owned here (cited, not cloned):
//   #839 createEffectAdderHandlers.test.jsx — handler write-side landing, guard
//        battery, unknown-condition-key rejection.
//   #855 EffectAdder.concentration.test.jsx — concentration tab face (own DC
//        sanitizer + disabled-state-machine bytes there).
//   EffectAdder.rendering.test.jsx — tab bar existence, overlay/modal clicks
//        never cancelling (:40).
//   EffectAdder.effects-*.test.jsx — effects browse/config tab machinery.
// Old → new map (10 → 4):
//   'render all conditions' + 'DC/Save defaults' + 'six ability options'
//     → test 1 (census + defaults + disabled Apply byte, #781/#788)
//   'select a condition' + 'default ability on select' → test 2
//   'changing DC/Save' + 'invalid DC defaults' + 'onApply default payload'
//     + 'onApply custom payload' → test 3 (one full flow, exact bytes)
//   'Cancel click' (overlay half cut → rendering.test.jsx:40) +
//     'Apply without selection' (rewritten to disabled byte → test 1) → test 4
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

  it('renders every condition by name with default DC 10, Save con, and Apply disabled until a selection', () => {
    const { container } = render(<EffectAdder {...props} />);

    // Census by name: each condition is a button, and the grid holds exactly
    // one badge per name (no duplicates, none missing).
    CONDITION_NAMES.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.ea-grid button')).toHaveLength(CONDITION_NAMES.length);

    // Field defaults — this tab's own bytes (concentration DC is #855's).
    expect(screen.getByLabelText('DC')).toHaveValue(10);
    const save = screen.getByLabelText('Save');
    expect(save).toHaveValue('con');
    expect(Array.from(save.options).map(o => o.value)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);

    // Disabled byte before selection — assert the byte, never rely on click-blocking.
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('single-selects conditions and applies each condition\'s default save ability', () => {
    const { container } = render(<EffectAdder {...props} />);
    const save = screen.getByLabelText('Save');

    // grappled defaults to 'str' (registry CONDITION_SAVE_MAP); Apply becomes enabled.
    fireEvent.click(screen.getByRole('button', { name: 'Grappled' }));
    expect(save).toHaveValue('str');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();

    // blinded has no default save, so the previously chosen 'str' is retained.
    fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
    expect(save).toHaveValue('str');

    // Selection is single: exactly one badge carries the selected state.
    expect(container.querySelectorAll('.ea-badge--selected')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Blinded' })).toHaveClass('ea-badge--selected');
  });

  it('dispatches the exact conditions payload once, with DC sanitizer retaining valid bytes', () => {
    render(<EffectAdder {...props} />);
    const dc = screen.getByLabelText('DC');

    fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
    fireEvent.change(dc, { target: { value: 'abc' } });
    expect(dc).toHaveValue(10);
    fireEvent.change(dc, { target: { value: '0' } });
    expect(dc).toHaveValue(10);
    fireEvent.change(dc, { target: { value: '15' } });
    expect(dc).toHaveValue(15);
    fireEvent.change(screen.getByLabelText('Save'), { target: { value: 'dex' } });

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply).toHaveBeenCalledWith('conditions', {
      target: 'Goblin',
      conditionKey: 'blinded',
      dc: 15,
      ability: 'dex',
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
