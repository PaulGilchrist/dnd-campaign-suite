// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignAdmin from './CampaignAdmin.jsx';

const createDefaultProps = (overrides = {}) => ({
    campaignName: 'test-campaign',
    onBack: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    onRenameCampaign: vi.fn(),
    ...overrides,
});

const getActionButton = (buttonText) =>
    screen.getByRole('button', { name: new RegExp(`^${buttonText}$`, 'i') });

describe('CampaignAdmin - Rollback & Upload', () => {
    const defaultProps = createDefaultProps();

    beforeEach(() => {
        vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(window, 'prompt').mockReturnValue('test-campaign');
        vi.stubGlobal('location', { reload: vi.fn() });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rollback - confirmation modal', () => {
        it('opens rollback confirmation modal when button is clicked', () => {
            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));

            expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();
            expect(screen.getByText(/overwrite ALL current campaign data/)).toBeInTheDocument();
        });

        it('closes modal via cancel button', () => {
            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));

            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();
        });

        it('closes modal via close (X) button', () => {
            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));

            fireEvent.click(screen.getByRole('button', { name: '' }));
            expect(screen.queryByRole('heading', { name: 'Rollback Campaign' })).not.toBeInTheDocument();
        });

        it('does not close modal via overlay click', () => {
            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));

            const modalEl = screen.getByRole('heading', { name: 'Rollback Campaign' }).closest('.ct-modal');
            fireEvent.click(modalEl.parentElement);
            expect(screen.getByRole('heading', { name: 'Rollback Campaign' })).toBeInTheDocument();
        });

        it('displays the campaign name and confirm button styling in the rollback confirmation', () => {
            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));

            expect(screen.getByText(/"test-campaign"/)).toBeInTheDocument();

            const confirmBtn = screen.getByRole('button', { name: /confirm/i });
            expect(confirmBtn).toHaveClass('ct-btn-danger');
            expect(confirmBtn.querySelector('i.fa-exclamation-triangle')).toBeInTheDocument();
        });

        it('displays the campaign name with special characters in the rollback confirmation', () => {
            render(<CampaignAdmin {...createDefaultProps({ campaignName: 'my campaign/1' })} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));

            expect(screen.getByText(/"my campaign\/1"/)).toBeInTheDocument();
        });
    });

    describe('Rollback - confirm action', () => {
        it('sends POST request to rollback endpoint on confirm', async () => {
            const fetchMock = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Rolled back' }) })
            );
            global.fetch = fetchMock;

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith(
                    '/api/campaigns/test-campaign/admin/rollback',
                    { method: 'POST' }
                );
            });
        });

        it('shows loading status while rolling back', async () => {
            global.fetch = vi.fn(() => new Promise(() => {}));

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(screen.getByText('Rolling back...')).toBeInTheDocument();
            });
        });

        it('shows success message on successful rollback', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Rolled back successfully' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(screen.getByText('Rolled back successfully')).toBeInTheDocument();
                expect(screen.getByText('Rolled back successfully').closest('.admin-status')).toHaveClass('admin-status--success');
            });
        });

        it('reloads page after successful rollback', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Rolled back' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(window.location.reload).toHaveBeenCalledTimes(1);
            });
        });

        it('shows error status on failed rollback', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Rollback failed' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(screen.getByText('Rollback failed')).toBeInTheDocument();
                expect(screen.getByText('Rollback failed').closest('.admin-status')).toHaveClass('admin-status--error');
                expect(window.location.reload).not.toHaveBeenCalled();
            });
        });

        it('shows error status on network error', async () => {
            global.fetch = vi.fn(() => Promise.reject(new Error('Network failed')));

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(screen.getByText('Network failed')).toBeInTheDocument();
                expect(screen.getByText('Network failed').closest('.admin-status')).toHaveClass('admin-status--error');
            });
        });

        it('disables rollback action button after confirm during async operation', async () => {
            global.fetch = vi.fn(() => new Promise(() => {}));

            render(<CampaignAdmin {...defaultProps} />);
            const rollbackBtn = getActionButton('Rollback to Snapshot');
            fireEvent.click(rollbackBtn);
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(rollbackBtn).toBeDisabled();
            });
        });

        it('does not call onConfirm when modal is canceled', async () => {
            const fetchMock = vi.fn();
            global.fetch = fetchMock;

            render(<CampaignAdmin {...defaultProps} />);
            fireEvent.click(getActionButton('Rollback to Snapshot'));
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            await waitFor(() => {
                expect(fetchMock).not.toHaveBeenCalled();
            });
        });
    });

    describe('Upload - file validation', () => {
        it('shows error when non-zip file is selected and clears the input', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });

            expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
            expect(document.querySelector('.admin-upload-label input[type="file"]').value).toBe('');
        });

        it('does not show error for .zip file', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'test.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });

            expect(screen.queryByText('Please select a .zip file')).not.toBeInTheDocument();
        });

        it('rejects .ZIP and .Zip extensions (case-sensitive check)', () => {
            render(<CampaignAdmin {...defaultProps} />);

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [new File(['test'], 'test.ZIP', { type: 'application/zip' })] } });
            expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [new File(['test'], 'test.Zip', { type: 'application/zip' })] } });
            expect(screen.getByText('Please select a .zip file')).toBeInTheDocument();
        });

        it('renders the upload file input with accept=".zip" attribute', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const fileInput = document.querySelector('.admin-upload-label input[type="file"]');

            expect(fileInput).toHaveAttribute('accept', '.zip');
        });
    });

    describe('Upload - confirmation modal', () => {
        it('opens upload confirmation modal when valid zip is selected', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });

            expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
            expect(screen.getByText(/backup\.zip/)).toBeInTheDocument();
        });

        it('closes upload modal via cancel button', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        });

        it('closes upload modal via close (X) button', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: '' }));

            expect(screen.queryByRole('heading', { name: 'Upload Campaign' })).not.toBeInTheDocument();
        });

        it('does not close upload modal via overlay click', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            const modalEl = screen.getByRole('heading', { name: 'Upload Campaign' }).closest('.ct-modal');
            fireEvent.click(modalEl.parentElement);

            expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
        });

        it('prevents closing upload modal when clicking inside the modal content', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('heading', { name: 'Upload Campaign' }));

            expect(screen.getByRole('heading', { name: 'Upload Campaign' })).toBeInTheDocument();
        });

        it('displays campaign name, file name, safety warning, and confirm button styling in the upload confirmation', () => {
            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'my-backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });

            expect(screen.getByText(/"test-campaign"/)).toBeInTheDocument();
            expect(screen.getByText(/"my-backup\.zip"/)).toBeInTheDocument();
            expect(screen.getByText(/safety net/i)).toBeInTheDocument();
            expect(screen.getByText(/rolled back/i)).toBeInTheDocument();

            const confirmBtn = screen.getByRole('button', { name: /confirm/i });
            expect(confirmBtn).toHaveClass('ct-btn-danger');
            expect(confirmBtn.querySelector('i.fa-exclamation-triangle')).toBeInTheDocument();
        });
    });

    describe('Upload - confirm action', () => {
        it('sends POST request with FormData on confirm', async () => {
            const fetchMock = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Upload complete' }) })
            );
            global.fetch = fetchMock;

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith(
                    '/api/campaigns/test-campaign/admin/upload',
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('includes file in FormData', async () => {
            const fetchMock = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Upload complete' }) })
            );
            let capturedBody = null;
            fetchMock.mockImplementation(async (url, options) => {
                capturedBody = options.body;
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Upload complete' }) });
            });
            global.fetch = fetchMock;

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(capturedBody).toBeInstanceOf(FormData);
                expect(capturedBody.get('file')).toBe(file);
            });
        });

        it('shows loading status while uploading', async () => {
            global.fetch = vi.fn(() => new Promise(() => {}));

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(screen.getByText('Uploading and extracting...')).toBeInTheDocument();
            });
        });

        it('shows success message on successful upload', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Upload complete' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(screen.getByText('Upload complete')).toBeInTheDocument();
                expect(screen.getByText('Upload complete').closest('.admin-status')).toHaveClass('admin-status--success');
            });
        });

        it('reloads page after successful upload', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Upload complete' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(window.location.reload).toHaveBeenCalledTimes(1);
            });
        });

        it('shows error alert on failed upload', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Upload failed' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith(
                    'Upload failed. Campaign has been rolled back to the previous state.\n\nError: Upload failed'
                );
            });
        });

        it('shows error alert on network error', async () => {
            global.fetch = vi.fn(() => Promise.reject(new Error('Network failed')));

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(window.alert).toHaveBeenCalledWith(
                    'Upload failed. Campaign has been rolled back to the previous state.\n\nError: Network failed'
                );
            });
        });

        it('clears file input after upload completes', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Upload complete' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            const fileInput = document.querySelector('.admin-upload-label input[type="file"]');
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(fileInput, { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(fileInput.value).toBe('');
            });
        });

        it('clears file input after upload error', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Upload failed' }) })
            );

            render(<CampaignAdmin {...defaultProps} />);
            const fileInput = document.querySelector('.admin-upload-label input[type="file"]');
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(fileInput, { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(fileInput.value).toBe('');
            });
        });

        it('clears file input after network error', async () => {
            global.fetch = vi.fn(() => Promise.reject(new Error('Network failed')));

            render(<CampaignAdmin {...defaultProps} />);
            const fileInput = document.querySelector('.admin-upload-label input[type="file"]');
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(fileInput, { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(fileInput.value).toBe('');
            });
        });

        it('disables buttons after confirm during async operation', async () => {
            global.fetch = vi.fn(() => new Promise(() => {}));

            render(<CampaignAdmin {...defaultProps} />);
            const fileInput = document.querySelector('.admin-upload-label input[type="file"]');
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(fileInput, { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

            await waitFor(() => {
                expect(fileInput).toBeDisabled();
            });
        });

        it('does not call fetch when upload modal is canceled', async () => {
            const fetchMock = vi.fn();
            global.fetch = fetchMock;

            render(<CampaignAdmin {...defaultProps} />);
            const file = new File(['test'], 'backup.zip', { type: 'application/zip' });

            fireEvent.change(document.querySelector('.admin-upload-label input[type="file"]'), { target: { files: [file] } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            await waitFor(() => {
                expect(fetchMock).not.toHaveBeenCalled();
            });
        });
    });
});
