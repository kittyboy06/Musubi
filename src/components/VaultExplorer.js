import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';

/**
 * Builds a nested tree structure from flat notes list:
 * [ { id, title, folder_path, ... } ]
 */
function buildTreeFromNotes(notes) {
  const root = { name: 'Root', isFolder: true, path: '', children: {}, files: [] };

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
  activeNoteId,
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
    <View style={{ marginLeft: depth > 0 ? 12 : 0 }}>
      {folder.path !== '' && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleFolder(folder.path)}
          style={styles.folderRow}
        >
          <Ionicons
            name={isExpanded ? 'folder-open-outline' : 'folder-outline'}
            size={16}
            color={theme.colors.primaryLight}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.folderName} numberOfLines={1}>
            {folder.name}
          </Text>
          <Text style={styles.countBadge}>{totalItemsCount}</Text>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onNewNoteInFolder(folder.path);
            }}
            style={styles.inlineAddBtn}
          >
            <Ionicons name="add-circle-outline" size={16} color={theme.colors.textSubtle} />
          </TouchableOpacity>

          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={theme.colors.textSubtle}
            style={{ marginLeft: 4 }}
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
              activeNoteId={activeNoteId}
              onSelectNote={onSelectNote}
              onNewNoteInFolder={onNewNoteInFolder}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              depth={depth + 1}
            />
          ))}

          {/* Markdown Files inside this folder */}
          {folder.files.map((file) => {
            const isActive = activeNoteId === file.id;
            return (
              <TouchableOpacity
                key={file.id}
                activeOpacity={0.8}
                onPress={() => onSelectNote(file)}
                style={[styles.fileRow, isActive && styles.activeFileRow]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={15}
                  color={isActive ? theme.colors.primaryLight : theme.colors.textSubtle}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[styles.fileName, isActive && styles.activeFileName]}
                  numberOfLines={1}
                >
                  {file.title.endsWith('.md') ? file.title : `${file.title}.md`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function VaultExplorer({
  notes = [],
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({
    '': true,
    Daily: true,
    Projects: true,
    'Projects/Android_Dev': true,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('note'); // 'note' or 'folder'
  const [inputName, setInputName] = useState('');
  const [selectedFolderPath, setSelectedFolderPath] = useState('');

  // Filter notes if search string is entered
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
    setSelectedFolderPath(folderPath);
    setInputName('');
    setModalVisible(true);
  };

  const handleConfirmCreate = () => {
    if (!inputName.trim()) {
      Alert.alert('Error', 'Please enter a valid name.');
      return;
    }

    if (modalType === 'note') {
      onCreateNote({
        title: inputName.trim().endsWith('.md') ? inputName.trim() : `${inputName.trim()}.md`,
        folder_path: selectedFolderPath,
        content: `# ${inputName.trim()}\n\nWrite your thoughts here...`,
      });
    } else {
      // Create folder by setting state
      const newFolderPath = selectedFolderPath
        ? `${selectedFolderPath}/${inputName.trim()}`
        : inputName.trim();
      setExpandedFolders((prev) => ({ ...prev, [newFolderPath]: true }));
      if (onCreateFolder) onCreateFolder(newFolderPath);
    }

    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Drawer Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="folder-open" size={18} color={theme.colors.primaryLight} />
          <Text style={styles.headerTitle}>OBSIDIAN VAULT</Text>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={theme.colors.textSubtle} />
        </TouchableOpacity>
      </View>

      {/* Action Bar (+ Note, + Folder) */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          onPress={() => handleOpenCreateModal('note')}
          style={styles.actionBtnPrimary}
        >
          <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={styles.actionBtnPrimaryText}>New Note</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleOpenCreateModal('folder')}
          style={styles.actionBtnSecondary}
        >
          <Ionicons name="folder-open-outline" size={16} color={theme.colors.primaryLight} style={{ marginRight: 4 }} />
          <Text style={styles.actionBtnSecondaryText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={15} color={theme.colors.textSubtle} style={{ marginRight: 8 }} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search vault files..."
          placeholderTextColor={theme.colors.textSubtle}
          style={styles.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={theme.colors.textSubtle} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Vault Tree Navigation */}
      <ScrollView style={styles.treeScroll} showsVerticalScrollIndicator={false}>
        <FolderNode
          folder={treeRoot}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
          onNewNoteInFolder={(folderPath) => handleOpenCreateModal('note', folderPath)}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
        />
      </ScrollView>

      {/* Modal for Creating File / Folder */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalType === 'note' ? 'Create New Note' : 'Create New Folder'}
            </Text>
            {selectedFolderPath ? (
              <Text style={styles.modalPathText}>Location: {selectedFolderPath}/</Text>
            ) : null}

            <TextInput
              value={inputName}
              onChangeText={setInputName}
              placeholder={modalType === 'note' ? 'e.g. Daily Log.md' : 'e.g. Projects'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16161c',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.8,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  actionBar: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  actionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  actionBtnSecondaryText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 12,
    padding: 0,
  },
  treeScroll: {
    flex: 1,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 2,
  },
  folderName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  countBadge: {
    fontSize: 10,
    color: theme.colors.textSubtle,
    marginRight: 6,
    fontWeight: '600',
  },
  inlineAddBtn: {
    paddingHorizontal: 4,
  },
  folderChildrenIndent: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 10,
    paddingLeft: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 2,
  },
  activeFileRow: {
    backgroundColor: theme.colors.accentGlow,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primaryLight,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  activeFileName: {
    color: theme.colors.primaryLight,
    fontWeight: '700',
  },

  /* Modal Styles */
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
});
