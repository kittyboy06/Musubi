import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import FloatingNavBar from '../components/FloatingNavBar';
import {
  fetchTodosFromSupabase,
  addTodoToSupabase,
  toggleTodoInSupabase,
  fetchNotesFromSupabase,
  subscribeToRealtimeNotes,
  subscribeToRealtimeTodos,
} from '../utils/supabaseSync';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [notesCount, setNotesCount] = useState(0);
  const [totalWordCount, setTotalWordCount] = useState(0);

  const [reminders, setReminders] = useState([]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoadingTasks(true);
      const [todosData, notesData] = await Promise.all([
        fetchTodosFromSupabase(),
        fetchNotesFromSupabase(),
      ]);
      setTasks(todosData);
      setNotesCount(notesData.length);

      const words = notesData.reduce((acc, note) => {
        const text = note.content || note.body || '';
        return acc + (text.trim() ? text.trim().split(/\s+/).length : 0);
      }, 0);
      setTotalWordCount(words);

      setLoadingTasks(false);
    }
    loadData();

    // Subscribe to realtime database updates across devices
    const unsubscribeNotes = subscribeToRealtimeNotes((freshNotes) => {
      setNotesCount(freshNotes.length);
      const words = freshNotes.reduce((acc, note) => {
        const text = note.content || note.body || '';
        return acc + (text.trim() ? text.trim().split(/\s+/).length : 0);
      }, 0);
      setTotalWordCount(words);
    });

    const unsubscribeTodos = subscribeToRealtimeTodos((freshTodos) => {
      setTasks(freshTodos);
    });

    return () => {
      unsubscribeNotes();
      unsubscribeTodos();
    };
  }, []);

  const completedCount = tasks.filter((t) => t.done).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const toggleTask = (id) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextDone = !t.done;
        toggleTodoInSupabase(id, nextDone);
        return { ...t, done: nextDone };
      }
      return t;
    });
    setTasks(updated);
  };

  const toggleReminder = (id) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const newTaskObj = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      priority: 'MEDIUM',
      tag: '#TODAY',
      done: false,
    };
    setTasks([newTaskObj, ...tasks]);
    setNewTaskTitle('');
    setShowTaskInput(false);

    const savedTask = await addTodoToSupabase(newTaskObj);
    if (savedTask && savedTask.id) {
      setTasks((prev) => prev.map((t) => (t.id === newTaskObj.id ? savedTask : t)));
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Musubi?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* TopAppBar (Matching Stitch Dashboard design) */}
        <View style={styles.topAppBar}>
          <View style={styles.brandLeft}>
            <View style={styles.logoBadge}>
              <Ionicons name="flower-outline" size={20} color={theme.colors.primaryLight} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Musubi</Text>
              <Text style={styles.dateLabel}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.topAppBarRight}>
            <TouchableOpacity onPress={() => navigation.navigate('GraphView')} style={styles.iconCircle}>
              <Ionicons name="git-network-outline" size={18} color={theme.colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.avatarCircle}>
              <Ionicons name="person-outline" size={16} color={theme.colors.primaryLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Dashboard Body */}
        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* Section 1: Hero Overview - Daily Reflection Stats */}
          <View style={styles.heroCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>Vault Overview</Text>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.textSubtle} />
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>VAULT NOTES</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{notesCount}</Text>
                  <Text style={styles.statUnit}>Files</Text>
                </View>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TASK COMPLETION</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{progressPercent}</Text>
                  <Text style={styles.statUnit}>%</Text>
                </View>
              </View>
            </View>

            <View style={styles.statsPillsRow}>
              <View style={styles.pillStat}>
                <Ionicons name="create-outline" size={16} color={theme.colors.primaryLight} />
                <Text style={styles.pillStatText}>{totalWordCount} WORDS</Text>
              </View>
              <View style={styles.pillStat}>
                <Ionicons name="list-outline" size={16} color={theme.colors.primaryLight} />
                <Text style={styles.pillStatText}>{tasks.length} TASKS</Text>
              </View>
            </View>
          </View>

          {/* Section 2: To-Do & Tasks - Today's Focus */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Focus</Text>
            <View style={styles.sectionRightRow}>
              <Text style={styles.progressText}>
                {completedCount} / {tasks.length} DONE
              </Text>
              <TouchableOpacity onPress={() => setShowTaskInput(!showTaskInput)} style={styles.addTaskBtn}>
                <Ionicons name="add" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Task Input Box */}
          {showTaskInput && (
            <View style={styles.taskInputCard}>
              <TextInput
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
                placeholder="Enter new task..."
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.taskInputField}
                autoFocus
              />
              <TouchableOpacity onPress={handleAddTask} style={styles.taskSaveBtn}>
                <Text style={styles.taskSaveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Task List */}
          <View style={styles.taskList}>
            {tasks.length === 0 ? (
              <Text style={{ color: theme.colors.textSubtle, fontSize: 13, paddingVertical: 12, textAlign: 'center' }}>
                No tasks yet. Tap + to add a task.
              </Text>
            ) : (
              tasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  activeOpacity={0.8}
                  onPress={() => toggleTask(task.id)}
                  style={[styles.taskCard, task.done && styles.taskCardDone]}
                >
                  <TouchableOpacity onPress={() => toggleTask(task.id)} style={styles.checkbox}>
                    {task.done && <Ionicons name="checkmark" size={14} color={theme.colors.primary} />}
                  </TouchableOpacity>

                  <View style={styles.taskTextCol}>
                    <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <View style={styles.tagsRow}>
                      <View
                        style={[
                          styles.priorityBadge,
                          task.priority === 'HIGH' && styles.priorityHigh,
                          task.priority === 'MEDIUM' && styles.priorityMed,
                          task.priority === 'LOW' && styles.priorityLow,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            task.priority === 'HIGH' && styles.priorityHighText,
                            task.priority === 'MEDIUM' && styles.priorityMedText,
                            task.priority === 'LOW' && styles.priorityLowText,
                          ]}
                        >
                          {task.priority}
                        </Text>
                      </View>
                      <Text style={styles.tagText}>{task.tag}</Text>
                    </View>
                  </View>

                  <Ionicons name="reorder-two-outline" size={18} color={theme.colors.textSubtle} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Section 3: Reminders - Coming Up */}
          <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Coming Up</Text>
          <View style={styles.remindersCard}>
            {reminders.length === 0 ? (
              <Text style={{ color: theme.colors.textSubtle, fontSize: 13, padding: 14, textAlign: 'center' }}>
                No upcoming reminders.
              </Text>
            ) : (
              reminders.map((rem, idx) => (
                <View
                  key={rem.id}
                  style={[
                    styles.reminderItem,
                    idx < reminders.length - 1 && styles.reminderItemBorder,
                  ]}
                >
                  <View style={styles.reminderLeft}>
                    <View style={styles.reminderIconCircle}>
                      <Ionicons name={rem.icon} size={18} color={theme.colors.primaryLight} />
                    </View>
                    <View>
                      <Text style={styles.reminderTitle}>{rem.title}</Text>
                      <Text style={styles.reminderTime}>{rem.time}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => toggleReminder(rem.id)}
                    style={[styles.toggleSwitch, rem.active && styles.toggleSwitchActive]}
                  >
                    <View style={[styles.toggleThumb, rem.active && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Quick Vault Launcher (Docked FAB Bar matching Stitch design) */}
          <View style={styles.fabLauncherBar}>
            <TouchableOpacity
              onPress={() => navigation.navigate('VaultExplorer')}
              style={styles.fabPrimaryBtn}
            >
              <Ionicons name="book-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.fabPrimaryBtnText}>OBSIDIAN VAULT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('VaultChat')}
              style={styles.fabSecondaryBtn}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.primaryLight} style={{ marginRight: 6 }} />
              <Text style={styles.fabSecondaryBtnText}>START VAULTCHAT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Floating Animated Maroon Navigation Bar */}
        <FloatingNavBar activeRoute="Dashboard" navigation={navigation} />
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
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 22,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSubtle,
    letterSpacing: 0.8,
  },
  topAppBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSubtle,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statUnit: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  statsPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  pillStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  pillStatText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  sectionRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primaryLight,
    marginRight: 8,
  },
  addTaskBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 3,
  },
  taskInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  taskInputField: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
  },
  taskSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  taskSaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  taskList: {
    gap: 8,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  taskCardDone: {
    opacity: 0.6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskTextCol: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityHigh: { backgroundColor: '#fee2e2' },
  priorityMed: { backgroundColor: '#e0e7ff' },
  priorityLow: { backgroundColor: '#d1fae5' },
  priorityText: { fontSize: 9, fontWeight: '800' },
  priorityHighText: { color: '#dc2626' },
  priorityMedText: { color: '#4f46e5' },
  priorityLowText: { color: '#059669' },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  remindersCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  reminderItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reminderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16161c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  reminderTime: {
    fontSize: 12,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.border,
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  fabLauncherBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
    gap: 10,
  },
  fabPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fabSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  fabSecondaryBtnText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bottomNavBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
