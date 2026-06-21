// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import usePopup from './usePopup.js';

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
  describe('return values', () => {
    it('should return showPopup function and render the button', () => {
      const buildHtml = vi.fn(() => '<p>Test HTML</p>');
      render(<TestComponent buildHtml={buildHtml} />);

      expect(screen.getByText('Show Popup')).toBeInTheDocument();
      expect(screen.getByText('Set HTML')).toBeInTheDocument();
    });
  });

  describe('showPopup', () => {
    it('should call buildHtml with the entity and display the popup', () => {
      const buildHtml = vi.fn(() => '<p>Test HTML</p>');
      render(<TestComponent buildHtml={buildHtml} />);

      fireEvent.click(screen.getByText('Show Popup'));
      expect(buildHtml).toHaveBeenCalledWith({ name: 'Test' });
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    it('should not display popup when buildHtml returns null', () => {
      const buildHtml = vi.fn(() => null);
      render(<TestComponent buildHtml={buildHtml} />);

      fireEvent.click(screen.getByText('Show Popup'));
      expect(buildHtml).toHaveBeenCalled();
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    it('should not display popup when buildHtml returns empty string', () => {
      const buildHtml = vi.fn(() => '');
      render(<TestComponent buildHtml={buildHtml} />);

      fireEvent.click(screen.getByText('Show Popup'));
      expect(buildHtml).toHaveBeenCalled();
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });
  });

  describe('setPopupHtml', () => {
    it('should update the popup content with custom HTML', () => {
      const buildHtml = vi.fn(() => '<p>Test</p>');
      render(<TestComponent buildHtml={buildHtml} />);

      fireEvent.click(screen.getByText('Set HTML'));
      expect(screen.getByTestId('popup')).toBeInTheDocument();
      expect(screen.getByTestId('popup').innerHTML).toBe('<p>New HTML</p>');
    });
  });
});
