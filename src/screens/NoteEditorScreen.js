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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import FloatingNavBar from '../components/FloatingNavBar';
import { useAppTheme } from '../utils/ThemeContext';
import { fetchNotesFromSupabase, saveNoteToSupabase, uploadImageToSupabaseStorage } from '../utils/supabaseSync';
import VaultExplorer from '../components/VaultExplorer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NoteEditorScreen({ route, navigation }) {
  const { activeTheme } = useAppTheme();
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
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Custom Dark Modals State (No Browser Default Popups)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTitleInput, setLinkTitleInput] = useState('');
  const [linkUrlInput, setLinkUrlInput] = useState('https://');

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
        console.warn('Fetch backlinks error:', err);
      }
    };

    fetchBacklinks();
  }, [title, activeNoteId, notesList]);

  // Debounced auto-save function
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

  const insertAtCursor = (textToInsert) => {
    const start = selection.start ?? content.length;
    const end = selection.end ?? content.length;
    const before = content.substring(0, start);
    const after = content.substring(end);
    const updated = before + textToInsert + after;
    setContent(updated);
    triggerAutoSave(title, updated, folderPath);
  };

  const applyFormatting = (type) => {
    const start = selection.start ?? content.length;
    const end = selection.end ?? content.length;
    const selectedText = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);

    let replacement = '';

    switch (type) {
      case 'bold':
        replacement = selectedText ? `**${selectedText}**` : '**bold text**';
        break;
      case 'italic':
        replacement = selectedText ? `*${selectedText}*` : '*italic text*';
        break;
      case 'h1':
        replacement = before.endsWith('\n') || start === 0 ? '# ' : '\n# ';
        break;
      case 'h2':
        replacement = before.endsWith('\n') || start === 0 ? '## ' : '\n## ';
        break;
      case 'link':
        setLinkTitleInput(selectedText || 'Link Title');
        setLinkUrlInput('https://');
        setShowLinkModal(true);
        return;
      case 'checkbox':
        replacement = before.endsWith('\n') || start === 0 ? '- [ ] ' : '\n- [ ] ';
        break;
      case 'quote':
        replacement = before.endsWith('\n') || start === 0 ? '> ' : '\n> ';
        break;
      default:
        replacement = type;
    }

    const updated = before + replacement + after;
    setContent(updated);
    triggerAutoSave(title, updated, folderPath);
  };

  const confirmInsertLink = () => {
    setShowLinkModal(false);
    const titleText = linkTitleInput.trim() || 'Link Title';
    const urlText = linkUrlInput.trim();
    let replacement = '';
    if (urlText && (urlText.startsWith('http://') || urlText.startsWith('https://'))) {
      replacement = `[${titleText}](${urlText})`;
    } else if (urlText) {
      replacement = `[[${urlText}]]`;
    } else {
      replacement = `[[${titleText}]]`;
    }
    insertAtCursor(replacement);
  };

  const handlePickImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result;
            setSaveStatus('saving');
            const publicCdnUrl = await uploadImageToSupabaseStorage(dataUrl, file.name);
            setAttachedImage(publicCdnUrl);
            const imageMarkdown = `\n\n![${file.name}](${publicCdnUrl})\n\n`;
            insertAtCursor(imageMarkdown);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      setLinkTitleInput('Attached Image');
      setLinkUrlInput('');
      setShowLinkModal(true);
    }
  };

  const insertMarkdown = (syntax) => {
    insertAtCursor(syntax);
  };

  const handleDelete = () => {
    if (!activeNoteId) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteNote = async () => {
    if (!activeNoteId) return;

    setDeleting(true);
    try {
      await supabase.from('notes').delete().eq('id', activeNoteId);
      const remaining = notesList.filter((n) => n.id !== activeNoteId);
      setNotesList(remaining);

      if (remaining.length > 0) {
        handleSelectNote(remaining[0]);
      } else {
        setActiveNoteId(null);
        setTitle('');
        setContent('');
      }
    } catch (err) {
      console.warn('Delete error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
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
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={[
              styles.scrollContent,
              backlinks.length > 0 && { paddingBottom: 310 },
            ]}
          >
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
                  <TouchableOpacity onPress={() => applyFormatting('bold')} style={styles.toolItem}>
                    <Text style={[styles.toolText, { fontWeight: '800' }]}>B</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyFormatting('italic')} style={styles.toolItem}>
                    <Text style={[styles.toolText, { fontStyle: 'italic', fontWeight: '700' }]}>/</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyFormatting('h1')} style={styles.toolItem}>
                    <Text style={styles.toolText}>H1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyFormatting('h2')} style={styles.toolItem}>
                    <Text style={styles.toolText}>H2</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    style={[styles.toolItem, { backgroundColor: activeTheme.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }]}
                  >
                    <Ionicons name="image-outline" size={15} color="#ffffff" />
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>Image</Text>
                  </TouchableOpacity>
                  <View style={styles.toolDivider} />
                  <TouchableOpacity onPress={() => applyFormatting('link')} style={styles.toolItem}>
                    <Ionicons name="link-outline" size={16} color={theme.colors.primaryLight} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyFormatting('checkbox')} style={styles.toolItem}>
                    <Ionicons name="checkbox-outline" size={16} color={theme.colors.primaryLight} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyFormatting('quote')} style={styles.toolItem}>
                    <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.colors.primaryLight} />
                  </TouchableOpacity>
                  <View style={styles.toolDivider} />
                  <TouchableOpacity onPress={handleDelete} disabled={deleting} style={[styles.toolItem, { backgroundColor: 'rgba(225, 29, 72, 0.15)' }]}>
                    <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
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
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  placeholder="Write your markdown thoughts here..."
                  placeholderTextColor={theme.colors.textSubtle}
                  multiline
                  style={styles.bodyInput}
                  textAlignVertical="top"
                />
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
            </View>
          </ScrollView>
        </View>

        {/* Pinned Obsidian Backlinks Section Above Navbar */}
        {backlinks.length > 0 && (
          <View style={styles.pinnedBacklinksCard}>
            <View style={styles.pinnedBacklinksHeader}>
              <Ionicons name="git-network-outline" size={14} color={theme.colors.primaryLight} />
              <Text style={styles.pinnedBacklinksTitle}>
                LINKED VAULT REFERENCES ({backlinks.length})
              </Text>
            </View>
            <ScrollView style={styles.pinnedBacklinksScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
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
            </ScrollView>
          </View>
        )}

        {/* Custom Delete Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="trash-bin-outline" size={22} color="#f43f5e" />
                </View>
                <Text style={styles.modalHeaderTitle}>Delete Note</Text>
              </View>
              <Text style={styles.modalBodyMessage}>
                Are you sure you want to delete <Text style={{ fontWeight: '800', color: '#fb7185' }}>"{title}"</Text> from your vault?
              </Text>
              <Text style={styles.modalSubMessage}>
                This will permanently remove the note from your local vault and Supabase cloud database.
              </Text>
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  onPress={() => setShowDeleteModal(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDeleteNote}
                  disabled={deleting}
                  style={styles.modalDeleteBtn}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalDeleteBtnText}>Delete Note</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Custom Insert Link Modal */}
        <Modal
          visible={showLinkModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLinkModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={[styles.modalIconWrap, { backgroundColor: 'rgba(225, 29, 72, 0.15)' }]}>
                  <Ionicons name="link-outline" size={20} color={theme.colors.primaryLight} />
                </View>
                <Text style={styles.modalHeaderTitle}>Insert Link</Text>
              </View>

              <Text style={styles.inputLabel}>Link Title / Text:</Text>
              <TextInput
                value={linkTitleInput}
                onChangeText={setLinkTitleInput}
                placeholder="e.g. My Note or Web Link..."
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.modalTextInput}
              />

              <Text style={styles.inputLabel}>URL or Vault Note Title:</Text>
              <TextInput
                value={linkUrlInput}
                onChangeText={setLinkUrlInput}
                placeholder="e.g. https://google.com or Daily Notes..."
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.modalTextInput}
              />

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  onPress={() => setShowLinkModal(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmInsertLink}
                  style={styles.modalConfirmBtn}
                >
                  <Text style={styles.modalConfirmBtnText}>Insert Link</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Floating Animated Maroon Navigation Bar */}
        <FloatingNavBar activeRoute="NoteEditor" navigation={navigation} />
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
    position: 'relative',
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
    paddingBottom: 110,
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
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 24,
    minHeight: 480,
  },
  attachImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16161c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginTop: 14,
  },
  attachImageText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primaryLight,
    marginLeft: 8,
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
  pinnedBacklinksCard: {
    position: 'absolute',
    bottom: 125,
    left: 16,
    right: 16,
    backgroundColor: '#16161c',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#881337',
    padding: 8,
    maxHeight: 110,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 900,
  },
  pinnedBacklinksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pinnedBacklinksTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fb7185',
    marginLeft: 6,
    letterSpacing: 0.6,
  },
  pinnedBacklinksScroll: {
    maxHeight: 52,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 2000,
  },
  customModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#16161c',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#881337',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  modalBodyMessage: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalSubMessage: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fb7185',
    marginBottom: 6,
    marginTop: 4,
  },
  modalTextInput: {
    backgroundColor: '#1f1f2e',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 12,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 10,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  modalDeleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#e11d48',
  },
  modalDeleteBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#881337',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
