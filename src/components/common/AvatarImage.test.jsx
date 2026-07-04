// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarImage from './AvatarImage.jsx';

describe('AvatarImage', () => {
  describe('image rendering', () => {
    it('should render img with correct src and alt when imagePath is provided', () => {
      render(<AvatarImage name="Test User" imagePath="/avatar.png" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/avatar.png');
      expect(img).toHaveAttribute('alt', 'Test User');
      expect(img).toHaveClass('avatar-image');
    });
  });

  describe('initial rendering', () => {
    it('should render first character initial when no imagePath', () => {
      render(<AvatarImage name="Test User" />);
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should render "?" when name is missing or empty', () => {
      render(<AvatarImage name="" />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

  describe('size prop', () => {
    it('should apply custom size to container dimensions', () => {
      const { container } = render(<AvatarImage name="Test" size={100} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '100px', height: '100px' });
    });

    it('should use default size of 60 when size prop is omitted', () => {
      const { container } = render(<AvatarImage name="Test" />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '60px', height: '60px' });
    });

    it('should set fontSize proportional to size for initial avatar', () => {
      const { container } = render(<AvatarImage name="Test" size={50} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ fontSize: '20px' });
    });
  });

  describe('interactivity', () => {
    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Enter or Space key is pressed', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
      onClick.mockClear();
      fireEvent.keyDown(button, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render a button wrapper with tabindex when onClick is provided', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('should not render a button wrapper when onClick is not provided', () => {
      render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
