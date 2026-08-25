import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The genre rule and the follow-key normaliser exist twice: once in the app
 * (TypeScript, compiled by Metro) and once in the alert poller (Deno, deployed
 * as an Edge Function). Nothing builds both, so nothing makes them agree.
 *
 * They have to agree, and the two failure modes are quietly different:
 *
 *  - If the *genre* rules drift, the poller records and alerts on shows the app
 *    refuses to display. Someone gets paged about a Harry Styles residency and
 *    then finds nothing in the app, which reads as the app being broken. This
 *    rule has already been rewritten twice in response to Ticketmaster
 *    re-tagging its own data, so it is under active change — exactly the
 *    condition where a second copy rots.
 *
 *  - If *followKey* drifts, nothing visibly breaks at all: the join inside
 *    ingest_concerts stops matching, no alerts are ever queued, and the feature
 *    simply goes quiet. Silence is indistinguishable from "nothing was
 *    announced this week", so this would not be noticed for a long time.
 *
 * Reading the two files as text is deliberately crude, and that is the point —
 * it needs no Deno toolchain and it cannot be fooled by importing one copy and
 * testing it twice.
 */
const repoRoot = join(__dirname, '..', '..', '..');
const appSource = readFileSync(join(repoRoot, 'src', 'services', 'ticketmaster.ts'), 'utf8');
const followsSource = readFileSync(join(repoRoot, 'src', 'services', 'follows.ts'), 'utf8');
const pollerSource = readFileSync(
  join(repoRoot, 'supabase', 'functions', 'poll-concerts', 'index.ts'),
  'utf8',
);
const proxySource = readFileSync(
  join(repoRoot, 'supabase', 'functions', 'concerts', 'index.ts'),
  'utf8',
);

/** Pulls `const NAME = <value>;`, whitespace-normalised so formatting differences
 *  between a Prettier-formatted app file and the Deno one are not false alarms. */
function constantValue(source: string, name: string) {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*([\\s\\S]*?);`, 'm'));
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

function functionBody(source: string, name: string) {
  const match = source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}`, 'm'));
  return match ? match[0].replace(/^export\s+/, '').replace(/\s+/g, ' ').trim() : null;
}

describe('poller parity with the app', () => {
  it.each(['NON_ELECTRONIC_GENRE', 'ELECTRONIC_SUBGENRE'])(
    '%s is identical in the app and the poller',
    (name) => {
      const app = constantValue(appSource, name);
      const poller = constantValue(pollerSource, name);
      // Guards against the regexes being absent and two nulls comparing equal,
      // which would make this test pass while checking nothing at all.
      expect(app).toBeTruthy();
      expect(poller).toBe(app);
    },
  );

  it('followKey normalises identically in the app and the poller', () => {
    const app = functionBody(followsSource, 'followKey');
    const poller = functionBody(pollerSource, 'followKey');
    expect(app).toBeTruthy();
    expect(poller).toBe(app);
  });

  it('isLikelyElectronic itself is identical, not just the regexes it reads', () => {
    // The two regexes matching proves nothing if the logic around them differs
    // — the rule is "drop only when no classification is electronic", and that
    // lives in the function body, not the patterns.
    const app = functionBody(appSource, 'isLikelyElectronic');
    const poller = functionBody(pollerSource, 'isLikelyElectronic');
    expect(app).toBeTruthy();
    expect(poller).toBe(app);
  });

  it('the poller queries the same cities as the concerts proxy', () => {
    // This is the assertion that was missing when it mattered. The poller had
    // `city: 'New York'` while the proxy queried New York, Brooklyn, Queens,
    // Bronx and Staten Island — so Brooklyn Steel, Elsewhere, Avant Gardner and
    // House of Yes were displayed by the app and invisible to the alert engine.
    // A follow on any of them could never fire, with no error anywhere.
    //
    // Compared as sorted city-name sets rather than as source text, since the
    // two files legitimately differ in shape (ALLOWED_CITIES vs CITIES) and
    // formatting. What has to agree is which cities get asked for.
    // Not constantValue(): these two declarations carry type annotations whose
    // own semicolons (`{ cities: string[]; stateCode: string; ... }`) terminate
    // its match early, so it returns null. Slice to the closing brace instead.
    const cityNames = (source: string, constName: string) => {
      const start = source.indexOf(`const ${constName}`);
      expect(start).toBeGreaterThan(-1);
      // Brace-matched, not a search for "\n};" — the proxy indents its closing
      // brace, so a column-0 search ran past it and swallowed unrelated code.
      // Counting from the first brace after "=" also steps over the type
      // annotation's own braces, which sit before it.
      const open = source.indexOf('{', source.indexOf('=', start));
      let depth = 0;
      let end = -1;
      for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) {
          end = i;
          break;
        }
      }
      expect(end).toBeGreaterThan(open);
      const names = [...source.slice(open, end).matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        // Drops the two-letter state and country codes; only city names matter.
        .filter((value) => value.length > 2)
        .sort();
      // Never let a broken extractor pass by comparing two empty arrays.
      expect(names.length).toBeGreaterThan(5);
      return names;
    };
    expect(cityNames(pollerSource, 'CITIES')).toEqual(
      cityNames(proxySource, 'ALLOWED_CITIES'),
    );
  });

  it('the poller applies the genre filter at all', () => {
    // The rules matching is worthless if the poller never calls them. Without
    // this, deleting the call site leaves every assertion above passing.
    expect(pollerSource).toMatch(/if\s*\(!isLikelyElectronic\(/);
  });
});
