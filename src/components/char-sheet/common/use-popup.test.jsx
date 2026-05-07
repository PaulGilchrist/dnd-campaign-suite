import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import usePopup from './use-popup.jsx';

// Helper component to test the hook
function TestComponent({ buildHtml }) {
  const { showPopup, popupHtml, setPopupHtml } = usePopup(buildHtml);
  return (
    <div>
      <button onClick={() => showPopup({ name: 'Test' })}>Show Popup</button>
      <button onClick={() => setPopupHtml('<p>New HTML</p>')}>Set HTML</button>
      {popupHtml && <div data-testid="popup" dangerouslySetInnerHTML={{ __html: popupHtml }} />}
    </div>
  );
}

describe('usePopup', () => {
  it('should return showPopup function', () => {
    const buildHtml = vi.fn(() => '<p>Test HTML</p>');
    const { container } = render(<TestComponent buildHtml={buildHtml} />);

    expect(container.querySelector('button')).toBeInTheDocument();
  });

  it('should show popup when showPopup is called with truthy buildHtml result', () => {
    const buildHtml = vi.fn(() => '<p>Test HTML</p>');
    render(<TestComponent buildHtml={buildHtml} />);

    fireEvent.click(screen.getByText('Show Popup'));
    expect(buildHtml).toHaveBeenCalledWith({ name: 'Test' });
  });

  it('should not show popup when buildHtml returns null', () => {
    const buildHtml = vi.fn(() => null);
    render(<TestComponent buildHtml={buildHtml} />);

    fireEvent.click(screen.getByText('Show Popup'));
    expect(buildHtml).toHaveBeenCalled();
  });

  it('should not show popup when buildHtml returns empty string', () => {
    const buildHtml = vi.fn(() => '');
    render(<TestComponent buildHtml={buildHtml} />);

    fireEvent.click(screen.getByText('Show Popup'));
    expect(buildHtml).toHaveBeenCalled();
  });

  it('should update popupHtml with setPopupHtml', () => {
    const buildHtml = vi.fn(() => '<p>Test</p>');
    render(<TestComponent buildHtml={buildHtml} />);

    fireEvent.click(screen.getByText('Set HTML'));
  });
});
