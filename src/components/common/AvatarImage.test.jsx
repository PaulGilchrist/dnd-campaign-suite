import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AvatarImage from './AvatarImage.jsx';

describe('AvatarImage', () => {
  describe('image rendering', () => {
    it('renders img with correct src and alt when imagePath is provided', () => {
      const { container } = render(<AvatarImage name="Test User" imagePath="/avatar.png" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/avatar.png');
      expect(img).toHaveAttribute('alt', 'Test User');
      expect(img).toHaveClass('avatar-image');

      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper.querySelector('img')).toBe(img);
    });

    it('passes through http URLs without campaign prefix', () => {
      render(<AvatarImage name="Remote" imagePath="https://example.com/avatar.png" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('prepends campaigns/{campaignName}/ when imagePath is not http and campaignName is provided', () => {
      render(<AvatarImage name="Local" imagePath="avatar.png" campaignName="my-campaign" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'campaigns/my-campaign/avatar.png');
    });
  });

  describe('initial rendering', () => {
    it('renders first character initial when no imagePath', () => {
      render(<AvatarImage name="Test User" />);
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('renders "?" for falsy names (empty, null, undefined)', () => {
      const { container: c1 } = render(<AvatarImage name="" />);
      expect(c1.querySelector('span')).toHaveTextContent('?');
      const { container: c2 } = render(<AvatarImage name={null} />);
      expect(c2.querySelector('span')).toHaveTextContent('?');
      const { container: c3 } = render(<AvatarImage />);
      expect(c3.querySelector('span')).toHaveTextContent('?');
    });

    it('renders uppercase first character for the initial', () => {
      render(<AvatarImage name="lowercase" />);
      expect(screen.getByText('L')).toBeInTheDocument();
    });

    it('applies avatar-initial class and fontSize style to the wrapper', () => {
      const { container } = render(<AvatarImage name="Test" size={50} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveClass('avatar-initial');
      expect(wrapper).toHaveStyle({ fontSize: '20px' });
    });
  });

  describe('size prop', () => {
    it('uses default size of 60 when size prop is omitted', () => {
      const { container } = render(<AvatarImage name="Test" />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '60px', height: '60px' });
    });

    it('applies custom size to container dimensions', () => {
      const { container } = render(<AvatarImage name="Test" size={100} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ width: '100px', height: '100px' });
    });

    it('applies custom size to initial avatar fontSize', () => {
      const { container } = render(<AvatarImage name="Test" size={80} />);
      const wrapper = container.querySelector('.avatar-wrapper');
      expect(wrapper).toHaveStyle({ fontSize: '32px' });
    });
  });

  describe('interactivity', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Enter key is pressed', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when Space key is pressed', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick for other keys', () => {
      const onClick = vi.fn();
      render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Escape' });
      expect(onClick).not.toHaveBeenCalled();
      fireEvent.keyDown(button, { key: 'a' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not render a button when onClick is not provided', () => {
      render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('sets role="button" and tabIndex=0 when onClick is provided, omits them otherwise', () => {
      const onClick = vi.fn();
      const { container: withClick } = render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={onClick} />);
      const wrapperWith = withClick.querySelector('.avatar-wrapper');
      expect(wrapperWith).toHaveAttribute('role', 'button');
      expect(wrapperWith).toHaveAttribute('tabindex', '0');

      const { container: withoutClick } = render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      const wrapperWithout = withoutClick.querySelector('.avatar-wrapper');
      expect(wrapperWithout).not.toHaveAttribute('role');
      expect(wrapperWithout).not.toHaveAttribute('tabindex');
    });

    it('applies cursor pointer style when onClick is provided, omits it otherwise', () => {
      const { container: withClick } = render(<AvatarImage name="Test" imagePath="/avatar.png" onClick={() => {}} />);
      const wrapperWith = withClick.querySelector('.avatar-wrapper');
      expect(wrapperWith).toHaveStyle({ cursor: 'pointer' });

      const { container: withoutClick } = render(<AvatarImage name="Test" imagePath="/avatar.png" />);
      const wrapperWithout = withoutClick.querySelector('.avatar-wrapper');
      expect(wrapperWithout).not.toHaveStyle({ cursor: 'pointer' });
    });
  });
});
