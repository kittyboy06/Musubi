import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { useAppTheme } from '../utils/ThemeContext';

export default function FloatingNavBar({ activeRoute, navigation }) {
  const { activeTheme } = useAppTheme();
  const tabs = [
    { route: 'Dashboard', label: 'HOME', icon: 'home', outlineIcon: 'home-outline' },
    { route: 'VaultExplorer', label: 'JOURNAL', icon: 'folder-open', outlineIcon: 'folder-open-outline' },
    { route: 'GraphView', label: 'GRAPH', icon: 'stats-chart', outlineIcon: 'stats-chart-outline' },
    { route: 'VaultChat', label: 'AI CHAT', icon: 'chatbubbles', outlineIcon: 'chatbubbles-outline' },
  ];

  // Scale animation controllers for each tab
  const scaleAnim0 = useRef(new Animated.Value(1)).current;
  const scaleAnim1 = useRef(new Animated.Value(1)).current;
  const scaleAnim2 = useRef(new Animated.Value(1)).current;
  const scaleAnim3 = useRef(new Animated.Value(1)).current;
  const scaleAnims = [scaleAnim0, scaleAnim1, scaleAnim2, scaleAnim3];

  const handlePress = (targetRoute, index) => {
    // Micro-spring press animation
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.88,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: false,
      }),
    ]).start();

    if (activeRoute !== targetRoute) {
      navigation.navigate(targetRoute);
    }
  };

  return (
    <View style={styles.floatingContainer}>
      <View style={[styles.maroonBar, { backgroundColor: activeTheme.primary }]}>
        {tabs.map((tab, idx) => {
          const isActive = activeRoute === tab.route || (tab.route === 'VaultExplorer' && activeRoute === 'NoteEditor');

          return (
            <Animated.View
              key={tab.route}
              style={[
                styles.tabWrapper,
                { transform: [{ scale: scaleAnims[idx] }] },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePress(tab.route, idx)}
                style={[styles.tabButton, isActive && styles.activeTabButton]}
              >
                <Ionicons
                  name={isActive ? tab.icon : tab.outlineIcon}
                  size={20}
                  color={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)'}
                />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>

                {isActive && <View style={styles.activeGlowDot} />}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  maroonBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.maroonBar,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 500,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 25px rgba(136, 19, 55, 0.45)',
      },
      default: {
        shadowColor: '#881337',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
  },
  activeTabButton: {
    backgroundColor: theme.colors.maroonBarActive,
  },
  tabText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  activeGlowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginTop: 3,
  },
});
