// @improved-by-ai
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

    it('renders the section header and each feat name without fetching details up front', () => {
      renderCharFeats(['Actor', 'Athlete']);
      expect(screen.getByText('Feats:')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.getByText('Athlete')).toBeInTheDocument();
      expect(loadFeatData).not.toHaveBeenCalled();
    });

    it('joins multiple feats with commas in the original order', () => {
      const { container } = renderCharFeats(['Zombie Feat', 'Alpha Feat', 'Athlete']);
      expect(container.textContent).toBe('Feats: Zombie Feat, Alpha Feat, Athlete');
    });

    it('collapses duplicate feats into one entry with a count badge per duplicate set', () => {
      renderCharFeats(['Actor', 'Actor', 'Athlete', 'Athlete', 'Athlete']);
      expect(screen.getAllByText('Actor * 2')).toHaveLength(1);
      expect(screen.getAllByText('Athlete * 3')).toHaveLength(1);
    });

    it('shows no count badge for a feat taken once', () => {
      renderCharFeats(['Actor', 'Athlete']);
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.queryByText(/\* \d/)).not.toBeInTheDocument();
    });
  });

  describe('opening feat details', () => {
    it('delegates the matched feat object to showPopup without rendering its own popup', async () => {
      const { showPopup } = renderCharFeats(['Actor']);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(showPopup).toHaveBeenCalledWith(FEAT_ACTOR);
      });
      // Found feats are rendered by the caller's popup, not this component's.
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });

    it('defaults to 5e rules data when the character has no rules version', async () => {
      const { showPopup } = renderCharFeats(['Actor']);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('5e');
        expect(showPopup).toHaveBeenCalledWith(FEAT_ACTOR);
      });
    });

    it('loads 2024 rules data when the character uses the 2024 ruleset', async () => {
      renderCharFeats(['Actor'], { rules: '2024' });
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(loadFeatData).toHaveBeenCalledWith('2024');
      });
    });

    it('matches a feat by index when the database name differs', async () => {
      const aliased = { name: 'Some Other Feat', index: 'actor', desc: ['Not the actor feat'] };
      loadFeatData.mockResolvedValue([aliased]);
      const { showPopup } = renderCharFeats(['Actor']);
      fireEvent.click(screen.getByText('Actor'));
      await waitFor(() => {
        expect(showPopup).toHaveBeenCalledWith(aliased);
      });
    });

    it('normalises case and spaces when matching multi-word feat names', async () => {
      const feat2024 = { name: 'GREAT WEAPON MASTER', index: 'great weapon master', desc: ['2024 version'] };
      loadFeatData.mockResolvedValue([feat2024]);
      const { showPopup } = renderCharFeats(['Great Weapon Master'], { rules: '2024' });
      fireEvent.click(screen.getByText('Great Weapon Master'));
      await waitFor(() => {
        expect(showPopup).toHaveBeenCalledWith(feat2024);
      });
    });
  });

  describe('not found and error popups', () => {
    it('shows a not-found popup in the DOM when the feat is absent from a loaded database, without calling showPopup', async () => {
      loadFeatData.mockResolvedValue([FEAT_ATHLETE]);
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
