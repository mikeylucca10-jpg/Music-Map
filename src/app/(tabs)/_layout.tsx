import AppTabs from '@/components/app-tabs';
import { FilterStateProvider } from '@/hooks/use-filter-state';

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
 *
 * The filter provider sits here rather than at the root because the list and
 * the map are the only two screens that share a filter, and both are in this
 * group. A show's own screen deliberately keeps its own city — it is looking
 * up one listing, not browsing a filtered set.
 */
export default function TabsLayout() {
  return (
    <FilterStateProvider>
      <AppTabs />
    </FilterStateProvider>
  );
}
