import { screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, beforeEachSetup, mockAddEntry } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log - note adding', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  describe('adding notes on button click', () => {
    it('submits note with trimmed text', async () => {
      setup(Log, []);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: ' Hello ' },
      });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'note', noteText: 'Hello' }),
        );
      });
    });

    it('uses selected character as author', async () => {
      setup(Log, []);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: 'hi' },
      });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Aragorn' } });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'note', characterName: 'Aragorn', noteText: 'hi' }),
        );
      });
    });

    it('uses Anonymous when no characters available', async () => {
      setup(Log, [], true, []);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: 'hi' },
      });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'note', characterName: 'Anonymous' }),
        );
      });
    });

    it('does not submit when text is whitespace only', () => {
      setup(Log, []);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: '    ' },
      });
      fireEvent.click(q('.log-add-btn'));
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('clears textarea after successful submit', async () => {
      setup(Log, []);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => expect(textarea).toHaveValue(''));
    });

    it('preserves textarea content when note is whitespace', () => {
      setup(Log, []);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(q('.log-add-btn'));
      expect(textarea).toHaveValue('   ');
    });

  });

  describe('keyboard shortcuts', () => {
    it('ctrl+enter submits the note', async () => {
      setup(Log, []);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    });

    it('plain enter does not submit', () => {
      setup(Log, []);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(mockAddEntry).not.toHaveBeenCalled();
    });
  });
});
