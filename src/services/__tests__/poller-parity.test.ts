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

  it('the poller applies the genre filter at all', () => {
    // The rules matching is worthless if the poller never calls them. Without
    // this, deleting the call site leaves every assertion above passing.
    expect(pollerSource).toMatch(/if\s*\(!isLikelyElectronic\(/);
  });
});
