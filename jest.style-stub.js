// Stub for CSS imports under Jest.
//
// `src/constants/theme.ts` imports `@/global.css` for the web build. Jest has
// no CSS loader, so any test whose module graph reaches theme.ts dies at import
// with a parse error rather than a useful failure. That graph got wider when
// ticketmaster.ts started reading the poster-sizing constants from theme.ts,
// which is what first surfaced this.
//
// Nothing under test reads CSS — the values that matter are the exported JS
// tokens — so an empty object is a complete stand-in.
module.exports = {};
