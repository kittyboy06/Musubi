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
import { useAppTheme } from '../utils/ThemeContext';
import {
  fetchTodosFromSupabase,
  addTodoToSupabase,
  toggleTodoInSupabase,
  updateTodoPriorityInSupabase,
  updateTodoDueDateInSupabase,
  fetchNotesFromSupabase,
  subscribeToRealtimeNotes,
  subscribeToRealtimeTodos,
} from '../utils/supabaseSync';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { activeTheme } = useAppTheme();
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [notesCount, setNotesCount] = useState(0);
  const [totalWordCount, setTotalWordCount] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calMonthDate, setCalMonthDate] = useState(new Date());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState(todayStr);
  const [showTaskInput, setShowTaskInput] = useState(false);

  const [showCalendarTaskInput, setShowCalendarTaskInput] = useState(false);
  const [calTaskTitle, setCalTaskTitle] = useState('');
  const [calTaskPriority, setCalTaskPriority] = useState('HIGH');

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

  const getCalendarDays = () => {
    const year = calMonthDate.getFullYear();
    const month = calMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: '', dateStr: '', isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter((t) => t.due_date === dateStr);
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        hasTasks: dayTasks.length > 0,
        taskPriorities: dayTasks.map((t) => t.priority || 'MEDIUM'),
      });
    }
    return days;
  };

  const changeMonth = (delta) => {
    const next = new Date(calMonthDate);
    next.setMonth(next.getMonth() + delta);
    setCalMonthDate(next);
  };

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

  const cyclePriority = (id, event) => {
    if (event) event.stopPropagation();
    const priorityOrder = ['MEDIUM', 'HIGH', 'URGENT', 'LOW'];
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const currIdx = priorityOrder.indexOf(t.priority || 'MEDIUM');
        const nextPriority = priorityOrder[(currIdx + 1) % priorityOrder.length];
        updateTodoPriorityInSupabase(id, nextPriority);
        return { ...t, priority: nextPriority };
      }
      return t;
    });
    setTasks(updated);
  };

  const moveTask = (index, direction, event) => {
    if (event) event.stopPropagation();
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= tasks.length) return;
    const reordered = [...tasks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    setTasks(reordered);
  };

  const sortByPriority = () => {
    const weights = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sorted = [...tasks].sort((a, b) => {
      const wA = weights[a.priority] || 2;
      const wB = weights[b.priority] || 2;
      return wB - wA;
    });
    setTasks(sorted);
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    const newTaskObj = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      due_date: newTaskDueDate || selectedDate || todayStr,
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

  const handleAddCalendarTask = async () => {
    if (!calTaskTitle.trim()) return;
    const targetDate = selectedDate || todayStr;
    const newTaskObj = {
      id: Date.now().toString(),
      title: calTaskTitle.trim(),
      priority: calTaskPriority,
      due_date: targetDate,
      tag: '#DEADLINE',
      done: false,
    };
    setTasks((prev) => [newTaskObj, ...prev]);
    setCalTaskTitle('');
    setShowCalendarTaskInput(false);

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
            <View style={[styles.logoBadge, { backgroundColor: activeTheme.primary, overflow: 'hidden' }]}>
              <Image
                source={require('../../musubi_app_logo.jpg')}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
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

            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarCircle}>
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
              <TouchableOpacity onPress={sortByPriority} style={styles.sortPriorityBtn}>
                <Ionicons name="swap-vertical-outline" size={13} color={theme.colors.primaryLight} />
                <Text style={styles.sortPriorityText}>Sort Priority</Text>
              </TouchableOpacity>
              <Text style={styles.progressText}>
                {completedCount} / {tasks.length} DONE
              </Text>
              <TouchableOpacity onPress={() => setShowTaskInput(!showTaskInput)} style={[styles.addTaskBtn, { backgroundColor: activeTheme.primary }]}>
                <Ionicons name="add" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: activeTheme.primaryLight }]} />
          </View>

          {/* Task Input Box */}
          {showTaskInput && (
            <View style={styles.taskInputCard}>
              <TextInput
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
                placeholder="Enter new task title..."
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.taskInputField}
                autoFocus
              />
              <View style={styles.priorityRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSubtle, marginRight: 2 }}>Priority:</Text>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setNewTaskPriority(p)}
                      style={[
                        styles.priorityPill,
                        newTaskPriority === p && { backgroundColor: activeTheme.primary, borderColor: activeTheme.primary },
                      ]}
                    >
                      <Text style={[styles.priorityPillText, newTaskPriority === p && { color: '#ffffff', fontWeight: '800' }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSubtle, marginRight: 4 }}>Deadline:</Text>
                  <TextInput
                    value={newTaskDueDate}
                    onChangeText={setNewTaskDueDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.textSubtle}
                    style={styles.dueDateInputField}
                  />
                  <TouchableOpacity onPress={handleAddTask} style={[styles.taskSaveBtn, { marginLeft: 8, backgroundColor: activeTheme.primary }]}>
                    <Text style={styles.taskSaveBtnText}>Add Task</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Task List */}
          <View style={styles.taskList}>
            {tasks.length === 0 ? (
              <Text style={{ color: theme.colors.textSubtle, fontSize: 13, paddingVertical: 12, textAlign: 'center' }}>
                No tasks yet. Tap + to add a task.
              </Text>
            ) : (
              tasks.map((task, index) => (
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
                      <TouchableOpacity
                        onPress={(e) => cyclePriority(task.id, e)}
                        style={[
                          styles.priorityBadge,
                          task.priority === 'URGENT' && styles.priorityUrgent,
                          task.priority === 'HIGH' && styles.priorityHigh,
                          task.priority === 'MEDIUM' && styles.priorityMed,
                          task.priority === 'LOW' && styles.priorityLow,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            task.priority === 'URGENT' && styles.priorityUrgentText,
                            task.priority === 'HIGH' && styles.priorityHighText,
                            task.priority === 'MEDIUM' && styles.priorityMedText,
                            task.priority === 'LOW' && styles.priorityLowText,
                          ]}
                        >
                          {task.priority || 'MEDIUM'} 🔄
                        </Text>
                      </TouchableOpacity>
                      {task.due_date && (
                        <View style={styles.deadlineBadge}>
                          <Ionicons name="calendar-outline" size={10} color={theme.colors.primaryLight} style={{ marginRight: 3 }} />
                          <Text style={styles.deadlineBadgeText}>{task.due_date}</Text>
                        </View>
                      )}
                      <Text style={styles.tagText}>{task.tag}</Text>
                    </View>
                  </View>

                  {/* Interactive Drag & Sort Move Buttons */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
                    <TouchableOpacity onPress={(e) => moveTask(index, 'up', e)} disabled={index === 0} style={{ padding: 4, opacity: index === 0 ? 0.3 : 1 }}>
                      <Ionicons name="chevron-up" size={16} color={theme.colors.primaryLight} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(e) => moveTask(index, 'down', e)} disabled={index === tasks.length - 1} style={{ padding: 4, opacity: index === tasks.length - 1 ? 0.3 : 1 }}>
                      <Ionicons name="chevron-down" size={16} color={theme.colors.primaryLight} />
                    </TouchableOpacity>
                    <Ionicons name="reorder-two-outline" size={18} color={theme.colors.primaryLight} style={{ marginLeft: 2 }} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Section 3: Task Deadline Calendar */}
          <View style={styles.calendarSectionHeader}>
            <Text style={styles.sectionTitle}>Task Deadline Calendar</Text>
            <TouchableOpacity onPress={() => setSelectedDate(todayStr)} style={styles.todayPill}>
              <Text style={styles.todayPillText}>Today: {todayStr}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calendarCard}>
            {/* Month Header Navigation */}
            <View style={styles.calendarMonthHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthNavBtn}>
                <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthTitle}>
                {calMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthNavBtn}>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Week Days Labels */}
            <View style={styles.weekDaysRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.weekDayLabel}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {getCalendarDays().map((d, i) => {
                const isSelected = d.dateStr === selectedDate;
                const isToday = d.dateStr === todayStr;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => d.dateStr && setSelectedDate(d.dateStr)}
                    disabled={!d.dateStr}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: activeTheme.primary },
                      isToday && !isSelected && { borderWidth: 1.5, borderColor: activeTheme.primaryLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumText,
                        isSelected && styles.dayNumSelected,
                        isToday && !isSelected && { color: activeTheme.primaryLight, fontWeight: '800' },
                      ]}
                    >
                      {d.dayNum}
                    </Text>
                    {d.hasTasks && (
                      <View style={styles.dotRow}>
                        {d.taskPriorities.slice(0, 3).map((p, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.taskDot,
                              p === 'URGENT' && { backgroundColor: '#be123c' },
                              p === 'HIGH' && { backgroundColor: '#dc2626' },
                              p === 'MEDIUM' && { backgroundColor: '#4f46e5' },
                              p === 'LOW' && { backgroundColor: '#059669' },
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tasks Scheduled for Selected Date */}
            <View style={styles.selectedDateTasksContainer}>
              <View style={styles.dateHeaderRow}>
                <Ionicons name="calendar-outline" size={14} color={activeTheme.primaryLight} />
                <Text style={styles.selectedDateTitle}>
                  Deadlines for {selectedDate === todayStr ? 'Today' : selectedDate}:
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCalendarTaskInput(!showCalendarTaskInput)}
                  style={[styles.addCalendarTaskBtn, { backgroundColor: activeTheme.primary }]}
                >
                  <Ionicons name="add" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.addCalendarTaskBtnText}>Add Deadline Task</Text>
                </TouchableOpacity>
              </View>

              {/* Inline Quick Add Task Box for Calendar Date */}
              {showCalendarTaskInput && (
                <View style={styles.calendarTaskInputCard}>
                  <TextInput
                    value={calTaskTitle}
                    onChangeText={setCalTaskTitle}
                    placeholder={`Enter task due on ${selectedDate}...`}
                    placeholderTextColor={theme.colors.textSubtle}
                    style={styles.taskInputField}
                    autoFocus
                  />
                  <View style={styles.priorityRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSubtle, marginRight: 6 }}>Priority:</Text>
                      {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setCalTaskPriority(p)}
                          style={[
                            styles.priorityPill,
                            calTaskPriority === p && { backgroundColor: activeTheme.primary, borderColor: activeTheme.primary },
                          ]}
                        >
                          <Text style={[styles.priorityPillText, calTaskPriority === p && { color: '#ffffff', fontWeight: '800' }]}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity onPress={handleAddCalendarTask} style={[styles.taskSaveBtn, { backgroundColor: activeTheme.primary }]}>
                      <Text style={styles.taskSaveBtnText}>Save Task</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {tasks.filter((t) => t.due_date === selectedDate).length === 0 ? (
                <Text style={styles.noTasksForDateText}>No deadline tasks scheduled for {selectedDate}. Tap "+ Add Deadline Task" above to add one!</Text>
              ) : (
                tasks
                  .filter((t) => t.due_date === selectedDate)
                  .map((t) => (
                    <View key={t.id} style={styles.deadlineTaskRow}>
                      <TouchableOpacity onPress={() => toggleTask(t.id)} style={[styles.checkboxSmall, { borderColor: activeTheme.primaryLight }]}>
                        {t.done && <Ionicons name="checkmark" size={12} color={activeTheme.primary} />}
                      </TouchableOpacity>
                      <Text style={[styles.deadlineTaskTitle, t.done && styles.taskTitleDone]}>
                        {t.title}
                      </Text>
                      <View
                        style={[
                          styles.priorityBadge,
                          t.priority === 'URGENT' && styles.priorityUrgent,
                          t.priority === 'HIGH' && styles.priorityHigh,
                          t.priority === 'MEDIUM' && styles.priorityMed,
                          t.priority === 'LOW' && styles.priorityLow,
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            t.priority === 'URGENT' && styles.priorityUrgentText,
                            t.priority === 'HIGH' && styles.priorityHighText,
                            t.priority === 'MEDIUM' && styles.priorityMedText,
                            t.priority === 'LOW' && styles.priorityLowText,
                          ]}
                        >
                          {t.priority || 'MEDIUM'}
                        </Text>
                      </View>
                    </View>
                  ))
              )}
            </View>
          </View>

          {/* Quick Vault Launcher (Docked FAB Bar matching Stitch design) */}
          <View style={styles.fabLauncherBar}>
            <TouchableOpacity
              onPress={() => navigation.navigate('VaultExplorer')}
              style={[styles.fabPrimaryBtn, { backgroundColor: activeTheme.primary }]}
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
  },
  taskInputField: {
    width: '100%',
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 10,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  taskSaveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.sm,
  },
  taskSaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
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
  priorityUrgent: { backgroundColor: '#ffe4e6' },
  priorityHigh: { backgroundColor: '#fee2e2' },
  priorityMed: { backgroundColor: '#e0e7ff' },
  priorityLow: { backgroundColor: '#d1fae5' },
  priorityText: { fontSize: 9, fontWeight: '800' },
  priorityUrgentText: { color: '#be123c' },
  priorityHighText: { color: '#dc2626' },
  priorityMedText: { color: '#4f46e5' },
  priorityLowText: { color: '#059669' },
  sortPriorityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sortPriorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primaryLight,
    marginLeft: 4,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBg,
    marginRight: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  priorityPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSubtle,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  calendarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  todayPill: {
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primaryLight,
  },
  calendarCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  calendarMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.inputBg,
  },
  calendarMonthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
  },
  weekDayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSubtle,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
  },
  dayNumText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dayNumSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  dayNumToday: {
    color: theme.colors.primaryLight,
    fontWeight: '800',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  selectedDateTasksContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectedDateTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
  addCalendarTaskBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  addCalendarTaskBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  calendarTaskInputCard: {
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  dueDateInputField: {
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: theme.colors.text,
    fontSize: 11,
    width: 95,
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deadlineBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.primaryLight,
  },
  noTasksForDateText: {
    fontSize: 12,
    color: theme.colors.textSubtle,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  deadlineTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 6,
  },
  checkboxSmall: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  deadlineTaskTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
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
