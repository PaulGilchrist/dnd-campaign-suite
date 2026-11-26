// @maintained-by-ai 2026-11-01
// Backlog 2026-11-01 AZ2 + 2026-11-22 PPP: designer-chat raw-JSON replies.
// The chat lane sends no response_format by design, so any misbehaving model
// can answer in JSON. Faces: a whole-message JSON object with a non-empty
// string `text` renders that prose as a plain message (PPP text-extract);
// any other whole-JSON document (bare object, array) collapses behind a
// <details> disclosure whose expansion holds the AZ2 indented pretty-print
// block (PPP details-collapse). Prose, malformed lookalikes, mid-prose JSON,
// GM rows and scalar text all render byte-identically to the old plain-text
// path.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const api = vi.hoisted(() => ({
    getAiStatus: vi.fn(),
    loadDesignerConversation: vi.fn(),
    clearDesignerConversation: vi.fn(),
    saveDesignerPendingPlan: vi.fn(),
    designerChat: vi.fn(),
    designerPlan: vi.fn(),
    designerGenerate: vi.fn(),
}));
vi.mock('../../services/ai/aiClient.js', () => api);

import AiDesignerSection from './AiDesignerSection.jsx';

const JSON_REPLY = {
    scope: 'arc',
    storySummary: 'The drowned chapel',
    entityPlan: [{ kind: 'npc', count: 2 }],
};
const JSON_TEXT = JSON.stringify(JSON_REPLY); // compact single-line blob, as a raw model would emit

beforeEach(() => {
    Object.values(api).forEach(fn => fn.mockReset());
    api.getAiStatus.mockResolvedValue({ configured: true });
    api.loadDesignerConversation.mockResolvedValue({ messages: [] });
});

function seedMessages(messages) {
    api.loadDesignerConversation.mockResolvedValue({ messages });
}

async function renderThread() {
    const { container } = render(<AiDesignerSection campaignName="c" />);
    await screen.findByPlaceholderText('What are we building?'); // mounted past the status probe
    return container;
}

