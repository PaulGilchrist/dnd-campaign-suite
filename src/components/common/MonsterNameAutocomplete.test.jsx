// @maintained-by-ai 2026-11-27 — trimmed to core behavior; caret-law mounts are pinned by MonsterNameAutocomplete.focus-intent.test.jsx and the ghost-list echo/outside-click regressions by MonsterNameAutocomplete.no-ghost-list.test.jsx (stronger there, not duplicated here).
// Bestiary rule: pre-made monsters arrive via loadMonsters (mocked at that seam —
// the /data/monsters.json fetch itself belongs to the dataLoader lane); the npcs
// prop carries CUSTOM NPCs only. Fixture rows below are small and distinctive.
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterNameAutocomplete from './MonsterNameAutocomplete.jsx';

const MONSTERS = [
    { index: 'goblin', name: 'Goblin' },
    { index: 'goblin-boss', name: 'Goblin Boss' },
    { index: 'hobgoblin', name: 'Hobgoblin' },
    { index: 'orc', name: 'Orc' },
    { index: 'troll', name: 'Troll' },
    { index: 'dragon', name: 'Dragon' },
    { index: 'ancient-dragon', name: 'Ancient Dragon' },
    { index: 'young-dragon', name: 'Young Dragon' },
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

/** Types into the input and deterministically flushes the suggestion debounce.
 *  Focuses first the way a real click-then-type does — a passive mount never
 *  arms the caret (see the focus-intent lane). */
function typeQuery(value) {
    const input = getInput();
    input.focus();
    fireEvent.change(input, { target: { value } });
    act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
    });
}

/** Names of the visible suggestions, or null when the list is closed.
 *  Strips the NPC badge text so monster/NPC rows compare by name alone. */
function suggestionNames() {
    const list = screen.queryByRole('list');
    return list
        ? within(list).getAllByRole('listitem').map(li => li.textContent.replace(/NPC$/, '').trim())
        : null;
}

/** Highlight position has no accessible attribute (no aria-activedescendant),
 *  so this — the only observable of arrow-walk state — reads the class. */
function highlightedName() {
    const el = document.querySelector('.monster-autocomplete-item.highlighted');
    return el ? el.textContent.trim() : null;
}

