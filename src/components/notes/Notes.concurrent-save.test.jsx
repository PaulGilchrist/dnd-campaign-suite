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

const mockHook = (saveImpl) =>
  useEntityManagement.mockReturnValue({
    items: [],
    loading: false,
    loadItems: vi.fn(),
    saveItems: saveImpl,
    deleteItem: vi.fn().mockResolvedValue(undefined),
  });

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
});
