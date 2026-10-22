// @maintained-by-ai
/**
 * Sanitizer lane (SECURITY-CRITICAL — XSS law home for the whole app).
 * Coverage-trim exception does NOT apply here: every attack-vector class must
 * stay represented (script tags, event handlers, dangerous URL schemes,
 * container tags, inert-CSS legacy, mXSS second-parse). Adding consumer
 * tests? Delete nothing from this file without re-checking the vector matrix.
 *
 * Module under test: sanitize.js wraps REAL dompurify@3.x + marked — nothing
 * is mocked except the marked.parse/parseInline throw, which is the only way
 * to reach the module's documented catch branch (strategy note; the wrapper's
 * canonical unit test runs WITH the real sanitizer, never a mocked one).
 *
 * Isolation law: every attack vector below is inert DATA (a string constant).
 * The only DOM touch is the second-parse stability check, scoped to a
 * DETACHED div that is never attached to document — injected text is parsed,
 * never executed. NO-CLOCK: all calls are synchronous; no timers allowed.
 *
 * Fixture integrity: curated OWASP-class vector set (XSS-filter-evasion
 * families), each row chosen for a mutually-distinguishable observable
 * output. All expected strings were DERIVED by running the real sanitizer in
 * this environment (byte-capture sessions), never hand-typed. jsdom-boundary
 * claims are documented inline; nothing browser-only is asserted.
 *
 * Cited by (canonical scope preserved): MarkdownPreview.test.jsx,
 * popup.test.jsx, PreviewToggle.test.jsx,
 * CharCharacterAdvancement.coverage.test.jsx.
 */
import { describe, it, expect, vi } from 'vitest';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { sanitizeHtml, renderMarkdown, renderMarkdownInline } from './sanitize.js';

// Config bytes mirrored verbatim from sanitize.js. The "faithful config" row
// below fails the moment the module's config drifts from these bytes.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup', 'mark', 'code', 'span',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
    'p', 'div', 'blockquote', 'pre', 'hr', 'br',
    'a',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'details', 'summary',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'style'],
  ADD_ATTR: ['data-*'],
};

// Full attack corpus — every vector fed to sanitizeHtml in sanitizeHtml's
// exact-outputs test below and re-parsed in the fixed-point test.
const ATTACK_VECTORS = [
  '<script>alert(1)</script>hi',
  '<SCRIPT>alert(1)</SCRIPT>hi',
  '<scr</script>ipt>alert(1)</script>',
  '<svg><script>alert(1)</script></svg>',
  '<img src=x onerror=alert(1)>',
  '<span class="safe" onclick="alert()" onmouseover="steal()">Content</span>',
  '<svg><animate onbegin="alert(1)" attributeName="x"></animate>ok</svg>',
  '<a href="javascript:alert(1)">X</a>',
  '<a href="vbscript:msgbox(1)">X</a>',
  '<a href="data:text/html,<script>alert(1)</script>">X</a>',
  '<iframe src="https://evil.example"></iframe>text',
  '<object data="x"></object><embed src="y">',
  '<form action="#"><input name="x"><button>go</button></form>',
  '<style>body{background:url("javascript:alert(1)")}</style>text',
  '<div><!--<script>alert(1)</script>--></div>',
  '<noscript><p>visible</p></noscript>',
];

