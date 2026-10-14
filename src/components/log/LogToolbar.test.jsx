import { screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { setup, beforeEachSetup } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  // ── TOOLBAR & STRUCTURE ───────────────────────
  describe('toolbar', () => {
    it('renders heading, textarea, add button, and character select', () => {
      setup(Log, []);
      expect(screen.getByRole('heading', { name: /campaign log/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Anonymous' })).toBeInTheDocument();
    });

    it('hides character select when no characters provided', () => {
      setup(Log, [], true, []);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });
});