describe('AiDesignerSection raw-JSON replies (AZ2 pretty-print)', () => {
    it('a persisted assistant message whose full text parses as JSON (no text field) still exposes the indented pretty-printed block', async () => {
        seedMessages([{ role: 'ai', content: JSON_TEXT, at: 1 }]);
        const container = await renderThread();

        const block = container.querySelector('pre.ai-designer-msg-json');
        expect(block).toBeTruthy();
        // Indented + readable: multi-line with 2-space nesting…
        expect(block.textContent).toBe(JSON.stringify(JSON_REPLY, null, 2));
        expect(block.textContent).toContain('\n');
        expect(block.textContent).toContain('  "scope": "arc"');
        // …with every byte of data preserved (no truncation).
        expect(block.textContent).toContain('The drowned chapel');
        expect(block.textContent).toContain('"count": 2');
    });

    it('a JSON reply arriving live through chat also renders as a formatted block', async () => {
        api.designerChat.mockResolvedValue({ ok: true, reply: '[{"kind": "faction"}]' });
        const container = await renderThread();

        fireEvent.change(screen.getByPlaceholderText('What are we building?'), { target: { value: 'Build me a cult' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));
        await waitFor(() => expect(container.querySelector('pre.ai-designer-msg-json')).toBeTruthy());
        expect(container.querySelector('pre.ai-designer-msg-json').textContent).toContain('"kind": "faction"');
    });

    it('a prose assistant message renders byte-identically to today (span, no pre)', async () => {
        const prose = 'Love the cult idea — what is its public face?';
        seedMessages([{ role: 'ai', content: prose, at: 1 }]);
        const container = await renderThread();

        expect(container.querySelector('pre')).toBeNull();
        const text = container.querySelector('span.ai-designer-msg-text');
        expect(text).toBeTruthy();
        expect(text.textContent).toBe(prose);
    });

    it('malformed JSON lookalikes render verbatim with no crash and no console error', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const malformed = ['{"a": ', '[1,2'];
        seedMessages(malformed.map((content, i) => ({ role: 'ai', content, at: i })));
        const container = await renderThread();

        expect(container.querySelector('pre')).toBeNull();
        const spans = container.querySelectorAll('span.ai-designer-msg-text');
        expect(Array.from(spans).map(s => s.textContent)).toEqual(malformed);
        expect(errSpy).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('JSON embedded mid-prose is not re-rendered — the whole mixed message stays plain text', async () => {
        const mixed = `Here is my proposal: ${JSON_TEXT} — thoughts?`;
        seedMessages([{ role: 'ai', content: mixed, at: 1 }]);
        const container = await renderThread();

        expect(container.querySelector('pre')).toBeNull();
        expect(container.querySelector('span.ai-designer-msg-text').textContent).toBe(mixed);
    });

    it('a GM-typed JSON blob stays raw (only assistant replies are pretty-printed)', async () => {
        seedMessages([{ role: 'gm', content: JSON_TEXT, at: 1 }]);
        const container = await renderThread();

        expect(container.querySelector('pre')).toBeNull();
        expect(container.querySelector('span.ai-designer-msg-text').textContent).toBe(JSON_TEXT);
    });

    it('scalar prose that happens to be valid JSON (e.g. "42") is not turned into a block', async () => {
        seedMessages([{ role: 'ai', content: '42', at: 1 }]);
        const container = await renderThread();

        expect(container.querySelector('pre')).toBeNull();
        expect(container.querySelector('span.ai-designer-msg-text').textContent).toBe('42');
    });
});

describe('AiDesignerSection raw-JSON replies (PPP text-extract + details-collapse)', () => {
    it('a whole-JSON object with a non-empty string text field renders that prose as a plain message — no JSON painted', async () => {
        const prose = 'Dusk settles over the drowned chapel as the cult gathers.';
        seedMessages([{ role: 'ai', content: `{"type":"narrative","text":${JSON.stringify(prose)},"confidence":0.9}`, at: 1 }]);
        const container = await renderThread();

        const text = container.querySelector('span.ai-designer-msg-text');
        expect(text.textContent).toBe(prose);
        expect(container.querySelector('pre')).toBeNull();
        expect(container.querySelector('details')).toBeNull();
        expect(container.textContent).not.toContain('confidence');
    });

    it('a live chat reply shaped {"type":"narrative",…} shows prose only', async () => {
        api.designerChat.mockResolvedValue({ ok: true, reply: '{"type":"narrative","text":"The marsh fog thickens.","confidence":0.9}' });
        const container = await renderThread();

        fireEvent.change(screen.getByPlaceholderText('What are we building?'), { target: { value: 'Set the scene' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));
        await waitFor(() => expect(screen.getByText('The marsh fog thickens.')).toBeTruthy());
        expect(container.querySelector('pre')).toBeNull();
        expect(container.querySelector('details')).toBeNull();
    });

    it('a whole-JSON object without a usable text field collapses behind a details disclosure naming it a raw JSON reply', async () => {
        seedMessages([{ role: 'ai', content: '{"foo":1}', at: 1 }]);
        const container = await renderThread();

        const details = container.querySelector('details.ai-designer-msg-json-details');
        expect(details).toBeTruthy();
        expect(details.open).toBe(false);
        expect(details.querySelector('summary').textContent).toMatch(/raw json/i);
        // The AZ2 indented pretty-print block survives behind the disclosure.
        const block = details.querySelector('pre.ai-designer-msg-json');
        expect(block.textContent).toBe(JSON.stringify({ foo: 1 }, null, 2));
        // No plain-text face leaks the raw blob outside the disclosure.
        expect(container.querySelector('span.ai-designer-msg-text')).toBeNull();
    });

    it('a whitespace-only or non-string text field is not usable — the reply collapses like any other raw JSON', async () => {
        seedMessages([
            { role: 'ai', content: '{"text":"   "}', at: 1 },
            { role: 'ai', content: '{"text":42}', at: 2 },
        ]);
        const container = await renderThread();

        const disclosures = container.querySelectorAll('details.ai-designer-msg-json-details');
        expect(disclosures.length).toBe(2);
        expect(container.querySelector('span.ai-designer-msg-text')).toBeNull();
    });

    it('a whole-JSON array (no text field anywhere) uses the details-collapsed face', async () => {
        seedMessages([{ role: 'ai', content: '[{"kind":"faction"},{"kind":"npc"}]', at: 1 }]);
        const container = await renderThread();

        const details = container.querySelector('details.ai-designer-msg-json-details');
        expect(details).toBeTruthy();
        expect(details.querySelector('pre.ai-designer-msg-json').textContent).toContain('"kind": "faction"');
    });
});