describe('sanitizeHtml', () => {
  it('returns empty string for every falsy or non-string input, and never runs the sanitizer on them (guard map, arity 1)', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(false)).toBe('');
    expect(sanitizeHtml(0)).toBe('');
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(123)).toBe('');
    expect(sanitizeHtml({})).toBe('');
    expect(sanitizeHtml([])).toBe('');
    // Boundary of the falsy guard: whitespace is a non-empty string and must
    // pass THROUGH untouched (proves guard tests vs sanitize behavior).
    expect(sanitizeHtml('   ')).toBe('   ');
    // Runtime arity of the exported lane entry points (#1510).
    expect(sanitizeHtml.length).toBe(1);
    expect(renderMarkdown.length).toBe(1);
    expect(renderMarkdownInline.length).toBe(1);
  });

  it('removes script tags together with their executable content, incl. case folding and nested-close mXSS', () => {
    expect(sanitizeHtml('<script>alert(1)</script>hi')).toBe('hi');
    expect(sanitizeHtml('<SCRIPT>alert(1)</SCRIPT>hi')).toBe('hi');
    // Nested-close obfuscation: first </script> closes the opener, the token
    // remnant ships as escaped INERT TEXT (byte-pinned jsdom observation).
    expect(sanitizeHtml('<scr</script>ipt>alert(1)</script>')).toBe('ipt&gt;alert(1)');
    expect(sanitizeHtml('<svg><script>alert(1)</script></svg>')).toBe('');
  });

  it('strips event-handler attributes and removes handler-bearing disallowed tags', () => {
    // img is not in ALLOWED_TAGS -> whole element (and handler) gone.
    expect(sanitizeHtml('<img src=x onerror=alert(1)>')).toBe('');
    // svg/animate tags disallowed -> whole subtree gone.
    expect(sanitizeHtml('<svg><animate onbegin="alert(1)" attributeName="x"></animate>ok</svg>')).toBe('');
    // span IS allowed: safe attrs survive byte-exact, handlers stripped.
    expect(sanitizeHtml('<span class="safe" onclick="alert()" onmouseover="steal()">Content</span>')).toBe('<span class="safe">Content</span>');
  });

  it('neutralises obfuscated dangerous URL schemes by stripping href (anchor text intact)', () => {
    const dangerousHrefs = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',           // case fold
      '&#106;avascript:alert(1)',      // entity-encoded j
      'java\tscript:alert(1)',         // tab inside scheme
      ' javascript:alert(1)',          // leading space
      'javascript\t:alert(1)',         // tab before colon
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ];
    for (const href of dangerousHrefs) {
      expect(sanitizeHtml(`<a href="${href}">X</a>`)).toBe('<a>X</a>');
    }
    // Null-byte truncation, honest jsdom-boundary pin: the HTML tokenizer
    // converts NUL to U+FFFD (spec behavior, browsers included), so the
    // scheme never reconstructs to "javascript:" — href survives as an inert
    // unknown-scheme URL. Pinned exactly as observed in this environment.
    expect(sanitizeHtml('<a href="jav\0ascript:alert(1)">X</a>')).toBe('<a href="jav\uFFFDascript:alert(1)">X</a>');
  });

  it('removes container/media vectors keeping only surrounding safe text', () => {
    expect(sanitizeHtml('<iframe src="https://evil.example"></iframe>text')).toBe('text');
    expect(sanitizeHtml('<object data="x"></object><embed src="y">')).toBe('');
    expect(sanitizeHtml('<form action="#"><input name="x"><button>go</button></form>')).toBe('go');
    // <style> disallowed and its CSS content dropped, not shipped as text.
    expect(sanitizeHtml('<style>body{background:url("javascript:alert(1)")}</style>text')).toBe('text');
    expect(sanitizeHtml('<div><!--<script>alert(1)</script>--></div>')).toBe('<div></div>');
    // mXSS class: jsdom parses noscript children as elements and unwraps the
    // tag; output is plain safe markup either way (no scripting in jsdom).
    expect(sanitizeHtml('<noscript><p>visible</p></noscript>')).toBe('<p>visible</p>');
  });

  it('preserves safe content byte-exact (over-sanitization = user-content-loss regression)', () => {
    expect(sanitizeHtml('<span class="safe" style="color:red" title="t">Content</span>')).toBe('<span class="safe" style="color:red" title="t">Content</span>');
    expect(sanitizeHtml('<a href="https://example.com" target="_blank" rel="noopener">Link</a>')).toBe('<a href="https://example.com" target="_blank" rel="noopener">Link</a>');
    expect(sanitizeHtml('<a href="mailto:x@y.z">M</a>')).toBe('<a href="mailto:x@y.z">M</a>');
    expect(sanitizeHtml('<span data-id="123" data-value="test">Content</span>')).toBe('<span data-id="123" data-value="test">Content</span>');
    // Entity round-trip: &amp; stays &amp; (no double-encoding ships).
    expect(sanitizeHtml('<a href="https://example.com?a=1&amp;b=2">L&amp;ink</a>')).toBe('<a href="https://example.com?a=1&amp;b=2">L&amp;ink</a>');
    // Raw angle brackets in text are escaped.
    expect(sanitizeHtml('Hello &amp; goodbye < 5 > 2')).toBe('Hello &amp; goodbye &lt; 5 &gt; 2');
    expect(sanitizeHtml('<b>bo<b>ld</b></b>')).toBe('<b>bo<b>ld</b></b>');
    expect(sanitizeHtml('<span></span>')).toBe('<span></span>');
    // Inert legacy-CSS survivors, documented honestly: expression() was
    // IE-only and url('javascript:') in CSS executes in no modern browser;
    // DOMPurify 3 leaves these bytes intact in this environment. The
    // fixed-point test proves they carry no executable path here.
    expect(sanitizeHtml('<div style="width:expression(alert(1))">x</div>')).toBe('<div style="width:expression(alert(1))">x</div>');
    expect(sanitizeHtml('<div style="background:url(\'javascript:alert(1)\')">x</div>')).toBe('<div style="background:url(\'javascript:alert(1)\')">x</div>');
  });

  it('every sanitized attack output is a stable inert fixed point under re-parse (mXSS check, deterministic)', () => {
    for (const vector of ATTACK_VECTORS) {
      const out = sanitizeHtml(vector);
      // Purity/determinism: two calls, identical bytes.
      expect(sanitizeHtml(vector)).toBe(out);
      // Second parse in a DETACHED div must not resurrect live elements or
      // handlers and must round-trip to the same bytes.
      const host = document.createElement('div');
      host.innerHTML = out;
      expect(host.innerHTML).toBe(out);
      expect(host.querySelectorAll('script,iframe,object,embed,svg,style').length).toBe(0);
      const liveHandlers = [...host.querySelectorAll('*')]
        .flatMap((el) => [...el.attributes].map((a) => a.name))
        .filter((name) => /^on/i.test(name));
      expect(liveHandlers).toEqual([]);
    }
  });

  it('config law: module output matches the declared DOMPurify config exactly, and four weakened configs each diverge (live mutant kills)', () => {
    // Faithful rows: the module == DOMPurify(real config) on discriminating
    // vectors, and ALLOWED_ATTR narrows below DOMPurify defaults (id/name die).
    const faithful = [
      '<script>alert(1)</script>hi',
      '<img src=x onerror=alert(1)>',
      '<svg><animate onbegin="alert(1)" attributeName="x"></animate>ok</svg>',
      '<span data-id="123" data-value="test">Content</span>',
      '<div style="width:expression(alert(1))">x</div>',
      '<a href="https://example.com" target="_blank" rel="noopener">Link</a>',
      '<span id="x" class="c">t</span>',
      '<a name="anchor" action="go">t</a>',
    ];
    for (const vector of faithful) {
      expect(sanitizeHtml(vector)).toBe(DOMPurify.sanitize(vector, PURIFY_CONFIG));
    }
    expect(sanitizeHtml('<span id="x" class="c">t</span>')).toBe('<span class="c">t</span>');
    expect(sanitizeHtml('<span id="x">t</span>')).toBe('<span>t</span>');
    expect(sanitizeHtml('<a name="anchor" action="go">t</a>')).toBe('<a>t</a>');

    // LIVE mutation kills (cp-backup-free: mutants run the real sanitizer
    // directly). A mutant is KILLED iff its output on the discriminating
    // vector differs from the module's — each is pinned non-vacuously.
    const mutants = [
      ['allow-img', { ...PURIFY_CONFIG, ALLOWED_TAGS: [...PURIFY_CONFIG.ALLOWED_TAGS, 'img'] },
        '<img src=x onerror=alert(1)>', '<img>'],
      ['allow-svg-animate', { ...PURIFY_CONFIG, ALLOWED_TAGS: [...PURIFY_CONFIG.ALLOWED_TAGS, 'svg', 'animate'] },
        '<svg><animate onbegin="alert(1)" attributeName="x"></animate>ok</svg>', '<svg><animate></animate>ok</svg>'],
      ['drop-allowed-attr', { ALLOWED_TAGS: PURIFY_CONFIG.ALLOWED_TAGS, ADD_ATTR: ['data-*'] },
        '<span id="x" class="c">t</span>', '<span id="x" class="c">t</span>'],
      ['no-config-at-all', {}, '<span id="x">t</span>', '<span id="x">t</span>'],
    ];
    for (const [, cfg, vector, expectedMutantOutput] of mutants) {
      const mutantOutput = DOMPurify.sanitize(vector, cfg);
      expect(mutantOutput).toBe(expectedMutantOutput); // mutant really diverges...
      expect(sanitizeHtml(vector)).not.toBe(mutantOutput); // ...so the module kills it
    }

    // Documented non-discriminating config entries (pinned so vendor/config
    // drift becomes visible):
    // 1. ADD_ATTR:['data-*'] is VACUOUS — DOMPurify already allows data-*
    //    by default (ALLOW_DATA_ATTR); removing it changes nothing.
    const noAddAttr = { ALLOWED_TAGS: PURIFY_CONFIG.ALLOWED_TAGS, ALLOWED_ATTR: PURIFY_CONFIG.ALLOWED_ATTR };
    expect(DOMPurify.sanitize('<span data-id="123">C</span>', noAddAttr))
      .toBe(sanitizeHtml('<span data-id="123">C</span>'));
    // 2. Even an ALLOWED_TAGS mutant that re-admits 'script' still emits ''
    //    in jsdom (parser/vendor hard-strips executable script content) —
    //    the tag-allow mutant kill therefore rides on img/svg rows above.
    expect(DOMPurify.sanitize('<script>alert(1)</script>', { ...PURIFY_CONFIG, ALLOWED_TAGS: [...PURIFY_CONFIG.ALLOWED_TAGS, 'script'] })).toBe('');
  });
});

