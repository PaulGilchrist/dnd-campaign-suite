// @maintained-by-ai 2026-10-24
// Regression lock for bug-eb-autocomplete-ghost-blocks-initiative-clicks:
// the dropdown used to auto-open from mount-time query seeds (Initiative cards
// autofocus their rename field with the creature's name; Join Encounter
// auto-navigates there), draping a ghost `.monster-autocomplete-list` over
// card controls (e.g. input[aria-label="Bandit max HP"]) and swallowing the
// GM's clicks. Only user keystrokes may open the list; blur/outside-click/
// selection must close it and keep it closed.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterNameAutocomplete from './MonsterNameAutocomplete.jsx';

const MONSTERS = [
    { index: 'bandit', name: 'Bandit' },
    { index: 'bandit-captain', name: 'Bandit Captain' },
    { index: 'bandit-crime-lord', name: 'Bandit Crime Lord' },
    { index: 'bandit-deceiver', name: 'Bandit Deceiver' },
    { index: 'orc', name: 'Orc' },
];

const { mockLoadMonsters } = vi.hoisted(() => ({ mockLoadMonsters: vi.fn() }));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: mockLoadMonsters,
}));

// Must match the suggestion-open debounce in the component (benign UI timer).
const DEBOUNCE_MS = 150;

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

function suggestionNames() {
    const list = document.querySelector('.monster-autocomplete-list');
    return list ? [...list.children].map(li => li.textContent.trim()) : null;
}

/** Flushes the suggestion debounce deterministically. */
function flushDebounce() {
    act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
    });
}

describe('MonsterNameAutocomplete ghost-list regression', () => {
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

    it('does not open the list when mounted pre-filled (initiative join-card lane)', async () => {
        // Repro: EB Join auto-navigates to Initiative with the new Bandit card
        // pre-filled with "Bandit". Previously the debounce auto-opened a
        // 4-item ghost list over the HP inputs even while the field held the
        // caret (the old initialFocus default auto-focused it).
        await renderAutocomplete({ value: 'Bandit' });
        expect(getInput()).toHaveValue('Bandit');
        expect(suggestionNames()).toBeNull();
        flushDebounce();
        flushDebounce();
        expect(suggestionNames()).toBeNull();
    });

    it('stays closed after an external value echo closes it (SSE rename lane)', async () => {
        const { rerender } = await renderAutocomplete({ value: 'Bandit' });
        flushDebounce();
        expect(suggestionNames()).toBeNull();
        await act(async () => {
            rerender(<MonsterNameAutocomplete value="Bandit Captain" />);
        });
        flushDebounce();
        flushDebounce();
        expect(getInput()).toHaveValue('Bandit Captain');
        expect(suggestionNames()).toBeNull();
    });

    it('re-opens mid-typing when a rename echo remounts the card (+NPC rename lane)', async () => {
        // Initiative cards are keyed `${name}-${tick}`: every rename keystroke
        // POSTs and the SSE echo REMOUNTS this component. The typed intent must
        // survive that remount so the +NPC flow ("rename it to a monster
        // name…") keeps its suggestions until dismissed (§312 lane).
        const utils = await renderAutocomplete({ value: '' });
        getInput().focus(); // a real rename starts with a click into the field
        fireEvent.change(getInput(), { target: { value: 'Band' } });
        flushDebounce();
        expect(suggestionNames()).not.toBeNull();
        await act(async () => {
            utils.unmount();
            render(<MonsterNameAutocomplete value="Band" />);
        });
        // The rename-echo remount carries the caret (intent gate), which is
        // what lets the list re-open over the fresh instance.
        expect(getInput()).toHaveFocus();
        flushDebounce();
        expect(suggestionNames()).toEqual([
            'Bandit', 'Bandit Captain', 'Bandit Crime Lord', 'Bandit Deceiver',
        ]);
        // Any outside click kills the intent for good.
        fireEvent.mouseDown(document.body);
        flushDebounce();
        expect(suggestionNames()).toBeNull();
    });

    it('opens on user typing and closes on blur without selection', async () => {
        await renderAutocomplete();
        getInput().focus();
        fireEvent.change(getInput(), { target: { value: 'Band' } });
        flushDebounce();
        expect(suggestionNames()).toEqual([
            'Bandit', 'Bandit Captain', 'Bandit Crime Lord', 'Bandit Deceiver',
        ]);
        fireEvent.blur(getInput());
        expect(suggestionNames()).toBeNull();
        // No re-open after the debounce window once blurred without typing.
        flushDebounce();
        flushDebounce();
        expect(suggestionNames()).toBeNull();
    });

    it('closes on mouse-down outside the component and does not re-open', async () => {
        await renderAutocomplete();
        getInput().focus();
        fireEvent.change(getInput(), { target: { value: 'bandit' } });
        flushDebounce();
        expect(suggestionNames()).not.toBeNull();
        fireEvent.mouseDown(document.body);
        expect(suggestionNames()).toBeNull();
        flushDebounce();
        expect(suggestionNames()).toBeNull();
    });

    it('closes for good when a suggestion is picked (no post-select echo re-open)', async () => {
        const onChange = vi.fn();
        const { rerender } = await renderAutocomplete({ onChange });
        getInput().focus();
        fireEvent.change(getInput(), { target: { value: 'band' } });
        flushDebounce();
        expect(suggestionNames()).not.toBeNull();
        fireEvent.mouseDown(screen.getByText('Bandit'));
        expect(getInput()).toHaveValue('Bandit');
        expect(onChange).toHaveBeenLastCalledWith('Bandit');
        expect(suggestionNames()).toBeNull();
        // Parent echoes the committed name back through the value prop.
        await act(async () => {
            rerender(<MonsterNameAutocomplete value="Bandit" onChange={onChange} />);
        });
        flushDebounce();
        flushDebounce();
        expect(suggestionNames()).toBeNull();
    });
});
