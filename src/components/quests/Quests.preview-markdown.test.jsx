// @maintained-by-ai: 2026-10-24
// QA 2026-10-13 backlog: quest list row previews printed RAW markdown
// (`**bold**`, `[link](…)`). Row preview now renders sanitized markdown
// via MarkdownPreview (the Notes-list pattern), clamped by CSS; the open/
// detail view (PreviewToggle textarea) keeps the raw source untouched.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Quests from './Quests.jsx';

const mockUseQuestsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (campaignName, config) => mockUseQuestsManagement(campaignName, config),
}));

// Modal fields stubbed as raw textareas — MarkdownPreview inside the modal
// lane is owned by MarkdownPreview.test.jsx / sanitize.test.js.
vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

const MARKDOWN_DESCRIPTION = '**bold** text and [a link](https://example.com)';

function renderWithQuests(quests) {
  mockUseQuestsManagement.mockReturnValue({
    items: quests,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
  });
  return render(
    <Quests campaignName="test-campaign" isLocalhost onBack={vi.fn()} />
  );
}

describe('Quests row preview markdown', () => {
  it('renders markdown descriptions formatted — no raw ** or []() syntax in the row', () => {
    const { container } = renderWithQuests([
      { id: 'q-1', name: 'Markdown Quest', status: 'active', description: MARKDOWN_DESCRIPTION, rewards: '', notes: '' },
    ]);

    const row = screen.getByRole('button', { name: 'Edit quest: Markdown Quest' });
    // Raw syntax never appears literally in the row.
    expect(row.textContent).not.toContain('**');
    expect(row.textContent).not.toContain('[a link](');
    // Linked text renders as plain readable text.
    expect(row.textContent).toContain('bold');
    expect(row.textContent).toContain('a link');
    // Sanitized inline HTML produced by marked+DOMPurify.
    expect(container.querySelector('.quests-list-subtitle strong')).toHaveTextContent('bold');
    const anchor = container.querySelector('.quests-list-subtitle a');
    expect(anchor).toHaveTextContent('a link');
    expect(anchor).toHaveAttribute('href', 'https://example.com');
  });

  it('clamps long descriptions (100-char truncate preserved, preview keeps clamp class)', () => {
    const long = `${'A'.repeat(120)} tail`;
    const { container } = renderWithQuests([
      { id: 'q-1', name: 'Long Quest', status: 'active', description: long, rewards: '', notes: '' },
    ]);

    const preview = container.querySelector('.quests-list-subtitle');
    expect(preview).toBeInTheDocument();
    // marked emits a trailing newline after the block — compare trimmed.
    expect(preview.textContent.trim()).toBe(`${'A'.repeat(100)}...`);
  });

  it('detail/edit view still shows the RAW markdown source (unchanged)', () => {
    renderWithQuests([
      { id: 'q-1', name: 'Markdown Quest', status: 'active', description: MARKDOWN_DESCRIPTION, rewards: '', notes: '' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Markdown Quest' }));
    expect(screen.getByTestId('field-quest-description')).toHaveValue(MARKDOWN_DESCRIPTION);
  });
});
