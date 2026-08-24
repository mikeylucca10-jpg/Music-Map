import { LegalBold, LegalBullet, LegalSection, LegalText } from '@/components/legal-section';
import { SettingsDetailScreen } from '@/components/settings-detail-screen';

// TODO(legal): two things must happen before any public release.
// 1. Replace CONTACT_EMAIL. App stores reject privacy policies with no working
//    contact route, and it's the only way a user can exercise the deletion
//    request described below.
// 2. Have a lawyer review this. It's written to be accurate about what the
//    code actually does, but accuracy isn't the same as compliance — GDPR/CCPA
//    obligations depend on where users are, not on what the app does.
const CONTACT_EMAIL = 'REPLACE_WITH_YOUR_CONTACT_EMAIL';

const LAST_UPDATED = 'August 15, 2026';

export default function PrivacyPolicyScreen() {
  return (
    <SettingsDetailScreen title="Privacy Policy" subtitle={`Last updated ${LAST_UPDATED}`}>
      <LegalSection heading="The short version">
        <LegalText>
          Music Map helps you find electronic music events. We store the account details you give us
          and the shows you save. Your location never leaves your device. We don&apos;t run ads, we
          don&apos;t use analytics or tracking SDKs, and we don&apos;t sell your data to anyone.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Your location">
        <LegalText>
          This is the part that matters most, so it goes first. If you grant location access, the
          app uses your coordinates for exactly two things: showing how far away each event is, and
          drawing your position on the map.
        </LegalText>
        <LegalBullet>
          Your coordinates are used <LegalBold>on your device only</LegalBold>. They are never
          uploaded to our servers, never attached to your account, and never shared with anyone.
        </LegalBullet>
        <LegalBullet>
          We request foreground location only — the app does not track you in the background.
        </LegalBullet>
        <LegalBullet>
          Location is optional. The app works fine without it; you just won&apos;t see distances. You
          can grant or revoke it at any time in your device settings.
        </LegalBullet>
      </LegalSection>

      <LegalSection heading="What we store">
        <LegalText>
          If you create an account, the following is stored on our behalf by Supabase, our hosting
          and authentication provider:
        </LegalText>
        <LegalBullet>
          Your email address and password. Passwords are hashed by Supabase — we never see or store
          your actual password.
        </LegalBullet>
        <LegalBullet>Your display name and default city, if you set them.</LegalBullet>
        <LegalBullet>
          The events you save, along with a copy of their details (name, venue, date, artwork) so a
          saved event still displays correctly after it drops out of the live listings.
        </LegalBullet>
        <LegalText>
          You can browse events without an account. If you never sign up, we store nothing about you
          on our servers.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Stored on your device">
        <LegalText>
          The app keeps a local cache so it opens quickly and still works on a poor connection:
          recent event listings, your profile, your saved events, and whether you&apos;ve answered
          the location prompt. Clearing the app&apos;s data or uninstalling removes all of it.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Other services involved">
        <LegalBullet>
          <LegalBold>Ticketmaster</LegalBold> supplies the event listings. We query it by city and
          date only — no information about you is sent.
        </LegalBullet>
        <LegalBullet>
          <LegalBold>Supabase</LegalBold> hosts our database and handles sign-in.
        </LegalBullet>
        <LegalBullet>
          <LegalBold>Map providers</LegalBold> render the map. In the web version, tiles come from
          OpenStreetMap, which can see your IP address and the area you&apos;re viewing. On phones,
          Apple Maps or Google Maps provides the map and their own privacy terms apply.
        </LegalBullet>
        <LegalBullet>
          <LegalBold>Ticket sellers.</LegalBold> Tapping a ticket link or &quot;Get Directions&quot;
          opens a third-party site or app. Once you leave Music Map, that company&apos;s privacy
          policy governs what happens next — we have no visibility into it.
        </LegalBullet>
      </LegalSection>

      <LegalSection heading="What we don't do">
        <LegalBullet>No advertising, and no ad networks in the app.</LegalBullet>
        <LegalBullet>No analytics, telemetry, or third-party tracking SDKs.</LegalBullet>
        <LegalBullet>No selling, renting, or trading your personal information.</LegalBullet>
        <LegalBullet>No background location tracking.</LegalBullet>
      </LegalSection>

      <LegalSection heading="Your choices">
        <LegalText>
          You can change your display name and default city, or unsave any event, from the Settings
          screen at any time. To request a copy of your data, or to have your account and everything
          attached to it deleted, contact us at {CONTACT_EMAIL}.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Children">
        <LegalText>
          Music Map isn&apos;t directed at children under 13, and we don&apos;t knowingly collect
          their information. Many listed events are age-restricted and set their own entry
          requirements.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Changes">
        <LegalText>
          If this policy changes in a way that affects how we handle your information, we&apos;ll
          update the date at the top of this page.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalText>Questions about this policy: {CONTACT_EMAIL}</LegalText>
      </LegalSection>
    </SettingsDetailScreen>
  );
}
