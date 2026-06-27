import PlacedItems from './PlacedItems';

const mockGridCenterX = (x) => x * 50 + 25;
const mockGridCenterY = (y) => y * 50 + 25;

const mockHandleItemPointerDown = vi.fn();

const baseProps = {
  placedItems: [],
  isLocalhost: true,
  fog: new Map(),
  gridCenterX: mockGridCenterX,
  gridCenterY: mockGridCenterY,
  setSelectedItem: vi.fn(),
  npcImages: {},
  itemDragging: null,
  handleItemPointerDown: mockHandleItemPointerDown,
};

export { baseProps, mockGridCenterX, mockGridCenterY, mockHandleItemPointerDown };
export default PlacedItems;
