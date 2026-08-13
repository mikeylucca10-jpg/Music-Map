import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Category } from '@/hooks/use-concerts-filters';
import { City } from '@/types/concert';

type ConcertsFilterBarProps = {
  category: Category;
  onCategoryChange: (category: Category) => void;
  categories: readonly Category[];
  city: City;
  onCityChange: (city: City) => void;
  cities: City[];
};

export function ConcertsFilterBar({
  category,
  onCategoryChange,
  categories,
  city,
  onCityChange,
  cities,
}: ConcertsFilterBarProps) {
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View>
        <Pressable
          onPress={() => setCityMenuOpen((open) => !open)}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.cityPill}>
            <ThemedText type="smallBold">{city.label} ▾</ThemedText>
          </ThemedView>
        </Pressable>

        {cityMenuOpen && (
          <ThemedView type="backgroundElement" style={styles.cityMenu}>
            {cities.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onCityChange(item);
                  setCityMenuOpen(false);
                }}
                style={({ pressed }) => [styles.cityMenuItem, pressed && styles.pressed]}>
                <ThemedText
                  type={item.id === city.id ? 'smallBold' : 'small'}
                  themeColor={item.id === city.id ? 'text' : 'textSecondary'}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}>
        {categories.map((item) => {
          const selected = item === category;
          return (
            <Pressable
              key={item}
              onPress={() => onCategoryChange(item)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: selected ? theme.accentInk : theme.textSecondary }}>
                  {item}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  cityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  cityMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    borderRadius: Radius.card,
    paddingVertical: Spacing.one,
    minWidth: 160,
    zIndex: 10,
  },
  cityMenuItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipsRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
