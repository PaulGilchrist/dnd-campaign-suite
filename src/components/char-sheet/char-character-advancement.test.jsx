import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharCharacterAdvancement from './char-character-advancement';

// Mock the usePopup hook
vi.mock('./common/use-popup', () => ({
  default: vi.fn(),
}));

// Mock the sanitize service
vi.mock('../../services/sanitize', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import usePopup from './common/use-popup';

const mockPlayerStats = {
  characterAdvancement: [
    {
      name: 'Level 1',
      description: 'You gain 1 hit point',
     },
     {
      name: 'Level 2',
      description: 'You gain proficiency in one skill',
      details: 'Choose from the skill list',
     },
   ],
};

describe('CharCharacterAdvancement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock usePopup to return a controlled popup
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: vi.fn(),
    }));
  });

  it('should render the section header', () => {
    render(
      <CharCharacterAdvancement playerStats={mockPlayerStats} />
    );

    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });

  it('should display feature names', () => {
    render(
      <CharCharacterAdvancement playerStats={mockPlayerStats} />
    );

    expect(screen.getByText(/Level 1/)).toBeInTheDocument();
    expect(screen.getByText(/Level 2/)).toBeInTheDocument();
  });

  it('should display feature descriptions', () => {
    render(
      <CharCharacterAdvancement playerStats={mockPlayerStats} />
    );

    expect(screen.getByText('You gain 1 hit point')).toBeInTheDocument();
    expect(screen.getByText('You gain proficiency in one skill')).toBeInTheDocument();
  });

  it('should call showPopup when feature with details is clicked', () => {
    const mockShowPopup = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: mockShowPopup,
      PopupElement: null,
      setPopupHtml: vi.fn(),
    }));

    render(
      <CharCharacterAdvancement playerStats={mockPlayerStats} />
    );

    const level2Element = screen.getByText(/Level 2/);
    fireEvent.click(level2Element);

    expect(mockShowPopup).toHaveBeenCalled();
  });

  it('should not show popup when feature without details is clicked', () => {
    let capturedBuildHtml;
    usePopup.mockImplementation((buildHtml) => {
      capturedBuildHtml = buildHtml;
      return {
        showPopup: vi.fn(),
        PopupElement: null,
      setPopupHtml: vi.fn(),
       };
     });

    render(
      <CharCharacterAdvancement playerStats={mockPlayerStats} />
    );

    const level1Element = screen.getByText(/Level 1/);
    fireEvent.click(level1Element);

      // showPopup is called but buildHtml returns null for features without details
    expect(capturedBuildHtml(mockPlayerStats.characterAdvancement[0])).toBeNull();
  });

  it('should handle empty characterAdvancement array', () => {
    const emptyStats = { characterAdvancement: [] };
    render(
      <CharCharacterAdvancement playerStats={emptyStats} />
    );

    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });

  it('should handle missing characterAdvancement', () => {
    const emptyStats = {};
    render(
      <CharCharacterAdvancement playerStats={emptyStats} />
    );

    expect(screen.getByText('Character Advancement')).toBeInTheDocument();
  });

  it('should render popup element container', () => {
    const mockPopupElement = <div data-testid="popup">Popup Content</div>;
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: mockPopupElement,
      setPopupHtml: vi.fn(),
    }));

    render(
       <CharCharacterAdvancement playerStats={mockPlayerStats} />
     );

    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('should apply clickable class to features with details', () => {
    render(
       <CharCharacterAdvancement playerStats={mockPlayerStats} />
     );

    const clickableElements = document.querySelectorAll('.clickable');
    expect(clickableElements.length).toBe(1);
  });

  it('should not apply clickable class to features without details', () => {
    const statsWithoutDetails = {
      characterAdvancement: [
        {
          name: 'Level 1',
          description: 'You gain 1 hit point',
         },
       ],
     };

    render(
       <CharCharacterAdvancement playerStats={statsWithoutDetails} />
     );

    const clickableElements = document.querySelectorAll('.clickable');
    expect(clickableElements.length).toBe(0);
  });
});
