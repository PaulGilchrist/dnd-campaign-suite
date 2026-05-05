import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharCharacterAdvancement from './char-character-advancement';

// Mock the useActionPopup hook
vi.mock('./common/use-action-popup', () => ({
  default: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

// Mock the sanitize service
vi.mock('../../services/sanitize', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import useActionPopup, { buildFeatureDetailHtml } from './common/use-action-popup';

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

    // Mock useActionPopup to return a controlled popup
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
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
    useActionPopup.mockImplementation(() => ({
      showPopup: mockShowPopup,
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));

    render(
      <CharCharacterAdvancement playerStats={mockPlayerStats} />
    );

    const level2Element = screen.getByText(/Level 2/);
    fireEvent.click(level2Element);

    expect(mockShowPopup).toHaveBeenCalled();
  });

  it('should return null for feature without details', () => {
    const result = buildFeatureDetailHtml({ name: 'Level 1', description: 'You gain 1 hit point' });
    expect(result).toBeNull();
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
    useActionPopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: mockPopupElement,
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