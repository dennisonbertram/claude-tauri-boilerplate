import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageViewer } from '../ImageViewer';

describe('ImageViewer', () => {
  const defaultProps = {
    src: 'https://example.com/photo.png',
    alt: 'A test image',
  };

  // -- Basic rendering --

  describe('Inline image rendering', () => {
    it('renders an image with the provided src and alt', () => {
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', defaultProps.src);
      expect(img).toHaveAttribute('alt', defaultProps.alt);
    });

    it('renders with lazy loading', () => {
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('renders with cursor pointer indicating clickability', () => {
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img');
      expect(img?.className).toContain('cursor');
    });

    it('supports base64 data URI sources', () => {
      const base64Src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const { container } = render(
        <ImageViewer src={base64Src} alt="Base64 image" />
      );
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', base64Src);
    });
  });

  // -- Lightbox overlay --

  describe('Lightbox overlay', () => {
    it('does not show overlay by default', () => {
      render(<ImageViewer {...defaultProps} />);
      expect(screen.queryByTestId('image-lightbox-overlay')).not.toBeInTheDocument();
    });

    it('opens overlay when image is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);
      expect(screen.getByTestId('image-lightbox-overlay')).toBeInTheDocument();
    });

    it('displays the full-size image in the overlay', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      const overlay = screen.getByTestId('image-lightbox-overlay');
      const overlayImg = overlay.querySelector('img');
      expect(overlayImg).toBeInTheDocument();
      expect(overlayImg).toHaveAttribute('src', defaultProps.src);
    });

    it('closes overlay when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      expect(screen.getByTestId('image-lightbox-overlay')).toBeInTheDocument();

      // Click on the backdrop (the overlay div itself, not the image)
      const backdrop = screen.getByTestId('image-lightbox-backdrop');
      await user.click(backdrop);

      expect(screen.queryByTestId('image-lightbox-overlay')).not.toBeInTheDocument();
    });

    it('closes overlay when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      expect(screen.getByTestId('image-lightbox-overlay')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('image-lightbox-overlay')).not.toBeInTheDocument();
    });

    it('shows close button in the overlay', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      expect(screen.getByLabelText('Close lightbox')).toBeInTheDocument();
    });

    it('closes overlay when close button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      await user.click(screen.getByLabelText('Close lightbox'));
      expect(screen.queryByTestId('image-lightbox-overlay')).not.toBeInTheDocument();
    });
  });

  // -- Zoom controls --

  describe('Zoom controls', () => {
    it('shows zoom in and zoom out buttons in overlay', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
      expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    });

    it('shows reset zoom button in overlay', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument();
    });

    it('zooms in when zoom in button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      const overlay = screen.getByTestId('image-lightbox-overlay');
      const overlayImg = overlay.querySelector('img')!;

      // Default scale should be 1
      expect(overlayImg.style.transform).toBe('scale(1)');

      await user.click(screen.getByLabelText('Zoom in'));

      // Scale should increase
      expect(overlayImg.style.transform).toBe('scale(1.5)');
    });

    it('zooms out when zoom out button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      // Zoom in first
      await user.click(screen.getByLabelText('Zoom in'));
      await user.click(screen.getByLabelText('Zoom in'));

      const overlay = screen.getByTestId('image-lightbox-overlay');
      const overlayImg = overlay.querySelector('img')!;

      // Now zoom out
      await user.click(screen.getByLabelText('Zoom out'));

      // Scale should have decreased from 2.25
      expect(overlayImg.style.transform).toBe('scale(1.5)');
    });

    it('resets zoom when reset button is clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      // Zoom in
      await user.click(screen.getByLabelText('Zoom in'));

      const overlay = screen.getByTestId('image-lightbox-overlay');
      const overlayImg = overlay.querySelector('img')!;
      expect(overlayImg.style.transform).not.toBe('scale(1)');

      // Reset
      await user.click(screen.getByLabelText('Reset zoom'));
      expect(overlayImg.style.transform).toBe('scale(1)');
    });

    it('does not zoom below minimum scale (0.25)', async () => {
      const user = userEvent.setup();
      const { container } = render(<ImageViewer {...defaultProps} />);
      const img = container.querySelector('img')!;
      await user.click(img);

      const overlay = screen.getByTestId('image-lightbox-overlay');
      const overlayImg = overlay.querySelector('img')!;

      // Zoom out many times - should not go below 0.25
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByLabelText('Zoom out'));
      }

      const scale = parseFloat(overlayImg.style.transform.replace('scale(', '').replace(')', ''));
      expect(scale).toBeGreaterThanOrEqual(0.25);
    });
  });
});
