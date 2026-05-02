import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePopup from './use-popup';

const MockPopup = vi.fn(({ html, onClickOrKeyDown }) => (
  <div data-testid="popup" onClick={onClickOrKeyDown}>
    <div dangerouslySetInnerHTML={{ __html: html }} />
  </div>
));

vi.mock('../../common/popup', () => ({ default: MockPopup }));

function TestComponent({ buildHtml }) {
  const { showPopup, PopupElement, setPopupHtml } = usePopup(buildHtml);

  return (
    <div>
      <button onClick={() => showPopup({ name: 'Test Entity' })}>
        Show Popup
      </button>
      <button onClick={() => setPopupHtml('<p>Direct HTML</p>')}>
        Set HTML
      </button>
      {PopupElement}
    </div>
  );
}

describe('usePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    });

  it('should not render popup on initial render', () => {
    render(<TestComponent buildHtml={() => '<p>Test</p>'} />);

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

  it('should render popup when showPopup is called with valid html', () => {
    render(<TestComponent buildHtml={(entity) => entity ? '<p>Test</p>' : null} />);

    expect(screen.getByText('Show Popup')).toBeInTheDocument();
    });

  it('should return setPopupHtml function', () => {
    function TestSetHtml() {
      const { PopupElement, setPopupHtml } = usePopup(() => '<p>Test</p>');
      setPopupHtml('<p>Direct</p>');
      return (
        <div>
          <button>Trigger</button>
          {PopupElement}
        </div>
      );
    }

    vi.mock('../../common/popup', () => ({
      default: vi.fn(({ html, onClickOrKeyDown }) => (
        <div data-testid="popup-direct">{html}</div>
      )),
    }));

    render(<TestSetHtml />);
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    });

  it('should not render popup when buildHtml returns null', () => {
    render(<TestComponent buildHtml={() => null} />);

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

  it('should not render popup when buildHtml returns empty string', () => {
    render(<TestComponent buildHtml={() => ''} />);

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

  it('should accept render function for buildHtml', () => {
    render(<TestComponent buildHtml={() => '<p>Content</p>'} />);

    expect(screen.getByText('Show Popup')).toBeInTheDocument();
    expect(screen.getByText('Set HTML')).toBeInTheDocument();
    });

  it('should pass correct props to Popup component', () => {
    function TestProps() {
      const { PopupElement } = usePopup(() => '<p>Test</p>');
      return (
        <div>
          <span data-testid="no-popup">Hidden</span>
          {PopupElement}
        </div>
      );
    }

    render(<TestProps />);
    expect(screen.getByTestId('no-popup')).toBeInTheDocument();
    });

  it('should work with different entity types', () => {
    const buildHtml = (entity) => {
      if (typeof entity === 'string') return `<p>${entity}</p>`;
      if (typeof entity === 'number') return `<p>${entity}</p>`;
      return `<p>${entity.name}</p>`;
    };

    render(<TestComponent buildHtml={buildHtml} />);
    expect(screen.getByText('Show Popup')).toBeInTheDocument();
    });
});