describe('MonsterNameAutocomplete', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // mockReset clears leftover resolve/reject overrides, then re-baseline.
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockResolvedValue(MONSTERS);
        // jsdom has no scrollIntoView; stub it so keyboard highlighting can run.
        HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        delete HTMLElement.prototype.scrollIntoView;
        vi.useRealTimers();
    });

    it('shows the current value, named by ariaLabel only when one is provided', async () => {
        const withLabel = await renderAutocomplete({ value: 'Goblin', ariaLabel: 'Goblin name' });
        expect(screen.getByRole('textbox', { name: 'Goblin name' })).toHaveValue('Goblin');
        withLabel.unmount();
        // Non-card call sites pass no ariaLabel: no accessible name is injected.
        await renderAutocomplete({ value: 'Mimic' });
        expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-label');
    });

    it('loads the bestiary exactly once on mount', async () => {
        await renderAutocomplete();
        expect(mockLoadMonsters).toHaveBeenCalledTimes(1);
    });

    it('keeps the field usable when the bestiary fails to load', async () => {
        mockLoadMonsters.mockRejectedValue(new Error('network down'));
        await renderAutocomplete();
        typeQuery('Gobl');
        expect(suggestionNames()).toBeNull();
        expect(getInput()).toHaveValue('Gobl');
    });

    it('reports every keystroke upward through onChange', async () => {
        const onChange = vi.fn();
        await renderAutocomplete({ onChange });
        const input = getInput();
        fireEvent.change(input, { target: { value: 'G' } });
        fireEvent.change(input, { target: { value: 'Go' } });
        fireEvent.change(input, { target: { value: 'Gob' } });
        expect(onChange).toHaveBeenNthCalledWith(1, 'G');
        expect(onChange).toHaveBeenNthCalledWith(2, 'Go');
        expect(onChange).toHaveBeenNthCalledWith(3, 'Gob');
    });

    it('ranks started-with matches ahead of contains-only matches, case-insensitively', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        expect(suggestionNames()).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
        typeQuery('DRAGON');
        expect(suggestionNames()).toEqual(['Dragon', 'Ancient Dragon', 'Young Dragon']);
    });

    it('opens no list for a whitespace-only or unmatched query', async () => {
        await renderAutocomplete();
        typeQuery('   ');
        expect(suggestionNames()).toBeNull();
        typeQuery('zzzzzz');
        expect(suggestionNames()).toBeNull();
    });

    it('closes the list when the query is cleared', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        expect(suggestionNames()).not.toBeNull();
        typeQuery('');
        expect(suggestionNames()).toBeNull();
    });

    it('surfaces custom NPCs with an NPC badge ahead of bestiary matches', async () => {
        await renderAutocomplete({ npcs: [{ name: 'Goblin Friend' }] });
        typeQuery('gob');
        const items = within(screen.getByRole('list')).getAllByRole('listitem');
        expect(within(items[0]).getByText('NPC')).toBeInTheDocument();
        expect(suggestionNames()).toEqual(['Goblin Friend', 'Goblin', 'Goblin Boss', 'Hobgoblin']);
        items.slice(1).forEach((li) => {
            expect(within(li).queryByText('NPC')).not.toBeInTheDocument();
        });
    });

    it('ignores nameless NPC entries instead of crashing the matcher', async () => {
        // Without the name filter, `n.name.toLowerCase()` throws on the
        // undefined-name row and the whole component dies.
        await renderAutocomplete({ npcs: [{ index: 'unnamed' }, { name: '' }] });
        typeQuery('gob');
        expect(suggestionNames()).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
    });

    it('caps the list at eight: started-with first, contains-only filling the rest', async () => {
        mockLoadMonsters.mockResolvedValue([
            { index: 'gob-1', name: 'Gob 1' },
            { index: 'gob-2', name: 'Gob 2' },
            ...Array.from({ length: 9 }, (_, i) => ({ index: `mid-${i}`, name: `AGob ${i + 1}` })),
        ]);
        await renderAutocomplete();
        typeQuery('gob');
        expect(suggestionNames()).toEqual([
            'Gob 1', 'Gob 2',
            'AGob 1', 'AGob 2', 'AGob 3', 'AGob 4', 'AGob 5', 'AGob 6',
        ]);
    });

    it('walks suggestions with arrow keys, wrapping in both directions', async () => {
        await renderAutocomplete();
        typeQuery('gob');

        fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
        expect(highlightedName()).toBe('Goblin');
        fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
        expect(highlightedName()).toBe('Goblin Boss');
        fireEvent.keyDown(getInput(), { key: 'ArrowUp' });
        expect(highlightedName()).toBe('Goblin');
        // One more ArrowUp from the first item wraps to the last.
        fireEvent.keyDown(getInput(), { key: 'ArrowUp' });
        expect(highlightedName()).toBe('Hobgoblin');
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('is inert to arrows while closed, and Enter commits the raw query verbatim', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        const input = getInput();
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(suggestionNames()).toBeNull();
        expect(highlightedName()).toBeNull();
        expect(onCommit).not.toHaveBeenCalled();
        // Enter with no list open (fresh field, then a custom non-matching name).
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenNthCalledWith(1, '');
        fireEvent.change(input, { target: { value: 'Xyzzy the Unsourced' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenNthCalledWith(2, 'Xyzzy the Unsourced');
        expect(onCommit).toHaveBeenCalledTimes(2);
    });

    it('commits the highlighted suggestion on Enter, updating the input and closing the list', async () => {
        const onChange = vi.fn();
        const onCommit = vi.fn();
        await renderAutocomplete({ onChange, onCommit });
        typeQuery('gob');
        fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
        fireEvent.keyDown(getInput(), { key: 'ArrowUp' }); // wrap to last: Hobgoblin
        fireEvent.keyDown(getInput(), { key: 'Enter' });
        expect(getInput()).toHaveValue('Hobgoblin');
        expect(onChange).toHaveBeenLastCalledWith('Hobgoblin');
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith('Hobgoblin');
        expect(suggestionNames()).toBeNull();
    });

    it('commits the raw query once on Enter when the list is open but nothing is highlighted', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        typeQuery('gob');
        expect(suggestionNames()).not.toBeNull();
        fireEvent.keyDown(getInput(), { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith('gob');
    });

    it('commits the current query and closes the list on blur', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        typeQuery('gob');
        fireEvent.blur(getInput());
        expect(onCommit).toHaveBeenCalledWith('gob');
        expect(suggestionNames()).toBeNull();
    });

    it('is safe to press Enter or blur with no onCommit handler', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        // Guarded branches: `if (onCommit)` must not be dropped or these throw.
        fireEvent.keyDown(getInput(), { key: 'Enter' }); // open, nothing highlighted
        expect(suggestionNames()).not.toBeNull();
        fireEvent.blur(getInput());
        expect(suggestionNames()).toBeNull();
        expect(getInput()).toHaveValue('gob');
    });

    it('selects a suggestion on mouse-down, updating value and committing', async () => {
        const onChange = vi.fn();
        const onCommit = vi.fn();
        await renderAutocomplete({ onChange, onCommit });
        typeQuery('gob');
        const secondItem = within(screen.getByRole('list')).getAllByRole('listitem')[1];
        fireEvent.mouseDown(secondItem);
        expect(getInput()).toHaveValue('Goblin Boss');
        expect(onChange).toHaveBeenLastCalledWith('Goblin Boss');
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith('Goblin Boss');
        expect(suggestionNames()).toBeNull();
    });

    it('keeps suggestions open on mouse-down inside the component', async () => {
        // Outside-click closing (plus intent kill / no-reopen) is pinned by the
        // no-ghost-list lane; only the inside leg is unique here.
        await renderAutocomplete();
        typeQuery('gob');
        fireEvent.mouseDown(getInput());
        expect(suggestionNames()).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
    });

    it('syncs the input on external value changes without re-reporting via onChange', async () => {
        const onChange = vi.fn();
        const { rerender } = await renderAutocomplete({ onChange });
        await act(async () => {
            rerender(<MonsterNameAutocomplete value="Orc" onChange={onChange} />);
        });
        expect(getInput()).toHaveValue('Orc');
        expect(onChange).not.toHaveBeenCalled();
        // An externally set query must NOT re-open suggestions — only user
        // keystrokes open it (bug-eb-autocomplete-ghost).
        act(() => {
            vi.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(suggestionNames()).toBeNull();
    });
});
