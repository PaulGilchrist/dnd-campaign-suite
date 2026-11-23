// @maintained-by-ai
// Lane: AllySelectionModal dismissal (backlog ZA 2026-11-23). The sp-overlay
// allies editor used to answer ONLY its Cancel button, so an Escape-left-open
// modal kept intercepting clicks on the board behind it. OWNED here: Escape and
// a PURE backdrop click route through the shared hooks/ui/useModalDismiss.js
// tier (SeededCampaignModal/DeleteConfirmModal precedent) to the SAME inert
// onCancel lane — never onConfirm, so a draft selection can never commit via a
// dismiss. Pinned: panel/inner-button/overlay-targeted Escapes (subtree lane,
// firing exactly once), the stranded-on-BODY face via the hook's window-rescue
// lane, the panel→backdrop drag guard, Cancel/Confirm lanes byte-unchanged,
// and the hook contract's `{disabled:true}` inertness under this family's
// '.sp-modal' panelSelector (the component itself passes no disabled flag —
// nothing is ever in flight here — so the inert face is pinned at the hook
// seam with this consumer's exact options).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllySelectionModal from './AllySelectionModal.jsx';
import { useModalDismiss } from '../../hooks/ui/useModalDismiss.js';

const creatures = [
  { name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 20 },
  { name: 'Hero', type: 'player', currentHp: 30, maxHp: 30 },
  { name: 'Orc', type: 'npc', currentHp: 0, maxHp: 25 },
];

let onConfirm;
let onCancel;

function renderModal(overrides = {}) {
  render(
    <AllySelectionModal
      title="Select Allies"
      icon="fa-shield-halved"
      creatures={creatures}
      currentAllies={[]}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
}

const overlay = () => document.querySelector('.sp-overlay');
const panel = () => document.querySelector('.sp-modal');
const checkboxFor = name => screen.getByRole('checkbox', { name: new RegExp(name, 'i') });

// Every dismiss face must be fully inert toward the write lane.
function expectDismissOnly() {
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
}

beforeEach(() => {
  onConfirm = vi.fn();
  onCancel = vi.fn();
});

describe('Escape dismisses through the same inert onCancel lane as Cancel', () => {
  it('Escape with focus on an inner control (checkbox) routes to onCancel, never onConfirm', () => {
    renderModal();
    // Draft first: a dismiss must drop it, not commit it.
    fireEvent.click(checkboxFor('Goblin'));

    fireEvent.keyDown(checkboxFor('Goblin'), { key: 'Escape' });

    expectDismissOnly();
  });

  it('Escape with focus on the entrance-focused button closes too', () => {
    renderModal();
    // useOverlayEntranceFocus pulls focus to the first focusable element on open.
    expect(panel().contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement, { key: 'Escape' });

    expectDismissOnly();
  });

  it('a panel-targeted Escape fires EXACTLY once (window rescue defers to the subtree lane)', () => {
    renderModal();

    fireEvent.keyDown(panel(), { key: 'Escape' });

    expectDismissOnly();
  });

  it('Escape with focus stranded on document.body closes via the window-rescue lane', () => {
    renderModal();
    // The documented stranded-focus face: a keydown targeted at BODY never
    // bubbles through the overlay, only the hook's window listener sees it.
    document.activeElement.blur();
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expectDismissOnly();
  });

  it('a non-Escape key dispatched at BODY does nothing', () => {
    renderModal();

    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('a pure backdrop click dismisses like Escape', () => {
  it('mousedown + click fully on the .sp-overlay scrim routes to onCancel', () => {
    renderModal();
    fireEvent.click(checkboxFor('Orc')); // draft selection must be dropped

    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());

    expectDismissOnly();
  });

  it('clicks bubbling from inside the panel keep the draft (no dismiss)', () => {
    renderModal();

    fireEvent.click(panel());
    fireEvent.mouseDown(panel());
    fireEvent.click(panel());

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('the drag guard holds', () => {
  it('mousedown in the panel released over the backdrop does not dismiss', () => {
    renderModal();

    fireEvent.mouseDown(panel());
    fireEvent.click(overlay());

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    // The guard resets: the next pure backdrop click still dismisses.
    fireEvent.mouseDown(overlay());
    fireEvent.click(overlay());
    expectDismissOnly();
  });

  it('text dragged off the header and released on the scrim stays draft', () => {
    renderModal();
    fireEvent.click(checkboxFor('Goblin'));

    fireEvent.mouseDown(screen.getByText('Select Allies'));
    fireEvent.mouseUp(overlay());
    fireEvent.click(overlay());

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(checkboxFor('Goblin')).toBeChecked();
  });
});

describe('Cancel and Confirm lanes are unchanged', () => {
  it('the Cancel button still routes once to onCancel with no confirm (law unchanged)', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Select All/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expectDismissOnly();
  });

  it('Confirm Allies (N) still writes only on confirm', () => {
    renderModal();
    fireEvent.click(checkboxFor('Hero'));

    fireEvent.click(screen.getByRole('button', { name: /Confirm Allies \(1\)/ }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['Hero']);
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('disabled-inertness per the hook contract (.sp-modal tier)', () => {
  // AllySelectionModal itself passes no `disabled` (no create is ever in
  // flight), so the inert face is pinned at the hook seam with THIS family's
  // exact panelSelector: every dismiss path must stay dead while disabled.
  function DisabledHost({ onCancel: cancel, disabled }) {
    const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
      useModalDismiss(cancel, { disabled, panelSelector: '.sp-modal' });
    return (
      <div
        className="sp-overlay"
        role="presentation"
        onMouseDown={handleOverlayMouseDown}
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
      >
        <div className="sp-modal">
          <input autoFocus placeholder="pinned focus anchor" />
        </div>
      </div>
    );
  }

  it('neither Escape (subtree or stranded) nor a backdrop click dismisses while disabled', () => {
    const cancel = vi.fn();
    render(<DisabledHost onCancel={cancel} disabled />);

    fireEvent.keyDown(screen.getByPlaceholderText('pinned focus anchor'), { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.mouseDown(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-overlay'));

    expect(cancel).not.toHaveBeenCalled();
  });
});