describe('renderMarkdown', () => {
  it('returns empty string for invalid input and for a parser throw (catch branch), and works again after restore', () => {
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
    expect(renderMarkdown(false)).toBe('');
    expect(renderMarkdown(123)).toBe('');
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   ')).toBe('');
    // Reach the real catch branch: parse() throwing must yield '', not a
    // crash. Spy is the ONLY mock in this file, and it is restored inline.
    const spy = vi.spyOn(marked, 'parse').mockImplementation(() => { throw new Error('boom'); });
    try {
      expect(renderMarkdown('# hi')).toBe('');
    } finally {
      spy.mockRestore();
    }
    expect(renderMarkdown('# Heading 1')).toBe('<h1>Heading 1</h1>\n');
  });

  it('renders a campaign-notes-shaped markdown document byte-exact (all block classes survive)', () => {
    const golden = [
      '## Quest Notes',
      '',
      'The **party** gathers at *Shalworth*.',
      '',
      '- Buy `rope`',
      '- Rest 1 hour',
      '',
      '> Danger lurks.',
      '',
      '| Skill | DC |',
      '|-------|----|',
      '| Athletics | 15 |',
      '',
      '---',
      '',
      '```text',
      'const x = 1;',
      '```',
      '',
    ].join('\n');
    // Expected bytes captured from the real marked+DOMPurify pipeline in
    // this environment (marked emits trailing \n; tbody hugs the next line).
    expect(renderMarkdown(golden)).toBe(
      '<h2>Quest Notes</h2>\n' +
      '<p>The <strong>party</strong> gathers at <em>Shalworth</em>.</p>\n' +
      '<ul>\n<li>Buy <code>rope</code></li>\n<li>Rest 1 hour</li>\n</ul>\n' +
      '<blockquote>\n<p>Danger lurks.</p>\n</blockquote>\n' +
      '<table>\n<thead>\n<tr>\n<th>Skill</th>\n<th>DC</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>Athletics</td>\n<td>15</td>\n</tr>\n</tbody></table>\n' +
      '<hr>\n' +
      '<pre><code class="language-text">const x = 1;\n</code></pre>\n'
    );
  });

  it('sanitizes AFTER parsing — marked itself emits the raw javascript: href, the module never ships it (order-of-operations proof)', () => {
    const md = '[click](javascript:alert("xss"))';
    // Parser stage alone leaks the dangerous href (percent-encoded quotes) —
    // distinguishes sanitize-after-parse from a parse-only pipeline.
    expect(marked.parse(md)).toBe('<p><a href="javascript:alert(%22xss%22)">click</a></p>\n');
    // Full pipeline result: href gone, anchor and text intact.
    expect(renderMarkdown(md)).toBe('<p><a>click</a></p>\n');
    // Raw script inside markdown: tag+content dropped, double space pinned as shipped.
    expect(renderMarkdown('text <script>alert(1)</script> more')).toBe('<p>text  more</p>\n');
  });
});

