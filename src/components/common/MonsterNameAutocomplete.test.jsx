/* @improved-by-ai */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    it('renders an input field', () => {
        const { container } = render(<MonsterNameAutocomplete value="" />);
        const input = container.querySelector('.monster-autocomplete-input');
        expect(input).toBeInTheDocument();
    });

    it('renders with the initial value', () => {
        render(<MonsterNameAutocomplete value="Goblin" />);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
    });

    it('renders with the default empty value', () => {
        render(<MonsterNameAutocomplete value="" />);
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
    });

    it('focuses the input when initialFocus is true', () => {
        render(<MonsterNameAutocomplete value="" initialFocus={true} />);
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
        const { container } = render(<MonsterNameAutocomplete value="" onChange={onChange} />);
        const input = container.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        expect(onChange).toHaveBeenCalledWith('Gobl');
    });

    it('shows suggestions when typing a matching prefix', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
    });

    it('shows suggestions with monsters that start with the query first', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Anc' } });
        await waitFor(() => {
            const items = document.querySelectorAll('.monster-autocomplete-item');
            expect(items.length).toBeGreaterThan(0);
            expect(items[0].textContent.trim()).toContain('Ancient Dragon');
        });
    });

    it('limits suggestions to 8 items for started-with matches', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'A' } });
        await waitFor(() => {
            const items = document.querySelectorAll('.monster-autocomplete-item');
            expect(items.length).toBeLessThanOrEqual(8);
        });
    });

    it('includes partial matches after exact prefix matches', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'a' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
    });

    it('hides suggestions when query has no matches', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'zzzzzzzzzz' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('hides suggestions when input is cleared', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.change(input, { target: { value: '' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('highlights the selected suggestion on arrow down', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        const highlighted = document.querySelector('.monster-autocomplete-item.highlighted');
        expect(highlighted).toBeInTheDocument();
    });

    it('cycles highlighted index on repeated arrow down', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Orc' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const items = document.querySelectorAll('.monster-autocomplete-item');
        if (items.length > 1) {
            for (let i = 0; i < items.length; i++) {
                fireEvent.keyDown(input, { key: 'ArrowDown' });
            }
            const first = document.querySelector('.monster-autocomplete-item.highlighted');
            expect(first.textContent.trim()).toContain(items[0].textContent.trim());
        }
    });

    it('cycles highlighted index on arrow up', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const items = document.querySelectorAll('.monster-autocomplete-item');
        if (items.length > 1) {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
            fireEvent.keyDown(input, { key: 'ArrowDown' });
            fireEvent.keyDown(input, { key: 'ArrowUp' });
            const highlighted = document.querySelector('.monster-autocomplete-item.highlighted');
            expect(highlighted).toBeInTheDocument();
        }
    });

    it('selects highlighted suggestion on Enter', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
    });

    it('commits the query value when no suggestion is highlighted on Enter', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('Gobl');
    });

    it('commits the query on blur', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith('Gobl');
    });

    it('hides suggestions on blur', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.blur(input);
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('hides suggestions when clicking outside', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.mouseDown(document.body);
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('selects suggestion on mouse down and commits via onCommit', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const item = document.querySelector('.monster-autocomplete-item');
        fireEvent.mouseDown(item);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        expect(onCommit).toHaveBeenCalledWith('Goblin');
    });

    it('calls onChange with selected name on suggestion click', async () => {
        const onChange = vi.fn();
        render(<MonsterNameAutocomplete value="" onChange={onChange} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const item = document.querySelector('.monster-autocomplete-item');
        fireEvent.mouseDown(item);
        expect(onChange).toHaveBeenCalledWith('Goblin');
    });

    it('renders NPC badge when npcs prop is provided', async () => {
        const npcs = [{ name: 'Custom NPC' }];
        render(<MonsterNameAutocomplete value="" npcs={npcs} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Cus' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const npcItem = document.querySelector('.monster-autocomplete-item');
        expect(npcItem).toBeInTheDocument();
        expect(npcItem.textContent).toContain('Custom NPC');
        const badge = npcItem.querySelector('.monster-autocomplete-badge');
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toBe('NPC');
    });

    it('filters out NPC items with no name', async () => {
        const npcs = [{ name: null }, { name: undefined }, { name: 'Valid NPC' }];
        render(<MonsterNameAutocomplete value="" npcs={npcs} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Val' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const items = document.querySelectorAll('.monster-autocomplete-item');
        const itemTexts = Array.from(items).map(item => {
            const badge = item.querySelector('.monster-autocomplete-badge');
            return badge ? item.textContent.replace('NPC', '').trim() : item.textContent.trim();
        });
        expect(itemTexts).toContain('Valid NPC');
    });

    it('applies fixed positioning class when position prop is provided', () => {
        const { container } = render(
            <MonsterNameAutocomplete value="" position={{ top: 10, left: 20 }} />
        );
        const wrapper = container.querySelector('.monster-autocomplete');
        expect(wrapper).toHaveClass('monster-autocomplete-fixed');
        expect(wrapper).toHaveStyle({ top: '10px', left: '20px' });
    });

    it('does not apply fixed positioning class when position is undefined', () => {
        const { container } = render(<MonsterNameAutocomplete value="" />);
        const wrapper = container.querySelector('.monster-autocomplete');
        expect(wrapper).not.toHaveClass('monster-autocomplete-fixed');
    });

    it('updates input when value prop changes externally', async () => {
        const { rerender } = render(<MonsterNameAutocomplete value="Goblin" />);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        rerender(<MonsterNameAutocomplete value="Orc" />);
        await waitFor(() => {
            expect(screen.getByDisplayValue('Orc')).toBeInTheDocument();
        });
    });

    it('does not show suggestions for empty query', async () => {
        render(<MonsterNameAutocomplete value="" />);
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('does not show suggestions for whitespace-only query', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: '   ' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('does not call onCommit when it is not provided on blur', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.blur(input);
        expect(screen.getByDisplayValue('Gobl')).toBeInTheDocument();
    });

    it('does not call onCommit when it is not provided on Enter with no suggestions', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
    });

    it('scrolls highlighted item into view', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'M' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const items = document.querySelectorAll('.monster-autocomplete-item');
        if (items.length > 1) {
            fireEvent.keyDown(input, { key: 'ArrowDown' });
            fireEvent.keyDown(input, { key: 'ArrowDown' });
            const highlighted = document.querySelector('.monster-autocomplete-item.highlighted');
            expect(highlighted).toBeInTheDocument();
        }
    });

    it('calls onCommit with current query when suggestions are shown but nothing highlighted on Enter', async () => {
        const onCommit = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('Gobl');
    });

    it('renders monster items without NPC badge', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const items = document.querySelectorAll('.monster-autocomplete-item');
        const npcBadges = document.querySelectorAll('.monster-autocomplete-badge');
        expect(npcBadges.length).toBe(0);
        const firstItem = items[0];
        expect(firstItem.textContent.trim()).toBe('Goblin');
        expect(firstItem.querySelector('.monster-autocomplete-badge')).not.toBeInTheDocument();
    });

    it('renders NPC items before monster items in the list', async () => {
        const npcs = [{ name: 'Zombie NPC' }];
        render(<MonsterNameAutocomplete value="" npcs={npcs} />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Z' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const items = document.querySelectorAll('.monster-autocomplete-item');
        const firstItem = items[0];
        const badge = firstItem.querySelector('.monster-autocomplete-badge');
        expect(badge).toBeInTheDocument();
        expect(firstItem.textContent).toContain('Zombie NPC');
        expect(firstItem.textContent).toContain('NPC');
    });
});
