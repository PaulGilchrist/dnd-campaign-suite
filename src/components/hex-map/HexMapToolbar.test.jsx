// @improved-by-ai
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

  it('should render map name', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByText('Test Map')).toBeInTheDocument();
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

  it('should render POI panel toggle', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Open POI panel')).toBeInTheDocument();
  });

  it('should render marching order toggle', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Manage marching order')).toBeInTheDocument();
  });

  it('should render zoom controls', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset view')).toBeInTheDocument();
  });

  it.each`
    zoom    | expectedText
    ${1.0}  | ${'50%'}
    ${1.5}  | ${'75%'}
    ${0.5}  | ${'25%'}
  `('should show zoom percentage $expectedText for zoom $zoom', ({ zoom, expectedText }) => {
    render(<HexMapToolbar {...props} zoom={zoom} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
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

  it('should call setGridSize with 0 for non-numeric input', () => {
    render(<HexMapToolbar {...props} />);
    const input = screen.getByDisplayValue('30');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(props.setGridSize).toHaveBeenCalledWith(0);
  });

  it.each`
    tool            | expectedTool
    ${TOOL_PAINT}   | ${TOOL_PAINT}
    ${TOOL_ERASE}   | ${TOOL_ERASE}
    ${TOOL_RIVER}   | ${TOOL_RIVER}
  `('should toggle $expectedTool on click', ({ tool, expectedTool }) => {
    render(<HexMapToolbar {...props} />);
    const titles = { [TOOL_PAINT]: 'Paint terrain', [TOOL_ERASE]: 'Erase terrain', [TOOL_RIVER]: 'Paint rivers' };
    fireEvent.click(screen.getByTitle(titles[tool]));
    expect(props.setTool).toHaveBeenCalledWith(expectedTool);
  });

  it.each`
    tool
    ${TOOL_PAINT}
    ${TOOL_ERASE}
    ${TOOL_RIVER}
  `('should toggle $tool off when already active', ({ tool }) => {
    render(<HexMapToolbar {...props} tool={tool} />);
    const titles = { [TOOL_PAINT]: 'Paint terrain', [TOOL_ERASE]: 'Erase terrain', [TOOL_RIVER]: 'Paint rivers' };
    fireEvent.click(screen.getByTitle(titles[tool]));
    expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
  });

  it.each`
    tool | shouldShow
    ${TOOL_PAINT} | ${true}
    ${TOOL_ERASE} | ${true}
    ${TOOL_NONE} | ${false}
  `('should $shouldShow terrain selector when $tool is active', ({ shouldShow }) => {
    render(<HexMapToolbar {...props} tool={shouldShow ? TOOL_PAINT : TOOL_NONE} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    if (shouldShow) {
      expect(swatches.length).toBe(3);
    } else {
      expect(swatches.length).toBe(0);
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
    terrainId    | swatchIndex
    ${'grassland'} | ${0}
    ${'forest'}    | ${1}
    ${'water'}     | ${2}
  `('should highlight active terrain swatch for $terrainId', ({ terrainId, swatchIndex }) => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} selectedTerrain={terrainId} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    expect(swatches[swatchIndex].classList.contains('active')).toBe(true);
    swatches.forEach((swatch, i) => {
      if (i !== swatchIndex) {
        expect(swatch.classList.contains('active')).toBe(false);
      }
    });
  });

  it('should render terrain swatches with correct fill colors', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    const expectedColors = ['rgb(74, 124, 63)', 'rgb(45, 90, 30)', 'rgb(58, 110, 165)'];
    swatches.forEach((swatch, i) => {
      expect(swatch.style.backgroundColor).toBe(expectedColors[i]);
    });
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

  it('should show close POI panel title when open', () => {
    render(<HexMapToolbar {...props} poiPanelOpen={true} />);
    expect(screen.getByTitle('Close POI panel')).toBeInTheDocument();
  });

  it('should toggle marching order open', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Manage marching order'));
    expect(props.setMarchingOrderOpen).toHaveBeenCalledWith(true);
  });

  it('should show close marching order title when open', () => {
    render(<HexMapToolbar {...props} marchingOrderOpen={true} />);
    expect(screen.getByTitle('Close marching order')).toBeInTheDocument();
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

  describe('road tool', () => {
    it('should toggle road tool on when clicked', () => {
      render(<HexMapToolbar {...props} />);
      fireEvent.click(screen.getByTitle('Connect cities and settlements with roads'));
      expect(props.setTool).toHaveBeenCalledWith(TOOL_ROAD);
    });

    it('should toggle road tool off when already active', () => {
      render(<HexMapToolbar {...props} tool={TOOL_ROAD} />);
      fireEvent.click(screen.getByTitle('Connect cities and settlements with roads'));
      expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
    });

    it('should add active class to road button when tool is road', () => {
      render(<HexMapToolbar {...props} tool={TOOL_ROAD} />);
      const btn = screen.getByTitle('Connect cities and settlements with roads');
      expect(btn.classList.contains('active')).toBe(true);
    });
  });

  describe('travel tool', () => {
    it('should toggle travel tool on when clicked', () => {
      render(<HexMapToolbar {...props} />);
      fireEvent.click(screen.getByTitle('Travel mode — plan and execute overland travel'));
      expect(props.setTool).toHaveBeenCalledWith(TOOL_TRAVEL);
    });

    it('should toggle travel tool off when already active', () => {
      render(<HexMapToolbar {...props} tool={TOOL_TRAVEL} />);
      fireEvent.click(screen.getByTitle('Travel mode — plan and execute overland travel'));
      expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
    });

    it('should add active class to travel button when tool is travel', () => {
      render(<HexMapToolbar {...props} tool={TOOL_TRAVEL} />);
      const btn = screen.getByTitle('Travel mode — plan and execute overland travel');
      expect(btn.classList.contains('active')).toBe(true);
    });
  });

  describe('grid size hint', () => {
    it('should render grid size hint with correct format', () => {
      render(<HexMapToolbar {...props} gridSize={30} />);
      expect(screen.getByText('60×30')).toBeInTheDocument();
    });

    it('should update grid size hint when gridSize changes', () => {
      render(<HexMapToolbar {...props} gridSize={50} />);
      expect(screen.getByText('100×50')).toBeInTheDocument();
    });
  });
});
