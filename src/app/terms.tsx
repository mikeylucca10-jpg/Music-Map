import { LegalBold, LegalBullet, LegalSection, LegalText } from '@/components/legal-section';
import { SettingsDetailScreen } from '@/components/settings-detail-screen';

// TODO(legal): replace CONTACT_EMAIL and get this reviewed by a lawyer before
// any public release — see the matching note in privacy-policy.tsx.
const CONTACT_EMAIL = 'REPLACE_WITH_YOUR_CONTACT_EMAIL';

const LAST_UPDATED = 'August 15, 2026';

export default function TermsScreen() {
  return (
    <SettingsDetailScreen title="Terms of Service" subtitle={`Last updated ${LAST_UPDATED}`}>
      <LegalSection heading="What Music Map is">
        <LegalText>
          Music Map is a discovery tool. It gathers electronic music events happening near you and
          points you to the places selling tickets. By using the app you agree to these terms.
        </LegalText>
      </LegalSection>

      <LegalSection heading="We don't sell tickets">
        <LegalText>
          This is the most important thing to understand. Music Map is not a ticket seller, box
          office, or broker, and we are not a party to any purchase you make.
        </LegalText>
        <LegalBullet>
          Every &quot;buy&quot; link sends you to a third-party seller. Your purchase is a contract
          between you and that seller, under their terms.
        </LegalBullet>
        <LegalBullet>
          Refunds, exchanges, cancellations, transfers, and entry disputes are handled entirely by
          that seller or the venue. We can&apos;t resolve them and have no access to your order.
        </LegalBullet>
      </LegalSection>

      <LegalSection heading="Prices and listings are not guaranteed">
        <LegalText>
          Event details come from third-party sources and can be incomplete, out of date, or wrong.
          Always confirm with the venue or seller before making plans or spending money.
        </LegalText>
        <LegalBullet>
          <LegalBold>Most prices shown are estimates, not offers.</LegalBold> Only prices sourced
          directly from Ticketmaster reflect real listed pricing. Prices shown for other sellers are
          approximations, labelled &quot;estimate&quot; in the app, and are there to give a rough
          sense of range — never rely on them as an actual price.
        </LegalBullet>
        <LegalBullet>
          Events can be moved, rescheduled, sold out, or cancelled without the listing updating.
        </LegalBullet>
        <LegalBullet>
          Age restrictions, entry requirements, and set times are set by the venue and may differ
          from what&apos;s shown.
        </LegalBullet>
        <LegalBullet>
          Distances and directions are approximate and meant for orientation, not navigation. Follow
          your actual maps app and local traffic laws.
        </LegalBullet>
      </LegalSection>

      <LegalSection heading="Your account">
        <LegalText>
          You don&apos;t need an account to browse. If you create one, keep your password to
          yourself — you&apos;re responsible for activity under your account. Give us accurate
          information, and let us know if you think someone else has access.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <LegalText>Please don&apos;t:</LegalText>
        <LegalBullet>
          Scrape, bulk-download, or resell the event data, or use automated tools to hammer the app.
        </LegalBullet>
        <LegalBullet>
          Try to break, overload, or gain unauthorised access to the app or its backend.
        </LegalBullet>
        <LegalBullet>Use the app for anything illegal, or to impersonate someone else.</LegalBullet>
      </LegalSection>

      <LegalSection heading="Availability">
        <LegalText>
          Music Map is provided as-is and as-available, without warranties of any kind. We depend on
          third-party services for event data and may change, interrupt, or discontinue any part of
          the app at any time. To the fullest extent the law allows, we&apos;re not liable for
          losses arising from your use of the app — including missed events, bad listings, or
          anything that happens with a third-party seller.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Ending access">
        <LegalText>
          You can stop using Music Map and delete your account at any time — see the Privacy Policy
          for how. We may suspend access that breaks these terms or puts the service or other people
          at risk.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <LegalText>
          We may update these terms as the app changes. When we do, we&apos;ll update the date at the
          top of this page. Continuing to use the app after a change means you accept the new terms.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalText>Questions about these terms: {CONTACT_EMAIL}</LegalText>
      </LegalSection>
    </SettingsDetailScreen>
  );
}
