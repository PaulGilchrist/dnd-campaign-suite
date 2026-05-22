const fs = require('fs');
const path = require('path');

describe('App.css .app rule', () => {
  it('should have padding-bottom to prevent content from touching the bottom edge', () => {
    const css = fs.readFileSync(path.join(__dirname, 'App.css'), 'utf-8');

    const appRuleMatch = css.match(/\.app\s*{([^}]+)}/);
    expect(appRuleMatch).toBeTruthy();

    const appRule = appRuleMatch[1];
    expect(appRule).toContain('padding-bottom: 20px');
  });
});
