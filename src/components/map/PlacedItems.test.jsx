import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlacedItems from './PlacedItems.jsx';
import { CELL_SIZE } from '../../config/mapConfig.js';

const makeItem = (overrides = {}) => ({
    id: 'item-1',
    type: 'barrel',
    gridX: 2,
    gridY: 3,
    visible: true,
    ...overrides,
});

const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

const renderComponent = (props, placedItems = []) =>
    render(
        <svg width={1200} height={800}>
            <PlacedItems
                placedItems={placedItems}
                isLocalhost={true}
                fog={undefined}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                setSelectedItem={vi.fn()}
                npcImages={{}}
                itemDragging={undefined}
                handleItemPointerDown={vi.fn()}
                {...props}
            />
        </svg>
    );

describe('PlacedItems', () => {
    it('should render no items when placedItems is empty', () => {
        const { container } = renderComponent([], []);
        const groups = container.querySelectorAll('g.placed-item, g.npc-group');
        expect(groups.length).toBe(0);
    });

    it('should render a barrel item', () => {
        const barrel = makeItem({ type: 'barrel' });
        const { container } = renderComponent([], [barrel]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        const barrelGroup = groups[0];
        expect(barrelGroup.querySelector('use[href="#barrel"]')).not.toBeNull();
    });

    it('should render a table item', () => {
        const table = makeItem({ type: 'table' });
        const { container } = renderComponent([], [table]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#table"]')).not.toBeNull();
    });

    it('should render a table with rotation=90', () => {
        const table = makeItem({ type: 'table', rotation: 90 });
        const { container } = renderComponent([], [table]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        const useEl = groups[0].querySelector('use[href="#table"]');
        expect(useEl.getAttribute('transform')).toContain('rotate(90');
    });

    it('should render a bed item', () => {
        const bed = makeItem({ type: 'bed' });
        const { container } = renderComponent([], [bed]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#bed"]')).not.toBeNull();
    });

    it('should render a firepit item', () => {
        const firepit = makeItem({ type: 'firepit' });
        const { container } = renderComponent([], [firepit]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#firepit"]')).not.toBeNull();
    });

    it('should render a door item when closed', () => {
        const door = makeItem({ type: 'door', open: false });
        const { container } = renderComponent([], [door]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#door"]')).not.toBeNull();
    });

    it('should render a door item when open with 0 rotation', () => {
        const door = makeItem({ type: 'door', open: true, rotation: 0 });
        const { container } = renderComponent([], [door]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        // Open door at 0 rotation renders 2 rects instead of a door <use>
        const rects = groups[0].querySelectorAll('rect');
        expect(rects.length).toBeGreaterThan(0);
    });

    it('should render a secret door item', () => {
        const secretDoor = makeItem({ type: 'secretDoor' });
        const { container } = renderComponent([], [secretDoor]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#secretDoor"]')).not.toBeNull();
    });

    it('should render a trap item', () => {
        const trap = makeItem({ type: 'trap' });
        const { container } = renderComponent([], [trap]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#trap"]')).not.toBeNull();
    });

    it('should render a pillar item', () => {
        const pillar = makeItem({ type: 'pillar' });
        const { container } = renderComponent([], [pillar]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#pillar"]')).not.toBeNull();
    });

    it('should render stairs with rotation', () => {
        const stairs = makeItem({ type: 'stairs', rotation: 90 });
        const { container } = renderComponent([], [stairs]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        const useEl = groups[0].querySelector('use[href="#stairs"]');
        expect(useEl.getAttribute('transform')).toContain('rotate(90');
    });

    it('should render an altar item', () => {
        const altar = makeItem({ type: 'altar' });
        const { container } = renderComponent([], [altar]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#altar"]')).not.toBeNull();
    });

    it('should render an altar with rotation=90', () => {
        const altar = makeItem({ type: 'altar', rotation: 90 });
        const { container } = renderComponent([], [altar]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        const useEl = groups[0].querySelector('use[href="#altar"]');
        expect(useEl.getAttribute('transform')).toContain('rotate(90');
    });

    it('should render a bookshelf item', () => {
        const bookshelf = makeItem({ type: 'bookshelf' });
        const { container } = renderComponent([], [bookshelf]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#bookshelf"]')).not.toBeNull();
    });

    it('should render a chair item', () => {
        const chair = makeItem({ type: 'chair' });
        const { container } = renderComponent([], [chair]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#chair"]')).not.toBeNull();
    });

    it('should render a chest item', () => {
        const chest = makeItem({ type: 'chest' });
        const { container } = renderComponent([], [chest]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#chest"]')).not.toBeNull();
    });

    it('should render a crate item', () => {
        const crate = makeItem({ type: 'crate' });
        const { container } = renderComponent([], [crate]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#crate"]')).not.toBeNull();
    });

    it('should render a fountain item', () => {
        const fountain = makeItem({ type: 'fountain' });
        const { container } = renderComponent([], [fountain]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#fountain"]')).not.toBeNull();
    });

    it('should render a skeleton item', () => {
        const skeleton = makeItem({ type: 'skeleton' });
        const { container } = renderComponent([], [skeleton]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#skeleton"]')).not.toBeNull();
    });

    it('should render a statue item', () => {
        const statue = makeItem({ type: 'statue' });
        const { container } = renderComponent([], [statue]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#statue"]')).not.toBeNull();
    });

    it('should render a torch item', () => {
        const torch = makeItem({ type: 'torch' });
        const { container } = renderComponent([], [torch]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#torch"]')).not.toBeNull();
    });

    it('should render a web item', () => {
        const web = makeItem({ type: 'web' });
        const { container } = renderComponent([], [web]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#web"]')).not.toBeNull();
    });

    it('should render an arrowSlitWall item', () => {
        const arrowSlitWall = makeItem({ type: 'arrowSlitWall' });
        const { container } = renderComponent([], [arrowSlitWall]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#arrowSlitWall"]')).not.toBeNull();
    });

    it('should render a tree item', () => {
        const tree = makeItem({ type: 'tree' });
        const { container } = renderComponent([], [tree]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#tree"]')).not.toBeNull();
    });

    it('should render a boulder item', () => {
        const boulder = makeItem({ type: 'boulder' });
        const { container } = renderComponent([], [boulder]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#boulder"]')).not.toBeNull();
    });

    it('should render a bush item', () => {
        const bush = makeItem({ type: 'bush' });
        const { container } = renderComponent([], [bush]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#bush"]')).not.toBeNull();
    });

    it('should render an NPC item with initial', () => {
        const npc = makeItem({ type: 'npc', name: 'Gandalf' });
        const { container } = renderComponent([], [npc]);
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups.length).toBe(1);
        const npcGroup = groups[0];
        expect(npcGroup.querySelector('text.npc-initial')).not.toBeNull();
        expect(npcGroup.querySelector('text.npc-initial').textContent).toBe('G');
    });

    it('should render an NPC item with name text', () => {
        const npc = makeItem({ type: 'npc', name: 'Gandalf' });
        const { container } = renderComponent([], [npc]);
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups.length).toBe(1);
        const npcGroup = groups[0];
        expect(npcGroup.querySelector('text.npc-name')).not.toBeNull();
        expect(npcGroup.querySelector('text.npc-name').textContent).toBe('Gandalf');
    });

    it('should render an NPC item with image when imageUrl is provided', () => {
        const npc = makeItem({ type: 'npc', name: 'Gandalf', imageUrl: 'https://example.com/gandalf.png' });
        const { container } = renderComponent([], [npc]);
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups.length).toBe(1);
        const npcGroup = groups[0];
        expect(npcGroup.querySelector('image.creature-image')).not.toBeNull();
    });

    it('should render an NPC item with image when npcImages has the name', () => {
        const npc = makeItem({ type: 'npc', name: 'Gandalf' });
        const npcImages = { Gandalf: 'https://example.com/gandalf.png' };
        const { container } = renderComponent({ npcImages }, [npc]);
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups.length).toBe(1);
        const npcGroup = groups[0];
        expect(npcGroup.querySelector('image.creature-image')).not.toBeNull();
    });

    it('should render NPC clipPath with correct id', () => {
        const npc = makeItem({ type: 'npc', id: 'npc-42', name: 'Gandalf' });
        const { container } = renderComponent([], [npc]);
        const clipPath = container.querySelector('clipPath[id="npc-clip-npc-42"]');
        expect(clipPath).not.toBeNull();
    });

    it('should render hit area rects on placed items when isLocalhost is true', () => {
        const items = [
            makeItem({ type: 'barrel' }),
            makeItem({ type: 'table' }),
            makeItem({ type: 'bed' }),
            makeItem({ type: 'door', open: false }),
            makeItem({ type: 'secretDoor' }),
            makeItem({ type: 'trap' }),
            makeItem({ type: 'pillar' }),
            makeItem({ type: 'stairs' }),
            makeItem({ type: 'altar' }),
            makeItem({ type: 'bookshelf' }),
            makeItem({ type: 'chair' }),
            makeItem({ type: 'chest' }),
            makeItem({ type: 'crate' }),
            makeItem({ type: 'firepit' }),
            makeItem({ type: 'fountain' }),
            makeItem({ type: 'skeleton' }),
            makeItem({ type: 'statue' }),
            makeItem({ type: 'torch' }),
            makeItem({ type: 'web' }),
            makeItem({ type: 'arrowSlitWall' }),
            makeItem({ type: 'tree' }),
            makeItem({ type: 'boulder' }),
            makeItem({ type: 'bush' }),
        ];
        const { container } = renderComponent([], items);
        const hitAreas = container.querySelectorAll('rect.item-hit-area');
        // NPC items use a transparent rect instead of item-hit-area class, so 22 not 23
        expect(hitAreas.length).toBe(items.length - 1);
    });

    it('should render hit area circles on barrel items when isLocalhost is true', () => {
        const barrel = makeItem({ type: 'barrel' });
        const npc = makeItem({ type: 'npc', name: 'Gandalf' });
        const { container } = renderComponent([], [barrel, npc]);
        const hitCircles = container.querySelectorAll('circle.item-hit-area');
        expect(hitCircles.length).toBe(1);
    });

    it('should not render hit areas when isLocalhost is false', () => {
        const items = [
            makeItem({ type: 'barrel' }),
            makeItem({ type: 'table' }),
            makeItem({ type: 'npc', name: 'Gandalf' }),
        ];
        const { container } = renderComponent({ isLocalhost: false }, items);
        const hitAreas = container.querySelectorAll('rect.item-hit-area, circle.item-hit-area');
        expect(hitAreas.length).toBe(0);
    });

    it('should not render any items when isLocalhost is false and items are not visible', () => {
        const items = [
            makeItem({ type: 'barrel', visible: false }),
            makeItem({ type: 'table', visible: false }),
        ];
        const { container } = renderComponent({ isLocalhost: false }, items);
        const groups = container.querySelectorAll('g.placed-item, g.npc-group');
        expect(groups.length).toBe(0);
    });

    it('should not render items hidden by fog when isLocalhost is false', () => {
        const items = [
            makeItem({ type: 'barrel', gridX: 1, gridY: 1 }),
            makeItem({ type: 'table', gridX: 2, gridY: 2 }),
        ];
        const fog = new Set(['1,1']);
        const { container } = renderComponent({ isLocalhost: false, fog }, items);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
    });

    it('should render barrel item even when fog covers its grid when isLocalhost is true', () => {
        const barrel = makeItem({ type: 'barrel', visible: false });
        const fog = new Set(['2,3']);
        const { container } = renderComponent({ isLocalhost: true, fog }, [barrel]);
        // isLocalhost=true means fog is not checked; item still renders (opacity 0.5 since visible=false)
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
    });

    it('should set opacity 0.5 for non-visible items when isLocalhost is true', () => {
        const barrel = makeItem({ type: 'barrel', visible: false });
        const { container } = renderComponent([], [barrel]);
        const useEl = container.querySelector('use[href="#barrel"]');
        expect(useEl.getAttribute('opacity')).toBe('0.5');
    });

    it('should set opacity 1 for visible items when isLocalhost is true', () => {
        const barrel = makeItem({ type: 'barrel', visible: true });
        const { container } = renderComponent([], [barrel]);
        const useEl = container.querySelector('use[href="#barrel"]');
        expect(useEl.getAttribute('opacity')).toBe('1');
    });

    it('should set opacity 1 for items when isLocalhost is false', () => {
        const barrel = makeItem({ type: 'barrel' });
        const { container } = renderComponent({ isLocalhost: false }, [barrel]);
        const useEl = container.querySelector('use[href="#barrel"]');
        expect(useEl.getAttribute('opacity')).toBe('1');
    });

    it('should call setSelectedItem on context menu for barrel', () => {
        const barrel = makeItem({ type: 'barrel' });
        const setSelectedItem = vi.fn();
        const { container } = renderComponent({ setSelectedItem }, [barrel]);
        const hitArea = container.querySelector('circle.item-hit-area');
        hitArea.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        expect(setSelectedItem).toHaveBeenCalledWith({ id: 'item-1', gridX: 2, gridY: 3 });
    });

    it('should call setSelectedItem on context menu for table', () => {
        const table = makeItem({ type: 'table' });
        const setSelectedItem = vi.fn();
        const { container } = renderComponent({ setSelectedItem }, [table]);
        const hitArea = container.querySelector('rect.item-hit-area');
        hitArea.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        expect(setSelectedItem).toHaveBeenCalledWith({ id: 'item-1', gridX: 2, gridY: 3 });
    });

    it('should call setSelectedItem on context menu for NPC', () => {
        const npc = makeItem({ type: 'npc', name: 'Gandalf' });
        const setSelectedItem = vi.fn();
        const { container } = renderComponent({ setSelectedItem }, [npc]);
        // The NPC group uses a transparent rect for the hit area
        const npcGroup = container.querySelector('g.npc-group');
        const transparentRects = npcGroup.querySelectorAll('rect[fill="transparent"]');
        transparentRects[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        expect(setSelectedItem).toHaveBeenCalledWith({ id: 'item-1', gridX: 2, gridY: 3 });
    });

    it('should render reposition highlight when item is being dragged', () => {
        const barrel = makeItem({ type: 'barrel' });
        const itemDragging = { itemId: 'item-1' };
        const { container } = renderComponent({ itemDragging }, [barrel]);
        const highlights = container.querySelectorAll('circle.reposition-highlight');
        expect(highlights.length).toBe(1);
    });

    it('should render reposition highlight rect for table when being dragged', () => {
        const table = makeItem({ type: 'table' });
        const itemDragging = { itemId: 'item-1' };
        const { container } = renderComponent({ itemDragging }, [table]);
        const highlights = container.querySelectorAll('rect.reposition-highlight');
        expect(highlights.length).toBe(1);
    });

    it('should not render reposition highlight when item is not being dragged', () => {
        const barrel = makeItem({ type: 'barrel' });
        const { container } = renderComponent({ itemDragging: { itemId: 'other-id' } }, [barrel]);
        const highlights = container.querySelectorAll('circle.reposition-highlight, rect.reposition-highlight');
        expect(highlights.length).toBe(0);
    });

    it('should render multiple items of different types', () => {
        const items = [
            makeItem({ type: 'barrel', id: 'b1' }),
            makeItem({ type: 'table', id: 't1' }),
            makeItem({ type: 'chair', id: 'c1' }),
        ];
        const { container } = renderComponent([], items);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(3);
    });

    it('should render multiple NPC items', () => {
        const npcs = [
            makeItem({ type: 'npc', id: 'npc1', name: 'Gandalf' }),
            makeItem({ type: 'npc', id: 'npc2', name: 'Frodo' }),
        ];
        const { container } = renderComponent([], npcs);
        const groups = container.querySelectorAll('g.npc-group');
        expect(groups.length).toBe(2);
    });

    it('should render NPC with correct circle radius', () => {
        const npc = makeItem({ type: 'npc', id: 'npc1', name: 'Gandalf' });
        const { container } = renderComponent([], [npc]);
        const npcCircle = container.querySelector('circle.npc-circle');
        expect(npcCircle.getAttribute('r')).toBe('20');
    });

    it('should render door with rotation transform when closed', () => {
        const door = makeItem({ type: 'door', open: false, rotation: 90 });
        const { container } = renderComponent([], [door]);
        const groups = container.querySelectorAll('g.placed-item');
        const useEl = groups[0].querySelector('use[href="#door"]');
        expect(useEl.getAttribute('transform')).toContain('rotate(90');
    });

    it('should render open door at 90 rotation with vertical rects', () => {
        const door = makeItem({ type: 'door', open: true, rotation: 90 });
        const { container } = renderComponent([], [door]);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        const rects = groups[0].querySelectorAll('rect');
        // Open door at 90 rotation renders 2 door rects + 1 hit area rect
        expect(rects.length).toBe(3);
    });

    it('should render open door at 0 rotation with horizontal rects', () => {
        const door = makeItem({ type: 'door', open: true, rotation: 0 });
        const { container } = renderComponent([], [door]);
        const groups = container.querySelectorAll('g.placed-item');
        const rects = groups[0].querySelectorAll('rect');
        // Open door at 0 rotation renders 2 door rects + 1 hit area rect
        expect(rects.length).toBe(3);
    });

    it('should render table with correct dimensions when not rotated', () => {
        const table = makeItem({ type: 'table' });
        const { container } = renderComponent([], [table]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('72');
        expect(hitArea.getAttribute('height')).toBe('36');
    });

    it('should render table with swapped dimensions when rotated 90', () => {
        const table = makeItem({ type: 'table', rotation: 90 });
        const { container } = renderComponent([], [table]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('36');
        expect(hitArea.getAttribute('height')).toBe('72');
    });

    it('should render bed with correct dimensions when not rotated', () => {
        const bed = makeItem({ type: 'bed' });
        const { container } = renderComponent([], [bed]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('72');
        expect(hitArea.getAttribute('height')).toBe('36');
    });

    it('should render bed with swapped dimensions when rotated 90', () => {
        const bed = makeItem({ type: 'bed', rotation: 90 });
        const { container } = renderComponent([], [bed]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('36');
        expect(hitArea.getAttribute('height')).toBe('72');
    });

    it('should render altar with correct dimensions when not rotated', () => {
        const altar = makeItem({ type: 'altar' });
        const { container } = renderComponent([], [altar]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('72');
        expect(hitArea.getAttribute('height')).toBe('36');
    });

    it('should render altar with swapped dimensions when rotated 90', () => {
        const altar = makeItem({ type: 'altar', rotation: 90 });
        const { container } = renderComponent([], [altar]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('36');
        expect(hitArea.getAttribute('height')).toBe('72');
    });

    it('should render bookshelf with correct dimensions when not rotated', () => {
        const bookshelf = makeItem({ type: 'bookshelf' });
        const { container } = renderComponent([], [bookshelf]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('72');
        expect(hitArea.getAttribute('height')).toBe('36');
    });

    it('should render bookshelf with swapped dimensions when rotated 90', () => {
        const bookshelf = makeItem({ type: 'bookshelf', rotation: 90 });
        const { container } = renderComponent([], [bookshelf]);
        const hitArea = container.querySelector('rect.item-hit-area');
        expect(hitArea.getAttribute('width')).toBe('36');
        expect(hitArea.getAttribute('height')).toBe('72');
    });

    it('should render all 23 item types by default', () => {
        const allTypes = [
            'altar', 'arrowSlitWall', 'barrel', 'bed', 'bookshelf', 'boulder',
            'bush', 'chair', 'chest', 'crate', 'door', 'firepit', 'fountain',
            'npc', 'pillar', 'secretDoor', 'skeleton', 'stairs', 'statue',
            'table', 'torch', 'trap', 'tree', 'web',
        ];
        const items = allTypes.map((type, i) => makeItem({ type, id: `item-${i}` }));
        // Override NPC name
        items[13] = makeItem({ type: 'npc', id: 'npc-0', name: 'Test' });
        const { container } = renderComponent([], items);
        const placedGroups = container.querySelectorAll('g.placed-item');
        const npcGroups = container.querySelectorAll('g.npc-group');
        expect(placedGroups.length + npcGroups.length).toBe(allTypes.length);
    });

    it('should apply correct SVG class to placed items', () => {
        const barrel = makeItem({ type: 'barrel' });
        const { container } = renderComponent([], [barrel]);
        const barrelGroup = container.querySelector('g.placed-item');
        expect(barrelGroup.classList.contains('placed-item')).toBe(true);
    });

    it('should apply npc-group class to NPC items', () => {
        const npc = makeItem({ type: 'npc', name: 'Gandalf' });
        const { container } = renderComponent([], [npc]);
        const npcGroup = container.querySelector('g.npc-group');
        expect(npcGroup.classList.contains('npc-group')).toBe(true);
    });

    it('should render hit area with cursor grab style', () => {
        const barrel = makeItem({ type: 'barrel' });
        const { container } = renderComponent([], [barrel]);
        const hitArea = container.querySelector('circle.item-hit-area');
        expect(hitArea.getAttribute('style')).toContain('cursor: grab');
    });

    it('should render hit areas with correct position for barrel', () => {
        const barrel = makeItem({ type: 'barrel' });
        const { container } = renderComponent([], [barrel]);
        const hitArea = container.querySelector('circle.item-hit-area');
        const cx = gridCenterX(2);
        const cy = gridCenterY(3);
        expect(hitArea.getAttribute('cx')).toBe(String(cx));
        expect(hitArea.getAttribute('cy')).toBe(String(cy));
    });

    it('should render fog correctly when fog is a Set', () => {
        const items = [
            makeItem({ type: 'barrel', gridX: 1, gridY: 1 }),
            makeItem({ type: 'table', gridX: 2, gridY: 2 }),
        ];
        const fog = new Set(['1,1']);
        const { container } = renderComponent({ isLocalhost: false, fog }, items);
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(1);
        expect(groups[0].querySelector('use[href="#table"]')).not.toBeNull();
    });

    it('should not filter by fog when isLocalhost is true', () => {
        const items = [
            makeItem({ type: 'barrel', gridX: 1, gridY: 1 }),
            makeItem({ type: 'table', gridX: 2, gridY: 2 }),
        ];
        const fog = new Set(['1,1', '2,2']);
        const { container } = renderComponent({ isLocalhost: true, fog }, items);
        // Both items should render because isLocalhost=true bypasses fog check
        const groups = container.querySelectorAll('g.placed-item');
        expect(groups.length).toBe(2);
    });
});
