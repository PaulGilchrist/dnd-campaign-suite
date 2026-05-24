import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HexMapToolbar from './HexMapToolbar.jsx';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER } from '../../config/outdoorConfig';

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
      onGenerateRivers: vi.fn(),
    };
  });

  it('should render back button', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Back to maps')).toBeInTheDocument();
  });

  it('should call onBack when back button clicked', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Back to maps'));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('should render map name', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByText('Test Map')).toBeInTheDocument();
  });

  it('should render paint button', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Paint terrain')).toBeInTheDocument();
  });

  it('should render erase button', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Erase terrain')).toBeInTheDocument();
  });

  it('should render river button', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Paint rivers')).toBeInTheDocument();
  });

  it('should render generate rivers button', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByTitle('Auto-generate rivers from terrain elevation')).toBeInTheDocument();
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

  it('should show zoom percentage', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should show zoom percentage for different zoom', () => {
    render(<HexMapToolbar {...props} zoom={1.5} />);
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('should render grid size input', () => {
    render(<HexMapToolbar {...props} />);
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('should call setGridSize when grid size changes', () => {
    render(<HexMapToolbar {...props} />);
    const input = screen.getByDisplayValue('30');
    fireEvent.change(input, { target: { value: '50' } });
    expect(props.setGridSize).toHaveBeenCalledWith(50);
  });

  it('should toggle paint tool on click', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Paint terrain'));
    expect(props.setTool).toHaveBeenCalledWith(TOOL_PAINT);
  });

  it('should toggle paint tool off when already active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} />);
    fireEvent.click(screen.getByTitle('Paint terrain'));
    expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
  });

  it('should toggle erase tool on click', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Erase terrain'));
    expect(props.setTool).toHaveBeenCalledWith(TOOL_ERASE);
  });

  it('should toggle erase tool off when already active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_ERASE} />);
    fireEvent.click(screen.getByTitle('Erase terrain'));
    expect(props.setTool).toHaveBeenCalledWith(TOOL_NONE);
  });

  it('should toggle river tool on click', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Paint rivers'));
    expect(props.setTool).toHaveBeenCalledWith(TOOL_RIVER);
  });

  it('should show terrain selector when paint tool active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    expect(swatches.length).toBe(3);
  });

  it('should show terrain selector when erase tool active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_ERASE} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    expect(swatches.length).toBe(3);
  });

  it('should not show terrain selector when no tool active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_NONE} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    expect(swatches.length).toBe(0);
  });

  it('should call setSelectedTerrain and setTool on swatch click', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    fireEvent.click(swatches[1]);
    expect(props.setSelectedTerrain).toHaveBeenCalledWith('forest');
    expect(props.setTool).toHaveBeenCalledWith(TOOL_PAINT);
  });

  it('should highlight active terrain swatch', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} selectedTerrain="forest" />);
    const swatches = document.querySelectorAll('.terrain-swatch');
    expect(swatches[1].classList.contains('active')).toBe(true);
    expect(swatches[0].classList.contains('active')).toBe(false);
  });

  it('should call zoomIn when zoom in clicked', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(props.zoomIn).toHaveBeenCalled();
  });

  it('should call zoomOut when zoom out clicked', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(props.zoomOut).toHaveBeenCalled();
  });

  it('should call resetView when reset clicked', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Reset view'));
    expect(props.resetView).toHaveBeenCalled();
  });

  it('should toggle POI panel', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Open POI panel'));
    expect(props.setPoiPanelOpen).toHaveBeenCalledWith(true);
  });

  it('should show close POI panel title when open', () => {
    render(<HexMapToolbar {...props} poiPanelOpen={true} />);
    expect(screen.getByTitle('Close POI panel')).toBeInTheDocument();
  });

  it('should toggle marching order', () => {
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

  it('should not show marching order count when empty', () => {
    render(<HexMapToolbar {...props} marchingOrder={[]} />);
    const indicator = document.querySelector('.hex-map-poi-indicator');
    expect(indicator).not.toBeInTheDocument();
  });

  it('should call onGenerateRivers when generate rivers clicked', () => {
    render(<HexMapToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Auto-generate rivers from terrain elevation'));
    expect(props.onGenerateRivers).toHaveBeenCalled();
  });

  it('should add active class to paint button when paint tool active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_PAINT} />);
    const btn = screen.getByTitle('Paint terrain');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('should add active class to river button when river tool active', () => {
    render(<HexMapToolbar {...props} tool={TOOL_RIVER} />);
    const btn = screen.getByTitle('Paint rivers');
    expect(btn.classList.contains('active')).toBe(true);
  });
});
