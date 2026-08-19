import AppTabs from '@/components/app-tabs';

/**
 * The tab bar, scoped to this group only.
 *
 * Screens outside `(tabs)` — a show's own screen, the legal pages, the
 * password reset — are siblings of this group rather than children of it, so
 * they open as full screens over the tabs instead of being unreachable.
 *
 * That distinction was not cosmetic. Previously every route lived under the
 * tab navigator, which renders only routes carrying a Trigger; anything
 * without one fell through to the default tab. Visiting /terms directly
 * rendered the home screen, and had done since those pages were written.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
