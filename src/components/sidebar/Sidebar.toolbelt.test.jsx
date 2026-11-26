// Toolbelt effect on the nav (Item 1): GM-hidden views disappear for EVERY
// device; localhostOnly gating runs FIRST and takes precedence (a visitor
// never sees GM views whatever the settings say); hiding never un-hides; the
// Admin footer row honors the hidden set; and the "Sidebar" opener is GM-only
// and itself never hideable (a GM must never be able to lock themselves out
// of the settings).
import { render, fireEvent } from '@testing-library/react';
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

describe('Sidebar toolbelt gating', () => {
  it('an absent/empty hidden set leaves the full nav standing (default all-visible)', () => {
    const { container } = render(<Sidebar {...createProps({ hiddenViews: [] })} />);
    for (const label of ['Initiative', 'Music', 'Maps', 'Log']) {
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

  it('keeps GM-only views invisible to a VISITOR regardless of the toolbelt (localhostOnly precedence)', () => {
    // Nothing hidden: the visitor still sees zero GM views.
    const { container } = render(<Sidebar {...createProps({ isLocalhost: false, hiddenViews: [] })} />);
    for (const label of ['Encounters', 'Factions', 'GM Screen', 'Notes', 'NPCs', 'Quests', 'Sessions', 'Settlements', 'Admin']) {
      expect(navText(container)).not.toContain(label);
    }
  });

  it('hiding never UN-hides a GM-only view for a visitor', () => {
    const { container } = render(<Sidebar {...createProps({ isLocalhost: false, hiddenViews: ['quests'] })} />);
    expect(navText(container)).not.toContain('Quests');
    // ...while the same hidden set DOES drop a shared view for the visitor.
    expect(navText(container)).toContain('Initiative');
  });

  it('hides the Admin footer row when campaignRepair is hidden (GM side)', () => {
    const shown = render(<Sidebar {...createProps({ hiddenViews: [] })} />);
    expect(navText(shown.container)).toContain('Admin');
    const hidden = render(<Sidebar {...createProps({ hiddenViews: ['campaignRepair'] })} />);
    expect(navText(hidden.container)).not.toContain('Admin');
  });

  it('the Sidebar settings opener is GM-only, appears with the save lane, and survives hiding Admin', () => {
    const onSave = vi.fn();
    const visitor = render(<Sidebar {...createProps({ isLocalhost: false, onSaveHiddenViews: vi.fn() })} />);
    expect(navText(visitor.container)).not.toContain('Sidebar');

    const gm = render(<Sidebar {...createProps({ onSaveHiddenViews: onSave, hiddenViews: ['campaignRepair'] })} />);
    const opener = [...gm.container.querySelectorAll('.sidebar-footer button')];
    expect(opener.map((b) => b.textContent.trim())).toEqual(['Sidebar']);
    fireEvent.click(opener[0]);
    // Opens the dialog in place (no navigation, no save on open).
    expect(document.querySelector('.ct-modal')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders no opener when no save lane exists (read-only mount safety)', () => {
    const { container } = render(<Sidebar {...createProps()} />);
    expect(container.querySelector('.sidebar-footer').textContent).not.toContain('Sidebar');
  });
});
