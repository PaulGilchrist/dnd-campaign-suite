// @maintained-by-ai: 2026-11-22
/**
 * Deferred plan D — ItemDetailsDock token art lane: creature rows (npc/
 * monster) get upload + emoji + Remove art; props/doors never do. Upload
 * posts the FileReader data URL to /token-image and patches the row with the
 RETURNED campaign-relative imagePath (the row never keeps bytes).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

import ItemDetailsDock from './ItemDetailsDock.jsx';

const item = (over = {}) => ({ id: 'i1', type: 'npc', name: 'Goblin', gridX: 1, gridY: 1, visible: true, ...over });

const renderDock = (it_ = item(), extra = {}) => render(
    <ItemDetailsDock
        item={it_}
        handleDeleteItem={vi.fn()}
        onDismiss={vi.fn()}
        campaignName="test-campaign"
        onPatchItem={vi.fn()}
        {...extra}
    />
);

afterEach(cleanup);

describe('ItemDetailsDock token art (plan D)', () => {
    it('creature rows get the art controls; prop rows (barrel/door) do not', () => {
        const { unmount } = renderDock();
        expect(screen.getByText(/Set token art/)).toBeInTheDocument();
        unmount();
        renderDock(item({ type: 'barrel' }));
        expect(screen.queryByText(/Set token art/)).not.toBeInTheDocument();
    });

    it('emoji pick patches the row immediately; Remove art clears both fields', () => {
        const onPatchItem = vi.fn();
        renderDock(item({ emoji: '🧙' }), { onPatchItem });
        fireEvent.click(screen.getByRole('button', { name: 'Set 🐉 token art' }));
        expect(onPatchItem).toHaveBeenCalledWith('i1', { emoji: '🐉' });
        fireEvent.click(screen.getByRole('button', { name: /Remove art/ }));
        expect(onPatchItem).toHaveBeenLastCalledWith('i1', { imagePath: undefined, emoji: undefined });
    });

    it('upload: FileReader data URL → POST /token-image → row keeps ONLY the returned imagePath', async () => {
        const onPatchItem = vi.fn();
        const fetchMock = vi.fn(async () => ({
            ok: true, json: async () => ({ imagePath: 'images/token-1.png' }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        // jsdom lacks FileReader.readAsDataURL plumbing for real files — stub.
        vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
            this.onload && this.onload({ target: { result: 'data:image/png;base64,AA==' } });
        });
        renderDock(item(), { onPatchItem });
        fireEvent.change(document.querySelector('.item-details-dock-art-row input[type=file]'), {
            target: { files: [new File(['x'], 'gob.png', { type: 'image/png' })] },
        });
        await waitFor(() => expect(onPatchItem).toHaveBeenCalledWith('i1', { imagePath: 'images/token-1.png' }));
        const [url, opts] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/campaigns/test-campaign/token-image');
        expect(JSON.parse(opts.body)).toMatchObject({ image: 'data:image/png;base64,AA==', imageName: 'gob.png' });
        vi.unstubAllGlobals();
    });

    it('refused upload surfaces the honest error line, patching nothing', async () => {
        const onPatchItem = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'image must be a base64 data URL' }) })));
        vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function () {
            this.onload && this.onload({ target: { result: 'not-a-data-url' } });
        });
        renderDock(item(), { onPatchItem });
        fireEvent.change(document.querySelector('.item-details-dock-art-row input[type=file]'), {
            target: { files: [new File(['x'], 'gob.png', { type: 'image/png' })] },
        });
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/image must be a base64 data URL/));
        expect(onPatchItem).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
