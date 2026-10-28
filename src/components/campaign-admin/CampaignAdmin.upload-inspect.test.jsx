// @maintained-by-ai
/**
 * Archive pre-flight of the CampaignAdmin upload lane
 * (backlog 2026-10-28-O: empty/foreign zip accepted silently): choosing a
 * valid .zip must run a read-only POST to /admin/upload-inspect BEFORE the
 * destructive confirm gate opens. Zero recognizable campaign files, a
 * corrupt archive (server 400), a failed request, and an unreadable
 * inspection payload all abort with a visible status and never reach
 * /admin/upload (fail-closed). A recognised archive shows the "Checking
 * archive..." busy line, then opens the untouched confirm modal.
 *
 * Reuses the mocking conventions of CampaignAdmin.rollback-upload.test.jsx
 * (routed fetch stub, neutral child-console responses).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
const EMPTY_ZIP_ERROR = 'No campaign data found in empty.zip — contains 0 recognizable campaign files';

const adminPath = (campaignName, action) =>
    `/api/campaigns/${encodeURIComponent(campaignName)}/admin/${action}`;

const jsonResponse = (body, ok = true, { status = 200, contentType = 'application/json' } = {}) => ({
    ok,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: () => Promise.resolve(body),
});
const neverSettles = () => new Promise(() => {});

const RECOGNISED = { entryCount: 3, recognizableCount: 2, recognizable: ['data/', 'Hero.json'] };

/**
 * Routed fetch stub: inspect defaults to a recognising payload, upload to a
 * success. Handlers may be a response object or an Error (rejects).
 */
function stubFetch({ inspect, upload } = {}) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url.endsWith('/admin/upload-inspect')) {
            result = inspect ?? jsonResponse(RECOGNISED);
        } else if (url.endsWith('/admin/upload')) {
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

/** Pick a file through the upload control. */
function selectFile(name, type = 'application/zip') {
    const file = new File(['zip-bytes'], name, { type });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    return file;
}

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

describe('CampaignAdmin - upload archive pre-flight inspection', () => {
    it('posts the chosen zip to upload-inspect (encoded URL, FormData "file") before any confirm gate opens', async () => {
        const fetchMock = stubFetch();
        renderAdmin();

        const file = selectFile('backup.zip');
        await screen.findByRole('heading', { name: 'Upload Campaign' });

        expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload-inspect'))).toBe(1);
        const [, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/admin/upload-inspect'));
        expect(options.body).toBeInstanceOf(FormData);
        expect(options.body.get('file')).toBe(file);
    });

    it('shows a "Checking archive..." busy line while the inspection is in flight', async () => {
        stubFetch({ inspect: neverSettles() });
        renderAdmin();

        selectFile('backup.zip');

        const busy = await screen.findByText('Checking archive...');
        expect(busy.closest('.admin-status')).toHaveClass('admin-status--loading');
        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        expect(fileInput()).toBeDisabled();
    });

    it('rejects an archive with no recognizable campaign files — explicit error, no modal, no upload POST, input cleared', async () => {
        const fetchMock = stubFetch({
            inspect: jsonResponse({ entryCount: 0, recognizableCount: 0, recognizable: [] }),
        });
        renderAdmin();

        selectFile('empty.zip');

        const status = await screen.findByText(EMPTY_ZIP_ERROR);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        expect(fileInput().value).toBe('');
        expect(window.alert).not.toHaveBeenCalled();
        expect(window.location.reload).not.toHaveBeenCalled();
        await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
    });

    it('rejects a corrupt archive the server cannot read as zip — same full stop', async () => {
        const fetchMock = stubFetch({
            inspect: jsonResponse(
                { error: 'Could not read the archive — it is not a valid zip file' },
                false,
                { status: 400 }
            ),
        });
        renderAdmin();

        selectFile('broken.zip');

        const status = await screen.findByText(
            'Upload aborted — Could not read the archive — it is not a valid zip file'
        );
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        expect(fileInput().value).toBe('');
        await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
    });

    it('fails closed when the inspection request never reaches the server — no modal, no upload POST', async () => {
        const fetchMock = stubFetch({ inspect: new Error('Network down') });
        renderAdmin();

        selectFile('backup.zip');

        const status = await screen.findByText('Upload aborted — could not check the archive (Network down)');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        expect(fileInput().value).toBe('');
        await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
    });

    it('fails closed on an unreadable inspection payload — a 200 without a count still aborts', async () => {
        const fetchMock = stubFetch({ inspect: jsonResponse({}) });
        renderAdmin();

        selectFile('backup.zip');

        const status = await screen.findByText(
            'Upload aborted — the archive check returned an unreadable response'
        );
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
    });

    it('the recognised lane is unchanged: modal copy intact and the confirmed upload still posts once', async () => {
        const fetchMock = stubFetch();
        renderAdmin();

        const file = selectFile('backup.zip');
        await screen.findByRole('heading', { name: 'Upload Campaign' });

        const warning = screen.getByText(/replace ALL current campaign data/);
        expect(warning.textContent).toContain(`"${CAMPAIGN}"`);
        expect(warning.textContent).toContain('"backup.zip"');
        expect(screen.getByText(/safety net/i)).toBeInTheDocument();
        // The successful check releases its busy line before the modal opens.
        expect(screen.queryByText('Checking archive...')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

        const status = await screen.findByText('Upload complete');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(1);
        const [, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/admin/upload'));
        expect(options.body.get('file')).toBe(file);
    });

    it('an aborted check resets the input so re-picking the SAME file re-runs the inspection', async () => {
        const fetchMock = stubFetch({
            inspect: jsonResponse({ entryCount: 0, recognizableCount: 0, recognizable: [] }),
        });
        renderAdmin();

        selectFile('empty.zip');
        await screen.findByText(EMPTY_ZIP_ERROR);
        expect(fileInput().value).toBe('');

        // Same file picked again: the change event fires (value was cleared)
        // and the sniff runs a second time — still never an upload.
        selectFile('empty.zip');
        await waitFor(() =>
            expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload-inspect'))).toBe(2)
        );
        expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0);
    });
});
