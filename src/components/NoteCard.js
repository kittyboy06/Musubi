import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';

export default function NoteCard({ note, onPress, onDelete }) {
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const contentText = note.content || note.body || 'No content...';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress(note)}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title || 'Untitled Note'}
        </Text>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          style={styles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.textSubtle} />
        </TouchableOpacity>
      </View>
      <Text style={styles.bodyPreview} numberOfLines={2}>
        {contentText}
      </Text>
      <View style={styles.footer}>
        <Ionicons name="time-outline" size={13} color={theme.colors.textSubtle} style={{ marginRight: 4 }} />
        <Text style={styles.timestamp}>{formatDate(note.updated_at || note.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  deleteBtn: {
    padding: 4,
  },
  bodyPreview: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSubtle,
  },
});
