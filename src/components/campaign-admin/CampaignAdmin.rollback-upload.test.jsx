// @maintained-by-ai
/**
 * Rollback & Upload flows of CampaignAdmin: the destructive confirmation gate
 * (one full-lifecycle test per flow — campaign-naming warning copy, danger
 * styling, overlay/content clicks are inert, Cancel/close dismiss without
 * contacting the server), client-side zip validation (the check is by file
 * name, case-sensitive ".zip" is the documented contract, plus the accept
 * filter), the archive pre-flight: a valid zip opens the confirm modal only
 * once /admin/upload-inspect (stubbed recognising by default) resolves —
 * POST wiring for /admin/rollback and /admin/upload — including
 * URL-encoding of the campaign name, which the data-management sibling
 * encode-checks only for its own routes — one assertion set per terminal
 * outcome (busy/success/error, alert copy, reload semantics), the
 * postRestoreNotice sessionStorage handoff that survives the reload, and the
 * restored-snapshot banner.
 *
 * Sibling files cover the other flows and are deliberately not repeated here:
 * backup-restore (snapshot/download), data-management (clear/reset), rename,
 * delete, rendering (idle state, including "no restore banner before
 * anything happens"), and theme-toggle. Child consoles (Enforcement, Session,
 * AI Referee) get neutral stub responses so only rollback/upload traffic is
 * asserted. Every campaign name used is a test-campaign variant.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const CAMPAIGN = 'test-campaign';
// One compound name exercises verbatim display in warning copy and the
// encodeURIComponent path for every request in the same test.
const TRICKY = 'my campaign/1';
const ROLLBACK_BTN = 'Rollback to Snapshot';
const RESTORED_ZIP = 'test-campaign-2026-10-10T12-34-56-789.zip';

const adminPath = (campaignName, action) =>
    `/api/campaigns/${encodeURIComponent(campaignName)}/admin/${action}`;

const jsonResponse = (body, ok = true, { status = 200, contentType = 'application/json' } = {}) => ({
    ok,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: () => Promise.resolve(body),
});
const neverSettles = () => new Promise(() => {});

const createDefaultProps = (overrides = {}) => ({
    campaignName: CAMPAIGN,
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

/**
 * Stub fetch routed by admin suffix, so campaign names with special
 * characters hit the same handlers as their encoded URLs. Unknown URLs
 * (child-section endpoints, covered in their own test files) get neutral
 * OK JSON. A handler may be a response object, an Error (rejects), or a
 * never-settling Promise (busy state).
 */
