const fs = require('fs');
const path = require('path');

describe('App.css .app rule', () => {
  it('should have flex column layout', () => {
    const css = fs.readFileSync(path.join(__dirname, 'App.css'), 'utf-8');

    const appRuleMatch = css.match(/\.app\s*{([^}]+)}/);
    expect(appRuleMatch).toBeTruthy();

    const appRule = appRuleMatch[1];
    expect(appRule).toContain('display: flex');
    expect(appRule).toContain('flex-direction: column');
  });
});
