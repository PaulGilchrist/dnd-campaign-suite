// @maintained-by-ai
// Lane: EffectAdder MODAL CHROME (canonical owner) — heading exact-byte-once,
// tab-bar census BY NAME in exact order (#789/#849), tab-switch panel seam
// (one mount/unmount observation each direction), overlay + modal-content clicks
// never cancelling (dismissal was deliberately removed: git 15eb96d46).
// NOT owned here (cited): conditions tab face + payload → EffectAdder.conditions
// .test.jsx #856; concentration tab face + zero-write cancel → EffectAdder
// .concentration.test.jsx #855; creatures→source dropdown census → EffectAdder
// .creatures.test.jsx #857; browse/search/empty pane → EffectAdder.effects
// -browsing.test.jsx #859; config view header/Back/'Other…'/payload →
// EffectAdder.effects-config.test.jsx #860; invalid/default initialTab routing →
// EffectAdder.edge-cases.test.jsx #858; dispatch landing → createEffectAdder
// Handlers.test.jsx #838/#839.
// Old -> new map (4 its / 5 cases -> 4 its / 4 cases):
//   it.each heading 'Goblin'/'Alice the Wizard'/'' -> test 1: h3 is a pure
//     passthrough of targetName (EffectAdder.jsx:110); one exact-byte pin
//     (strengthened with once), other rows re-interpolate the same JSX.
//   'three tabs: Conditions, Effects, Concentration' -> test 2: strengthened
//     from three loose getByRole queries to an exact ordered census BY NAME of
//     the whole tab bar (cited owner: #856/#858).
//   'NOT call onCancel when the overlay background is clicked' + 'NOT call
//   onCancel when the modal content is clicked' (:40, cited by #856 cancel-half
//   -cut and #858) -> test 3: one click sequence proves both halves of the
//   same guard — neither .ea-overlay nor .ea-modal has a click handler
//   (:108-109) — plus modal-still-mounted evidence after each click.
//   ADDED test 4: tab-switch seam (owned by contract, previously missing):
//   conditions→effects→concentration→conditions, panel markers mount/unmount
//   one at a time. Markers are single-byte seam sentinels only; panel CONTENT
//   censuses stay with #855/#856/#859/#860.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

describe('EffectAdder - modal chrome', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'conditions',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [{ name: 'Alice' }],
    };
  });

  it('renders the target name exactly once as the modal heading', () => {
    render(<EffectAdder {...props} />);
    expect(screen.getAllByRole('heading', { level: 3, name: 'Goblin' })).toHaveLength(1);
  });

  it('renders exactly three tab buttons — Conditions, Effects, Concentration — in that order', () => {
    render(<EffectAdder {...props} />);
    const tabs = within(document.querySelector('.ea-tabs')).getAllByRole('button');
    expect(tabs.map(b => b.textContent)).toEqual(['Conditions', 'Effects', 'Concentration']);
  });

  it('never cancels and stays mounted when the overlay or modal content is clicked', () => {
    const onCancel = vi.fn();
    render(<EffectAdder {...props} onCancel={onCancel} />);
    // Overlay backdrop click — dismissal was removed on purpose; nothing happens.
    fireEvent.click(document.querySelector('.ea-overlay'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector('.ea-modal')).toBeInTheDocument();
    // Clicks bubbling from inside the modal content cancel nothing either.
    fireEvent.click(document.querySelector('.ea-modal'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector('.ea-modal')).toBeInTheDocument();
  });

  it('switches the mounted panel one-at-a-time across all three tabs', () => {
    render(<EffectAdder {...props} />);
    // initialTab='conditions': conditions marker live, other panels absent.
    expect(screen.getByRole('button', { name: 'Blinded' })).toBeInTheDocument();
    // conditions -> effects
    fireEvent.click(screen.getByRole('button', { name: 'Effects' }));
    expect(screen.getByPlaceholderText('Search effects…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Blinded' })).not.toBeInTheDocument();
    // effects -> concentration
    fireEvent.click(screen.getByRole('button', { name: 'Concentration' }));
    expect(screen.getByLabelText('Spell Name')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search effects…')).not.toBeInTheDocument();
    // concentration -> conditions (backward leg)
    fireEvent.click(screen.getByRole('button', { name: 'Conditions' }));
    expect(screen.getByRole('button', { name: 'Blinded' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Spell Name')).not.toBeInTheDocument();
    // Pure UI navigation: no dispatch on tab churn.
    expect(props.onApply).not.toHaveBeenCalled();
  });
});
