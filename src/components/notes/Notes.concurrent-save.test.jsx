// @maintained-by-ai: 2026-10-27
// Regression lock for bug-ct-editor-concurrent-save-silently-drops-other-tabs-edits:
// the Notes editor must SURFACE a server conflict (409 "changed elsewhere")
// instead of silently swallowing the failed save like before. Mirrors the
// mocked useEntityManagement harness of Notes.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Notes from './Notes.jsx';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: function PreviewToggle({ value, onChange, placeholder }) {
    return (
      <textarea
        data-testid="preview-toggle-textarea"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
    );
  },
}));

const CONFLICT_MESSAGE =
  'Note "abc" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

const mockHook = (saveImpl) => {
  const hook = {
    items: [],
    loading: false,
    loadItems: vi.fn(),
    saveItems: saveImpl,
    deleteItem: vi.fn().mockResolvedValue(undefined),
  };
  useEntityManagement.mockReturnValue(hook);
  return hook;
};

// Errors from notesService carry { conflict: true } only for a server 409
// conflict body — the banner's Reload list action gates on that flag.
const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });

const openEditorWithStaleEdit = (ui) => {
  fireEvent.click(ui.getByRole('button', { name: /new note/i }));
  fireEvent.change(ui.getByTestId('preview-toggle-textarea'), {
    target: { value: 'A stale edit' },
  });
  fireEvent.click(ui.getByRole('button', { name: /^save/i }));
};

describe('Notes — concurrent-save conflict surfacing', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => false));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the server 409 message in the modal instead of failing silently', async () => {
    mockHook(vi.fn().mockRejectedValue(new Error(CONFLICT_MESSAGE)));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    fireEvent.click(screen.getByRole('button', { name: /new note/i }));
    fireEvent.change(screen.getByTestId('preview-toggle-textarea'), {
      target: { value: 'A stale edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));

    const alert = await waitFor(() => {
      const el = document.querySelector('.notes-form-error');
      expect(el).not.toBeNull();
      return el;
    });
    expect(alert.textContent).toMatch(/modified in another tab or session/);
    expect(alert.textContent).toMatch(/NOT saved/);
  });

  it('clears the conflict message when the editor is closed', async () => {
    mockHook(vi.fn().mockRejectedValue(new Error(CONFLICT_MESSAGE)));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    fireEvent.click(screen.getByRole('button', { name: /new note/i }));
    fireEvent.change(screen.getByTestId('preview-toggle-textarea'), {
      target: { value: 'A stale edit' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await waitFor(() => expect(document.querySelector('.notes-form-error')).not.toBeNull());

    // Cancel on a dirty draft first NAMES the discard (improve 2026-10-29-V)
    // — accept it; the close still clears the banner.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "A stale edit"?');
    confirmSpy.mockRestore();
    expect(document.querySelector('.notes-form-error')).toBeNull();
  });

  it('successful saves still close the modal with no error shown', async () => {
    mockHook(vi.fn().mockResolvedValue({ success: true }));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    fireEvent.click(screen.getByRole('button', { name: /new note/i }));
    fireEvent.change(screen.getByTestId('preview-toggle-textarea'), {
      target: { value: 'A fresh note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));

    await waitFor(() => expect(useEntityManagement().saveItems).toHaveBeenCalled());
    expect(document.querySelector('.notes-form-error')).toBeNull();
    expect(screen.queryByTestId('preview-toggle-textarea')).toBeNull();
  });

  it('flags a 409 conflict with a Reload list action — accept the discard confirm and one click closes the editor and refetches the list', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hook = mockHook(vi.fn().mockRejectedValue(conflictError()));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    openEditorWithStaleEdit(screen);
    const button = await screen.findByRole('button', { name: 'Reload list' });
    expect(document.querySelector('.notes-form-error')).not.toBeNull();
    // Only the mount load so far — nothing re-fetched while the banner is up.
    expect(hook.loadItems).toHaveBeenCalledTimes(1);
    // improve 2026-10-27-J: rejected edit stays amber AND silent here — the
    // service layer owns the single "Concurrent-edit conflict saving …" warn
    // (asserted in NotesService.test.js); hook/component layers no longer
    // duplicate it.
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // improve 2026-10-28-T: the typed 'A stale edit' makes the draft dirty,
    // so Reload now NAMES the discard — accept it to run the recovery.
    globalThis.confirm.mockReturnValue(true);
    fireEvent.click(button);
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Reload the note list and discard your unsaved edits?'
    );
    // One click = the sanctioned stale close: editor gone + one more refresh,
    // so the next reopen seeds a fresh row (mirrors NPCs recovery machinery).
    await waitFor(() => expect(hook.loadItems).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('preview-toggle-textarea')).toBeNull();
    expect(document.querySelector('.notes-form-error')).toBeNull();
  });

  it('non-conflict save failures keep the old copy-only banner (no Reload list)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockHook(vi.fn().mockRejectedValue(new Error('Failed to save notes')));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    openEditorWithStaleEdit(screen);
    await waitFor(() => expect(document.querySelector('.notes-form-error')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
    // Genuine failures still log red; warn channel untouched.
    expect(errorSpy).toHaveBeenCalledWith('Failed to save note:', expect.any(Error));
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
