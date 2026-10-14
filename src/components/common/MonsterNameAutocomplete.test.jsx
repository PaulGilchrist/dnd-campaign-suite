import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterNameAutocomplete from './MonsterNameAutocomplete.jsx';

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([
        { index: 'goblin', name: 'Goblin' },
        { index: 'orc', name: 'Orc' },
        { index: 'troll', name: 'Troll' },
        { index: 'dragon', name: 'Ancient Dragon' },
        { index: 'beholder', name: 'Beholder' },
        { index: 'manticore', name: 'Manticore' },
        { index: 'hydra', name: 'Hydra' },
        { index: 'minotaur', name: 'Minotaur' },
        { index: 'ghost', name: 'Ghost' },
        { index: 'wraith', name: 'Wraith' },
    ])),
}));

describe('MonsterNameAutocomplete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            value: vi.fn(),
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        delete HTMLElement.prototype.scrollIntoView;
        vi.restoreAllMocks();
    });

    it('renders an input field and focuses when initialFocus is true', () => {
        render(<MonsterNameAutocomplete value="Goblin" initialFocus={true} />);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        const input = document.querySelector('.monster-autocomplete-input');
        expect(document.activeElement).toBe(input);
    });

    it('does not focus the input when initialFocus is false', () => {
        render(<MonsterNameAutocomplete value="" initialFocus={false} />);
        const input = document.querySelector('.monster-autocomplete-input');
        expect(document.activeElement).not.toBe(input);
    });

    it('calls onChange when input value changes', () => {
        const onChange = vi.fn();
        render(<MonsterNameAutocomplete value="" onChange={onChange} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        expect(onChange).toHaveBeenCalledWith('Gobl');
    });

    it('shows suggestions when query matches monster names', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await expect(screen.findByText('Goblin')).resolves.toBeInTheDocument();
    });

    it('hides suggestions when query has no matches or is cleared', async () => {
        const { unmount } = render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');

        fireEvent.change(input, { target: { value: 'zzzzzzzzzz' } });
        await new Promise(r => setTimeout(r, 200));
        expect(document.querySelector('.monster-autocomplete-list')).not.toBeInTheDocument();
        unmount();

        render(<MonsterNameAutocomplete value="" />);
        const input2 = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input2, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));
        fireEvent.change(input2, { target: { value: '' } });
        await new Promise(r => setTimeout(r, 200));
        expect(document.querySelector('.monster-autocomplete-list')).not.toBeInTheDocument();
    });

    it('prioritizes started-with matches over contains matches', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Anc' } });
        await new Promise(r => setTimeout(r, 200));
        const items = document.querySelectorAll('.monster-autocomplete-item');
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].textContent.trim()).toBe('Ancient Dragon');
    });

    it('highlights first suggestion on ArrowDown and wraps to first on ArrowUp from last', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(document.querySelector('.monster-autocomplete-item.highlighted')).toBeInTheDocument();

        // Simulate reaching the end by dispatching ArrowDown repeatedly
        const list = document.querySelector('.monster-autocomplete-list');
        const totalItems = list.children.length;
        for (let i = 0; i < totalItems - 1; i++) {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
        }
        // One more ArrowDown should wrap to first
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        const wrappedItem = document.querySelector('.monster-autocomplete-item.highlighted');
        expect(wrappedItem.textContent.trim()).toBe(list.children[0].textContent.trim());
    });

    it('selects highlighted suggestion on Enter', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('Goblin');
    });

    it('commits raw query on Enter when no suggestions are shown', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'xyz' } });
        await new Promise(r => setTimeout(r, 200));
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('xyz');
    });

    it('commits query on blur when onCommit is provided', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith('Gobl');
    });

    it('commits and calls onChange on mouse selection', async () => {
        const onCommit = vi.fn();
        const onChange = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} onChange={onChange} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));
        const item = document.querySelector('.monster-autocomplete-item');
        fireEvent.mouseDown(item);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith('Goblin');
        expect(onCommit).toHaveBeenCalledWith('Goblin');
    });

    it('hides suggestions when clicking outside the component', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));
        fireEvent.mouseDown(document.body);
        const list = document.querySelector('.monster-autocomplete-list');
        expect(list).not.toBeInTheDocument();
    });

    it('renders NPC badge when npcs prop is provided', async () => {
        const npcs = [{ name: 'Custom NPC' }];
        render(<MonsterNameAutocomplete value="" npcs={npcs} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Cus' } });
        await new Promise(r => setTimeout(r, 200));
        const npcItem = document.querySelector('.monster-autocomplete-item');
        expect(npcItem).toBeInTheDocument();
        expect(npcItem.textContent).toContain('Custom NPC');
        const badge = npcItem.querySelector('.monster-autocomplete-badge');
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toBe('NPC');
    });

    it('renders only monsters when npcs is an empty array', async () => {
        render(<MonsterNameAutocomplete value="" npcs={[]} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await new Promise(r => setTimeout(r, 200));
        const items = document.querySelectorAll('.monster-autocomplete-item');
        items.forEach(item => {
            expect(item.querySelector('.monster-autocomplete-badge')).not.toBeInTheDocument();
        });
    });

    it('applies fixed positioning class when position prop is provided', () => {
        render(<MonsterNameAutocomplete value="" position={{ top: 10, left: 20 }} />);
        const wrapper = document.querySelector('.monster-autocomplete');
        expect(wrapper).toHaveClass('monster-autocomplete-fixed');
    });

    it('updates input when value prop changes externally', async () => {
        const { rerender } = render(<MonsterNameAutocomplete value="Goblin" />);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        rerender(<MonsterNameAutocomplete value="Orc" />);
        await new Promise(r => setTimeout(r, 200));
        expect(screen.getByDisplayValue('Orc')).toBeInTheDocument();
    });
});
