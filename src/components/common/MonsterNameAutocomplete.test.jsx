// @improved-by-ai
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterNameAutocomplete from './MonsterNameAutocomplete.jsx';

// Bestiary rule: pre-made monsters come from monsters.json via loadMonsters;
// the npcs prop carries CUSTOM NPCs only. These fixtures mirror that split.
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

/** Types into the input and deterministically flushes the suggestion debounce. */
function typeQuery(value) {
    fireEvent.change(getInput(), { target: { value } });
    act(() => {
        vi.advanceTimersByTime(DEBOUNCE_MS);
    });
}

/** Names of the visible suggestions, or null when the list is closed. */
function suggestionNames() {
    const list = document.querySelector('.monster-autocomplete-list');
    return list ? [...list.children].map(li => li.textContent.trim()) : null;
}

function highlightedName() {
    const el = document.querySelector('.monster-autocomplete-item.highlighted');
    return el ? el.textContent.trim() : null;
}

describe('MonsterNameAutocomplete', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockResolvedValue(MONSTERS);
        // jsdom has no scrollIntoView; stub it so keyboard highlighting can run.
        HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        delete HTMLElement.prototype.scrollIntoView;
        vi.useRealTimers();
    });

    it('renders a text input showing the current value', async () => {
        await renderAutocomplete({ value: 'Goblin' });
        expect(getInput()).toHaveValue('Goblin');
    });

    it('loads the bestiary once on mount', async () => {
        await renderAutocomplete();
        expect(mockLoadMonsters).toHaveBeenCalledTimes(1);
    });

    it('keeps working when the bestiary fails to load', async () => {
        mockLoadMonsters.mockRejectedValue(new Error('network down'));
        await renderAutocomplete();
        typeQuery('Gobl');
        expect(suggestionNames()).toBeNull();
        expect(getInput()).toHaveValue('Gobl');
    });

    it('focuses the input by default', async () => {
        await renderAutocomplete();
        expect(document.activeElement).toBe(getInput());
    });

    it('does not focus the input when initialFocus is false', async () => {
        await renderAutocomplete({ initialFocus: false });
        expect(document.activeElement).not.toBe(getInput());
    });

    it('reports every keystroke through onChange', async () => {
        const onChange = vi.fn();
        await renderAutocomplete({ onChange });
        fireEvent.change(getInput(), { target: { value: 'G' } });
        fireEvent.change(getInput(), { target: { value: 'Go' } });
        fireEvent.change(getInput(), { target: { value: 'Gob' } });
        expect(onChange).toHaveBeenNthCalledWith(1, 'G');
        expect(onChange).toHaveBeenNthCalledWith(2, 'Go');
        expect(onChange).toHaveBeenNthCalledWith(3, 'Gob');
    });

    it('lists started-with matches before contains-only matches', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        expect(suggestionNames()).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
    });

    it('matches names case-insensitively', async () => {
        await renderAutocomplete();
        typeQuery('DRAGON');
        expect(suggestionNames()).toEqual(['Dragon', 'Ancient Dragon', 'Young Dragon']);
    });

    it('shows no suggestions for an empty or whitespace-only query', async () => {
        await renderAutocomplete();
        expect(suggestionNames()).toBeNull();
        typeQuery('   ');
        expect(suggestionNames()).toBeNull();
    });

    it('shows no suggestions when nothing matches the query', async () => {
        await renderAutocomplete();
        typeQuery('zzzzzz');
        expect(suggestionNames()).toBeNull();
    });

    it('closes the suggestion list when the query is cleared', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        expect(suggestionNames()).not.toBeNull();
        typeQuery('');
        expect(suggestionNames()).toBeNull();
    });

    it('surfaces custom NPCs with an NPC badge ahead of bestiary matches', async () => {
        await renderAutocomplete({ npcs: [{ name: 'Goblin Friend' }] });
        typeQuery('gob');
        const items = within(document.querySelector('.monster-autocomplete-list')).getAllByRole('listitem');
        expect(within(items[0]).getByText('NPC')).toBeInTheDocument();
        expect(items[0].textContent).toContain('Goblin Friend');
        expect(suggestionNames().slice(1)).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
        items.slice(1).forEach((li) => {
            expect(within(li).queryByText('NPC')).not.toBeInTheDocument();
        });
    });

    it('ignores nameless NPC entries', async () => {
        await renderAutocomplete({ npcs: [{ index: 'unnamed' }, { name: '' }] });
        typeQuery('gob');
        expect(suggestionNames()).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
    });

    it('caps suggestions at eight, keeping started-with matches', async () => {
        const many = Array.from({ length: 10 }, (_, i) => ({ index: `alpha-${i}`, name: `Alpha ${i + 1}` }));
        mockLoadMonsters.mockResolvedValue([...many, { index: 'z1', name: 'Z Alpha 1' }, { index: 'z2', name: 'Z Alpha 2' }]);
        await renderAutocomplete();
        typeQuery('alpha');
        const names = suggestionNames();
        expect(names).toHaveLength(8);
        expect(names).toEqual(many.slice(0, 8).map(m => m.name));
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

    it('ignores arrow keys while no suggestions are open', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
        fireEvent.keyDown(getInput(), { key: 'ArrowUp' });
        expect(suggestionNames()).toBeNull();
        expect(highlightedName()).toBeNull();
        expect(onCommit).not.toHaveBeenCalled();
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
        expect(onCommit).toHaveBeenCalledWith('Hobgoblin');
        expect(suggestionNames()).toBeNull();
    });

    it('commits the raw query on Enter when the list is open but nothing is highlighted', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        typeQuery('gob');
        fireEvent.keyDown(getInput(), { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith('gob');
    });

    it('commits the raw query on Enter when nothing matches', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        typeQuery('xyz custom name');
        expect(suggestionNames()).toBeNull();
        fireEvent.keyDown(getInput(), { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('xyz custom name');
    });

    it('commits the current query and closes the list on blur', async () => {
        const onCommit = vi.fn();
        await renderAutocomplete({ onCommit });
        typeQuery('gob');
        fireEvent.blur(getInput());
        expect(onCommit).toHaveBeenCalledWith('gob');
        expect(suggestionNames()).toBeNull();
    });

    it('closes the list on blur without an onCommit handler and keeps the typed text', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        expect(() => fireEvent.blur(getInput())).not.toThrow();
        expect(suggestionNames()).toBeNull();
        expect(getInput()).toHaveValue('gob');
    });

    it('selects a suggestion on mouse-down, updating value and committing', async () => {
        const onChange = vi.fn();
        const onCommit = vi.fn();
        await renderAutocomplete({ onChange, onCommit });
        typeQuery('gob');
        const secondItem = within(document.querySelector('.monster-autocomplete-list')).getAllByRole('listitem')[1];
        fireEvent.mouseDown(secondItem);
        expect(getInput()).toHaveValue('Goblin Boss');
        expect(onChange).toHaveBeenLastCalledWith('Goblin Boss');
        expect(onCommit).toHaveBeenCalledWith('Goblin Boss');
        expect(suggestionNames()).toBeNull();
    });

    it('keeps suggestions open on mouse-down inside the component', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        fireEvent.mouseDown(getInput());
        expect(suggestionNames()).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin']);
    });

    it('closes suggestions on mouse-down outside the component', async () => {
        await renderAutocomplete();
        typeQuery('gob');
        fireEvent.mouseDown(document.body);
        expect(suggestionNames()).toBeNull();
    });

    it('applies the fixed-position class only when a position is provided', async () => {
        const { rerender } = await renderAutocomplete();
        const wrapper = document.querySelector('.monster-autocomplete');
        expect(wrapper).not.toHaveClass('monster-autocomplete-fixed');
        rerender(<MonsterNameAutocomplete value="" position={{ top: 10, left: 20 }} />);
        expect(document.querySelector('.monster-autocomplete')).toHaveClass('monster-autocomplete-fixed');
    });

    it('syncs the input on external value changes without re-reporting via onChange', async () => {
        const onChange = vi.fn();
        const { rerender } = await renderAutocomplete({ value: 'Goblin', onChange });
        onChange.mockClear();
        await act(async () => {
            rerender(<MonsterNameAutocomplete value="Orc" onChange={onChange} />);
        });
        expect(getInput()).toHaveValue('Orc');
        expect(onChange).not.toHaveBeenCalled();
        // An externally set query re-opens matching suggestions after the debounce.
        act(() => {
            vi.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(suggestionNames()).toEqual(['Orc']);
    });
});
