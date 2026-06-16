import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ItemsPanel from './ItemsPanel.jsx';

describe('ItemsPanel', () => {
    it('should return null when itemsPanelOpen is false', () => {
        const { container } = render(
            <ItemsPanel itemsPanelOpen={false} onClose={() => {}} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('should render when itemsPanelOpen is true', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        expect(screen.queryByRole('button')).toBeInTheDocument();
    });

    it('should render the close button with Font Awesome icon', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const closeBtn = screen.getByRole('button');
        expect(closeBtn).toHaveClass('items-panel-close');
        const icon = closeBtn.querySelector('i');
        expect(icon).toHaveClass('fa-solid');
        expect(icon).toHaveClass('fa-times');
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <ItemsPanel itemsPanelOpen onClose={onClose} />
        );
        const closeBtn = screen.getByRole('button');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should render indoor items by default', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        expect(screen.getByText('Altar')).toBeInTheDocument();
        expect(screen.getByText('Arrow Slit Wall')).toBeInTheDocument();
        expect(screen.getByText('Barrel')).toBeInTheDocument();
        expect(screen.getByText('Bed')).toBeInTheDocument();
        expect(screen.getByText('Bookshelf')).toBeInTheDocument();
        expect(screen.getByText('Chair')).toBeInTheDocument();
        expect(screen.getByText('Treasure Chest')).toBeInTheDocument();
        expect(screen.getByText('Crate')).toBeInTheDocument();
        expect(screen.getByText('Door')).toBeInTheDocument();
        expect(screen.getByText('Fire Pit')).toBeInTheDocument();
        expect(screen.getByText('Fountain')).toBeInTheDocument();
        expect(screen.getByText('Pillar')).toBeInTheDocument();
        expect(screen.getByText('Secret Door')).toBeInTheDocument();
        expect(screen.getByText('Stairs')).toBeInTheDocument();
        expect(screen.getByText('Statue')).toBeInTheDocument();
        expect(screen.getByText('Table')).toBeInTheDocument();
        expect(screen.getByText('Torch')).toBeInTheDocument();
        expect(screen.getByText('Trap')).toBeInTheDocument();
        expect(screen.getByText('Spider Web')).toBeInTheDocument();
    });

    it('should render outdoor items when mapVariant is outdoor', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} mapVariant="outdoor" />
        );
        expect(screen.getByText('Barrel')).toBeInTheDocument();
        expect(screen.getByText('Boulder')).toBeInTheDocument();
        expect(screen.getByText('Bush')).toBeInTheDocument();
        expect(screen.getByText('Crate')).toBeInTheDocument();
        expect(screen.getByText('Fire Pit')).toBeInTheDocument();
        expect(screen.getByText('Torch')).toBeInTheDocument();
        expect(screen.getByText('Tree')).toBeInTheDocument();
    });

    it('should not render indoor-only items when mapVariant is outdoor', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} mapVariant="outdoor" />
        );
        expect(screen.queryByText('Altar')).not.toBeInTheDocument();
        expect(screen.queryByText('Arrow Slit Wall')).not.toBeInTheDocument();
        expect(screen.queryByText('Bed')).not.toBeInTheDocument();
        expect(screen.queryByText('Bookshelf')).not.toBeInTheDocument();
        expect(screen.queryByText('Chair')).not.toBeInTheDocument();
        expect(screen.queryByText('Treasure Chest')).not.toBeInTheDocument();
        expect(screen.queryByText('Door')).not.toBeInTheDocument();
        expect(screen.queryByText('Fountain')).not.toBeInTheDocument();
        expect(screen.queryByText('Pillar')).not.toBeInTheDocument();
        expect(screen.queryByText('Secret Door')).not.toBeInTheDocument();
        expect(screen.queryByText('Stairs')).not.toBeInTheDocument();
        expect(screen.queryByText('Statue')).not.toBeInTheDocument();
        expect(screen.queryByText('Table')).not.toBeInTheDocument();
        expect(screen.queryByText('Trap')).not.toBeInTheDocument();
        expect(screen.queryByText('Spider Web')).not.toBeInTheDocument();
    });

    it('should not render outdoor-only items when mapVariant is indoor', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} mapVariant="indoor" />
        );
        expect(screen.queryByText('Boulder')).not.toBeInTheDocument();
        expect(screen.queryByText('Bush')).not.toBeInTheDocument();
        expect(screen.queryByText('Tree')).not.toBeInTheDocument();
    });

    it('should render NPC item', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        expect(screen.getByText('NPC')).toBeInTheDocument();
    });

    it('should render draggable items with correct data type', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const altarItem = screen.getByText('Altar').closest('[draggable]');
        expect(altarItem).toHaveAttribute('draggable', 'true');

        const barrelItem = screen.getByText('Barrel').closest('[draggable]');
        expect(barrelItem).toHaveAttribute('draggable', 'true');

        const npcItem = screen.getByText('NPC').closest('[draggable]');
        expect(npcItem).toHaveAttribute('draggable', 'true');
    });

    it('should trigger onDragStart and set dataTransfer', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const npcItem = screen.getByText('NPC').closest('[draggable]');
        const setDataSpy = vi.fn();
        const setDragImageSpy = vi.fn();
        const mockDataTransfer = {
            setData: setDataSpy,
            setDragImage: setDragImageSpy,
        };
        Object.defineProperty(npcItem, 'draggable', { value: true });
        npcItem.addEventListener('dragstart', (e) => {
            e.dataTransfer = mockDataTransfer;
        });
        fireEvent.dragStart(npcItem);
        expect(setDataSpy).toHaveBeenCalledWith('text/plain', 'npc');
    });

    it('should render characters section when missingChars exist', () => {
        const characters = [
            { name: 'Thorin', imagePath: '/images/thorin.png' },
            { name: 'Eldara' },
        ];
        const players = [{ name: 'Player1' }];
        render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        expect(screen.getByText('Characters')).toBeInTheDocument();
        expect(screen.getByText('Thorin')).toBeInTheDocument();
        expect(screen.getByText('Eldara')).toBeInTheDocument();
    });

    it('should not render characters section when all characters are players', () => {
        const characters = [
            { name: 'Thorin' },
            { name: 'Eldara' },
        ];
        const players = [
            { name: 'Thorin' },
            { name: 'Eldara' },
        ];
        const { container } = render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        expect(screen.queryByText('Characters')).not.toBeInTheDocument();
        expect(container.querySelector('.items-panel-section')).toBeNull();
    });

    it('should render character image when imagePath is provided', () => {
        const characters = [{ name: 'Thorin', imagePath: '/images/thorin.png' }];
        const players = [];
        render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        const img = screen.getByAltText('Thorin');
        expect(img).toHaveAttribute('src', '/images/thorin.png');
    });

    it('should render character initial when no imagePath is provided', () => {
        const characters = [{ name: 'Eldara' }];
        const players = [];
        render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        const initial = screen.getByText('E');
        expect(initial).toHaveClass('items-panel-char-initial');
    });

    it('should render character as draggable', () => {
        const characters = [{ name: 'Thorin' }];
        const players = [];
        render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        const charItem = screen.getByText('Thorin').closest('[draggable]');
        expect(charItem).toHaveAttribute('draggable', 'true');
        expect(charItem).toHaveClass('items-panel-item');
        expect(charItem).toHaveClass('items-panel-char');
    });

    it('should filter characters not in players list', () => {
        const characters = [
            { name: 'Thorin' },
            { name: 'Eldara' },
            { name: 'Grimjaw' },
        ];
        const players = [{ name: 'Thorin' }];
        const { container } = render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        const charItems = container.querySelectorAll('.items-panel-char');
        const names = Array.from(charItems).map(item => {
            const spans = item.querySelectorAll('span');
            return spans.length > 1 ? spans[1].textContent : (spans[0] ? spans[0].textContent : '');
        });
        expect(names).not.toContain('Thorin');
        expect(names).toContain('Eldara');
        expect(names).toContain('Grimjaw');
    });

    it('should render items-panel wrapper with correct class', () => {
        const { container } = render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const panel = container.querySelector('.items-panel');
        expect(panel).not.toBeNull();
    });

    it('should render items-panel-content wrapper', () => {
        const { container } = render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const content = container.querySelector('.items-panel-content');
        expect(content).not.toBeNull();
    });

    it('should render items-panel-section for characters', () => {
        const characters = [{ name: 'Thorin' }];
        const players = [];
        const { container } = render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
            />
        );
        const section = container.querySelector('.items-panel-section');
        expect(section).not.toBeNull();
        expect(section.querySelector('.items-panel-section-title')).toHaveTextContent('Characters');
    });

    it('should render correct number of indoor items', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const indoorItems = [
            'Altar', 'Arrow Slit Wall', 'Barrel', 'Bed', 'Bookshelf',
            'Chair', 'Treasure Chest', 'Crate', 'Door', 'Fire Pit',
            'Fountain', 'Pillar', 'Secret Door', 'Stairs', 'Statue',
            'Table', 'Torch', 'Trap', 'Spider Web',
        ];
        indoorItems.forEach(label => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    it('should render correct number of outdoor items', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} mapVariant="outdoor" />
        );
        const outdoorItems = [
            'Barrel', 'Boulder', 'Bush', 'Crate', 'Fire Pit', 'Torch', 'Tree',
        ];
        outdoorItems.forEach(label => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    it('should render SVG elements inside each item', () => {
        render(
            <ItemsPanel itemsPanelOpen onClose={() => {}} />
        );
        const itemElements = document.querySelectorAll('.items-panel-item svg');
        expect(itemElements.length).toBeGreaterThan(0);
    });

    it('should render character SVG circle avatar for missing chars in outdoor mode', () => {
        const characters = [{ name: 'Thorin', imagePath: '/images/thorin.png' }];
        const players = [];
        render(
            <ItemsPanel
                itemsPanelOpen
                onClose={() => {}}
                characters={characters}
                players={players}
                mapVariant="outdoor"
            />
        );
        const charItem = screen.getByText('Thorin').closest('.items-panel-char');
        expect(charItem).not.toBeNull();
        const img = charItem.querySelector('.items-panel-char-img');
        expect(img).toHaveAttribute('src', '/images/thorin.png');
    });
});
