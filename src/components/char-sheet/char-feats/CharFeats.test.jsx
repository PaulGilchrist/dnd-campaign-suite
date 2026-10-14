// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharFeats from './CharFeats.jsx';

// Only mock the data boundary (network/JSON fetch). usePopup and Popup are
// simple enough to run for real so the popup open/close behavior is verified
// in the DOM rather than through spies.
vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(),
}));

import { loadFeatData } from '../../../services/ui/dataLoader.js';

const FEAT_ACTOR = {
  name: 'Actor',
  index: 'actor',
  desc: ['You look, sound, and act like a different person.'],
};

const FEAT_ATHLETE = {
  name: 'Athlete',
  index: 'athlete',
  desc: ['You excel at athletic feats.'],
};

// Fresh props + showPopup spy per render; no shared mutable fixtures.
function renderCharFeats(feats, { rules, showPopup = vi.fn() } = {}) {
  const utils = render(
    <CharFeats playerStats={{ feats, rules }} showPopup={showPopup} />
  );
  return { ...utils, showPopup };
}

describe('CharFeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFeatData.mockResolvedValue([FEAT_ACTOR, FEAT_ATHLETE]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('display', () => {
    it.each([
      ['missing', undefined],
      ['empty', []],
    ])('renders nothing when the feats list is %s', (_label, feats) => {
      const { container } = renderCharFeats(feats);
      expect(container.innerHTML).toBe('');
    });

    it('renders the header and feat names comma-joined in original order, defers detail fetching, and shows no badge for single feats', () => {
      const { container } = renderCharFeats(['Zombie Feat', 'Alpha Feat', 'Athlete']);
      expect(container.textContent).toBe('Feats: Zombie Feat, Alpha Feat, Athlete');
      // Details arrive from the rules database only on click, never up front.
      expect(loadFeatData).not.toHaveBeenCalled();
      expect(screen.queryByText(/\* \d/)).not.toBeInTheDocument();
    });

    it('collapses duplicate feats into one entry with a count badge per duplicate set', () => {
      renderCharFeats(['Actor', 'Actor', 'Athlete', 'Athlete', 'Athlete']);
      expect(screen.getAllByText('Actor * 2')).toHaveLength(1);
      expect(screen.getAllByText('Athlete * 3')).toHaveLength(1);
      expect(screen.queryByText('Actor', { exact: true })).not.toBeInTheDocument();
    });
  });

  describe('opening feat details', () => {
    it.each([
      ['5e by default when the character has no rules version', undefined, '5e'],
      ['2024 when the character uses the 2024 ruleset', '2024', '2024'],
    ])('loads %s data and delegates the matched feat to showPopup without rendering its own popup', async (_label, rules, expectedVersion) => {
      const { showPopup } = renderCharFeats(['Actor'], { rules });
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith(expectedVersion);
        expect(showPopup).toHaveBeenCalledWith(FEAT_ACTOR);
      });
      // Found feats are rendered by the caller's popup, not this component's.
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });

    it.each([
      ['by index when the database name differs', [
        { name: 'Some Other Feat', index: 'actor', desc: ['Not the actor feat'] },
      ], 'Actor'],
      ['by normalised case and spaces when the database name differs in format', [
        { name: 'GREAT WEAPON MASTER', index: 'great weapon master', desc: ['2024 version'] },
      ], 'Great Weapon Master'],
    ])('matches feats %s', async (_label, dbFeats, clickedName) => {
      loadFeatData.mockResolvedValue(dbFeats);
      const { showPopup } = renderCharFeats([clickedName]);
      fireEvent.click(screen.getByText(clickedName));
      await waitFor(() => {
        expect(showPopup).toHaveBeenCalledWith(dbFeats[0]);
      });
    });
  });

  describe('not found and error popups', () => {
    it.each([
      ['feat is absent from a loaded database', [FEAT_ATHLETE]],
      ['database loads empty', []],
    ])('shows a dismissible not-found popup in the DOM when the %s, without calling showPopup', async (_label, dbFeats) => {
      loadFeatData.mockResolvedValue(dbFeats);
      const { showPopup } = renderCharFeats(['Actor']);
      fireEvent.click(screen.getByText('Actor'));

      await waitFor(() => {
        expect(screen.getByText(/not found in database/i)).toBeInTheDocument();
      });
      expect(screen.getByText('Actor', { selector: 'b' })).toBeInTheDocument();
      expect(showPopup).not.toHaveBeenCalled();

      // The popup closes when dismissed.
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        expect(screen.queryByText(/not found in database/i)).not.toBeInTheDocument();
      });
    });

    it('shows an error popup with the failure reason and logs to console when feat loading fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      loadFeatData.mockRejectedValue(new Error('Network error'));
      const { showPopup } = renderCharFeats(['Actor']);
      fireEvent.click(screen.getByText('Actor'));

      await waitFor(() => {
        expect(screen.getByText(/Error loading feat details: Network error/)).toBeInTheDocument();
      });
      expect(showPopup).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CharFeats] Error loading feats'),
        expect.any(Error)
      );
    });
  });
});
