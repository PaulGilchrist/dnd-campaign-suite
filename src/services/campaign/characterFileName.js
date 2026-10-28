// Canonical character-name → on-disk filename recipe. MUST stay byte-identical
// with the server POST create route (server/routes/campaigns-character.js:
// `character.name.replace(/[^a-zA-Z0-9]/g, '_')`): case preserved, every
// non-alphanumeric char becomes '_'. Create/edit/delete lanes, the SSE
// delete-mirror (App.jsx) and the healing target fetch all derive filenames
// through this one helper so they can never drift apart again
// (bug-character-delete-sanitizer-mismatch). Kept in its own dependency-free
// module so consumer tests that wholesale-mock campaignService still get the
// real recipe.
export function characterFileName(name) {
    return `${String(name).replace(/[^a-zA-Z0-9]/g, '_')}.json`;
}

export default characterFileName;
