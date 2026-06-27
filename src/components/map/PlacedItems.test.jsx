import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

describe('PlacedItems - SVG attributes and element structure', () => {
  describe('barrel SVG attributes', () => {
    it('renders barrel with correct use element attributes', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#barrel"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('x', '7');
      expect(useEl).toHaveAttribute('y', '7');
      expect(useEl).toHaveAttribute('opacity', '1');
    });

    it('renders barrel hit area as circle on localhost', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const circles = container.querySelectorAll('circle[class="item-hit-area"]');
      expect(circles.length).toBe(1);
      expect(circles[0]).toHaveAttribute('cx', '25');
      expect(circles[0]).toHaveAttribute('cy', '25');
      expect(circles[0]).toHaveAttribute('r', '20');
    });
  });

  describe('table SVG attributes and positioning', () => {
    it('renders table with horizontal positioning (not rotated)', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#table"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('x', '9');
      expect(useEl).toHaveAttribute('y', '7');
      expect(useEl).toHaveAttribute('opacity', '1');
    });

    it('renders table with vertical positioning (rotated 90)', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#table"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('x', '-11');
      expect(useEl).toHaveAttribute('y', '27');
      expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 45)');
    });

    it('renders table hit area as rectangle', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const rects = container.querySelectorAll('rect[class="item-hit-area"]');
      expect(rects.length).toBe(1);
    });
  });

  describe('bed SVG attributes and positioning', () => {
    it('renders bed with horizontal positioning (rotation 0)', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#bed"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders bed with vertical positioning (rotation 90)', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#bed"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 45)');
    });

    it('renders bed with custom rotation value', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 1, gridY: 1, visible: true, rotation: 45 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#bed"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('transform', 'rotate(45, 95, 75)');
    });
  });

  describe('altar SVG attributes and positioning', () => {
    it('renders altar with horizontal positioning (rotation 0)', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#altar"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders altar with vertical positioning (rotation 90)', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#altar"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 45)');
    });
  });

  describe('bookshelf SVG attributes and positioning', () => {
    it('renders bookshelf with horizontal positioning (rotation 0)', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#bookshelf"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders bookshelf with vertical positioning (rotation 90)', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#bookshelf"]');
      expect(useEl).toBeInTheDocument();
      expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 45)');
    });
  });

  describe('door SVG attributes', () => {
    it('renders closed door with use element', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#door"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders closed door with rotation', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#door"]');
      expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 25)');
    });

    it('renders open door with horizontal orientation (rotation 0)', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true, open: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
      expect(rects.length).toBe(2);
      expect(container.querySelector('use[href="#door"]')).toBeNull();
    });

    it('renders open door with vertical orientation (rotation 90)', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true, open: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
      expect(rects.length).toBe(2);
      const rect1 = rects[0];
      expect(rect1).toHaveAttribute('x', '7');
      expect(rect1).toHaveAttribute('y', '7');
      expect(rect1).toHaveAttribute('width', '5');
      expect(rect1).toHaveAttribute('height', '36');
    });

    it('renders door hit area', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('rect[class="item-hit-area"]');
      expect(hitArea).toBeInTheDocument();
      expect(hitArea).toHaveAttribute('x', '7');
      expect(hitArea).toHaveAttribute('y', '7');
      expect(hitArea).toHaveAttribute('width', '36');
      expect(hitArea).toHaveAttribute('height', '36');
    });
  });

  describe('secret door SVG attributes', () => {
    it('renders secret door with use element', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#secretDoor"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders secret door with rotation', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true, rotation: 180 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#secretDoor"]');
      expect(useEl).toHaveAttribute('transform', 'rotate(180, 25, 25)');
    });
  });

  describe('firepit SVG attributes', () => {
    it('renders firepit with use element', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#firepit"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders firepit hit area as rectangle', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('rect[class="item-hit-area"]');
      expect(hitArea).toBeInTheDocument();
      expect(hitArea).toHaveAttribute('width', '36');
      expect(hitArea).toHaveAttribute('height', '36');
    });
  });

  describe('trap SVG attributes', () => {
    it('renders trap with use element', () => {
      const items = [{ id: 'trap-1', type: 'trap', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#trap"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('pillar SVG attributes', () => {
    it('renders pillar with use element', () => {
      const items = [{ id: 'pillar-1', type: 'pillar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#pillar"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('stairs SVG attributes', () => {
    it('renders stairs with use element', () => {
      const items = [{ id: 'stairs-1', type: 'stairs', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#stairs"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders stairs with rotation', () => {
      const items = [{ id: 'stairs-1', type: 'stairs', gridX: 0, gridY: 0, visible: true, rotation: 270 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#stairs"]');
      expect(useEl).toHaveAttribute('transform', 'rotate(270, 25, 25)');
    });
  });

  describe('chair SVG attributes', () => {
    it('renders chair with use element', () => {
      const items = [{ id: 'chair-1', type: 'chair', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#chair"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders chair with rotation', () => {
      const items = [{ id: 'chair-1', type: 'chair', gridX: 0, gridY: 0, visible: true, rotation: 180 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#chair"]');
      expect(useEl).toHaveAttribute('transform', 'rotate(180, 25, 25)');
    });
  });

  describe('chest SVG attributes', () => {
    it('renders chest with use element', () => {
      const items = [{ id: 'chest-1', type: 'chest', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#chest"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('crate SVG attributes', () => {
    it('renders crate with use element', () => {
      const items = [{ id: 'crate-1', type: 'crate', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#crate"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('fountain SVG attributes', () => {
    it('renders fountain with use element', () => {
      const items = [{ id: 'fountain-1', type: 'fountain', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#fountain"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('skeleton SVG attributes', () => {
    it('renders skeleton with use element', () => {
      const items = [{ id: 'skeleton-1', type: 'skeleton', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#skeleton"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('statue SVG attributes', () => {
    it('renders statue with use element', () => {
      const items = [{ id: 'statue-1', type: 'statue', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#statue"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('torch SVG attributes', () => {
    it('renders torch with use element', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#torch"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders torch with rotation', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true, rotation: 45 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#torch"]');
      expect(useEl).toHaveAttribute('transform', 'rotate(45, 25, 25)');
    });
  });

  describe('web SVG attributes', () => {
    it('renders web with use element', () => {
      const items = [{ id: 'web-1', type: 'web', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#web"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('arrowSlitWall SVG attributes', () => {
    it('renders arrowSlitWall with use element', () => {
      const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#arrowSlitWall"]');
      expect(useEl).toBeInTheDocument();
    });

    it('renders arrowSlitWall with rotation', () => {
      const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 0, gridY: 0, visible: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#arrowSlitWall"]');
      expect(useEl).toHaveAttribute('transform', 'rotate(90, 25, 25)');
    });
  });

  describe('tree SVG attributes', () => {
    it('renders tree with use element', () => {
      const items = [{ id: 'tree-1', type: 'tree', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#tree"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('boulder SVG attributes', () => {
    it('renders boulder with use element', () => {
      const items = [{ id: 'boulder-1', type: 'boulder', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#boulder"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('bush SVG attributes', () => {
    it('renders bush with use element', () => {
      const items = [{ id: 'bush-1', type: 'bush', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#bush"]');
      expect(useEl).toBeInTheDocument();
    });
  });

  describe('NPC detailed rendering', () => {
    it('renders NPC circle element', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const circles = container.querySelectorAll('circle[class="npc-circle"]');
      expect(circles.length).toBe(1);
    });

    it('renders NPC clipPath with correct id', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      const clipPath = container.querySelector('clipPath[id="npc-clip-npc-1"]');
      expect(clipPath).toBeInTheDocument();
      const clipCircle = clipPath.querySelector('circle');
      expect(clipCircle).toBeInTheDocument();
      expect(clipCircle).toHaveAttribute('cx', '25');
      expect(clipCircle).toHaveAttribute('cy', '25');
      expect(clipCircle).toHaveAttribute('r', '20');
    });

    it('renders NPC image when npcImages has entry', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{ Goblin: '/goblin.png' }} />);
      const images = container.querySelectorAll('image');
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute('xlink:href', '/goblin.png');
      expect(images[0]).toHaveAttribute('width', '36');
      expect(images[0]).toHaveAttribute('height', '36');
      expect(images[0]).toHaveAttribute('clip-path', 'url(#npc-clip-npc-1)');
    });

    it('renders NPC image when imageUrl is provided directly', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin', imageUrl: '/custom.png' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      const images = container.querySelectorAll('image');
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute('xlink:href', '/custom.png');
    });

    it('prefers npcImages over imageUrl when both are present', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin', imageUrl: '/custom.png' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{ Goblin: '/goblin.png' }} />);
      const images = container.querySelectorAll('image');
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute('xlink:href', '/goblin.png');
    });

    it('renders NPC text initial from name', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    it('renders NPC name text', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('renders NPC text at correct position', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      const nameText = container.querySelector('text[class="npc-name"]');
      expect(nameText).toBeInTheDocument();
      expect(nameText).toHaveAttribute('x', '25');
      expect(nameText).toHaveAttribute('y', '41');
    });

    it('renders NPC initial text at correct position', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} npcImages={{}} />);
      const initialText = container.querySelector('text[class="npc-initial"]');
      expect(initialText).toBeInTheDocument();
      expect(initialText).toHaveAttribute('x', '25');
      expect(initialText).toHaveAttribute('y', '25');
    });
  });

  describe('localhost vs non-localhost rendering', () => {
    it('renders hit areas and drag highlights only on localhost', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
      const hitAreas = container.querySelectorAll('.item-hit-area');
      expect(hitAreas.length).toBe(0);
    });

    it('renders hit areas on localhost', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} />);
      const hitAreas = container.querySelectorAll('.item-hit-area');
      expect(hitAreas.length).toBe(1);
    });

    it('renders reposition highlight only on localhost', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'barrel-1' }} />);
      const highlights = container.querySelectorAll('.reposition-highlight');
      expect(highlights.length).toBe(1);
    });

    it('does not render reposition highlight for non-localhost', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} itemDragging={{ itemId: 'barrel-1' }} />);
      const highlights = container.querySelectorAll('.reposition-highlight');
      expect(highlights.length).toBe(0);
    });

    it('renders localhost invisible items at 0.5 opacity', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: false }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} />);
      const useEl = container.querySelector('use[href="#barrel"]');
      expect(useEl).toHaveAttribute('opacity', '0.5');
    });

    it('renders localhost visible items at 1 opacity', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} />);
      const useEl = container.querySelector('use[href="#barrel"]');
      expect(useEl).toHaveAttribute('opacity', '1');
    });

    it('renders non-localhost items at 1 opacity when visible is true', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
      const useEl = container.querySelector('use[href="#barrel"]');
      expect(useEl).toHaveAttribute('opacity', '1');
    });

    it('hides non-localhost items when visible is false', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: false }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
      const useEl = container.querySelector('use[href="#barrel"]');
      expect(useEl).toBeNull();
    });
  });

  describe('type filtering', () => {
    it('only renders items matching the specified type', () => {
      const items = [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'chest-1', type: 'chest', gridX: 1, gridY: 0, visible: true },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const barrelUse = container.querySelector('use[href="#barrel"]');
      const chestUse = container.querySelector('use[href="#chest"]');
      expect(barrelUse).toBeInTheDocument();
      expect(chestUse).toBeInTheDocument();
    });

    it('does not render items with types not in the render list', () => {
      const items = [{ id: 'unknown-1', type: 'unknownType', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('grid position calculations', () => {
    it('positions items at grid coordinates correctly', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 5, gridY: 3, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('circle[class="item-hit-area"]');
      expect(hitArea).toHaveAttribute('cx', '275');
      expect(hitArea).toHaveAttribute('cy', '175');
    });

    it('positions different items at different grid coordinates', () => {
      const items = [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'barrel-2', type: 'barrel', gridX: 10, gridY: 5, visible: true },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitAreas = container.querySelectorAll('circle[class="item-hit-area"]');
      expect(hitAreas.length).toBe(2);
      expect(hitAreas[0]).toHaveAttribute('cx', '25');
      expect(hitAreas[0]).toHaveAttribute('cy', '25');
      expect(hitAreas[1]).toHaveAttribute('cx', '525');
      expect(hitAreas[1]).toHaveAttribute('cy', '275');
    });
  });

  describe('key uniqueness', () => {
    it('assigns unique keys based on item id', () => {
      const items = [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'barrel-2', type: 'barrel', gridX: 1, gridY: 0, visible: true },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const groups = container.querySelectorAll('g.placed-item');
      expect(groups.length).toBe(2);
    });
  });

  describe('npc group key uniqueness', () => {
    it('assigns unique keys to npc groups based on item id', () => {
      const items = [
        { id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' },
        { id: 'npc-2', type: 'npc', gridX: 1, gridY: 0, visible: true, name: 'Orc' },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const npcGroups = container.querySelectorAll('g.npc-group');
      expect(npcGroups.length).toBe(2);
    });
  });

  describe('npc group class', () => {
    it('renders NPC in npc-group not placed-item group', () => {
      const items = [{ id: 'npc-1', type: 'npc', gridX: 0, gridY: 0, visible: true, name: 'Goblin' }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const npcGroup = container.querySelector('g.npc-group');
      expect(npcGroup).toBeInTheDocument();
      const placedItem = container.querySelector('g.placed-item');
      expect(placedItem).toBeNull();
    });
  });

  describe('hit area cursor style', () => {
    it('sets grab cursor on localhost hit areas', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const hitArea = container.querySelector('.item-hit-area');
      expect(hitArea).toHaveStyle({ cursor: 'grab' });
    });
  });

  describe('reposition highlight shapes per type', () => {
    it('renders circle highlight for barrel when dragging', () => {
      const items = [{ id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'barrel-1' }} />);
      const highlight = container.querySelector('circle.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });

    it('renders rect highlight for door when dragging', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'door-1' }} />);
      const highlight = container.querySelector('rect.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });

    it('renders rect highlight for table when dragging', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'table-1' }} />);
      const highlight = container.querySelector('rect.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });

    it('renders rect highlight for bed when dragging', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'bed-1' }} />);
      const highlight = container.querySelector('rect.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });

    it('renders rect highlight for altar when dragging', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'altar-1' }} />);
      const highlight = container.querySelector('rect.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });

    it('renders rect highlight for bookshelf when dragging', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'bookshelf-1' }} />);
      const highlight = container.querySelector('rect.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });
  });

  describe('firepit reposition highlight shape', () => {
    it('renders circle highlight for firepit when dragging', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={true} itemDragging={{ itemId: 'firepit-1' }} />);
      const highlight = container.querySelector('circle.reposition-highlight');
      expect(highlight).toBeInTheDocument();
    });
  });

  describe('mixed type rendering', () => {
    it('renders multiple items of different types in one render', () => {
      const items = [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'chest-1', type: 'chest', gridX: 1, gridY: 0, visible: true },
        { id: 'npc-1', type: 'npc', gridX: 2, gridY: 0, visible: true, name: 'Goblin' },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const barrelUse = container.querySelector('use[href="#barrel"]');
      const chestUse = container.querySelector('use[href="#chest"]');
      const npcCircle = container.querySelector('circle[class="npc-circle"]');
      expect(barrelUse).toBeInTheDocument();
      expect(chestUse).toBeInTheDocument();
      expect(npcCircle).toBeInTheDocument();
    });

    it('renders all 23 item types when provided', () => {
      const items = [
        { id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true },
        { id: 'arrow-1', type: 'arrowSlitWall', gridX: 1, gridY: 0, visible: true },
        { id: 'barrel-1', type: 'barrel', gridX: 2, gridY: 0, visible: true },
        { id: 'bed-1', type: 'bed', gridX: 3, gridY: 0, visible: true },
        { id: 'bookshelf-1', type: 'bookshelf', gridX: 4, gridY: 0, visible: true },
        { id: 'boulder-1', type: 'boulder', gridX: 5, gridY: 0, visible: true },
        { id: 'bush-1', type: 'bush', gridX: 6, gridY: 0, visible: true },
        { id: 'chair-1', type: 'chair', gridX: 7, gridY: 0, visible: true },
        { id: 'chest-1', type: 'chest', gridX: 8, gridY: 0, visible: true },
        { id: 'crate-1', type: 'crate', gridX: 9, gridY: 0, visible: true },
        { id: 'door-1', type: 'door', gridX: 10, gridY: 0, visible: true },
        { id: 'firepit-1', type: 'firepit', gridX: 11, gridY: 0, visible: true },
        { id: 'fountain-1', type: 'fountain', gridX: 12, gridY: 0, visible: true },
        { id: 'npc-1', type: 'npc', gridX: 13, gridY: 0, visible: true, name: 'Goblin' },
        { id: 'pillar-1', type: 'pillar', gridX: 14, gridY: 0, visible: true },
        { id: 'secret-1', type: 'secretDoor', gridX: 15, gridY: 0, visible: true },
        { id: 'skeleton-1', type: 'skeleton', gridX: 16, gridY: 0, visible: true },
        { id: 'stairs-1', type: 'stairs', gridX: 17, gridY: 0, visible: true },
        { id: 'statue-1', type: 'statue', gridX: 18, gridY: 0, visible: true },
        { id: 'table-1', type: 'table', gridX: 19, gridY: 0, visible: true },
        { id: 'torch-1', type: 'torch', gridX: 20, gridY: 0, visible: true },
        { id: 'trap-1', type: 'trap', gridX: 21, gridY: 0, visible: true },
        { id: 'tree-1', type: 'tree', gridX: 22, gridY: 0, visible: true },
        { id: 'web-1', type: 'web', gridX: 23, gridY: 0, visible: true },
      ];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const placedItems = container.querySelectorAll('g.placed-item');
      const npcGroups = container.querySelectorAll('g.npc-group');
      expect(placedItems.length).toBe(23);
      expect(npcGroups.length).toBe(1);
    });

    it('renders items with undefined rotation without transform attribute', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true, rotation: undefined }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#torch"]');
      expect(useEl).not.toHaveAttribute('transform');
    });

    it('renders items with missing rotation without transform attribute', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const useEl = container.querySelector('use[href="#torch"]');
      expect(useEl).not.toHaveAttribute('transform');
    });
  });

  describe('door open state rendering details', () => {
    it('renders open door horizontal rects at correct positions', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true, open: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
      expect(rects.length).toBe(2);
      expect(rects[0]).toHaveAttribute('x', '7');
      expect(rects[0]).toHaveAttribute('y', '7');
      expect(rects[0]).toHaveAttribute('width', '36');
      expect(rects[0]).toHaveAttribute('height', '5');
      expect(rects[1]).toHaveAttribute('x', '7');
      expect(rects[1]).toHaveAttribute('y', '38');
      expect(rects[1]).toHaveAttribute('width', '36');
      expect(rects[1]).toHaveAttribute('height', '5');
    });

    it('renders open door vertical rects at correct positions', () => {
      const items = [{ id: 'door-1', type: 'door', gridX: 0, gridY: 0, visible: true, open: true, rotation: 90 }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
      expect(rects.length).toBe(2);
      expect(rects[0]).toHaveAttribute('x', '7');
      expect(rects[0]).toHaveAttribute('y', '7');
      expect(rects[0]).toHaveAttribute('width', '5');
      expect(rects[0]).toHaveAttribute('height', '36');
      expect(rects[1]).toHaveAttribute('x', '38');
      expect(rects[1]).toHaveAttribute('y', '7');
      expect(rects[1]).toHaveAttribute('width', '5');
      expect(rects[1]).toHaveAttribute('height', '36');
    });
  });

  describe('item types rendered with placed-item class', () => {
    it('renders altar with placed-item class', () => {
      const items = [{ id: 'altar-1', type: 'altar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders arrowSlitWall with placed-item class', () => {
      const items = [{ id: 'arrow-1', type: 'arrowSlitWall', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders bed with placed-item class', () => {
      const items = [{ id: 'bed-1', type: 'bed', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders bookshelf with placed-item class', () => {
      const items = [{ id: 'bookshelf-1', type: 'bookshelf', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders boulder with placed-item class', () => {
      const items = [{ id: 'boulder-1', type: 'boulder', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders bush with placed-item class', () => {
      const items = [{ id: 'bush-1', type: 'bush', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders chair with placed-item class', () => {
      const items = [{ id: 'chair-1', type: 'chair', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders crate with placed-item class', () => {
      const items = [{ id: 'crate-1', type: 'crate', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders firepit with placed-item class', () => {
      const items = [{ id: 'firepit-1', type: 'firepit', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders fountain with placed-item class', () => {
      const items = [{ id: 'fountain-1', type: 'fountain', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders pillar with placed-item class', () => {
      const items = [{ id: 'pillar-1', type: 'pillar', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders secretDoor with placed-item class', () => {
      const items = [{ id: 'secret-1', type: 'secretDoor', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders skeleton with placed-item class', () => {
      const items = [{ id: 'skeleton-1', type: 'skeleton', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders stairs with placed-item class', () => {
      const items = [{ id: 'stairs-1', type: 'stairs', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders statue with placed-item class', () => {
      const items = [{ id: 'statue-1', type: 'statue', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders table with placed-item class', () => {
      const items = [{ id: 'table-1', type: 'table', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders torch with placed-item class', () => {
      const items = [{ id: 'torch-1', type: 'torch', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders trap with placed-item class', () => {
      const items = [{ id: 'trap-1', type: 'trap', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders tree with placed-item class', () => {
      const items = [{ id: 'tree-1', type: 'tree', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });

    it('renders web with placed-item class', () => {
      const items = [{ id: 'web-1', type: 'web', gridX: 0, gridY: 0, visible: true }];
      const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
      expect(container.querySelector('g.placed-item')).toBeInTheDocument();
    });
  });
});
