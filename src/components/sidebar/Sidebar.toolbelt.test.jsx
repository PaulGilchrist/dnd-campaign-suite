// @maintained-by-ai 2026-11-26
// Sidebar-level toolbelt wiring (Item 1): an absent hidden set leaves the full
// nav standing; a hidden view drops its button for BOTH origins; the
// localhostOnly gate runs FIRST (a visitor sees zero GM views whatever the
// settings say, and no hidden set can un-hide one); hiding a shared view never
// un-hides its neighbours; the Admin footer row honors the hidden set; the
// "Sidebar" opener is GM-only, needs the save lane, is never hideable (no
// lock-out), and opens/closes the dialog in place without saving on open.
// Dialog internals (checkboxes, presets, debounce, kit close lanes) are owned
// by ToolbeltSettings.test.jsx; the view/preset data contracts by
// src/services/ui/sidebarNav.test.js.
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

function createProps(overrides = {}) {
  const handler = () => vi.fn();
  return {
    campaignName: 'test-campaign',
    characters: [],
    activeCharacter: null,
    isLocalhost: true,
    onBackToCampaigns: handler(),
    onAddCharacter: handler(),
    onCharacterClick: handler(),
    onEncounterClick: handler(),
    onFactionsClick: handler(),
    onGMScreenClick: handler(),
    onInitiativeClick: handler(),
    onMapsClick: handler(),
    onMusicClick: handler(),
    onNotesClick: handler(),
    onQuestsClick: handler(),
    onQuestBoardClick: handler(),
    onNPCsClick: handler(),
    onSessionsClick: handler(),
    onInventoryClick: handler(),
    onSettlementsClick: handler(),
    onCampaignBuilderClick: handler(),
    onLogClick: handler(),
    onRepairClick: handler(),
    onHelpClick: handler(),
    ...overrides,
  };
}

const navText = (container) => container.querySelector('nav').textContent;

const GM_ONLY_LABELS = ['Encounters', 'Factions', 'GM Screen', 'Notes', 'NPCs', 'Quests', 'Sessions', 'Settlements', 'Admin'];

describe('Sidebar toolbelt gating', () => {
  it('an absent hidden set leaves the full nav standing (default all-visible, Admin included)', () => {
    const { container } = render(<Sidebar {...createProps()} />);
    for (const label of ['Initiative', 'Music', 'Maps', 'Log', 'Admin']) {
      expect(navText(container)).toContain(label);
    }
  });

  it.each([['initiative', 'Initiative', 'Initiative'], ['music', 'Music', 'Music'], ['mapsManager', 'Maps', 'Map']])(
    'hidden %s drops the button for BOTH origins (GM label / player label)',
    (view, label, playerLabel) => {
      const gm = render(<Sidebar {...createProps({ hiddenViews: [view], isLocalhost: true })} />);
      expect(navText(gm.container)).not.toContain(label);
      const visitor = render(<Sidebar {...createProps({ hiddenViews: [view], isLocalhost: false })} />);
      expect(navText(visitor.container)).not.toContain(playerLabel);
    },
  );

  it('a VISITOR sees zero GM views and no footer whatever the hidden set (localhostOnly precedence, hiding never un-hides)', () => {
    // Hiding a GM-only id exercises the gate with a NON-empty set: the other
    // GM labels below are un-hidden yet still absent, proving localhostOnly
    // runs first and the hidden list neither adds nor removes visitor access.
    const { container } = render(<Sidebar {...createProps({ isLocalhost: false, hiddenViews: ['quests'] })} />);
    for (const label of GM_ONLY_LABELS) {
      expect(navText(container)).not.toContain(label);
    }
    // Positive control: the shared nav is intact for the visitor.
    for (const label of ['Initiative', 'Log']) {
      expect(navText(container)).toContain(label);
    }
    // The whole GM footer (Admin row + opener) never renders for a visitor.
    expect(container.querySelector('.sidebar-footer')).toBeNull();
  });

  it('hides the Admin footer row when campaignRepair is hidden (GM side)', () => {
    const { container } = render(<Sidebar {...createProps({ hiddenViews: ['campaignRepair'] })} />);
    expect(navText(container)).not.toContain('Admin');
  });

  it('the opener is never hideable, and opens/closes the dialog in place with no save on open', () => {
    const onSave = vi.fn();
    // Even with Admin hidden, the opener is the GM's only surviving button —
    // hiding must never lock a GM out of the settings.
    const { container } = render(<Sidebar {...createProps({ onSaveHiddenViews: onSave, hiddenViews: ['campaignRepair'] })} />);
    const opener = [...container.querySelectorAll('.sidebar-footer button')];
    expect(opener.map((b) => b.textContent.trim())).toEqual(['Sidebar']);

    fireEvent.click(opener[0]);
    expect(document.querySelector('.ct-modal')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(document.querySelector('.ct-modal')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders no opener when no save lane exists (read-only mount safety)', () => {
    const { container } = render(<Sidebar {...createProps()} />);
    const footer = container.querySelector('.sidebar-footer');
    expect(footer).not.toBeNull(); // Admin row still stands...
    expect(footer.textContent).not.toContain('Sidebar'); // ...without the opener
  });
});
