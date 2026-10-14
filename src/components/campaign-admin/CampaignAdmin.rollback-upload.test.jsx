// @improved-by-ai
/**
 * Rollback & Upload flows of CampaignAdmin: the destructive confirmation gate
 * (campaign-naming warning copy, cancel/close/overlay behaviour, danger
 * styling), client-side zip validation, POST wiring for /admin/rollback and
 * /admin/upload (including URL-encoding of the campaign name — the sibling
 * data-management tests only encode-check those routes), busy/success/error
 * status rendering, post-success plumbing (location.reload + the
 * postRestoreNotice sessionStorage handoff), and the restored-snapshot banner.
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
const ROLLBACK_BTN = 'Rollback to Snapshot';
const RESTORED_ZIP = 'test-campaign-2026-10-10T12-34-56-789.zip';

const adminPath = (campaignName, action) =>
    `/api/campaigns/${encodeURIComponent(campaignName)}/admin/${action}`;

const jsonResponse = (body, ok = true) => ({ ok, json: () => Promise.resolve(body) });
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
function stubFetch({ rollback, upload } = {}) {
    const fetchMock = vi.fn((url) => {
        let result;
        if (url.endsWith('/admin/rollback')) {
            result = rollback ?? jsonResponse({ message: 'Rolled back', restored: RESTORED_ZIP });
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
    describe('confirmation gate', () => {
        it.each([CAMPAIGN, 'my campaign/1'])(
            'asks for confirmation naming "$campaignName" and the data it overwrites, without touching the server',
            (campaignName) => {
                const fetchMock = stubFetch();
                const { unmount } = renderAdmin({ campaignName });

                fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

                expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();
                // The warning names this campaign verbatim and spells out the loss.
                const warning = screen.getByText(/overwrite ALL current campaign data/);
                expect(warning.textContent).toContain(`"${campaignName}"`);
                // Nothing destructive has been sent yet.
                expect(postCount(fetchMock, adminPath(campaignName, 'rollback'))).toBe(0);
                unmount();
            }
        );

        it('closes via Cancel without sending anything', async () => {
            const fetchMock = stubFetch();
            renderAdmin();

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();
            // Flush microtasks: a rollback POST would already have landed.
            await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'rollback'))).toBe(0));
            expect(document.querySelector('.campaign-admin .admin-status')).toBeNull();
        });

        it('closes via the header close button without sending anything', async () => {
            const fetchMock = stubFetch();
            const { container } = renderAdmin();

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            fireEvent.click(container.querySelector('.ct-modal-header .ct-modal-close'));

            expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();
            await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'rollback'))).toBe(0));
        });

        it('stays open when clicking the overlay or the modal content', () => {
            stubFetch();
            renderAdmin();
            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

            // Only the explicit Cancel/Confirm/close controls dismiss it.
            fireEvent.click(document.querySelector('.ct-modal-overlay'));
            fireEvent.click(screen.getByRole('heading', { name: 'Rollback Campaign' }));

            expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();
        });

        it('frames confirmation as a destructive action', () => {
            stubFetch();
            renderAdmin();
            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));

            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).toHaveClass('ct-btn-danger');
            expect(confirmBtn.querySelector('i.fa-exclamation-triangle')).toBeInTheDocument();
        });
    });

    describe('confirmed rollback', () => {
        it('posts to /admin/rollback, shows the server message, and reloads', async () => {
            const fetchMock = stubFetch();
            renderAdmin();

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            clickModalConfirm();

            const status = await screen.findByText('Rolled back');
            expect(status.closest('.admin-status')).toHaveClass('admin-status--success');
            expect(fetchMock).toHaveBeenCalledWith(adminPath(CAMPAIGN, 'rollback'), { method: 'POST' });
            await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
            // The busy flag has cleared by the time the flow settles.
            expect(screen.getByRole('button', { name: ROLLBACK_BTN })).toBeEnabled();
        });

        it('hands off a post-restore notice naming the restored snapshot before reloading', async () => {
            stubFetch();
            renderAdmin();

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            clickModalConfirm();

            await waitFor(() => expect(window.location.reload).toHaveBeenCalledTimes(1));
            // The reload wipes the in-memory status; the notice is the only
            // thing that survives to explain the fresh page to the GM.
            expect(JSON.parse(sessionStorage.getItem('postRestoreNotice'))).toEqual({
                campaign: CAMPAIGN,
                restored: RESTORED_ZIP,
            });
        });

        it('encodes the campaign name in the rollback URL', async () => {
            const campaignName = 'my campaign/1';
            const fetchMock = stubFetch();
            renderAdmin({ campaignName });

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            clickModalConfirm();

            await waitFor(() =>
                expect(fetchMock).toHaveBeenCalledWith(adminPath(campaignName, 'rollback'), { method: 'POST' })
            );
            // No unencoded campaign name ever leaves the client.
            fetchMock.mock.calls.forEach(([u]) => {
                expect(u).not.toContain(campaignName);
            });
        });

        it('surfaces the server error without reloading or storing a restore notice', async () => {
            const fetchMock = stubFetch({ rollback: jsonResponse({ error: 'No snapshot found' }, false) });
            renderAdmin();

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            clickModalConfirm();

            const status = await screen.findByText('No snapshot found');
            expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
            expect(window.location.reload).not.toHaveBeenCalled();
            expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
            expect(screen.getByRole('button', { name: ROLLBACK_BTN })).toBeEnabled();
            expect(postCount(fetchMock, adminPath(CAMPAIGN, 'rollback'))).toBe(1);
        });

        it('surfaces the failure reason when the rollback never reaches the server', async () => {
            stubFetch({ rollback: new Error('Network failed') });
            renderAdmin();

            fireEvent.click(screen.getByRole('button', { name: ROLLBACK_BTN }));
            clickModalConfirm();

            const status = await screen.findByText('Network failed');
            expect(status.closest('.admin-status')).toHaveClass('admin-status--error');
            expect(window.location.reload).not.toHaveBeenCalled();
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
        it.each(['test.txt', 'backup.tar.gz', 'notes.pdf'])(
            'rejects %s with an error, clears the input, and never opens the modal',
            (name) => {
                stubFetch();
                renderAdmin();

                selectFile(name, 'text/plain');

                expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
                expect(fileInput().value).toBe('');
                expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
            }
        );

        // Documented contract: the check is case-sensitive — only exactly
        // ".zip" passes, even though the OS picker may label both alike.
        it.each(['test.ZIP', 'test.Zip'])('rejects the uppercase-extension file %s', (name) => {
            stubFetch();
            renderAdmin();

            selectFile(name);

            expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        });

        it('limits the OS file picker to .zip via accept', () => {
            stubFetch();
            renderAdmin();

            expect(fileInput()).toHaveAttribute('accept', '.zip');
        });
    });

    describe('confirmation gate', () => {
        it('opens when a valid zip is selected, naming the campaign and archive — with no validation error', () => {
            stubFetch();
            renderAdmin();

            selectFile('backup.zip');

            expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
            const warning = screen.getByText(/replace ALL current campaign data/);
            expect(warning.textContent).toContain(`"${CAMPAIGN}"`);
            expect(warning.textContent).toContain('"backup.zip"');
            expect(screen.queryByText('Please select a .zip file')).not.toBeInTheDocument();
        });

        it('warns that a safety snapshot is taken and restores on failure', () => {
            stubFetch();
            renderAdmin();

            selectFile('backup.zip');

            expect(screen.getByText(/safety net/i)).toBeInTheDocument();
            expect(screen.getByText(/automatically rolled back/i)).toBeInTheDocument();
        });

        it('closes via Cancel without uploading', async () => {
            const fetchMock = stubFetch();
            renderAdmin();

            selectFile('backup.zip');
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
            await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
        });

        it('closes via the header close button without uploading', async () => {
            const fetchMock = stubFetch();
            const { container } = renderAdmin();

            selectFile('backup.zip');
            fireEvent.click(container.querySelector('.ct-modal-header .ct-modal-close'));

            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
            await waitFor(() => expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(0));
        });

        it('stays open when clicking the overlay or the modal content', () => {
            stubFetch();
            renderAdmin();
            selectFile('backup.zip');

            fireEvent.click(document.querySelector('.ct-modal-overlay'));
            fireEvent.click(screen.getByRole('heading', { name: 'Upload Campaign' }));

            expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
        });

        it('frames confirmation as a destructive action', () => {
            stubFetch();
            renderAdmin();
            selectFile('backup.zip');

            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).toHaveClass('ct-btn-danger');
            expect(confirmBtn.querySelector('i.fa-exclamation-triangle')).toBeInTheDocument();
        });
    });

    describe('confirmed upload', () => {
        // One entry per terminal outcome: success reloads, both failure
        // paths alert (the campaign is auto-rolled-back server-side) and
        // leave the page in place so the GM can read the status.
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
                handler: jsonResponse({ error: 'Upload failed', details: 'corrupt archive' }, false),
                statusText: 'Upload failed: corrupt archive',
                kind: 'error',
                reloads: false,
                alertText:
                    'Upload failed. Campaign has been rolled back to the previous state.\n\nError: Upload failed\nDetails: corrupt archive',
            },
            {
                name: 'never reaches the server',
                handler: new Error('Network failed'),
                statusText: 'Network failed',
                kind: 'error',
                reloads: false,
                alertText:
                    'Upload failed. Campaign has been rolled back to the previous state.\n\nError: Network failed',
            },
        ];

        it('posts the selected file as FormData to /admin/upload', async () => {
            const fetchMock = stubFetch();
            renderAdmin();

            const file = selectFile('backup.zip');
            clickModalConfirm();

            await waitFor(() =>
                expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(1)
            );
            const [, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/admin/upload'));
            expect(options.body).toBeInstanceOf(FormData);
            expect(options.body.get('file')).toBe(file);
        });

        it.each(OUTCOMES)(
            'when the upload $name: shows the $kind status, clears the input, and reloads=$reloads',
            async ({ handler, statusText, kind, reloads, alertText }) => {
                stubFetch({ upload: handler });
                renderAdmin();

                selectFile('backup.zip');
                clickModalConfirm();

                const status = await screen.findByText(statusText);
                expect(status.closest('.admin-status')).toHaveClass(`admin-status--${kind}`);
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

        it('encodes the campaign name in the upload URL', async () => {
            const campaignName = 'my campaign/1';
            const fetchMock = stubFetch();
            renderAdmin({ campaignName });

            const file = selectFile('backup.zip');
            clickModalConfirm();

            await waitFor(() =>
                expect(postCount(fetchMock, adminPath(campaignName, 'upload'))).toBe(1)
            );
            const [, options] = fetchMock.mock.calls.find(([u]) => u.endsWith('/admin/upload'));
            expect(options.body.get('file')).toBe(file);
            fetchMock.mock.calls.forEach(([u]) => {
                expect(u).not.toContain(campaignName);
            });
        });

        it('shows a busy state and blocks the upload control while uploading', async () => {
            const fetchMock = stubFetch({ upload: neverSettles() });
            renderAdmin();

            selectFile('backup.zip');
            clickModalConfirm();

            const busy = await screen.findByText('Uploading and extracting...');
            expect(busy.closest('.admin-status')).toHaveClass('admin-status--loading');
            expect(fileInput()).toBeDisabled();
            expect(screen.getByRole('button', { name: ROLLBACK_BTN })).toBeDisabled();

            // Busy state spans the sibling controls; the in-flight upload
            // is never repeated.
            expect(screen.getByRole('button', { name: 'Create Snapshot' })).toBeDisabled();
            expect(postCount(fetchMock, adminPath(CAMPAIGN, 'upload'))).toBe(1);
        });
    });
});
