// @maintained-by-ai 2026-11-17
// Regression lock for bug-avatar-zoom-close-focus-stolen-by-card-autocomplete:
// Initiative cards are keyed `${name}-${runtimeStateTick}`, so every tick
// re-key, SSE echo, or overlay riding over the board REMOUNTS the GM rename
// autocomplete. Its mount effect used to focus itself unconditionally (the
// initialFocus DEFAULT), so the passive mount grabbed the caret; an avatar
// zoom opening next captured that field as its focus-restore "opener" and all
// three close lanes (Escape, ×, backdrop) faithfully walked focus out of the
// modal into the card input. A mount may own the caret ONLY on user intent:
// an explicitly armed open (initialFocus — the map token rename popover) or a
// mid-rename echo remount (isTypingIntent, the same gate as the ghost list).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterNameAutocomplete from './MonsterNameAutocomplete.jsx';

const MONSTERS = [
    { index: 'bandit', name: 'Bandit' },
    { index: 'goblin', name: 'Goblin' },
    { index: 'orc', name: 'Orc' },
];

const { mockLoadMonsters } = vi.hoisted(() => ({ mockLoadMonsters: vi.fn() }));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: mockLoadMonsters,
}));

async function renderAutocomplete(props = {}) {
    let utils;
    await act(async () => {
        utils = render(<MonsterNameAutocomplete value="" {...props} />);
    });
    return utils;
}

function getInput() {
    return screen.getByRole('textbox');
}

// Stand-in for a modal opener (an .avatar-wrapper div / the zoom panel): the
// element a close lane must hand the caret back to.
function mountOpener() {
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();
    return opener;
}

describe('MonsterNameAutocomplete mount-focus intent gate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockResolvedValue(MONSTERS);
        HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        delete HTMLElement.prototype.scrollIntoView;
        vi.useRealTimers();
    });

    it('does not steal the caret on a pre-filled passive mount (zoom-opener keeps focus)', async () => {
        // Repro: Join auto-navigates to Initiative while a stat-modal/zoom
        // surface holds focus; the fresh card mount used to grab the caret.
        const opener = mountOpener();
        await renderAutocomplete({ value: 'Goblin', ariaLabel: 'Goblin name' });
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('does not re-claim the caret on a tick re-key remount without typing intent', async () => {
        const utils = await renderAutocomplete({ value: 'Orc' });
        const opener = mountOpener();
        await act(async () => {
            utils.unmount();
            render(<MonsterNameAutocomplete value="Orc" />);
        });
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('carries the caret across a mid-rename echo remount (typing intent)', async () => {
        const utils = await renderAutocomplete({ value: '' });
        getInput().focus(); // entering the rename lane = a click into the field
        fireEvent.change(getInput(), { target: { value: 'Band' } });
        // The keystroke POST + echo re-keys the card: remount mid-word.
        await act(async () => {
            utils.unmount();
            render(<MonsterNameAutocomplete value="Band" />);
        });
        expect(getInput()).toHaveFocus();
        // Leave the lane honestly so later tests start with no live intent.
        fireEvent.blur(getInput());
    });

    it('blur clears the intent — a later remount never re-grabs the caret', async () => {
        const utils = await renderAutocomplete({ value: '' });
        getInput().focus();
        fireEvent.change(getInput(), { target: { value: 'Or' } });
        fireEvent.blur(getInput()); // commits + stands down
        const opener = mountOpener();
        await act(async () => {
            utils.unmount();
            render(<MonsterNameAutocomplete value="Or" />);
        });
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('focuses on an explicitly armed mount (map token rename popover lane)', async () => {
        const opener = mountOpener();
        await renderAutocomplete({ value: 'Goblin', initialFocus: true });
        expect(document.activeElement).toBe(getInput());
        expect(opener).not.toHaveFocus();
        opener.remove();
    });
});
