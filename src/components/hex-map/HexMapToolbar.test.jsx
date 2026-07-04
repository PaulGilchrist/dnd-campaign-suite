// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HexMapToolbar from './HexMapToolbar.jsx';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_ROAD, TOOL_TRAVEL } from '../../config/outdoorConfig';

describe('HexMapToolbar', () => {
  let props;

  beforeEach(() => {
    props = {
      onBack: vi.fn(),
      mapName: 'Test Map',
      tool: TOOL_NONE,
      setTool: vi.fn(),
      selectedTerrain: 'grassland',
      setSelectedTerrain: vi.fn(),
      terrainTypes: [
        { id: 'grassland', name: 'Grassland', fill: '#4a7c3f' },
        { id: 'forest', name: 'Forest', fill: '#2d5a1e' },
        { id: 'water', name: 'Water', fill: '#3a6ea5' },
      ],
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetView: vi.fn(),
      zoom: 1.0,
      poiPanelOpen: false,
      setPoiPanelOpen: vi.fn(),
      gridSize: 30,
      setGridSize: vi.fn(),
      marchingOrderOpen: false,
      setMarchingOrderOpen: vi.fn(),
      marchingOrder: [],
    };
  });

  it('should render back button and call onBack when clicked', () => {
    render(<HexMapToolbar {...props} />);
    const backBtn = screen.getByTitle('Back to maps');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(props.onBack).toHaveBeenCalled();
  });

  it.each`
    tool            | title
    ${TOOL_PAINT}   | ${'Paint terrain'}
    ${TOOL_ERASE}   | ${'Erase terrain'}
    ${TOOL_RIVER}   | ${'Paint rivers'}
    ${TOOL_ROAD}    | ${'Connect cities and settlements with roads'}
    ${TOOL_TRAVEL}  | ${'Travel mode — plan and execute overland travel'}
  `('should render $title button', ({ title }) => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle(title)).toBeInTheDocument();
  });

  it('should render zoom controls', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset view')).toBeInTheDocument();
  });

  it('should render grid size input with correct value', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('should call setGridSize when grid size changes', () => {
    render(<HexMapToolbar {...props} />);
    const input = screen.getByDisplayValue('30');
    fireEvent.change(input, { target: { value: '50' } });
    expect(props.setGridSize).toHaveBeenCalledWith(50);
  });

  it.each`
    tool            | expectedTool
    ${TOOL_PAINT}   | ${TOOL_PAINT}
    ${TOOL_ERASE}   | ${TOOL_ERASE}
    ${TOOL_RIVER}   | ${TOOL_RIVER}
    ${TOOL_ROAD}    | ${TOOL_ROAD}
    ${TOOL_TRAVEL}  | ${TOOL_TRAVEL}
  `('should toggle $expectedTool on click', ({ tool, expectedTool }) => {
    render(<HexMapToolbar {...props} />);
    const titles = { [TOOL_PAINT]: 'Paint terrain', [TOOL_ERASE]: 'Erase terrain', [TOOL_RIVER]: 'Paint rivers', [TOOL_ROAD]: 'Connect cities and settlements with roads', [TOOL_TRAVEL]: 'Travel mode — plan and execute overland travel' };
    fireEvent.click(screen.getByTitle(titles[tool]));
    expect(props.setTool).toHaveBeenCalledWith(expectedTool);
  });

  it.each`
    tool            | expectedTool
    ${TOOL_PAINT}   | ${TOOL_NONE}
    ${TOOL_ERASE}   | ${TOOL_NONE}
    ${TOOL_RIVER}   | ${TOOL_NONE}
    ${TOOL_ROAD}    | ${TOOL_NONE}
    ${TOOL_TRAVEL}  | ${TOOL_NONE}
  `('should toggle $expectedTool off when $tool already active', ({ tool, expectedTool }) => {
    render(<HexMapToolbar {...props} tool={tool} />);
    const titles = { [TOOL_PAINT]: 'Paint terrain', [TOOL_ERASE]: 'Erase terrain', [TOOL_RIVER]: 'Paint rivers', [TOOL_ROAD]: 'Connect cities and settlements with roads', [TOOL_TRAVEL]: 'Travel mode — plan and execute overland travel' };
    fireEvent.click(screen.getByTitle(titles[tool]));
    expect(props.setTool).toHaveBeenCalledWith(expectedTool);
  });

  it.each`
    tool | isActive
    ${TOOL_PAINT} | ${true}
    ${TOOL_ERASE} | ${true}
    ${TOOL_NONE} | ${false}
  `('should show terrain selector when $tool is $isActive', ({ isActive }) => {
    render(<HexMapToolbar {...props} tool={isActive ? TOOL_PAINT : TOOL_NONE} />);
    const selector = document.querySelector('.terrain-selector');
    if (isActive) {
      expect(selector).toBeInTheDocument();
    } else {
      expect(selector).not.toBeInTheDocument();
    }
  });

  it('should call setSelectedTerrain and setTool on swatch click', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    fireEvent.click(swatches[1]);
    expect(props.setSelectedTerrain).toHaveBeenCalledWith('forest');
    expect(props.setTool).toHaveBeenCalledWith(TOOL_PAINT);
  });

  it.each`
    buttonTitle
    ${'Zoom in'}
    ${'Zoom out'}
    ${'Reset view'}
  `('should call the appropriate handler when $buttonTitle clicked', ({ buttonTitle }) => {
    render(<HexMapToolbar {...props} />);
    const handlers = { 'Zoom in': props.zoomIn, 'Zoom out': props.zoomOut, 'Reset view': props.resetView };
    fireEvent.click(screen.getByTitle(buttonTitle));
    expect(handlers[buttonTitle]).toHaveBeenCalled();
  });

  it('should toggle POI panel open', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Open POI panel'));
    expect(props.setPoiPanelOpen).toHaveBeenCalledWith(true);
  });

  it.each`
    panel      | openTitle          | closeTitle
    ${'POI'}   | ${'Open POI panel'} | ${'Close POI panel'}
    ${'marching order'} | ${'Manage marching order'} | ${'Close marching order'}
  `('should show $closeTitle when $panel is open', ({ closeTitle }) => {
    const isPoi = closeTitle === 'Close POI panel';
    render(<HexMapToolbar {...props} {...(isPoi ? { poiPanelOpen: true } : { marchingOrderOpen: true })} />);
    expect(screen.getByTitle(closeTitle)).toBeInTheDocument();
  });

  it('should toggle marching order open', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Manage marching order'));
    expect(props.setMarchingOrderOpen).toHaveBeenCalledWith(true);
  });

  it('should show marching order count indicator', () => {
    render(<HexMapToolbar {...props} marchingOrder={[{ id: 1 }, { id: 2 }]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should not show marching order count indicator when empty', () => {
    render(<HexMapToolbar {...props} marchingOrder={[]} />);
    const indicator = document.querySelector('.hex-map-poi-indicator');
    expect(indicator).not.toBeInTheDocument();
  });

  it.each`
    tool            | buttonTitle
    ${TOOL_PAINT}   | ${'Paint terrain'}
    ${TOOL_ERASE}   | ${'Erase terrain'}
    ${TOOL_RIVER}   | ${'Paint rivers'}
    ${TOOL_ROAD}    | ${'Connect cities and settlements with roads'}
    ${TOOL_TRAVEL}  | ${'Travel mode — plan and execute overland travel'}
  `('should add active class to $buttonTitle when $tool active', ({ tool, buttonTitle }) => {
    render(<HexMapToolbar {...props} tool={tool} />);
    const btn = screen.getByTitle(buttonTitle);
    expect(btn.classList.contains('active')).toBe(true);
  });

  describe('print button', () => {
    it('should render print button', () => {
      render(<HexMapToolbar {...props} />);
      expect(screen.getByTitle('Print map')).toBeInTheDocument();
    });

    it('should call window.print when print button is clicked', () => {
      const printSpy = vi.spyOn(window, 'print');
      render(<HexMapToolbar {...props} />);
      fireEvent.click(screen.getByTitle('Print map'));
      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();
    });
  });
});
