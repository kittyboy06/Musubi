import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import FloatingNavBar from '../components/FloatingNavBar';
import KnowledgeGraph3D from '../components/KnowledgeGraph3D';
import { useAppTheme } from '../utils/ThemeContext';
import { fetchNotesFromSupabase } from '../utils/supabaseSync';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GraphViewScreen({ navigation }) {
  const { activeTheme } = useAppTheme();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedNode, setSelectedNode] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const data = await fetchNotesFromSupabase();
    setNotes(data);
    setLoading(false);
  };

  const { nodes, edges } = useMemo(() => {
    if (!notes || notes.length === 0) return { nodes: [], edges: [] };

    const center = { x: SCREEN_WIDTH / 2 - 20, y: (SCREEN_HEIGHT - 280) / 2 };
    const radius = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT - 280) * 0.35;

    const nodeMap = new Map();
    const edgesArr = [];

    notes.forEach((note, idx) => {
      const angle = (idx / notes.length) * 2 * Math.PI;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);

      nodeMap.set(note.id, {
        id: note.id,
        title: note.title || 'Untitled Note',
        content: note.content || note.body || '',
        x,
        y,
        connections: 0,
        color: note.color || theme.colors.primaryLight,
      });
    });

    notes.forEach((sourceNote) => {
      notes.forEach((targetNote) => {
        if (sourceNote.id !== targetNote.id) {
          const targetTitle = (targetNote.title || '').replace(/\.md$/, '').trim().toLowerCase();
          if (targetTitle && sourceNote.content && sourceNote.content.toLowerCase().includes(targetTitle)) {
            edgesArr.push({
              id: `${sourceNote.id}-${targetNote.id}`,
              from: sourceNote.id,
              to: targetNote.id,
            });
            const src = nodeMap.get(sourceNote.id);
            const tgt = nodeMap.get(targetNote.id);
            if (src) src.connections = (src.connections || 0) + 1;
            if (tgt) tgt.connections = (tgt.connections || 0) + 1;
          }
        }
      });
    });

    let filteredList = Array.from(nodeMap.values());

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredList = filteredList.filter(
        (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }

    if (filterType === 'linked') {
      filteredList = filteredList.filter((n) => n.connections > 1);
    } else if (filterType === 'orphans') {
      filteredList = filteredList.filter((n) => n.connections === 1);
    }

    return { nodes: filteredList, edges: edgesArr };
  }, [notes, searchQuery, filterType]);

  return (
    <View style={[styles.safeArea, { height: '100vh', minHeight: 600 }]}>
      <View style={[styles.container, { flex: 1, height: '100%' }]}>
        {/* TopAppBar (Matching Stitch KnowledgeGraph design) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Knowledge Graph</Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setShowHelpModal(true)} style={[styles.iconBtn, { backgroundColor: activeTheme.primary }]}>
              <Ionicons name="help-circle-outline" size={20} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity onPress={fetchNotes} style={styles.iconBtn}>
              <Ionicons name="refresh-outline" size={20} color={activeTheme.primaryLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Controls & Search */}
        <View style={styles.controlsBar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={theme.colors.textSubtle} style={{ marginRight: 6 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search graph nodes..."
              placeholderTextColor={theme.colors.textSubtle}
              style={styles.searchInput}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
            <TouchableOpacity
              onPress={() => setFilterType('all')}
              style={[styles.pill, filterType === 'all' && { backgroundColor: activeTheme.primary, borderColor: activeTheme.primary }]}
            >
              <Text style={[styles.pillText, filterType === 'all' && styles.pillTextActive]}>
                All ({nodes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterType('linked')}
              style={[styles.pill, filterType === 'linked' && { backgroundColor: activeTheme.primary, borderColor: activeTheme.primary }]}
            >
              <Text style={[styles.pillText, filterType === 'linked' && styles.pillTextActive]}>
                Linked Nodes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterType('orphans')}
              style={[styles.pill, filterType === 'orphans' && { backgroundColor: activeTheme.primary, borderColor: activeTheme.primary }]}
            >
              <Text style={[styles.pillText, filterType === 'orphans' && styles.pillTextActive]}>
                Orphan Nodes
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Graph Visualizer Canvas */}
        <View style={styles.graphCanvas}>
          {/* Floating 3D Controls Info Badge */}
          <TouchableOpacity
            onPress={() => setShowHelpModal(true)}
            style={[styles.helpBadgeBtn, { borderColor: activeTheme.primaryLight, backgroundColor: theme.colors.surface }]}
          >
            <Ionicons name="help-circle" size={16} color={activeTheme.primary} style={{ marginRight: 5 }} />
            <Text style={[styles.helpBadgeText, { color: activeTheme.primary }]}>3D Controls & Info ?</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : nodes.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconBadge}>
                <Ionicons name="git-network-outline" size={44} color={theme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Knowledge Graph Nodes Yet</Text>
              <Text style={styles.emptySubtext}>
                Create notes with wiki-links like [[Note Title]] to automatically generate an interactive network graph.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('VaultExplorer')}
                style={styles.emptyActionBtn}
              >
                <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionBtnText}>Create First Note</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <KnowledgeGraph3D
              nodes={nodes}
              edges={edges}
              onSelectNode={setSelectedNode}
              selectedNode={selectedNode}
            />
          )}
        </View>

        {/* Selected Node Details Bottom Sheet (Matching Stitch design) */}
        {selectedNode && (
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetBadge}>
                  <Ionicons name="git-branch" size={16} color={theme.colors.primaryLight} />
                </View>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {selectedNode.title}
                </Text>
              </View>

              <TouchableOpacity onPress={() => setSelectedNode(null)}>
                <Ionicons name="close" size={20} color={theme.colors.textSubtle} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetSnippet} numberOfLines={2}>
              {selectedNode.content || 'No content snippet available.'}
            </Text>

            <View style={styles.sheetFooter}>
              <Text style={styles.sheetMeta}>
                {selectedNode.connections} Connections • Obsidian Vault Node
              </Text>

              <TouchableOpacity
                onPress={() => {
                  const targetNote = notes.find((n) => n.id === selectedNode.id);
                  navigation.navigate('NoteEditor', { note: targetNote });
                }}
                style={[styles.openNoteBtn, { backgroundColor: activeTheme.primary }]}
              >
                <Text style={styles.openNoteBtnText}>Open Note</Text>
                <Ionicons name="arrow-forward" size={14} color="#ffffff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Floating Animated Maroon Navigation Bar */}
        <FloatingNavBar activeRoute="GraphView" navigation={navigation} />

        {/* 3D Knowledge Graph Controls & Legend Info Modal */}
        <Modal transparent visible={showHelpModal} animationType="fade" onRequestClose={() => setShowHelpModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.customModalCard, { borderColor: activeTheme.primaryLight }]}>
              <View style={styles.modalHeaderRow}>
                <Ionicons name="sparkles" size={24} color={activeTheme.primaryLight} />
                <Text style={[styles.modalHeaderTitle, { color: activeTheme.primaryLight }]}>
                  3D Graph Controls & Legend
                </Text>
              </View>

              <ScrollView style={{ maxHeight: 340 }}>
                <View style={styles.infoRow}>
                  <Ionicons name="hand-right-outline" size={20} color={activeTheme.primaryLight} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoRowTitle}>Click & Drag to Rotate</Text>
                    <Text style={styles.infoRowSubtext}>Orbit 360° around your notes network sphere.</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="expand-outline" size={20} color={activeTheme.primaryLight} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoRowTitle}>Scroll / Pinch to Zoom</Text>
                    <Text style={styles.infoRowSubtext}>Zoom in & out to inspect dense clusters of linked notes.</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="radio-button-on" size={20} color={activeTheme.primaryLight} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoRowTitle}>Tap Node to View Details</Text>
                    <Text style={styles.infoRowSubtext}>Select any node sphere to see title, content snippet, and open note.</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="git-branch-outline" size={20} color={activeTheme.primaryLight} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoRowTitle}>Wiki-Link Connections</Text>
                    <Text style={styles.infoRowSubtext}>Lines connecting nodes represent [[Wiki-Links]] between markdown files.</Text>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity onPress={() => setShowHelpModal(false)} style={[styles.modalGotItBtn, { backgroundColor: activeTheme.primary }]}>
                <Text style={styles.modalGotItBtnText}>Got It!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    height: '100%',
    backgroundColor: '#090d16',
  },
  container: {
    flex: 1,
    height: '100%',
    backgroundColor: '#090d16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  controlsBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  filterPills: {
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  graphCanvas: {
    flex: 1,
    minHeight: 450,
    backgroundColor: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 110,
  },
  emptyIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 320,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    elevation: 3,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  nodeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  graphNode: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  selectedNodeHalo: {
    backgroundColor: theme.colors.primary,
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
  nodeLabel: {
    position: 'absolute',
    bottom: -18,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    maxWidth: 90,
    textAlign: 'center',
  },
  selectedNodeLabel: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 88,
    left: 12,
    right: 12,
    backgroundColor: '#16161c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 1000,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  sheetBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  sheetSnippet: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 12,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  openNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  openNoteBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
  helpBadgeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  helpBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  customModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#16161c',
    borderRadius: theme.borderRadius.lg,
    padding: 22,
    borderWidth: 1.5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoRowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  infoRowSubtext: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
  modalGotItBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalGotItBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