function stubFetch({ rollback, upload, inspect } = {}) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url.endsWith('/admin/rollback')) {
            result = rollback ?? jsonResponse({ message: 'Rolled back', restored: RESTORED_ZIP });
        } else if (url.endsWith('/admin/upload-inspect')) {
            // Default: the archive sniff passes (the upload-inspect sibling
            // file covers the rejection lanes in detail).
            result = inspect ?? jsonResponse({ entryCount: 2, recognizableCount: 2, recognizable: ['data/', 'Hero.json'] });
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

const renderAdmin = (overrides = {}) => render(<CampaignAdmin {...createDefaultProps(overrides)} />);

const fileInput = () => document.querySelector('.admin-upload-label input[type="file"]');

/** Pick a file through the upload control and return it. */
function selectFile(name, type = 'application/zip') {
    const file = new File(['zip-bytes'], name, { type });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    return file;
}

const clickModalConfirm = () => fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

/**
 * Pick a zip the default inspect stub recognises and wait for the pre-flight
 * sniff to resolve — the confirm modal only opens once inspection passes.
 */
async function selectRecognisedZip(name = 'backup.zip') {
    const file = new File(['zip-bytes'], name, { type: 'application/zip' });
    fireEvent.change(fileInput(), { target: { files: [file] } });
    await screen.findByRole('heading', { name: 'Upload Campaign' });
    return file;
}

/** Number of POSTs the mock received for a given URL. */
const postCount = (fetchMock, url) =>
    fetchMock.mock.calls.filter(([u, opts]) => u === url && opts?.method === 'POST').length;

beforeEach(() => {
    // Rollback/upload failures surface via alert(); reload is stubbed so a
    // "successful" test can still inspect post-success state.
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.stubGlobal('location', { href: 'http://localhost/', reload: vi.fn() });
    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
});

describe('CampaignAdmin - Rollback', () => {
    it('gates rollback behind a destructive confirmation naming the campaign — dismissing it sends nothing', async () => {
        const fetchMock = stubFetch();
        const { container } = renderAdmin({ campaignName: TRICKY });

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

        const heading = screen.getByRole('heading', { name: 'Rollback Campaign' });
        // The warning names this campaign verbatim and spells out the loss.
        const warning = screen.getByText(/overwrite ALL current campaign data/);
        expect(warning.textContent).toContain(`"${TRICKY}"`);
        // Styled destructively so it can never be mistaken for a safe action.
        const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
        expect(confirmBtn).toHaveClass('ct-btn-danger');
        expect(confirmBtn.querySelector('i.fa-exclamation-triangle')).toBeInTheDocument();

        // Only the explicit Cancel/close controls dismiss it.
        fireEvent.click(document.querySelector('.ct-modal-overlay'));
        fireEvent.click(heading);
        expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();

        fireEvent.click(container.querySelector('.ct-modal-header .ct-modal-close'));
        expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();

        // Re-open, then dismiss via Cancel too.
        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();

        // Flush microtasks: a rollback POST would already have landed.
        await waitFor(() => expect(postCount(fetchMock, adminPath(TRICKY, 'rollback'))).toBe(0));
        expect(document.querySelector('.campaign-admin .admin-status')).toBeNull();
    });

    it('confirmed rollback posts once to the encoded URL, shows the server message, hands off the post-restore notice, and reloads', async () => {
        const fetchMock = stubFetch();
        renderAdmin({ campaignName: TRICKY });

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
        clickModalConfirm();

        const status = await screen.findByText('Rolled back');
        expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
        expect(postCount(fetchMock, adminPath(TRICKY, 'rollback'))).toBe(1);
        // No unencoded campaign name ever leaves the client.
        fetchMock.mock.calls.forEach(([u]) => expect(u).not.toContain(TRICKY));
        // The reload wipes the in-memory status; the notice naming the
        // restored snapshot is the only thing that survives to explain the
        // fresh page to the GM.
        expect(JSON.parse(sessionStorage.getItem('postRestoreNotice'))).toEqual({
            campaign: TRICKY,
            restored: RESTORED_ZIP,
        });
        await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
        // The busy flag has cleared by the time the flow settles.
        expect(screen.getByRole('button', { name: ROLLBACK_BTN })).toBeEnabled();
    });

    it.each([
        {
            name: 'the server rejects it',
            handler: jsonResponse({ error: 'No snapshot found' }, false),
            statusText: 'No snapshot found',
        },
        {
            name: 'the request never reaches the server',
            handler: new Error('Network failed'),
            statusText: 'Network failed',
        },
    ])('surfaces the error when rollback $name, without reloading or storing a restore notice', async ({ handler, statusText }) => {
        const fetchMock = stubFetch({ rollback: handler });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
        clickModalConfirm();

        const status = await screen.findByText(statusText);
        expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
        expect(postCount(fetchMock, adminPath(CAMPAIGN, 'rollback'))).toBe(1);
        expect(window.location.reload).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
        // The GM can read the status and try again.
        expect(screen.getByRole('button', { name: ROLLBACK_BTN })).toBeEnabled();
    });

    it('shows a busy state and blocks repeat rollbacks while rolling back', async () => {
        const fetchMock = stubFetch({ rollback: neverSettles() });
        renderAdmin();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
        clickModalConfirm();

        const busy = await screen.findByText('Rolling back...');
        expect(busy.closest('.admin-status')).toHaveClass('admin-status--loading');
        // Busy state spans the other backup/restore controls too.
        expect(screen.getByRole('button', { name: 'Create Snapshot' })).toBeDisabled();
        expect(fileInput()).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
        expect(postCount(fetchMock, adminPath(CAMPAIGN, 'rollback'))).toBe(1);
    });
});

describe('CampaignAdmin - Restored snapshot banner', () => {
    // The negative path (no banner when the prop is absent) is covered by
    // CampaignAdmin.rendering.test.jsx idle-state assertions.
    it('renders a success banner naming the restored snapshot file', async () => {
        stubFetch();
        renderAdmin({ restoredSnapshot: RESTORED_ZIP });

        const banner = await screen.findByText(`Campaign restored from ${RESTORED_ZIP}`);
        expect(banner.closest('.admin-status')).toHaveClass('admin-status--success');
    });
});

describe('CampaignAdmin - Upload', () => {
    describe('file validation', () => {
        it.each([
            { name: 'test.txt', type: 'text/plain' },
            { name: 'backup.tar.gz', type: 'application/gzip' },
            // Documented contract: the name check is case-sensitive — only
            // exactly ".zip" passes, even though the OS picker may label
            // both alike and both arrive with a zip MIME type.
            { name: 'test.ZIP', type: 'application/zip' },
            { name: 'test.Zip', type: 'application/zip' },
        ])(
            'rejects $name with an error, clears the input, and never opens the modal or uploads',
            async ({ name, type }) => {
                const fetchMock = stubFetch();
                renderAdmin();

                // The OS picker is pre-filtered to .zip as a first line of defence.
                expect(fileInput()).toHaveAttribute('accept', '.zip');

                selectFile(name, type);

                expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
                expect(fileInput().value).toBe('');
                expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
                await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
            }
        );

        it('rejects a file over the 100 MB server limit up front — no modal, no network round-trip', async () => {
            const fetchMock = stubFetch();
            renderAdmin();

            const file = new File(['tiny'], 'huge.zip', { type: 'application/zip' });
            // A real 101 MB buffer would bloat the test runner; the size
            // getter is all the pre-check reads.
            Object.defineProperty(file, 'size', { value: 101 * 1024 * 1024 });
            fireEvent.change(fileInput(), { target: { files: [file] } });

            expect(screen.getByText('File too large (limit 100 MB)')).toBeInTheDocument();
            expect(fileInput().value).toBe('');
            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
            await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
        });
    });

    describe('confirmation gate', () => {
        it('opens on a valid zip naming the campaign, archive, and safety net — dismissing it never uploads', async () => {
            const fetchMock = stubFetch();
            const { container } = renderAdmin({ campaignName: TRICKY });

            await selectRecognisedZip('backup.zip');

            const heading = screen.getByRole('heading', { name: 'Upload Campaign' });
            const warning = screen.getByText(/replace ALL current campaign data/);
            expect(warning.textContent).toContain(`"${TRICKY}"`);
            expect(warning.textContent).toContain('"backup.zip"');
            // The auto-rollback safety net is spelled out before anything happens.
            expect(screen.getByText(/safety net/i)).toBeInTheDocument();
            expect(screen.getByText(/automatically rolled back/i)).toBeInTheDocument();
            expect(screen.queryByText('Please select a .zip file')).not.toBeInTheDocument();

            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).toHaveClass('ct-btn-danger');
            expect(confirmBtn.querySelector('i.fa-exclamation-triangle')).toBeInTheDocument();

            // Only the explicit Cancel/close controls dismiss it.
            fireEvent.click(document.querySelector('.ct-modal-overlay'));
            fireEvent.click(heading);
            expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();

            fireEvent.click(container.querySelector('.ct-modal-header .ct-modal-close'));
            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();

            // Re-open, then dismiss via Cancel too.
            await selectRecognisedZip('backup.zip');
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();

            await waitFor(() => expect(postCount(fetchMock, adminPath(TRICKY, 'upload'))).toBe(0));
        });
    });

    describe('confirmed upload', () => {
        // One entry per terminal outcome: success reloads; only failures the
        // route itself reports (HTTP 500 JSON, raised after the safety
        // snapshot) may claim a rollback. Pre-route rejections (413 oversize
        // JSON, non-JSON server error pages) and transport errors never
        // touched campaign data, so their alert copy must not claim a restore.
        const OUTCOMES = [
            {
                name: 'succeeds',
                handler: jsonResponse({ message: 'Upload complete' }),
                statusText: 'Upload complete',
                kind: 'success',
                reloads: true,
                alertText: null,
            },
            {
                name: 'is rejected by the server',
                handler: jsonResponse({ error: 'Upload failed', details: 'corrupt archive' }, false, { status: 500 }),
                statusText: 'Upload failed: corrupt archive',
                kind: 'error',
                reloads: false,
                alertText:
                    'Upload failed. Campaign has been rolled back to the previous state.\n\nError: Upload failed\nDetails: corrupt archive',
            },
            {
                name: 'is rejected as oversized (server JSON 413)',
                handler: jsonResponse({ error: 'File too large (limit 100 MB)' }, false, { status: 413 }),
                statusText: 'File too large (limit 100 MB)',
                kind: 'error',
                reloads: false,
                alertText:
                    'Upload failed before any campaign data was replaced.\n\nError: File too large (limit 100 MB)',
            },
            {
                name: 'draws a non-JSON server error page',
                handler: {
                    ok: false,
                    status: 500,
                    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
                    json: () => Promise.reject(new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')),
                },
                statusText: 'Server returned a non-JSON error response (HTTP 500)',
                kind: 'error',
                reloads: false,
                alertText:
                    'Upload failed before any campaign data was replaced.\n\nError: Server returned a non-JSON error response (HTTP 500)',
            },
            {
                name: 'never reaches the server',
                handler: new Error('Network failed'),
                statusText: 'Network failed',
                kind: 'error',
                reloads: false,
                alertText:
                    'Upload failed. The request did not complete, so no changes were confirmed.\n\nError: Network failed',
            },
        ];

        it.each(OUTCOMES)(
            'when upload $name: posts the file once to the encoded URL, shows the $kind status, clears the input, and reloads=$reloads',
            async ({ handler, statusText, kind, reloads, alertText }) => {
                const fetchMock = stubFetch({ upload: handler });
                renderAdmin({ campaignName: TRICKY });

                const file = await selectRecognisedZip('backup.zip');
                clickModalConfirm();

                const status = await screen.findByText(statusText);
                expect(status.closest('.admin-status')).toHaveClass(`admin-status--${kind}`);
                expect(postCount(fetchMock, adminPath(TRICKY, 'upload'))).toBe(1);
                // The file travels as FormData under the "file" field.
                const [, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/admin/upload'));
                expect(options.body).toBeInstanceOf(FormData);
                expect(options.body.get('file')).toBe(file);
                // No unencoded campaign name ever leaves the client.
                fetchMock.mock.calls.forEach(([u]) => expect(u).not.toContain(TRICKY));
                // The input is reset whatever happens, so re-picking the same
                // file still fires change next time.
                expect(fileInput().value).toBe('');
                if (alertText) {
                    expect(window.alert).toHaveBeenCalledWith(alertText);
                } else {
                    expect(window.alert).not.toHaveBeenCalled();
                }
                await waitFor(() =>
                    expect(window.location.reload).toHaveBeenCalledTimes(reloads ? 1 : 0)
                );
            }
        );

        it('shows a busy state and blocks the upload control while uploading', async () => {
            const fetchMock = stubFetch({ upload: neverSettles() });
            renderAdmin();

            await selectRecognisedZip('backup.zip');
            clickModalConfirm();

            const busy = await screen.findByText('Uploading and extracting...');
            expect(busy.closest('.admin-status')).toHaveClass('admin-status--loading');
            expect(fileInput()).toBeDisabled();
            // Busy state spans the sibling controls; the in-flight upload
            // is never repeated.
            expect(screen.getByRole('button', { name: ROLLBACK_BTN })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Create Snapshot' })).toBeDisabled();
            expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(1);
        });
    });
});
