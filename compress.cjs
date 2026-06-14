const fs = require('fs');
const path = require('path');

function walk(d) {
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);

        if (fs.statSync(p).isDirectory()) {
            walk(p);
        } else if (p.endsWith('.json')) {
            const j = JSON.stringify(JSON.parse(fs.readFileSync(p, 'utf8')));
            fs.writeFileSync(p, j);
        }
    }
}

walk('dist/data');
