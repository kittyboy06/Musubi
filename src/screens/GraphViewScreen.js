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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import { fetchNotesFromSupabase } from '../utils/supabaseSync';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GraphViewScreen({ navigation }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedNode, setSelectedNode] = useState(null);

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
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* TopAppBar (Matching Stitch KnowledgeGraph design) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Knowledge Graph</Text>

          <TouchableOpacity onPress={fetchNotes} style={styles.iconBtn}>
            <Ionicons name="refresh-outline" size={20} color={theme.colors.primaryLight} />
          </TouchableOpacity>
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
              style={[styles.pill, filterType === 'all' && styles.pillActive]}
            >
              <Text style={[styles.pillText, filterType === 'all' && styles.pillTextActive]}>
                All ({nodes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterType('linked')}
              style={[styles.pill, filterType === 'linked' && styles.pillActive]}
            >
              <Text style={[styles.pillText, filterType === 'linked' && styles.pillTextActive]}>
                Linked Nodes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterType('orphans')}
              style={[styles.pill, filterType === 'orphans' && styles.pillActive]}
            >
              <Text style={[styles.pillText, filterType === 'orphans' && styles.pillTextActive]}>
                Orphan Nodes
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Graph Visualizer Canvas */}
        <View style={styles.graphCanvas}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primaryLight} />
          ) : (
            <View style={styles.nodeLayer}>
              {nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const nodeSize = Math.max(38, 38 + node.connections * 5);

                return (
                  <TouchableOpacity
                    key={node.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedNode(node)}
                    style={[
                      styles.graphNode,
                      {
                        left: node.x,
                        top: node.y,
                        width: nodeSize,
                        height: nodeSize,
                        borderRadius: nodeSize / 2,
                        borderColor: node.color || theme.colors.primaryLight,
                      },
                      isSelected && styles.selectedNodeHalo,
                    ]}
                  >
                    <Ionicons
                      name="ellipse"
                      size={Math.min(16, nodeSize * 0.4)}
                      color={node.color || theme.colors.primaryLight}
                    />
                    <Text
                      style={[styles.nodeLabel, isSelected && styles.selectedNodeLabel]}
                      numberOfLines={1}
                    >
                      {node.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                style={styles.openNoteBtn}
              >
                <Text style={styles.openNoteBtnText}>Open Note</Text>
                <Ionicons name="arrow-forward" size={14} color="#ffffff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* BottomNavBar */}
        <View style={styles.bottomNavBar}>
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.navItem}>
            <Ionicons name="home-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('NoteEditor')} style={styles.navItem}>
            <Ionicons name="create-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>JOURNAL</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItemActive}>
            <Ionicons name="stats-chart" size={20} color={theme.colors.primaryLight} />
            <Text style={styles.navTextActive}>GRAPH</Text>
            <View style={styles.activeDot} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('VaultChat')} style={styles.navItem}>
            <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>AI CHAT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  controlsBar: {
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
    height: 38,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
  },
  filterPills: {
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#16161c',
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  pillText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  graphCanvas: {
    flex: 1,
    backgroundColor: '#0d0d10',
    position: 'relative',
    overflow: 'hidden',
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
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
    backgroundColor: theme.colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  sheetSnippet: {
    fontSize: 13,
    color: theme.colors.textSecondary,
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
    color: theme.colors.textSubtle,
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
});
