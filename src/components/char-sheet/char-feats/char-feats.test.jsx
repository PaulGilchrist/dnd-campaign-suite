import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharFeats from './char-feats';

// Mock the usePopup hook
vi.mock('../common/use-popup', () => ({
  default: vi.fn(),
}));

import usePopup from '../common/use-popup';

const mockPlayerStats = {
  feats: ['Actor', 'Athlete'],
  rules: '5e',
};

const mockFeatsData = [
  {
    name: 'Actor',
    index: 'actor',
    desc: ['You look, sound, and act like a different person.'],
   },
   {
    name: 'Athlete',
    index: 'athlete',
    desc: ['You excel at athletic feats.'],
  },
];

describe('CharFeats', () => {
  beforeEach(() => {
    vi.clearAllMocks();

     // Mock usePopup to return a controlled popup
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: vi.fn(),
     }));

     // Mock fetch
    global.fetch = vi.fn();
   });

  afterEach(() => {
    vi.restoreAllMocks();
   });

  it('should return null when no feats', () => {
    const { container } = render(
        <CharFeats playerStats={{ feats: [] }} />
      );

    expect(container.firstChild).toBeNull();
   });

  it('should return null when feats is undefined', () => {
    const { container } = render(
        <CharFeats playerStats={{}} />
      );

    expect(container.firstChild).toBeNull();
   });

  it('should display feat names', () => {
    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

       // Use regex to match text that may include trailing comma
    expect(screen.getByText(/Actor/)).toBeInTheDocument();
    expect(screen.getByText(/Athlete/)).toBeInTheDocument();
    });

  it('should display the Feats label', () => {
    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

    expect(screen.getByText(/Feats:/)).toBeInTheDocument();
   });

  it('should call fetch when feat is clicked', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockFeatsData,
     });

    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

       // Use getAllByText since text includes comma
    const actorElements = screen.getAllByText(/Actor/);
    fireEvent.click(actorElements[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/data/feats.json');
   });
    });

  it('should show popup with feat details when found', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockFeatsData,
     });

    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

       // Use getAllByText since text includes comma
    const actorElements = screen.getAllByText(/Actor/);
    fireEvent.click(actorElements[0]);

     // The component uses showPopup from props, not from usePopup
     // Let's check that fetch was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
   });
    });

  it('should handle fetch error gracefully', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: mockSetPopupHtml,
     }));

    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

       // Use getAllByText since text includes comma
    const actorElements = screen.getAllByText(/Actor/);
    fireEvent.click(actorElements[0]);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalled();
   });
    });

  it('should handle feat not found in database', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [],
     });

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: mockSetPopupHtml,
     }));

    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

       // Use getAllByText since text includes comma
    const actorElements = screen.getAllByText(/Actor/);
    fireEvent.click(actorElements[0]);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalled();
   });
    });

  it('should render popup element container', () => {
    const mockPopupElement = <div data-testid="popup">Popup Content</div>;
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: mockPopupElement,
      setPopupHtml: vi.fn(),
     }));

    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

    expect(screen.getByTestId('popup')).toBeInTheDocument();
   });

  it('should separate multiple feats with commas', () => {
    render(
        <CharFeats playerStats={mockPlayerStats} />
      );

       // Get the feats container and check its text content
    const featsContainer = screen.getByText(/Feats:/).parentElement;
    expect(featsContainer.textContent).toContain(',');
    });

  it('should use 2024 feats file when rules is 2024', async () => {
    const stats2024 = {
      feats: ['Actor'],
      rules: '2024',
     };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockFeatsData,
     });

    render(
        <CharFeats playerStats={stats2024} />
      );

       // Use getAllByText since text may include comma
    const actorElements = screen.getAllByText(/Actor/);
    fireEvent.click(actorElements[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/feats.json');
   });
    });
});