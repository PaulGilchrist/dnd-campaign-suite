// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvatarImage from './AvatarImage.jsx';

// One render per test keeps queries unambiguous; setup.js cleans up after each.
function renderAvatar(props) {
  const utils = render(<AvatarImage name="Test" {...props} />);
  return { ...utils, wrapper: utils.container.querySelector('.avatar-wrapper') };
}

describe('AvatarImage', () => {
  describe('image mode (imagePath provided)', () => {
    // Src resolution: http(s) passes through untouched; relative paths get the
    // campaign prefix only when a campaignName is supplied.
    it.each([
      ['absolute path stays untouched', { imagePath: '/avatar.png' }, '/avatar.png'],
      ['relative path + campaign gets campaign prefix', { imagePath: 'avatar.png', campaignName: 'my-campaign' }, 'campaigns/my-campaign/avatar.png'],
      ['https URL ignores campaignName', { imagePath: 'https://example.com/avatar.png', campaignName: 'my-campaign' }, 'https://example.com/avatar.png'],
      ['http URL ignores campaignName', { imagePath: 'http://example.com/avatar.png', campaignName: 'my-campaign' }, 'http://example.com/avatar.png'],
      ['relative path without campaign stays untouched', { imagePath: 'avatar.png' }, 'avatar.png'],
    ])('%s', (_label, props, expectedSrc) => {
      renderAvatar({ name: 'Test User', ...props });
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', expectedSrc);
      expect(img).toHaveAttribute('alt', 'Test User');
      expect(img).toHaveClass('avatar-image');
    });

    it('shows the image, not an initial placeholder', () => {
      const { wrapper } = renderAvatar({ imagePath: '/avatar.png' });
      expect(screen.queryByText('T')).not.toBeInTheDocument();
      expect(wrapper.querySelector('img')).toBe(screen.getByRole('img'));
    });

    it('falls back to initial mode when imagePath is an empty string', () => {
      const { wrapper } = renderAvatar({ imagePath: '', campaignName: 'my-campaign' });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(wrapper).toHaveTextContent('T');
    });
  });

  describe('initial mode (no usable imagePath)', () => {
    it.each([
      ['first letter of a name', 'Test User', 'T'],
      ['uppercases a lowercase name', 'lowercase', 'L'],
      ['keeps a digit initial', '4ev1l', '4'],
      ['question mark for empty name', '', '?'],
      ['question mark for null name', null, '?'],
      ['question mark for missing name', undefined, '?'],
    ])('%s', (_label, name, expectedInitial) => {
      renderAvatar({ name });
      expect(screen.getByText(expectedInitial)).toBeInTheDocument();
    });

    it('renders a placeholder span, not a broken image', () => {
      const { wrapper } = renderAvatar({ name: 'Test' });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(wrapper).toHaveClass('avatar-initial');
      expect(wrapper.querySelector('span')).toHaveTextContent('T');
    });
  });

  // Dangling imagePath (a DB row whose file is gone): the browser fires error on
  // the 404, and the naturalWidth probe catches a zero-pixel payload delivered as
  // a "successful" load. Both must converge onto the initials disc; a genuinely
  // painting image keeps the existing <img> branch byte-identical.
  describe('failed image load (dangling path)', () => {
    it('renders the initials disc instead of a broken image when the load errors', () => {
      const { wrapper } = renderAvatar({ imagePath: '/missing.png' });
      fireEvent.error(screen.getByRole('img'));

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(wrapper).toHaveClass('avatar-initial');
      expect(wrapper.querySelector('span')).toHaveTextContent('T');
    });

    it('renders the initials disc when a "successful" load decodes zero pixels', () => {
      const { wrapper } = renderAvatar({ imagePath: '/empty.png' });
      const img = screen.getByRole('img');
      expect(img.naturalWidth).toBe(0); // jsdom never decodes — the probe's tripwire
      fireEvent.load(img);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(wrapper).toHaveClass('avatar-initial');
    });

    it('keeps the painting image on a successful load (no lingering initials)', () => {
      const { wrapper } = renderAvatar({ imagePath: '/avatar.png' });
      const img = screen.getByRole('img');
      Object.defineProperty(img, 'naturalWidth', { value: 240 });
      fireEvent.load(img);

      expect(screen.getByRole('img')).toHaveAttribute('src', '/avatar.png');
      expect(wrapper).not.toHaveClass('avatar-initial');
      expect(screen.queryByText('T')).not.toBeInTheDocument();
    });

    it('retries the image when a later imagePath resolves to a new src', () => {
      const { rerender } = render(<AvatarImage name="Test" imagePath="/missing.png" />);
      fireEvent.error(screen.getByRole('img'));
      expect(screen.queryByRole('img')).not.toBeInTheDocument();

      rerender(<AvatarImage name="Test" imagePath="/fixed.png" />);
      expect(screen.getByRole('img')).toHaveAttribute('src', '/fixed.png');
    });

    it('keeps the consumer-wired interactive tier on the degraded disc', () => {
      // Arming stays the consumer's decision (NPCFormModal/CharSummary gate on a
      // truthy path; CreatureCard's avatar click opens the stat modal, not a
      // zoom) — the failed face must not silently strip the tier.
      const onClick = vi.fn();
      renderAvatar({ imagePath: '/missing.png', onClick });
      fireEvent.error(screen.getByRole('img'));

      const disc = screen.getByRole('button');
      expect(disc).toHaveAttribute('tabindex', '0');
      fireEvent.keyDown(disc, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('sizing', () => {
    it.each([
      ['default size', undefined, '60px'],
      ['custom size', 100, '100px'],
    ])('%s applies to image avatar box', (_label, size, expectedPx) => {
      const { wrapper } = renderAvatar({ imagePath: '/avatar.png', size });
      expect(wrapper).toHaveStyle({ width: expectedPx, height: expectedPx });
    });

    it.each([
      [50, '20px'],
      [80, '32px'],
    ])('initial avatar with size %i scales font to %s', (size, expectedFontSize) => {
      const { wrapper } = renderAvatar({ size });
      expect(wrapper).toHaveStyle({ width: `${size}px`, height: `${size}px`, fontSize: expectedFontSize });
    });
  });

  // The component duplicates its interactive props across both render branches,
  // so every interactivity test runs against both variants.
  const variants = [
    ['image avatar', { imagePath: '/avatar.png' }],
    ['initial avatar', {}],
  ];

  describe.each(variants)('interactivity — %s', (_label, variantProps) => {
    it('calls onClick once per click', () => {
      const onClick = vi.fn();
      renderAvatar({ ...variantProps, onClick });
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each(['Enter', ' '])(
      'activates on %s key for keyboard users',
      (key) => {
        const onClick = vi.fn();
        renderAvatar({ ...variantProps, onClick });
        fireEvent.keyDown(screen.getByRole('button'), { key });
        expect(onClick).toHaveBeenCalledTimes(1);
      }
    );

    it.each(['Escape', 'a', '1'])(
      'does not activate on unrelated key: %s',
      (key) => {
        const onClick = vi.fn();
        renderAvatar({ ...variantProps, onClick });
        fireEvent.keyDown(screen.getByRole('button'), { key });
        expect(onClick).not.toHaveBeenCalled();
      }
    );

    it('is exposed as a focusable button with pointer cursor', () => {
      const { wrapper } = renderAvatar({ ...variantProps, onClick: vi.fn() });
      expect(wrapper).toHaveAttribute('role', 'button');
      expect(wrapper).toHaveAttribute('tabindex', '0');
      expect(wrapper).toHaveStyle({ cursor: 'pointer' });
    });

    it('is a static, inert element when onClick is omitted', () => {
      const { wrapper } = renderAvatar(variantProps);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(wrapper).not.toHaveAttribute('tabindex');
      expect(wrapper).not.toHaveStyle({ cursor: 'pointer' });
      expect(() => fireEvent.click(wrapper)).not.toThrow();
    });
  });
});
