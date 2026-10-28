// @maintained-by-ai
/**
 * Regression lock for bug-admin-upload-cancel-keeps-file-selection: dismissing
 * the "Upload Campaign" confirmation modal (Cancel or the × close) must reset
 * the file input and clear the status line, so re-choosing the SAME file
 * fires a fresh change event (the native picker sends none while value/files
 * are unchanged) instead of looking like a dead button. The confirm path must
 * stay intact (File reference survives the reset), sibling modals (Rollback)
 * must not touch the input, and the non-zip rejection keeps clearing the
 * input on its own early-return path.
 *
 * Reuses the mocking conventions of CampaignAdmin.rollback-upload.test.jsx
 * (routed fetch stub, neutral child-console responses).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';

const adminPath = (campaignName, action) =>
    `/api/campaigns/${encodeURIComponent(campaignName)}/admin/${action}`;

const jsonResponse = (body, ok = true, { status = 200, contentType = 'application/json' } = {}) => ({
    ok,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: () => Promise.resolve(body),
});

function stubFetch({ upload } = {}) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url.endsWith('/admin/upload')) {
            result = upload ?? jsonResponse({ message: 'Upload complete' });
        } else if (url.endsWith('/admin/snapshots')) {
            result = jsonResponse({ snapshots: [] });
        } else {
            result = jsonResponse({});
        }
        return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const renderAdmin = () =>
    render(
        <CampaignAdmin
            campaignName={CAMPAIGN}
            onBack={vi.fn()}
            theme="dark"
            toggleTheme={vi.fn()}
            onRenameCampaign={vi.fn()}
        />
    );

const fileInput = () => document.querySelector('.admin-upload-label input[type="file"]');

/** Pick a file through the upload control and return it. */
function selectFile(name, type = 'application/zip') {
    const file = new File(['zip-bytes'], name, { type });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    return file;
}

const clickModalButton = (name) =>
    fireEvent.click(screen.getByRole('button', { name }));

const statusLine = () => document.querySelector('.campaign-admin > .admin-status');

const postCount = (fetchMock, url) =>
    fetchMock.mock.calls.filter(([u, opts]) => u === url && opts?.method === 'POST').length;

beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.stubGlobal('location', { href: 'http://localhost/', reload: vi.fn() });
    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

describe('CampaignAdmin - Upload cancel resets the file selection', () => {
    it('Cancel closes the modal, clears the input value/files, and sends nothing', async () => {
        const fetchMock = stubFetch();
        renderAdmin();

        selectFile('garbage.zip');
        expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
        // jsdom's fireEvent.change populates files but not the fakepath value.
        expect(fileInput().files).toHaveLength(1);

        clickModalButton('Cancel');

        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        // The whole bug: the cancelled file used to persist in the input.
        expect(fileInput().value).toBe('');
        expect(fileInput().files).toHaveLength(0);
        await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
    });

    it('the × close button resets the input the same way Cancel does', () => {
        stubFetch();
        const { container } = renderAdmin();

        selectFile('garbage.zip');
        fireEvent.click(container.querySelector('.ct-modal-header .ct-modal-close'));

        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        expect(fileInput().value).toBe('');
        expect(fileInput().files).toHaveLength(0);
    });

    it('cancel clears a lingering error status so the line reflects the latest action', () => {
        stubFetch();
        renderAdmin();

        // Prior failed attempt leaves a red status line.
        selectFile('notes.txt', 'text/plain');
        expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();

        // A valid pick opens the modal (the stale error line still lingers at
        // this point — that separate backlog nit is out of scope here);
        // cancelling dismisses both the modal and the stale status.
        selectFile('garbage.zip');
        expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
        clickModalButton('Cancel');

        expect(statusLine()).toBeNull();
        expect(screen.queryByText('Please select a .zip file')).not.toBeInTheDocument();
    });

    it('re-selecting the SAME file after a cancel re-opens the confirmation modal', () => {
        stubFetch();
        renderAdmin();

        selectFile('garbage.zip');
        clickModalButton('Cancel');
        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();

        // Native picker semantics: change only fires because the value was reset.
        selectFile('garbage.zip');
        expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
    });

    it('the confirm path still uploads the chosen file despite the reset helper', async () => {
        const fetchMock = stubFetch({ upload: jsonResponse({ message: 'Upload complete' }) });
        renderAdmin();

        const file = selectFile('backup.zip');
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        const status = await screen.findByText('Upload complete');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(1);
        const [, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/admin/upload'));
        expect(options.body.get('file')).toBe(file);
    });

    it('dismissing the Rollback modal never touches the file input or the status', () => {
        stubFetch();
        renderAdmin();

        // Selections on the non-zip error path clear their own files but keep
        // the error status; that status must survive an UNRELATED modal's
        // Cancel (the reset is scoped to the Upload confirm by title).
        selectFile('notes.txt', 'text/plain');
        expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
        expect(fileInput().files).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Rollback to Snapshot' }));
        clickModalButton('Cancel');

        expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
    });
});
