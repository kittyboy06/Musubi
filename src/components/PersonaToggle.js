import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';

export default function PersonaToggle({ selectedPersona, onSelectPersona }) {
  const isFriend = selectedPersona === 'friend';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => onSelectPersona('friend')}
        activeOpacity={0.8}
        style={[
          styles.optionBtn,
          isFriend && styles.activeFriend,
        ]}
      >
        <Ionicons
          name="heart-outline"
          size={16}
          color={isFriend ? '#ffffff' : theme.colors.textSubtle}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.optionText, isFriend && styles.activeText]}>
          Friend
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onSelectPersona('tyler')}
        activeOpacity={0.8}
        style={[
          styles.optionBtn,
          !isFriend && styles.activeTyler,
        ]}
      >
        <Ionicons
          name="flame-outline"
          size={16}
          color={!isFriend ? '#ffffff' : theme.colors.textSubtle}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.optionText, !isFriend && styles.activeText]}>
          Tyler Durden
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeFriend: {
    backgroundColor: theme.colors.friend.primary,
  },
  activeTyler: {
    backgroundColor: theme.colors.tyler.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
