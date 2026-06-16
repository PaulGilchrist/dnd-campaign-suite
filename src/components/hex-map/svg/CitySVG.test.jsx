import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CitySVG from './CitySVG.jsx';

describe('CitySVG', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the SVG group element', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        expect(group).toBeInTheDocument();
    });

    it('should render with the provided id attribute', () => {
        const { container } = render(<CitySVG id="city-1" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('id')).toBe('city-1');
    });

    it('should render with the provided className', () => {
        const { container } = render(<CitySVG className="city-icon" />);
        const group = container.querySelector('g');
        expect(group.getAttribute('class')).toBe('city-icon');
    });

    it('should pass through additional props via spread', () => {
        const { container } = render(<CitySVG data-testid="city-svg" onClick={vi.fn()} />);
        const group = container.querySelector('g');
        expect(group.getAttribute('data-testid')).toBe('city-svg');
    });

    it('should support ref forwarding', () => {
        const ref = vi.fn();
        render(<CitySVG ref={ref} />);
        expect(ref).toHaveBeenCalled();
    });

    it('should render with displayName CitySVG', () => {
        expect(CitySVG.displayName).toBe('CitySVG');
    });

    it('should render the ground shadow ellipse', () => {
        const { container } = render(<CitySVG />);
        const shadow = container.querySelector('ellipse');
        expect(shadow).toBeInTheDocument();
        expect(shadow.getAttribute('cx')).toBe('18');
        expect(shadow.getAttribute('cy')).toBe('33');
        expect(shadow.getAttribute('rx')).toBe('17');
        expect(shadow.getAttribute('ry')).toBe('5');
        expect(shadow.getAttribute('fill')).toBe('#555');
        expect(shadow.getAttribute('opacity')).toBe('0.12');
    });

    it('should render the main curtain wall rect', () => {
        const { container } = render(<CitySVG />);
        const wall = container.querySelector('rect[fill="#9E9E9E"][stroke="#757575"]');
        expect(wall.getAttribute('x')).toBe('1');
        expect(wall.getAttribute('y')).toBe('24');
        expect(wall.getAttribute('width')).toBe('34');
        expect(wall.getAttribute('height')).toBe('10');
        expect(wall.getAttribute('rx')).toBe('1');
        expect(wall.getAttribute('fill')).toBe('#9E9E9E');
        expect(wall.getAttribute('stroke')).toBe('#757575');
        expect(wall.getAttribute('stroke-width')).toBe('0.8');
    });

    it('should render the wall shadow rect', () => {
        const { container } = render(<CitySVG />);
        const allRects = [...container.querySelectorAll('rect')];
        const wallShadow = allRects.find(r => r.getAttribute('y') === '31' && r.getAttribute('height') === '3');
        expect(wallShadow).toBeInTheDocument();
        expect(wallShadow.getAttribute('fill')).toBe('#757575');
        expect(wallShadow.getAttribute('opacity')).toBe('0.4');
    });

    it('should render wall stone texture horizontal lines', () => {
        const { container } = render(<CitySVG />);
        const allLines = [...container.querySelectorAll('line')];
        const stoneLines = allLines.filter(l => l.getAttribute('stroke') === '#888' && l.getAttribute('stroke-width') === '0.3' && l.getAttribute('opacity') === '0.4');
        expect(stoneLines.length).toBe(2);
        expect(stoneLines[0].getAttribute('opacity')).toBe('0.4');
        expect(stoneLines[1].getAttribute('opacity')).toBe('0.4');
    });

    it('should render 6 wall crenellations (merlons)', () => {
        const { container } = render(<CitySVG />);
        const merlons = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '21' && r.getAttribute('height') === '3' && r.getAttribute('fill') === '#9E9E9E'
        );
        expect(merlons.length).toBe(6);
    });

    it('should render 5 crenel gaps between wall merlons', () => {
        const { container } = render(<CitySVG />);
        const gaps = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '22' && r.getAttribute('height') === '2' && r.getAttribute('width') === '2' && r.getAttribute('fill') === '#757575'
        );
        expect(gaps.length).toBe(5);
    });

    it('should render 6 wall crenellation highlight top edges', () => {
        const { container } = render(<CitySVG />);
        const highlights = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#BDBDBD' && r.getAttribute('opacity') === '0.4' && r.getAttribute('height') === '0.5'
        );
        expect(highlights.length).toBe(6);
    });

    it('should render the left corner tower', () => {
        const { container } = render(<CitySVG />);
        const towers = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('x') === '0' && r.getAttribute('y') === '15' && r.getAttribute('width') === '6' && r.getAttribute('height') === '9'
        );
        expect(towers.length).toBe(1);
        expect(towers[0].getAttribute('fill')).toBe('#8A8A8A');
        expect(towers[0].getAttribute('stroke')).toBe('#757575');
    });

    it('should render left tower crenellations', () => {
        const { container } = render(<CitySVG />);
        const leftCrenels = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '12' && r.getAttribute('fill') === '#8A8A8A' && r.getAttribute('stroke') === '#757575' && r.getAttribute('stroke-width') === '0.3'
        );
        // Left tower has 2 crenellations at x=0 and x=4
        expect(leftCrenels.length).toBeGreaterThanOrEqual(2);
    });

    it('should render the left tower window', () => {
        const { container } = render(<CitySVG />);
        const leftWindow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('x') === '2' && r.getAttribute('y') === '17'
        );
        expect(leftWindow).toBeInTheDocument();
        expect(leftWindow.getAttribute('width')).toBe('1.5');
        expect(leftWindow.getAttribute('height')).toBe('2');
    });

    it('should render the right corner tower', () => {
        const { container } = render(<CitySVG />);
        const rightTower = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '30' && r.getAttribute('y') === '15' && r.getAttribute('width') === '6' && r.getAttribute('height') === '9'
        );
        expect(rightTower).toBeInTheDocument();
        expect(rightTower.getAttribute('fill')).toBe('#8A8A8A');
    });

    it('should render right tower crenellations', () => {
        const { container } = render(<CitySVG />);
        const rightCrenels = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '12' && r.getAttribute('fill') === '#8A8A8A' && r.getAttribute('stroke') === '#757575' && r.getAttribute('stroke-width') === '0.3'
        );
        // Right tower has 2 crenellations at x=30 and x=34
        expect(rightCrenels.length).toBeGreaterThanOrEqual(2);
    });

    it('should render the right tower window', () => {
        const { container } = render(<CitySVG />);
        const rightWindow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('x') === '32.5' && r.getAttribute('y') === '17'
        );
        expect(rightWindow).toBeInTheDocument();
        expect(rightWindow.getAttribute('width')).toBe('1.5');
    });

    it('should render the gatehouse archway', () => {
        const { container } = render(<CitySVG />);
        const gatehouse = container.querySelector('rect[fill="#6E6E6E"]');
        expect(gatehouse).toBeInTheDocument();
        expect(gatehouse.getAttribute('x')).toBe('12');
        expect(gatehouse.getAttribute('y')).toBe('28');
        expect(gatehouse.getAttribute('width')).toBe('12');
        expect(gatehouse.getAttribute('height')).toBe('6');
    });

    it('should render the gate arch path', () => {
        const { container } = render(<CitySVG />);
        const gatePath = container.querySelector('path[fill="#333"]');
        expect(gatePath).toBeInTheDocument();
        expect(gatePath.getAttribute('stroke')).toBe('#555');
        expect(gatePath.getAttribute('stroke-width')).toBe('0.5');
    });

    it('should render 5 portcullis vertical lines', () => {
        const { container } = render(<CitySVG />);
        const portcullisLines = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#555' && l.getAttribute('stroke-width') === '0.3'
        );
        expect(portcullisLines.length).toBe(5);
    });

    it('should render the portcullis crossbar', () => {
        const { container } = render(<CitySVG />);
        const crossbar = [...container.querySelectorAll('line')].find(l =>
            l.getAttribute('stroke') === '#666' && l.getAttribute('stroke-width') === '0.5'
        );
        expect(crossbar).toBeInTheDocument();
        expect(crossbar.getAttribute('y1')).toBe('30');
        expect(crossbar.getAttribute('y2')).toBe('30');
    });

    it('should render the central keep main tower', () => {
        const { container } = render(<CitySVG />);
        const keepRect = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '11' && r.getAttribute('y') === '4' && r.getAttribute('width') === '14' && r.getAttribute('height') === '18'
        );
        expect(keepRect).toBeInTheDocument();
        expect(keepRect.getAttribute('fill')).toBe('#A8A8A8');
    });

    it('should render keep left shadow', () => {
        const { container } = render(<CitySVG />);
        const keepShadow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '11' && r.getAttribute('fill') === '#757575' && r.getAttribute('opacity') === '0.3'
        );
        expect(keepShadow).toBeInTheDocument();
        expect(keepShadow.getAttribute('width')).toBe('3');
    });

    it('should render keep right highlight', () => {
        const { container } = render(<CitySVG />);
        const keepHighlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '23' && r.getAttribute('fill') === '#BDBDBD' && r.getAttribute('opacity') === '0.25'
        );
        expect(keepHighlight).toBeInTheDocument();
        expect(keepHighlight.getAttribute('width')).toBe('2');
    });

    it('should render 3 keep stone texture lines', () => {
        const { container } = render(<CitySVG />);
        const keepLines = [...container.querySelectorAll('line')].filter(l =>
            l.getAttribute('stroke') === '#888' && l.getAttribute('opacity') === '0.35'
        );
        expect(keepLines.length).toBe(3);
    });

    it('should render 3 keep crenellations', () => {
        const { container } = render(<CitySVG />);
        const keepCrenels = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '1' && r.getAttribute('height') === '3' && r.getAttribute('fill') === '#A8A8A8'
        );
        expect(keepCrenels.length).toBe(3);
    });

    it('should render 2 keep crenel gaps', () => {
        const { container } = render(<CitySVG />);
        const keepGaps = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '2' && r.getAttribute('width') === '2' && r.getAttribute('height') === '2' && r.getAttribute('fill') === '#757575'
        );
        expect(keepGaps.length).toBe(2);
    });

    it('should render 3 keep windows', () => {
        const { container } = render(<CitySVG />);
        const keepWindows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('y') === '8'
        );
        expect(keepWindows.length).toBe(2);
        const mainWindow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('y') === '14' && r.getAttribute('width') === '3'
        );
        expect(mainWindow).toBeInTheDocument();
    });

    it('should render the keep spire polygon', () => {
        const { container } = render(<CitySVG />);
        const spire = container.querySelector('polygon[fill="#6B3E1F"]');
        expect(spire).toBeInTheDocument();
        expect(spire.getAttribute('stroke')).toBe('#5A2E10');
        expect(spire.getAttribute('stroke-width')).toBe('0.5');
        expect(spire.getAttribute('stroke-linejoin')).toBe('round');
    });

    it('should render the spire highlight polygon', () => {
        const { container } = render(<CitySVG />);
        const spireHighlight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#7A4E28' && p.getAttribute('opacity') === '0.3'
        );
        expect(spireHighlight).toBeInTheDocument();
    });

    it('should render the left building behind wall', () => {
        const { container } = render(<CitySVG />);
        const leftBuilding = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '4' && r.getAttribute('y') === '16' && r.getAttribute('fill') === '#C49A6C'
        );
        expect(leftBuilding).toBeInTheDocument();
        expect(leftBuilding.getAttribute('stroke')).toBe('#8B5A2B');
    });

    it('should render the left building roof polygon', () => {
        const { container } = render(<CitySVG />);
        const leftRoof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#6B3E1F' && p.getAttribute('points') === '3,16 8,10 13,16'
        );
        expect(leftRoof).toBeInTheDocument();
    });

    it('should render left building roof highlight', () => {
        const { container } = render(<CitySVG />);
        const leftHighlight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#7A4E28' && p.getAttribute('opacity') === '0.25' && p.getAttribute('points') === '6,14 8,11 10,14'
        );
        expect(leftHighlight).toBeInTheDocument();
    });

    it('should render left building windows', () => {
        const { container } = render(<CitySVG />);
        const leftWindows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#F5D060' && r.getAttribute('y') === '18'
        );
        expect(leftWindows.length).toBe(2);
        expect(leftWindows[0].getAttribute('opacity')).toBe('0.4');
        expect(leftWindows[1].getAttribute('opacity')).toBe('0.3');
    });

    it('should render left building door', () => {
        const { container } = render(<CitySVG />);
        const leftDoor = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#5A2E10' && r.getAttribute('x') === '7' && r.getAttribute('y') === '22'
        );
        expect(leftDoor).toBeInTheDocument();
        expect(leftDoor.getAttribute('width')).toBe('2');
    });

    it('should render the right building behind wall', () => {
        const { container } = render(<CitySVG />);
        const rightBuilding = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '24' && r.getAttribute('y') === '15' && r.getAttribute('fill') === '#B8925C'
        );
        expect(rightBuilding).toBeInTheDocument();
        expect(rightBuilding.getAttribute('width')).toBe('8');
        expect(rightBuilding.getAttribute('height')).toBe('9');
    });

    it('should render the right building roof polygon', () => {
        const { container } = render(<CitySVG />);
        const rightRoof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#6B3E1F' && p.getAttribute('points') === '23,15 28,9 33,15'
        );
        expect(rightRoof).toBeInTheDocument();
    });

    it('should render right building roof highlight', () => {
        const { container } = render(<CitySVG />);
        const rightHighlight = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#7A4E28' && p.getAttribute('opacity') === '0.25' && p.getAttribute('points') === '26,13 28,10 30,13'
        );
        expect(rightHighlight).toBeInTheDocument();
    });

    it('should render right building windows', () => {
        const { container } = render(<CitySVG />);
        const rightWindows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#F5D060' && r.getAttribute('y') === '17'
        );
        expect(rightWindows.length).toBe(2);
    });

    it('should render right building door', () => {
        const { container } = render(<CitySVG />);
        const rightDoor = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#5A2E10' && r.getAttribute('x') === '27' && r.getAttribute('y') === '22'
        );
        expect(rightDoor).toBeInTheDocument();
    });

    it('should render the small turret between keep and left wall', () => {
        const { container } = render(<CitySVG />);
        const leftTurret = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '8' && r.getAttribute('y') === '12' && r.getAttribute('fill') === '#9E9E9E'
        );
        expect(leftTurret).toBeInTheDocument();
        expect(leftTurret.getAttribute('width')).toBe('5');
        expect(leftTurret.getAttribute('height')).toBe('8');
    });

    it('should render the left turret roof polygon', () => {
        const { container } = render(<CitySVG />);
        const leftTurretRoof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#6B3E1F' && p.getAttribute('points') === '8,12 10.5,8 13,12'
        );
        expect(leftTurretRoof).toBeInTheDocument();
        expect(leftTurretRoof.getAttribute('stroke-width')).toBe('0.3');
    });

    it('should render the left turret window', () => {
        const { container } = render(<CitySVG />);
        const leftTurretWindow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('x') === '10' && r.getAttribute('y') === '14'
        );
        expect(leftTurretWindow).toBeInTheDocument();
        expect(leftTurretWindow.getAttribute('width')).toBe('1.5');
    });

    it('should render the small turret between keep and right wall', () => {
        const { container } = render(<CitySVG />);
        const rightTurret = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('x') === '23' && r.getAttribute('y') === '13' && r.getAttribute('fill') === '#9E9E9E'
        );
        expect(rightTurret).toBeInTheDocument();
        expect(rightTurret.getAttribute('width')).toBe('5');
    });

    it('should render the right turret roof polygon', () => {
        const { container } = render(<CitySVG />);
        const rightTurretRoof = [...container.querySelectorAll('polygon')].find(p =>
            p.getAttribute('fill') === '#6B3E1F' && p.getAttribute('points') === '23,13 25.5,10 28,13'
        );
        expect(rightTurretRoof).toBeInTheDocument();
    });

    it('should render the right turret window', () => {
        const { container } = render(<CitySVG />);
        const rightTurretWindow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('x') === '24.5' && r.getAttribute('y') === '15'
        );
        expect(rightTurretWindow).toBeInTheDocument();
    });

    it('should render a keep window highlight rect', () => {
        const { container } = render(<CitySVG />);
        const keepWindowHighlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#A8A8A8' && r.getAttribute('opacity') === '0.3' && r.getAttribute('y') === '14'
        );
        expect(keepWindowHighlight).toBeInTheDocument();
    });

    it('should render the correct count of polygon elements', () => {
        const { container } = render(<CitySVG />);
        const polygons = container.querySelectorAll('polygon');
        expect(polygons.length).toBe(8);
    });

    it('should render the correct count of rect elements', () => {
        const { container } = render(<CitySVG />);
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBe(54);
    });

    it('should render the correct count of line elements', () => {
        const { container } = render(<CitySVG />);
        const lines = container.querySelectorAll('line');
        expect(lines.length).toBe(11);
    });

    it('should render exactly 1 ellipse (ground shadow)', () => {
        const { container } = render(<CitySVG />);
        const ellipses = container.querySelectorAll('ellipse');
        expect(ellipses.length).toBe(1);
    });

    it('should render exactly 1 path element (gate arch)', () => {
        const { container } = render(<CitySVG />);
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBe(1);
    });

    it('should render with all expected wall colors', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#9E9E9E');
        expect(fills).toContain('#757575');
        expect(strokes).toContain('#888');
        expect(fills).toContain('#BDBDBD');
    });

    it('should render with all expected tower colors', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#8A8A8A');
    });

    it('should render with all expected keep colors', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#A8A8A8');
        expect(fills).toContain('#5A2E10');
    });

    it('should render with all expected building colors', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        const strokes = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
            if (el.getAttribute('stroke')) strokes.add(el.getAttribute('stroke'));
        });
        expect(fills).toContain('#C49A6C');
        expect(fills).toContain('#B8925C');
        expect(fills).toContain('#F5D060');
        expect(strokes).toContain('#8B5A2B');
    });

    it('should render with all expected dark colors for windows and gate', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#444');
        expect(fills).toContain('#333');
        expect(fills).toContain('#555');
        expect(fills).toContain('#6E6E6E');
    });

    it('should render with all expected roof colors', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const allElements = group.querySelectorAll('*');
        const fills = new Set();
        allElements.forEach(el => {
            if (el.getAttribute('fill')) fills.add(el.getAttribute('fill'));
        });
        expect(fills).toContain('#6B3E1F');
        expect(fills).toContain('#7A4E28');
    });

    it('should render the gatehouse with correct stroke', () => {
        const { container } = render(<CitySVG />);
        const gatehouse = container.querySelector('rect[fill="#6E6E6E"]');
        expect(gatehouse.getAttribute('stroke')).toBe('#555');
        expect(gatehouse.getAttribute('stroke-width')).toBe('0.4');
    });

    it('should render the keep spire with strokeLinejoin round', () => {
        const { container } = render(<CitySVG />);
        const spire = container.querySelector('polygon[stroke-linejoin="round"]');
        expect(spire).toBeInTheDocument();
    });

    it('should render all elements within the group', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBeGreaterThan(0);
    });

    it('should render wall crenellations with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const merlons = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('y') === '21' && r.getAttribute('height') === '3' && r.getAttribute('fill') === '#9E9E9E' && r.getAttribute('stroke-width') === '0.4'
        );
        expect(merlons.length).toBe(6);
    });

    it('should render towers with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const towers = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('stroke') === '#757575' && r.getAttribute('stroke-width') === '0.5' && r.getAttribute('fill') === '#8A8A8A'
        );
        // left tower, right tower
        expect(towers.length).toBe(2);
    });

    it('should render keep with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const keep = container.querySelector('rect[fill="#A8A8A8"][stroke-width="0.6"]');
        expect(keep).toBeInTheDocument();
    });

    it('should render keep crenellations with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const keepCrenels = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('stroke-width') === '0.4' && r.getAttribute('y') === '1'
        );
        expect(keepCrenels.length).toBe(3);
    });

    it('should render turret rects with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const turretRects = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('stroke-width') === '0.4' && r.getAttribute('fill') === '#9E9E9E' && r.getAttribute('rx') === '0.4'
        );
        expect(turretRects.length).toBe(2);
    });

    it('should render turret roofs with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const turretRoofs = [...container.querySelectorAll('polygon')].filter(p =>
            p.getAttribute('stroke-width') === '0.3' && p.getAttribute('fill') === '#6B3E1F'
        );
        expect(turretRoofs.length).toBe(2);
    });

    it('should render building roofs with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const buildingRoofs = [...container.querySelectorAll('polygon')].filter(p =>
            p.getAttribute('stroke-width') === '0.4' && p.getAttribute('fill') === '#6B3E1F'
        );
        expect(buildingRoofs.length).toBe(2);
    });

    it('should render building rects with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const buildingRects = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('stroke') === '#8B5A2B' && r.getAttribute('stroke-width') === '0.5' && r.getAttribute('rx') === '0.4'
        );
        expect(buildingRects.length).toBe(2);
    });

    it('should render left tower crenellations with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const leftCrenelLines = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('stroke-width') === '0.3' && r.getAttribute('fill') === '#8A8A8A' && r.getAttribute('y') === '12' && r.getAttribute('stroke') === '#757575'
        );
        expect(leftCrenelLines.length).toBeGreaterThanOrEqual(2);
    });

    it('should render right tower crenellations with correct stroke width', () => {
        const { container } = render(<CitySVG />);
        const rightCrenelLines = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('stroke-width') === '0.3' && r.getAttribute('fill') === '#8A8A8A' && r.getAttribute('y') === '12' && r.getAttribute('stroke') === '#757575'
        );
        expect(rightCrenelLines.length).toBeGreaterThanOrEqual(2);
    });

    it('should render window rects with rx border radius', () => {
        const { container } = render(<CitySVG />);
        const windows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('rx') === '0.2'
        );
        expect(windows.length).toBe(4);
    });

    it('should render building window rects with small rx', () => {
        const { container } = render(<CitySVG />);
        const buildingWindows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#F5D060' && r.getAttribute('rx') === '0.15'
        );
        expect(buildingWindows.length).toBe(4);
    });

    it('should render building door rects with rx', () => {
        const { container } = render(<CitySVG />);
        const doors = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#5A2E10' && r.getAttribute('rx') === '0.2'
        );
        expect(doors.length).toBe(2);
    });

    it('should render keep window with rx 0.3', () => {
        const { container } = render(<CitySVG />);
        const keepWindow = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#444' && r.getAttribute('rx') === '0.3'
        );
        expect(keepWindow).toBeInTheDocument();
    });

    it('should render wall, towers, keep, and turrets with rx 0.5', () => {
        const { container } = render(<CitySVG />);
        const cornerRects = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.5' && r.getAttribute('stroke') === '#757575'
        );
        expect(cornerRects.length).toBeGreaterThanOrEqual(2);
    });

    it('should render building rects with rx 0.4', () => {
        const { container } = render(<CitySVG />);
        const buildingRects = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.4' && r.getAttribute('stroke') === '#8B5A2B'
        );
        expect(buildingRects.length).toBe(2);
    });

    it('should render turret rects with rx 0.4', () => {
        const { container } = render(<CitySVG />);
        const turretRects = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.4' && r.getAttribute('fill') === '#9E9E9E' && r.getAttribute('stroke') === '#757575'
        );
        expect(turretRects.length).toBe(2);
    });

    it('should render gatehouse rect with rx 0.5', () => {
        const { container } = render(<CitySVG />);
        const gatehouse = container.querySelector('rect[fill="#6E6E6E"][rx="0.5"]');
        expect(gatehouse).toBeInTheDocument();
    });

    it('should render keep rect with rx 0.5', () => {
        const { container } = render(<CitySVG />);
        const keep = container.querySelector('rect[fill="#A8A8A8"][rx="0.5"]');
        expect(keep).toBeInTheDocument();
    });

    it('should render wall shadow rect with rx 0.5', () => {
        const { container } = render(<CitySVG />);
        const wallShadow = container.querySelector('rect[fill="#757575"][opacity="0.4"][rx="0.5"]');
        expect(wallShadow).toBeInTheDocument();
    });

    it('should render wall merlons with rx 0.2', () => {
        const { container } = render(<CitySVG />);
        const merlons = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.2' && r.getAttribute('fill') === '#9E9E9E' && r.getAttribute('y') === '21'
        );
        expect(merlons.length).toBe(6);
    });

    it('should render keep crenellations with rx 0.15', () => {
        const { container } = render(<CitySVG />);
        const keepCrenels = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('rx') === '0.15' && r.getAttribute('y') === '1'
        );
        expect(keepCrenels.length).toBe(3);
    });

    it('should render wall highlight rects with rx 0.1', () => {
        const { container } = render(<CitySVG />);
        const highlights = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#BDBDBD' && r.getAttribute('rx') === '0.1'
        );
        expect(highlights.length).toBe(6);
    });

    it('should render keep window highlight with rx 0.1', () => {
        const { container } = render(<CitySVG />);
        const keepHighlight = [...container.querySelectorAll('rect')].find(r =>
            r.getAttribute('fill') === '#A8A8A8' && r.getAttribute('opacity') === '0.3' && r.getAttribute('rx') === '0.1'
        );
        expect(keepHighlight).toBeInTheDocument();
    });

    it('should render keep shadow rects with rx 0.3', () => {
        const { container } = render(<CitySVG />);
        const keepShadows = [...container.querySelectorAll('rect')].filter(r =>
            r.getAttribute('fill') === '#757575' && r.getAttribute('opacity') === '0.3' && r.getAttribute('rx') === '0.3'
        );
        expect(keepShadows.length).toBe(1);
    });

    it('should render the component with all expected SVG element types', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        expect(group.querySelector('ellipse')).toBeInTheDocument();
        expect(group.querySelector('rect')).toBeInTheDocument();
        expect(group.querySelector('line')).toBeInTheDocument();
        expect(group.querySelector('polygon')).toBeInTheDocument();
        expect(group.querySelector('path')).toBeInTheDocument();
    });

    it('should render the main wall with rx 1', () => {
        const { container } = render(<CitySVG />);
        const wall = container.querySelector('rect[rx="1"]');
        expect(wall).toBeInTheDocument();
        expect(wall.getAttribute('fill')).toBe('#9E9E9E');
    });

    it('should render the correct total count of SVG children in group', () => {
        const { container } = render(<CitySVG />);
        const group = container.querySelector('g');
        const children = group.children;
        expect(children.length).toBe(75);
    });
});
