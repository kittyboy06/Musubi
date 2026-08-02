import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import FloatingNavBar from '../components/FloatingNavBar';
import { useAppTheme } from '../utils/ThemeContext';
import { fetchNotesFromSupabase, saveNoteToSupabase, subscribeToRealtimeNotes } from '../utils/supabaseSync';

/**
 * Builds a nested tree structure from flat notes list:
 * [ { id, title, folder_path, ... } ]
 */
function buildTreeFromNotes(notes) {
  const root = { name: 'Vault Root', isFolder: true, path: '', children: {}, files: [] };

  notes.forEach((note) => {
    const rawPath = note.folder_path ? note.folder_path.trim() : '';
    const parts = rawPath ? rawPath.split('/').filter(Boolean) : [];

    let current = root;
    let accumulatedPath = '';

    parts.forEach((part) => {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          isFolder: true,
          path: accumulatedPath,
          children: {},
          files: [],
        };
      }
      current = current.children[part];
    });

    current.files.push(note);
  });

  return root;
}

function FolderNode({
  folder,
  onSelectNote,
  onNewNoteInFolder,
  expandedFolders,
  toggleFolder,
  depth = 0,
}) {
  const isExpanded = !!expandedFolders[folder.path];
  const folderChildrenKeys = Object.keys(folder.children);
  const totalItemsCount = folderChildrenKeys.length + folder.files.length;

  return (
    <View style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {folder.path !== '' && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleFolder(folder.path)}
          style={styles.folderRow}
        >
          <Ionicons
            name={isExpanded ? 'folder-open' : 'folder'}
            size={20}
            color={theme.colors.primaryLight}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={styles.countBadge}>{totalItemsCount} items</Text>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onNewNoteInFolder(folder.path);
            }}
            style={styles.inlineAddBtn}
          >
            <Ionicons name="add-circle" size={20} color={theme.colors.primaryLight} />
          </TouchableOpacity>

          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={theme.colors.textSubtle}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      )}

      {(isExpanded || folder.path === '') && (
        <View style={folder.path !== '' ? styles.folderChildrenIndent : null}>
          {/* Subfolders */}
          {folderChildrenKeys.map((key) => (
            <FolderNode
              key={folder.children[key].path}
              folder={folder.children[key]}
              onSelectNote={onSelectNote}
              onNewNoteInFolder={onNewNoteInFolder}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              depth={depth + 1}
            />
          ))}

          {/* Markdown Files inside this folder */}
          {folder.files.map((file) => (
            <TouchableOpacity
              key={file.id}
              activeOpacity={0.8}
              onPress={() => onSelectNote(file)}
              style={styles.fileRow}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={theme.colors.primaryLight}
                style={{ marginRight: 10 }}
              />
              <View style={styles.fileTextCol}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.title.endsWith('.md') ? file.title : `${file.title}.md`}
                </Text>
                <Text style={styles.fileSubtext} numberOfLines={1}>
                  {file.content ? file.content.substring(0, 60).replace(/\n/g, ' ') : 'Empty file...'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSubtle} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function VaultExplorerScreen({ navigation }) {
  const { activeTheme } = useAppTheme();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({ '': true });

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('note'); // 'note' or 'folder'
  const [inputName, setInputName] = useState('');
  const [targetFolderPath, setTargetFolderPath] = useState('');

  useEffect(() => {
    async function loadVaultNotes() {
      setLoading(true);
      const data = await fetchNotesFromSupabase();
      setNotes(data);
      setLoading(false);
    }
    loadVaultNotes();

    const unsubscribe = subscribeToRealtimeNotes((freshNotes) => {
      setNotes(freshNotes);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.folder_path && n.folder_path.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  const treeRoot = useMemo(() => buildTreeFromNotes(filteredNotes), [filteredNotes]);

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleOpenCreateModal = (type, folderPath = '') => {
    setModalType(type);
    setTargetFolderPath(folderPath);
    setInputName('');
    setModalVisible(true);
  };

  const handleSelectNote = (note) => {
    navigation.navigate('NoteEditor', { note });
  };

  const handleConfirmCreate = async () => {
    if (!inputName.trim()) {
      Alert.alert('Error', 'Please enter a valid name.');
      return;
    }

    if (modalType === 'note') {
      const cleanTitle = inputName.trim().endsWith('.md') ? inputName.trim() : `${inputName.trim()}.md`;
      const newNoteObj = {
        id: `temp-${Date.now()}`,
        title: cleanTitle,
        folder_path: targetFolderPath,
        content: `# ${cleanTitle.replace(/\.md$/, '')}\n\n`,
        updated_at: new Date().toISOString(),
      };

      setNotes((prev) => [newNoteObj, ...prev]);
      setModalVisible(false);

      const saved = await saveNoteToSupabase(newNoteObj);
      navigation.navigate('NoteEditor', { note: saved || newNoteObj });
    } else {
      const newPath = targetFolderPath ? `${targetFolderPath}/${inputName.trim()}` : inputName.trim();
      setExpandedFolders((prev) => ({ ...prev, [newPath]: true }));
      setModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.topAppBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.primaryLight} />
          </TouchableOpacity>

          <View style={styles.headerTitleCenter}>
            <Ionicons name="folder-open" size={20} color={theme.colors.primaryLight} style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>OBSIDIAN VAULT</Text>
          </View>

          <TouchableOpacity
            onPress={() => handleOpenCreateModal('note')}
            style={[styles.iconBtnPrimary, { backgroundColor: activeTheme.primary }]}
          >
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Top Action Bar & Stats */}
        <View style={styles.actionBanner}>
          <TouchableOpacity
            onPress={() => handleOpenCreateModal('note')}
            style={[styles.actionCardPrimary, { backgroundColor: activeTheme.primary }]}
          >
            <Ionicons name="document-text-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.actionCardPrimaryText}>New Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOpenCreateModal('folder')}
            style={styles.actionCardSecondary}
          >
            <Ionicons name="folder-open-outline" size={20} color={activeTheme.primaryLight} style={{ marginRight: 6 }} />
            <Text style={[styles.actionCardSecondaryText, { color: activeTheme.primary }]}>New Folder</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textSubtle} style={{ marginRight: 10 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search vault notes, folders & content..."
              placeholderTextColor={theme.colors.textSubtle}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textSubtle} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Vault Explorer Tree Body */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.treeScroll} contentContainerStyle={styles.treeScrollContent}>
            {notes.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="folder-open-outline" size={48} color={theme.colors.textSubtle} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyStateTitle}>Your Vault is Empty</Text>
                <Text style={styles.emptyStateSub}>
                  Create your first note or folder to organize your personal knowledge base.
                </Text>
                <TouchableOpacity
                  onPress={() => handleOpenCreateModal('note')}
                  style={styles.emptyStateBtn}
                >
                  <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyStateBtnText}>Create First Note</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FolderNode
                folder={treeRoot}
                onSelectNote={handleSelectNote}
                onNewNoteInFolder={(folderPath) => handleOpenCreateModal('note', folderPath)}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            )}
          </ScrollView>
        )}

        {/* Modal for Creating File / Folder */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {modalType === 'note' ? 'Create New Note' : 'Create New Folder'}
              </Text>
              {targetFolderPath ? (
                <Text style={styles.modalPathText}>Target Folder: {targetFolderPath}/</Text>
              ) : null}

              <TextInput
                value={inputName}
                onChangeText={setInputName}
                placeholder={modalType === 'note' ? 'e.g. Daily Reflection.md' : 'e.g. Projects'}
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.modalInput}
                autoFocus
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleConfirmCreate} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Floating Animated Maroon Navigation Bar */}
        <FloatingNavBar activeRoute="VaultExplorer" navigation={navigation} />
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
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBanner: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actionCardPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryContainer,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  actionCardPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  actionCardSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  actionCardSecondaryText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    padding: 0,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  treeScroll: {
    flex: 1,
  },
  treeScrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  folderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  countBadge: {
    fontSize: 11,
    color: theme.colors.textSubtle,
    marginRight: 8,
    fontWeight: '600',
  },
  inlineAddBtn: {
    paddingHorizontal: 6,
  },
  folderChildrenIndent: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 14,
    paddingLeft: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fileTextCol: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  fileSubtext: {
    fontSize: 11,
    color: theme.colors.textSubtle,
  },

  /* Empty State */
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyStateSub: {
    fontSize: 13,
    color: theme.colors.textSubtle,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  emptyStateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  modalPathText: {
    fontSize: 11,
    color: theme.colors.primaryLight,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: theme.colors.inputBg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.inputBg,
  },
  modalCancelText: {
    color: theme.colors.textSubtle,
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Bottom Nav */
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
