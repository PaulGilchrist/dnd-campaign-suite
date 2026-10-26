// @maintained-by-ai: 2026-10-26
// Lane: read-only map description panel (backlog 2026-10-26). Self-gates on
// empty/missing description so both editor roots (Map.jsx indoor, HexMap.jsx
// outdoor) mount it unconditionally. Markdown rendering itself (marked +
// DOMPurify sanitization bytes) is owned by MarkdownPreview.test.jsx and
// sanitize.test.js — pinned here is only that the panel routes through it.

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MapDescriptionPanel from './MapDescriptionPanel.jsx';

const panel = () => document.querySelector('[data-testid="map-description-panel"]');

describe('MapDescriptionPanel', () => {
    it('renders nothing when mapData is absent (document still loading)', () => {
        render(<MapDescriptionPanel mapData={null} />);
        expect(panel()).toBeNull();
    });

    it('renders nothing when the description is empty or missing', () => {
        const { rerender } = render(<MapDescriptionPanel mapData={{ description: '' }} />);
        expect(panel()).toBeNull();

        rerender(<MapDescriptionPanel mapData={{ name: 'Test Map' }} />);
        expect(panel()).toBeNull();

        rerender(<MapDescriptionPanel />);
        expect(panel()).toBeNull();
    });

    it('renders a non-empty description through the sanitized markdown path', () => {
        render(<MapDescriptionPanel mapData={{ description: '**misty** ruins' }} />);

        const root = panel();
        expect(root).toBeTruthy();
        const body = root.querySelector('.map-description-panel-body');
        expect(body).toBeTruthy();
        // Markdown parsed to markup — plain text would show the literal **
        expect(body.querySelector('strong')?.textContent).toBe('misty');
    });

    it('never injects raw HTML — script tags are stripped', () => {
        render(
            <MapDescriptionPanel
                mapData={{ description: 'Safe text <script>alert(1)</script>' }}
            />
        );

        const root = panel();
        expect(root.textContent).toContain('Safe text');
        expect(root.querySelector('script')).toBeNull();
    });
});
