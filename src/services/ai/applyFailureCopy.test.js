// @maintained-by-ai
// Backlog 2026-11-22 (UI) — the failed-apply copy law: plain-English sentence
// first, raw transport error only as a BOUNDED tail (a proxy HTML 500 page
// must never flood the .ai-notice). Deterministic pure-function contract,
// no churn expected when the app changes.
import { describe, it, expect } from 'vitest';
import { applyFailureDetail, RAW_DETAIL_MAX } from './applyFailureCopy.js';

const SENTENCE = 'the save request failed — nothing was changed.';

// A realistic proxy failure page: hundreds of bytes of multi-line HTML.
const HTML_500 = `<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head>
<body>\n<center><h1>502 Bad Gateway</h1></center>\n<hr><center>nginx/1.27.3</center>
<p>The proxy server received an invalid response from the upstream server at
http://proxy.local:8080/upstream/ai/chat/completions while serving the request.</p>
</body></html>`;

describe('applyFailureDetail — plain sentence + bounded raw tail', () => {
    it('opens with the plain-English sentence (what the notice renders after "Not applied: ")', () => {
        expect(applyFailureDetail(new Error('anything')).startsWith(SENTENCE)).toBe(true);
    });

    it('a short raw error is shown verbatim in the details tail', () => {
        const d = applyFailureDetail(new Error('pt2-race-probe'));
        expect(d).toContain('pt2-race-probe');
        expect(d).not.toMatch(/truncated/);
    });

    it('a bare thrown string (lane echoes response text) is treated as the raw detail', () => {
        expect(applyFailureDetail('ledger locked')).toContain('(details: ledger locked)');
    });

    it('a huge raw error (proxy HTML 500 page) is truncated with a visible marker and stays bounded', () => {
        expect(HTML_500.length).toBeGreaterThan(2 * RAW_DETAIL_MAX); // premise: genuinely huge
        const d = applyFailureDetail(new Error(HTML_500));
        expect(d).toContain('[truncated');
        expect(d).toContain('full error in the console'); // where diagnostics live
        expect(d.length).toBeLessThanOrEqual(SENTENCE.length + RAW_DETAIL_MAX + 60);
        // The tail never carries the whole page — nothing past the cap leaks.
        expect(d).not.toContain('upstream/ai/chat/completions while serving');
        expect(d).not.toContain('</body>');
    });

    it('whitespace is collapsed BEFORE the cap so truncation buys readable bytes, not newlines', () => {
        const d = applyFailureDetail(new Error(`Failed to fetch\n\n   \t   \n${'x'.repeat(20)}`));
        expect(d).toContain(`Failed to fetch ${'x'.repeat(20)}`); // run of whitespace → one space
        expect(d).not.toMatch(/\s\s/);
    });

    it('an empty/absent error still names itself honestly', () => {
        expect(applyFailureDetail(undefined)).toContain('(details: unknown error)');
    });
});
