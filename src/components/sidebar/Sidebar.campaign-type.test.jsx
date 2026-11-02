// @maintained-by-ai
// Campaign-type lane on the sidebar: an arena battle strips campaign-only
// planning views out of the nav (fight sandbox), while starter and standard
// campaigns keep the full nav. Header chips name the non-standard types so
// every tab sees what kind of campaign it opened; standard shows no chip.
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

const ARENA_HIDDEN = ['Drafts', 'Factions', 'Inventory', 'Notes', 'Quests', 'Sessions', 'Settlements'];
const ARENA_KEPT = ['Encounters', 'Initiative', 'Log', 'Maps', 'Music', 'NPCs', 'Rules', 'Admin'];

function createProps(overrides = {}) {
  const handler = () => vi.fn();
  return {
    campaignName: 'qa-arena',
    characters: [],
    activeCharacter: null,
    isLocalhost: true,
    onBackToCampaigns: handler(),
    onAddCharacter: handler(),
    onCharacterClick: handler(),
    onEncounterClick: handler(),
    onFactionsClick: handler(),
    onInitiativeClick: handler(),
    onMapsClick: handler(),
    onMusicClick: handler(),
    onNotesClick: handler(),
    onQuestsClick: handler(),
    onNPCsClick: handler(),
    onSessionsClick: handler(),
    onInventoryClick: handler(),
    onSettlementsClick: handler(),
    onCampaignBuilderClick: handler(),
    onLogClick: handler(),
    onRepairClick: handler(),
    ...overrides,
  };
}

describe('Sidebar campaign-type gating', () => {
  it('hides campaign-only views and shows the Arena chip when campaignType is arena', () => {
    const { container } = render(<Sidebar {...createProps({ campaignType: 'arena' })} />);
    for (const label of ARENA_HIDDEN) {
      expect(container.querySelector('nav')?.textContent).not.toContain(label);
    }
    for (const label of ARENA_KEPT) {
      expect(container.querySelector('nav')?.textContent).toContain(label);
    }
    const badge = container.querySelector('.sidebar-campaign-badge--arena');
    expect(badge).toHaveTextContent('Arena Battle');
  });

  it('keeps the full nav and shows the Starter chip when campaignType is starter', () => {
    const { container } = render(<Sidebar {...createProps({ campaignName: 'qa-starter', campaignType: 'starter' })} />);
    for (const label of ARENA_HIDDEN) {
      expect(container.querySelector('nav')?.textContent).toContain(label);
    }
    const badge = container.querySelector('.sidebar-campaign-badge--starter');
    expect(badge).toHaveTextContent('Starter Adventure');
  });

  it('renders the full nav with no type chip for standard (default) campaigns', () => {
    const { container } = render(<Sidebar {...createProps()} />);
    expect(container.querySelector('.sidebar-campaign-badge')).not.toBeInTheDocument();
    for (const label of ARENA_HIDDEN) {
      expect(container.querySelector('nav')?.textContent).toContain(label);
    }
  });
});
