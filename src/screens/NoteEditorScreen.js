import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import { fetchNotesFromSupabase, saveNoteToSupabase } from '../utils/supabaseSync';
import VaultExplorer from '../components/VaultExplorer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NoteEditorScreen({ route, navigation }) {
  const routeNote = route.params?.note;

  const [notesList, setNotesList] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(routeNote?.id || null);
  const [title, setTitle] = useState(routeNote?.title || '');
  const [folderPath, setFolderPath] = useState(routeNote?.folder_path || '');
  const [content, setContent] = useState(routeNote?.content || '');

  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  const [deleting, setDeleting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [showGraphSection, setShowGraphSection] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [backlinks, setBacklinks] = useState([]);

  const saveTimerRef = useRef(null);

  // 1. Initial Load of Vault Notes
  useEffect(() => {
    async function loadVault() {
      const data = await fetchNotesFromSupabase();
      setNotesList(data);
      if (!activeNoteId && data.length > 0) {
        const initial = routeNote || data[0];
        setActiveNoteId(initial.id);
        setTitle(initial.title || 'Untitled.md');
        setFolderPath(initial.folder_path || '');
        setContent(initial.content || '');
      }
    }
    loadVault();
  }, []);

  // 2. Fetch Backlinks for Current Note
  useEffect(() => {
    if (!title.trim() || title.length < 3) return;

    const fetchBacklinks = async () => {
      try {
        const cleanTitle = title.replace(/\.md$/, '').trim();
        const { data, error } = await supabase
          .from('notes')
          .select('id, title, content, folder_path, updated_at')
          .neq('id', activeNoteId || '00000000-0000-0000-0000-000000000000')
          .ilike('content', `%${cleanTitle}%`);

        if (!error && data) {
          setBacklinks(data);
        } else {
          // Local fallback matching
          const matched = notesList.filter(
            (n) =>
              n.id !== activeNoteId &&
              n.content &&
              n.content.toLowerCase().includes(cleanTitle.toLowerCase())
          );
          setBacklinks(matched);
        }
      } catch (err) {
        console.warn('Backlinks fetch error:', err);
      }
    };

    fetchBacklinks();
  }, [title, activeNoteId, notesList]);

  // 3. Auto Save Active Note
  const triggerAutoSave = useCallback(
    (newTitle, newContent, newFolderPath) => {
      setSaveStatus('unsaved');

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        try {
          const notePayload = {
            id: activeNoteId,
            title: newTitle.trim() || 'Untitled.md',
            folder_path: newFolderPath || '',
            content: newContent,
            attachedImage,
          };

          const saved = await saveNoteToSupabase(notePayload);

          if (saved) {
            setSaveStatus('saved');
            if (saved.id && !activeNoteId) {
              setActiveNoteId(saved.id);
            }
            // Update local notesList state
            setNotesList((prev) => {
              const exists = prev.some((n) => n.id === (saved.id || activeNoteId));
              if (exists) {
                return prev.map((n) =>
                  n.id === (saved.id || activeNoteId) ? { ...n, ...notePayload, id: saved.id || n.id } : n
                );
              }
              return [{ ...notePayload, id: saved.id || Date.now().toString() }, ...prev];
            });
          } else {
            setSaveStatus('saved');
          }
        } catch (err) {
          console.warn('Auto-save error:', err);
          setSaveStatus('saved');
        }
      }, 1000);
    },
    [activeNoteId, attachedImage]
  );

  // Switch Active Note from Vault Tree
  const handleSelectNote = (note) => {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setFolderPath(note.folder_path || '');
    setContent(note.content || '');
    setAttachedImage(note.image_url || null);
    setSaveStatus('saved');
    if (SCREEN_WIDTH < 768) {
      setIsDrawerOpen(false);
    }
  };

  // Create New Note in Vault
  const handleCreateNoteInVault = async (newNoteData) => {
    const tempId = `temp-${Date.now()}`;
    const newNoteObj = {
      id: tempId,
      title: newNoteData.title,
      folder_path: newNoteData.folder_path || '',
      content: newNoteData.content || `# ${newNoteData.title}\n\n`,
      updated_at: new Date().toISOString(),
    };

    setNotesList((prev) => [newNoteObj, ...prev]);
    handleSelectNote(newNoteObj);

    const saved = await saveNoteToSupabase(newNoteObj);
    if (saved && saved.id) {
      setActiveNoteId(saved.id);
      setNotesList((prev) =>
        prev.map((n) => (n.id === tempId ? { ...newNoteObj, id: saved.id } : n))
      );
    }
  };

  const handleTitleChange = (text) => {
    setTitle(text);
    triggerAutoSave(text, content, folderPath);
  };

  const handleContentChange = (text) => {
    setContent(text);
    triggerAutoSave(title, text, folderPath);
  };

  const insertMarkdown = (snippet) => {
    const updated = content + (content.length > 0 && !content.endsWith('\n') ? '\n' : '') + snippet;
    setContent(updated);
    triggerAutoSave(title, updated, folderPath);
  };

  const handleDelete = async () => {
    if (!activeNoteId) return;

    Alert.alert('Delete Note', `Delete "${title}" from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          await supabase.from('notes').delete().eq('id', activeNoteId);
          setDeleting(false);

          const remaining = notesList.filter((n) => n.id !== activeNoteId);
          setNotesList(remaining);

          if (remaining.length > 0) {
            handleSelectNote(remaining[0]);
          } else {
            setActiveNoteId(null);
            setTitle('');
            setContent('');
          }
        },
      },
    ]);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // Breadcrumbs string
  const breadcrumbPath = folderPath
    ? `Vault > ${folderPath.split('/').join(' > ')} > ${title}`
    : `Vault > ${title}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top AppBar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('VaultExplorer')} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.primaryLight} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('VaultExplorer')}
            style={styles.vaultToggleBtn}
          >
            <Ionicons name="folder-open" size={18} color={theme.colors.primaryLight} />
            <Text style={styles.vaultToggleText}>VAULT EXPLORER</Text>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() =>
                handleCreateNoteInVault({
                  title: `Untitled_${notesList.length + 1}.md`,
                  folder_path: folderPath,
                })
              }
              style={styles.iconBtn}
            >
              <Ionicons name="add" size={20} color={theme.colors.primaryLight} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowGraphSection(!showGraphSection)}
              style={[styles.iconBtn, { marginLeft: 6 }]}
            >
              <Ionicons name="git-network-outline" size={20} color={theme.colors.primaryLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Breadcrumb Path Bar */}
        <View style={styles.breadcrumbBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Ionicons name="documents-outline" size={14} color={theme.colors.primaryLight} style={{ marginRight: 6 }} />
            <Text style={styles.breadcrumbText}>{breadcrumbPath}</Text>
          </ScrollView>

          <View style={styles.saveStatusBadge}>
            <View
              style={[
                styles.statusDot,
                saveStatus === 'saving' && { backgroundColor: '#f59e0b' },
                saveStatus === 'unsaved' && { backgroundColor: '#ef4444' },
              ]}
            />
            <Text style={styles.saveStatusText}>
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'unsaved'
                ? 'Unsaved'
                : 'Vault Synced'}
            </Text>
          </View>
        </View>

        {/* Main Body */}
        <View style={styles.mainBody}>
          {/* Editor Workspace */}
          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* Relationship Graph Section (Optional) */}
            {showGraphSection && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate('GraphView')}
                style={styles.graphSectionCard}
              >
                <View style={styles.graphHeader}>
                  <Text style={styles.graphTitle}>VAULT KNOWLEDGE GRAPH</Text>
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                  </View>
                </View>

                <View style={styles.graphPreviewArea}>
                  <View style={styles.nodeCenter}>
                    <Text style={styles.nodeCenterText}>{title.replace(/\.md$/, '')}</Text>
                  </View>
                  {notesList.slice(0, 3).map((n, idx) => (
                    <View
                      key={n.id}
                      style={[
                        styles.nodeSub,
                        idx === 0 && { top: 12, left: 24 },
                        idx === 1 && { top: 12, right: 24 },
                        idx === 2 && { bottom: 12, left: '35%' },
                      ]}
                    >
                      <Text style={styles.nodeSubText}>{n.title.replace(/\.md$/, '')}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            )}

            {/* Editor Card */}
            <View style={styles.editorCard}>
              {/* Formatting Toolbar */}
              <View style={styles.toolbar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity onPress={() => insertMarkdown('**bold**')} style={styles.toolItem}>
                    <Text style={[styles.toolText, { fontWeight: '800' }]}>B</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('*italic*')} style={styles.toolItem}>
                    <Text style={[styles.toolText, { fontStyle: 'italic' }]}>I</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('# ')} style={styles.toolItem}>
                    <Text style={styles.toolText}>H1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('## ')} style={styles.toolItem}>
                    <Text style={styles.toolText}>H2</Text>
                  </TouchableOpacity>
                  <View style={styles.toolDivider} />
                  <TouchableOpacity onPress={() => insertMarkdown('[[Link]]')} style={styles.toolItem}>
                    <Ionicons name="link-outline" size={16} color={theme.colors.primaryLight} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('- [ ] ')} style={styles.toolItem}>
                    <Ionicons name="checkbox-outline" size={16} color={theme.colors.primaryLight} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => insertMarkdown('> ')} style={styles.toolItem}>
                    <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.colors.primaryLight} />
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Title & Body TextInput */}
              <View style={styles.inputArea}>
                <TextInput
                  value={title}
                  onChangeText={handleTitleChange}
                  placeholder="File name (e.g. Note.md)..."
                  placeholderTextColor={theme.colors.textSubtle}
                  style={styles.titleInput}
                />

                <View style={styles.divider} />

                <TextInput
                  value={content}
                  onChangeText={handleContentChange}
                  placeholder="Write your markdown thoughts here..."
                  placeholderTextColor={theme.colors.textSubtle}
                  multiline
                  style={styles.bodyInput}
                  textAlignVertical="top"
                />

                {/* Attached Image Preview */}
                {attachedImage && (
                  <View style={styles.imagePreviewCard}>
                    <Image source={{ uri: attachedImage }} style={styles.previewImage} />
                    <TouchableOpacity
                      onPress={() => setAttachedImage(null)}
                      style={styles.removeImageBtn}
                    >
                      <Ionicons name="close" size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Obsidian Backlinks Section */}
              {backlinks.length > 0 && (
                <View style={styles.backlinksContainer}>
                  <Text style={styles.backlinksHeaderTitle}>Linked Vault References ({backlinks.length})</Text>
                  {backlinks.map((bl) => (
                    <TouchableOpacity
                      key={bl.id}
                      onPress={() => handleSelectNote(bl)}
                      style={styles.backlinkCard}
                    >
                      <View style={styles.backlinkTitleRow}>
                        <Ionicons name="document-text-outline" size={14} color={theme.colors.primaryLight} />
                        <Text style={styles.backlinkTitle}>
                          {bl.folder_path ? `${bl.folder_path}/${bl.title}` : bl.title}
                        </Text>
                      </View>
                      <Text style={styles.backlinkSnippet} numberOfLines={2}>
                        {bl.content}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Footer Metadata Bar */}
        <View style={styles.footerBar}>
          <Text style={styles.footerText}>{wordCount} words</Text>
          <Text style={styles.footerText}>{charCount} characters</Text>
          <TouchableOpacity onPress={handleDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNavBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.navItem}>
            <Ionicons name="home-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('VaultExplorer')} style={styles.navItem}>
            <Ionicons name="folder-open-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>JOURNAL</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('GraphView')} style={styles.navItem}>
            <Ionicons name="stats-chart-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>GRAPH</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('VaultChat')} style={styles.navItem}>
            <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>AI CHAT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    height: '100%',
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  vaultToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  vaultToggleBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  vaultToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primaryLight,
    marginLeft: 6,
    letterSpacing: 0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#16161c',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  breadcrumbText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  saveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  saveStatusText: {
    fontSize: 11,
    color: theme.colors.textSubtle,
    fontWeight: '600',
  },
  mainBody: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerWrapper: {
    width: 280,
    height: '100%',
    zIndex: 10,
  },
  scrollBody: {
    flex: 1,
    height: '100%',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  graphSectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  graphTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSubtle,
    letterSpacing: 0.8,
  },
  liveBadge: {
    backgroundColor: '#ffdcc3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#6a3b0e',
  },
  graphPreviewArea: {
    height: 120,
    backgroundColor: '#16161c',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeCenter: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  nodeCenterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  nodeSub: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nodeSubText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  editorCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  toolItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    marginRight: 6,
  },
  toolText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
  },
  toolDivider: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.border,
    marginHorizontal: 6,
  },
  inputArea: {
    padding: 16,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 12,
  },
  bodyInput: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    minHeight: 250,
  },
  imagePreviewCard: {
    marginTop: 14,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.md,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backlinksContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: '#16161c',
  },
  backlinksHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primaryLight,
    marginBottom: 8,
  },
  backlinkCard: {
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 6,
  },
  backlinkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backlinkTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 6,
  },
  backlinkSnippet: {
    fontSize: 11,
    color: theme.colors.textSubtle,
  },
  footerBar: {
    height: 40,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.textSubtle,
    fontWeight: '600',
  },
  bottomNavBar: {
    height: 60,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  navTextActive: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.primaryLight,
    marginTop: 2,
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primaryLight,
  },
});
