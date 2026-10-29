// @maintained-by-ai
// Lane: EFFECTS-TAB EXIT AFFORDANCES (2026-10-29-Y "effect-adder-effects-tab-no-cancel").
// The Effects tab used to render no Cancel on either of its two views — the only
// exit was switching to a sibling tab (exit trap). Owns: browse-pane .ea-actions
// Cancel row + config-view Cancel button, both invoking onCancel with zero
// onApply dispatch, Escape closing the modal from every tab, and the keydown
// listener being removed on unmount (DiceTray convention).
// NOT owned here (cited): Conditions/Concentration Cancel legs → EffectAdder
// .conditions.test.jsx #856 / EffectAdder.concentration.test.jsx #855; overlay/
// modal clicks never cancelling → EffectAdder.rendering.test.jsx; browse/search
// pane → EffectAdder.effects-browsing.test.jsx #859; config fields + Apply
// payload → EffectAdder.effects-config.test.jsx #860; suppression notice →
// EffectAdder.suppression-notice.test.jsx.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EffectAdder from './EffectAdder.jsx';

const openEffectsTab = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Effects' }));

// Harness mirrors Initiative.jsx: the parent's onCancel clears its local
// effectAdderTarget state, so a real close UNMOUNTS the overlay (no network).
function CloseOnCancelHarness({ onCancelSpy, initialTab = 'effects' }) {
  const [open, setOpen] = React.useState(true)
  return open ? (
    <EffectAdder
      targetName='Goblin'
      initialTab={initialTab}
      onCancel={() => { onCancelSpy(); setOpen(false) }}
      onApply={vi.fn()}
      creatures={[{ name: 'Alice' }]}
    />
  ) : null
}

describe('EffectAdder - effects-tab Cancel + Escape exit affordances', () => {
  let props;

  beforeEach(() => {
    props = {
      targetName: 'Goblin',
      initialTab: 'effects',
      onCancel: vi.fn(),
      onApply: vi.fn(),
      creatures: [{ name: 'Alice' }],
    };
  });

  it('browse pane renders a Cancel button inside an .ea-actions row', () => {
    render(<EffectAdder {...props} />);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toBeInTheDocument();
    expect(cancel.closest('.ea-actions')).toBeInTheDocument();
  });

  it('Cancel in the browse pane closes the modal with zero apply dispatch', () => {
    const onCancelSpy = vi.fn();
    render(<CloseOnCancelHarness onCancelSpy={onCancelSpy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancelSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ea-overlay')).toBeNull();
  });

  it('config view keeps Back/Apply and adds a Cancel that closes without dispatching', () => {
    const onCancelSpy = vi.fn();
    const onApply = vi.fn();
    function ConfigHarness() {
      const [open, setOpen] = React.useState(true)
      return open ? (
        <EffectAdder
          targetName='Goblin'
          initialTab='effects'
          onCancel={() => { onCancelSpy(); setOpen(false) }}
          onApply={onApply}
          creatures={[{ name: 'Alice' }]}
        />
      ) : null
    }
    render(<ConfigHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Goad' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.closest('.ea-actions')).toBeInTheDocument();
    fireEvent.click(cancel);

    expect(onCancelSpy).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(document.querySelector('.ea-overlay')).toBeNull();
  });

  it.each(['conditions', 'effects', 'concentration'])(
    'Escape on the %s tab invokes onCancel exactly once',
    tab => {
      render(<EffectAdder {...props} initialTab={tab} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(props.onCancel).toHaveBeenCalledTimes(1);
      expect(props.onApply).not.toHaveBeenCalled();
    }
  );

  it('Escape closes the modal from the effects browse pane through the parent unmount', () => {
    const onCancelSpy = vi.fn();
    render(<CloseOnCancelHarness onCancelSpy={onCancelSpy} initialTab='conditions' />);
    // conditions → effects, then Escape: the browse-pane exit trap is gone.
    openEffectsTab();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ea-overlay')).toBeNull();
  });

  it('removes its Escape listener on unmount', () => {
    const onCancelSpy = vi.fn();
    const { unmount } = render(<EffectAdder {...props} onCancel={onCancelSpy} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelSpy).not.toHaveBeenCalled();
  });
});
