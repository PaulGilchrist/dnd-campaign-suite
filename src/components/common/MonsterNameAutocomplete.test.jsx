/* @cleaned-by-ai */
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
        const { container } = render(<MonsterNameAutocomplete value="" onChange={onChange} />);
        const input = container.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        expect(onChange).toHaveBeenCalledWith('Gobl');
    });

    it('shows suggestions for matching queries and hides for no matches or empty input', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');

        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });

        fireEvent.change(input, { target: { value: 'zzzzzzzzzz' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });

        fireEvent.change(input, { target: { value: '' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).not.toBeInTheDocument();
        });
    });

    it('prioritizes started-with matches and limits results to 8', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');

        fireEvent.change(input, { target: { value: 'Anc' } });
        await waitFor(() => {
            const items = document.querySelectorAll('.monster-autocomplete-item');
            expect(items.length).toBeGreaterThan(0);
            expect(items[0].textContent.trim()).toContain('Ancient Dragon');
        });

        fireEvent.change(input, { target: { value: 'A' } });
        await waitFor(() => {
            const items = document.querySelectorAll('.monster-autocomplete-item');
            expect(items.length).toBeLessThanOrEqual(8);
        });
    });

    it('highlights suggestions on arrow keys', async () => {
        render(<MonsterNameAutocomplete value="" />);
        const input = document.querySelector('.monster-autocomplete-input');
        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(document.querySelector('.monster-autocomplete-item.highlighted')).toBeInTheDocument();

        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(document.querySelector('.monster-autocomplete-item.highlighted')).toBeInTheDocument();
    });

    it('commits on Enter', async () => {
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

    it('commits query on blur', async () => {
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

    it('commits and calls onChange on mouse selection', async () => {
        const onCommit = vi.fn();
        const onChange = vi.fn();
        render(<MonsterNameAutocomplete value="" onCommit={onCommit} onChange={onChange} />);
        const input = document.querySelector('.monster-autocomplete-input');

        fireEvent.change(input, { target: { value: 'Gobl' } });
        await waitFor(() => {
            const list = document.querySelector('.monster-autocomplete-list');
            expect(list).toBeInTheDocument();
        });
        const item = document.querySelector('.monster-autocomplete-item');
        fireEvent.mouseDown(item);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        expect(onChange).toHaveBeenCalledWith('Goblin');
        expect(onCommit).toHaveBeenCalledWith('Goblin');
    });

    it('hides suggestions on clicking outside', async () => {
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

    it('applies fixed positioning class when position prop is provided', () => {
        const { container } = render(
            <MonsterNameAutocomplete value="" position={{ top: 10, left: 20 }} />
        );
        const wrapper = container.querySelector('.monster-autocomplete');
        expect(wrapper).toHaveClass('monster-autocomplete-fixed');
    });

    it('updates input when value prop changes externally', async () => {
        const { rerender } = render(<MonsterNameAutocomplete value="Goblin" />);
        expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
        rerender(<MonsterNameAutocomplete value="Orc" />);
        await waitFor(() => {
            expect(screen.getByDisplayValue('Orc')).toBeInTheDocument();
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
});
