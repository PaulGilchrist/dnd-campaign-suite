// @maintained-by-ai 2026-11-22
// Regression lock for bug-quick-create-seeded-modal-escape-dead-after-refused-
// create: the seeded quick-create modals toggle `disabled={seeding}` on BOTH
// footer buttons, so the clicked Create sheds focus to BODY mid-create and the
// overlay-subtree keydown lane can never again see an Escape (dispatched at
// BODY, it bubbles body→window, never back down through the overlay). The
// shared hook now answers those stranded-focus keydowns from a window-level
// listener — while firing EXACTLY once (panel-targeted Escapes stay with the
// subtree lane), staying inert mid-create, only acting while a dialog with the
// panel class is actually mounted (CampaignSelection calls the hook from a
// persistent host), and unbinding on unmount.
//
// The BODY-focus face is what the component family test
// (CampaignSelection.create-modal-dismiss.test.jsx) could never catch: it
// dispatches keydown FROM THE INPUT (subtree) only. Every dismiss here
// dispatches from document.body or the panel to pin the lane split.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useModalDismiss } from './useModalDismiss.js';

// Thin dialog wired exactly like SeededCampaignModal.jsx: the overlay carries
// the returned mousedown/click/keydown handlers and the panel is the
// panelSelector root. `open=false` mirrors the persistent-host consumers
// (CampaignSelection): hook still called, dialog not rendered.
function DismissHost({ onCancel, disabled = false, open = true, panelSelector = '.modal-content' }) {
  const { handleKeyDown, handleOverlayMouseDown, handleOverlayClick } =
    useModalDismiss(onCancel, { disabled, panelSelector });
  if (!open) return <div className="host">persistent host, dialog closed</div>;
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className={panelSelector.replace(/^\./, '')} role="dialog" aria-modal="true">
        <input autoFocus placeholder="Enter campaign name" />
        <button>Cancel</button>
      </div>
    </div>
  );
}

const input = () => document.querySelector('input[placeholder="Enter campaign name"]');
const pressEscapeOnBody = () => fireEvent.keyDown(document.body, { key: 'Escape' });

describe('useModalDismiss: Escape rescue for focus stranded outside the panel', () => {
  it('answers an Escape dispatched at BODY (the refused-create face)', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} />);
    expect(onCancel).not.toHaveBeenCalled();

    pressEscapeOnBody();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires exactly once when focus is inside the panel (window lane defers to the subtree lane)', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} />);

    fireEvent.keyDown(input(), { key: 'Escape' });

    // Both listeners see this keydown; only the subtree lane may act, or the
    // stacked-dialog scoping of the subtree handler is lost via double-cancel.
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('stays inert mid-create: disabled blocks the BODY lane too', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} disabled />);

    pressEscapeOnBody();
    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('a persistent host with no dialog mounted never acts on page-wide Escapes', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} open={false} />);

    pressEscapeOnBody();

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('honours a custom panelSelector on both lanes', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} panelSelector=".pi-modal" />);

    // Panel-targeted: subtree lane only (one cancel); the window lane skips
    // because the target is inside the custom-class panel.
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Stranded focus: the rescue lane acts under the custom class too.
    pressEscapeOnBody();
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('ignores non-Escape keys dispatched at BODY', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} />);

    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('leaves document-targeted Escapes to the host lane (AvatarModal one-shot law — never double-fires)', () => {
    const onCancel = vi.fn();
    render(<DismissHost onCancel={onCancel} />);

    // AvatarModal.jsx carries its OWN document-level one-shot Escape listener;
    // a rescue that acted on target=document would fire onClose twice per press
    // (caught live by AvatarModal.test.jsx 'closes exactly once'). The rescue
    // lane answers ONLY the <body>/<html> stranded-focus target.
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('unmount removes the window listener (no leak, Escape dead afterwards)', () => {
    const onCancel = vi.fn();
    const { unmount } = render(<DismissHost onCancel={onCancel} />);
    unmount();

    pressEscapeOnBody();

    expect(onCancel).not.toHaveBeenCalled();
  });
});
