import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

describe('PlacedItems - Fog of war hiding', () => {
  describe('fog hides non-localhost items', () => {
    it('hides barrel when fog covers the cell', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });

    it('shows barrel when fog does not cover the cell', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['1,1', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('hides table when fog covers the cell', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#table"]')).toBeNull();
    });

    it('hides bed when fog covers the cell', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#bed"]')).toBeNull();
    });

    it('hides altar when fog covers the cell', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#altar"]')).toBeNull();
    });

    it('hides bookshelf when fog covers the cell', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#bookshelf"]')).toBeNull();
    });

    it('hides door when fog covers the cell', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#door"]')).toBeNull();
    });

    it('hides secret door when fog covers the cell', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#secretDoor"]')).toBeNull();
    });

    it('hides firepit when fog covers the cell', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#firepit"]')).toBeNull();
    });

    it('hides trap when fog covers the cell', () => {
      const items = [{ id: 'trap-1', type: 'trap', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#trap"]')).toBeNull();
    });

    it('hides pillar when fog covers the cell', () => {
      const items = [{ id: 'pillar-1', type: 'pillar', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#pillar"]')).toBeNull();
    });

    it('hides stairs when fog covers the cell', () => {
      const items = [{ id: 'stairs-1', type: 'stairs', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#stairs"]')).toBeNull();
    });

    it('hides chair when fog covers the cell', () => {
      const items = [{ id: 'chair-1', type: 'chair', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#chair"]')).toBeNull();
    });

    it('hides chest when fog covers the cell', () => {
      const items = [{ id: 'chest-1', type: 'chest', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#chest"]')).toBeNull();
    });

    it('hides crate when fog covers the cell', () => {
      const items = [{ id: 'crate-1', type: 'crate', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#crate"]')).toBeNull();
    });

    it('hides fountain when fog covers the cell', () => {
      const items = [{ id: 'fountain-1', type: 'fountain', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#fountain"]')).toBeNull();
    });

    it('hides skeleton when fog covers the cell', () => {
      const items = [{ id: 'skeleton-1', type: 'skeleton', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#skeleton"]')).toBeNull();
    });

    it('hides statue when fog covers the cell', () => {
      const items = [{ id: 'statue-1', type: 'statue', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#statue"]')).toBeNull();
    });

    it('hides torch when fog covers the cell', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#torch"]')).toBeNull();
    });

    it('hides web when fog covers the cell', () => {
      const items = [{ id: 'web-1', type: 'web', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#web"]')).toBeNull();
    });

    it('hides arrowSlitWall when fog covers the cell', () => {
      const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#arrowSlitWall"]')).toBeNull();
    });

    it('hides tree when fog covers the cell', () => {
      const items = [{ id: 'tree-1', type: 'tree', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#tree"]')).toBeNull();
    });

    it('hides boulder when fog covers the cell', () => {
      const items = [{ id: 'boulder-1', type: 'boulder', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#boulder"]')).toBeNull();
    });

    it('hides bush when fog covers the cell', () => {
      const items = [{ id: 'bush-1', type: 'bush', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#bush"]')).toBeNull();
    });

    it('hides NPC when fog covers the cell', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('circle[class="npc-circle"]')).toBeNull();
    });
  });

  describe('fog does not affect localhost', () => {
    it('shows barrel on localhost even when fog covers the cell', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} fog={fog} />);
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });

    it('shows NPC on localhost even when fog covers the cell', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} fog={fog} />);
      expect(container.querySelector('circle[class="npc-circle"]')).toBeInTheDocument();
    });

    it('shows door on localhost even when fog covers the cell', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} fog={fog} />);
      expect(container.querySelector('use[href="#door"]')).toBeInTheDocument();
    });
  });

  describe('fog with visible=false', () => {
    it('hides non-localhost item when both visible=false and fog covers cell', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: false }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });

    it('shows localhost invisible item at 0.5 opacity even when fog covers cell', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: false }];
      const fog = new Map([['0,0', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} fog={fog} />);
      const useEl = container.querySelector('use[href="#barrel"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('opacity', '0.5');
    });
  });

  describe('fog with different grid positions', () => {
    it('hides item at specific grid coordinates when fog matches', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 5, gridY: 3, visible: true }];
      const fog = new Map([['5,3', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#barrel"]')).toBeNull();
    });

    it('shows item when fog covers different coordinates', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 5, gridY: 3, visible: true }];
      const fog = new Map([['1,1', true]]);
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} fog={fog} />);
      expect(container.querySelector('use[href="#barrel"]')).toBeInTheDocument();
    });
  });
});