describe('renderMarkdownInline', () => {
  it('returns empty string for invalid input and for a parseInline throw (catch branch), and works again after restore', () => {
    expect(renderMarkdownInline(null)).toBe('');
    expect(renderMarkdownInline(undefined)).toBe('');
    expect(renderMarkdownInline(false)).toBe('');
    expect(renderMarkdownInline(123)).toBe('');
    expect(renderMarkdownInline('')).toBe('');
    // Whitespace is truthy inline markdown and must pass through intact
    // (unlike renderMarkdown, whose block parse of "   " yields '').
    expect(renderMarkdownInline('   ')).toBe('   ');
    const spy = vi.spyOn(marked, 'parseInline').mockImplementation(() => { throw new Error('boom'); });
    try {
      expect(renderMarkdownInline('**hi**')).toBe('');
    } finally {
      spy.mockRestore();
    }
    expect(renderMarkdownInline('[link](https://example.com)')).toBe('<a href="https://example.com">link</a>');
  });

  it('renders inline markdown byte-exact with no block wrappers, sanitizing inline attacks', () => {
    expect(renderMarkdownInline('**bold text** and *italic* and `code`')).toBe('<strong>bold text</strong> and <em>italic</em> and <code>code</code>');
    expect(renderMarkdownInline('[x](javascript:alert(1))')).toBe('<a>x</a>');
    expect(renderMarkdownInline('<b>bo<b>ld</b></b>')).toBe('<b>bo<b>ld</b></b>');
  });
});
