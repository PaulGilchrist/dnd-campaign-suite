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
  'note "abc" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';

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

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
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

  it('flags a 409 conflict with a Reload list action — one click closes the editor and refetches the list', async () => {
    const hook = mockHook(vi.fn().mockRejectedValue(conflictError()));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    openEditorWithStaleEdit(screen);
    const button = await screen.findByRole('button', { name: 'Reload list' });
    expect(document.querySelector('.notes-form-error')).not.toBeNull();
    // Only the mount load so far — nothing re-fetched while the banner is up.
    expect(hook.loadItems).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    // One click = the sanctioned stale close: editor gone + one more refresh,
    // so the next reopen seeds a fresh row (mirrors NPCs recovery machinery).
    await waitFor(() => expect(hook.loadItems).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('preview-toggle-textarea')).toBeNull();
    expect(document.querySelector('.notes-form-error')).toBeNull();
  });

  it('non-conflict save failures keep the old copy-only banner (no Reload list)', async () => {
    mockHook(vi.fn().mockRejectedValue(new Error('Failed to save notes')));
    render(
      <Notes campaignName="test" characters={[]} isLocalhost={true} onBack={() => {}} />
    );

    openEditorWithStaleEdit(screen);
    await waitFor(() => expect(document.querySelector('.notes-form-error')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Reload list' })).not.toBeInTheDocument();
  });
});
