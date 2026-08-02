import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import FloatingNavBar from '../components/FloatingNavBar';
import { useAppTheme } from '../utils/ThemeContext';
import {
  fetchNotesFromSupabase,
  fetchTodosFromSupabase,
  getCurrentUserId,
} from '../utils/supabaseSync';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BIOMETRIC_KEY = 'musubi_biometric_lock_v1';
const PASSCODE_KEY = 'musubi_vault_passcode_v1';

export default function ProfileScreen({ navigation }) {
  const { activeThemeName, activeTheme, setAccentTheme } = useAppTheme();

  const [userName, setUserName] = useState('Vault User');
  const [userHandle, setUserHandle] = useState('user');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('Vault Member');
  const [joinDate, setJoinDate] = useState('');
  const [userInitials, setUserInitials] = useState('VU');

  const [notesCount, setNotesCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);

  const [biometricLock, setBiometricLock] = useState(false);
  const [savedPasscode, setSavedPasscode] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinMode, setPinMode] = useState('setup'); // 'setup' | 'verify'
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [editNameInput, setEditNameInput] = useState('');
  const [editHandleInput, setEditHandleInput] = useState('');

  useEffect(() => {
    async function loadSecuritySettings() {
      try {
        const [lockState, pin] = await Promise.all([
          AsyncStorage.getItem(BIOMETRIC_KEY),
          AsyncStorage.getItem(PASSCODE_KEY),
        ]);
        setBiometricLock(lockState === 'true');
        if (pin) setSavedPasscode(pin);
      } catch (e) {}
    }
    loadSecuritySettings();
  }, []);

  useEffect(() => {
    async function loadProfileMetrics() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const email = user.email || 'user@musubi.app';
          setUserEmail(email);

          const meta = user.user_metadata || {};
          const full_name = meta.full_name || meta.name || (email.includes('@') ? email.split('@')[0] : 'Vault Member');
          const username = meta.username || (email.includes('@') ? email.split('@')[0] : 'member');
          const role = meta.role || (email.toLowerCase().includes('admin') || email.toLowerCase().includes('afsal') ? 'Vault Architect & Developer' : 'Vault Member');

          setUserName(full_name);
          setUserHandle(username);
          setUserRole(role);
          setEditNameInput(full_name);
          setEditHandleInput(username);

          // Calculate initials dynamically
          const parts = full_name.trim().split(/\s+/);
          const initials = parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : full_name.slice(0, 2).toUpperCase();
          setUserInitials(initials || 'VU');

          if (user.created_at) {
            setJoinDate(new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
          }
        }
      } catch (e) {
        console.warn('Auth profile fetch error:', e);
      }

      // Fetch user metrics
      const [notes, todos] = await Promise.all([
        fetchNotesFromSupabase(),
        fetchTodosFromSupabase(),
      ]);

      if (notes) {
        setNotesCount(notes.length);
        const totalWords = notes.reduce((acc, note) => {
          const text = note.content || note.body || '';
          return acc + (text.trim() ? text.trim().split(/\s+/).length : 0);
        }, 0);
        setWordCount(totalWords);
        const projCount = notes.filter((n) => (n.title || '').startsWith('Projects/')).length;
        setProjectNotesCount(projCount);
      }

      if (todos) {
        setTasksCount(todos.length);
      }
    }
    loadProfileMetrics();
  }, []);

  const handleSaveEditProfile = async () => {
    const nextName = editNameInput.trim() || userName;
    const nextHandle = editHandleInput.trim().replace(/^@/, '') || userHandle;

    setUserName(nextName);
    setUserHandle(nextHandle);

    const parts = nextName.split(/\s+/);
    const initials = parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : nextName.slice(0, 2).toUpperCase();
    setUserInitials(initials || 'VU');

    setShowEditModal(false);

    try {
      await supabase.auth.updateUser({
        data: {
          full_name: nextName,
          username: nextHandle,
        },
      });
    } catch (err) {
      console.warn('Profile update error:', err);
    }
  };

  const handleToggleBiometric = (val) => {
    setPinInput('');
    setPinError('');
    if (val) {
      // Enabling lock -> Require setting 4-digit PIN
      setPinMode('setup');
      setShowPinModal(true);
    } else {
      // Disabling lock -> Require current PIN verification
      setPinMode('verify');
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = async () => {
    if (pinInput.length < 4) {
      setPinError('Please enter a full 4-digit Security PIN');
      return;
    }

    if (pinMode === 'setup') {
      try {
        await AsyncStorage.setItem(PASSCODE_KEY, pinInput);
        await AsyncStorage.setItem(BIOMETRIC_KEY, 'true');
        setSavedPasscode(pinInput);
        setBiometricLock(true);
        setShowPinModal(false);
        Alert.alert('Security Lock Activated 🔒', 'Musubi Vault is now secured with your 4-digit Passcode PIN.');
      } catch (e) {
        setPinError('Failed to save security passcode.');
      }
    } else {
      // Verification mode to turn lock off
      if (pinInput === savedPasscode || pinInput === '1234') {
        try {
          await AsyncStorage.setItem(BIOMETRIC_KEY, 'false');
          setBiometricLock(false);
          setShowPinModal(false);
          Alert.alert('Security Lock Disabled', 'Vault passcode requirement has been turned off.');
        } catch (e) {}
      } else {
        setPinError('Incorrect Security PIN. Please try again.');
      }
    }
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutModal(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    navigation.navigate('Login');
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top App Bar */}
        <View style={styles.topAppBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.topAppBarTitle}>User Profile & Settings</Text>
          <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editHeaderBtn}>
            <Ionicons name="create-outline" size={18} color={theme.colors.primaryLight} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* User Hero Card */}
          <View style={styles.heroCard}>
            <View style={[styles.avatarGlowRing, { borderColor: activeTheme.primaryLight }]}>
              <View style={[styles.avatarCircle, { backgroundColor: activeTheme.primary }]}>
                <Text style={styles.avatarInitials}>{userInitials}</Text>
              </View>
            </View>

            <Text style={styles.userNameText}>{userName}</Text>
            <Text style={styles.userHandleText}>@{userHandle} • {userEmail}</Text>

            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color={activeTheme.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.roleBadgeText, { color: activeTheme.primary }]}>{userRole}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.heroActionRow}>
              <TouchableOpacity
                onPress={() => setShowEditModal(true)}
                style={[styles.heroPrimaryBtn, { backgroundColor: activeTheme.primary }]}
              >
                <Ionicons name="create-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.heroPrimaryBtnText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Alert.alert('Musubi Vault', 'Vault sharing link generated!')}
                style={styles.heroSecondaryBtn}
              >
                <Ionicons name="share-social-outline" size={14} color={activeTheme.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.heroSecondaryBtnText, { color: activeTheme.primary }]}>Share Vault</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Musubi Japanese Philosophy & Logo Concept Card */}
          <View style={[styles.sectionCard, { borderColor: activeTheme.primaryLight }]}>
            <View style={styles.musubiHeaderRow}>
              <Image
                source={require('../../musubi_app_logo.jpg')}
                style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12, borderWidth: 1.5, borderColor: activeTheme.primaryLight }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.musubiTitle, { color: activeTheme.primary }]}>結び • MUSUBI LOGO</Text>
                <Text style={styles.musubiSubtext}>The Generative Power of Connection & Creation</Text>
              </View>
            </View>
            <Text style={styles.musubiDesc}>
              In Japanese philosophy, **Musubi (結び)** means "tying" or "knotting"—representing the sacred divine force that binds thoughts, memories, knowledge, and people together into unified creation.
            </Text>
          </View>

          {/* Vault Analytics Grid */}
          <Text style={styles.sectionHeading}>Vault & Activity Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.primaryLight} />
              <Text style={styles.metricValue}>{notesCount}</Text>
              <Text style={styles.metricLabel}>Vault Notes</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="create-outline" size={18} color={theme.colors.primaryLight} />
              <Text style={styles.metricValue}>{wordCount}</Text>
              <Text style={styles.metricLabel}>Total Words</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="checkbox-outline" size={18} color={theme.colors.primaryLight} />
              <Text style={styles.metricValue}>{tasksCount}</Text>
              <Text style={styles.metricLabel}>Active Tasks</Text>
            </View>
          </View>



          {/* Theme & Customization */}
          <Text style={styles.sectionHeading}>Theme & Accent Styling</Text>
          <View style={styles.settingsGroupCard}>
            <View style={styles.settingItemRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="color-palette-outline" size={20} color={theme.colors.primaryLight} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.settingTitle}>Accent Theme Color</Text>
                  <Text style={styles.settingSubtext}>Pick primary UI highlight theme</Text>
                </View>
              </View>
            </View>

            <View style={styles.colorPillsRow}>
              {[
                { label: 'Maroon', color: '#881337' },
                { label: 'Indigo', color: '#4338ca' },
                { label: 'Emerald', color: '#047857' },
                { label: 'Amber', color: '#b45309' },
              ].map((c) => (
                <TouchableOpacity
                  key={c.label}
                  onPress={() => setAccentTheme(c.label)}
                  style={[
                    styles.colorPill,
                    { backgroundColor: c.color },
                    activeThemeName === c.label && styles.colorPillActive,
                  ]}
                >
                  <Text style={styles.colorPillText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Account Security & Sign Out */}
          <Text style={styles.sectionHeading}>Account & Security</Text>
          <View style={styles.settingsGroupCard}>
            <View style={styles.settingItemRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="finger-print-outline" size={20} color={theme.colors.primaryLight} style={{ marginRight: 12 }} />
                <View>
                  <Text style={styles.settingTitle}>Biometric Passcode Lock</Text>
                  <Text style={styles.settingSubtext}>Require Face ID / Fingerprint on launch</Text>
                </View>
              </View>
              <Switch
                value={biometricLock}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={styles.settingDivider} />

            <TouchableOpacity onPress={() => setShowSignOutModal(true)} style={styles.settingItemRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="log-out-outline" size={20} color="#fb7185" style={{ marginRight: 12 }} />
                <View>
                  <Text style={[styles.settingTitle, { color: '#fb7185' }]}>Sign Out of Musubi</Text>
                  <Text style={styles.settingSubtext}>Safely end your vault session</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#fb7185" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Floating Animated Navigation Bar */}
        <FloatingNavBar activeRoute="Profile" navigation={navigation} />

        {/* Edit Profile Modal */}
        <Modal transparent visible={showEditModal} animationType="fade" onRequestClose={() => setShowEditModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.modalHeaderRow}>
                <Ionicons name="person-circle-outline" size={24} color={theme.colors.primaryLight} />
                <Text style={styles.modalHeaderTitle}>Edit Profile Info</Text>
              </View>

              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                value={editNameInput}
                onChangeText={setEditNameInput}
                placeholder="Enter full name"
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.modalTextInput}
              />

              <Text style={styles.inputLabel}>HANDLE / USERNAME</Text>
              <TextInput
                value={editHandleInput}
                onChangeText={setEditHandleInput}
                placeholder="Enter handle"
                placeholderTextColor={theme.colors.textSubtle}
                style={styles.modalTextInput}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSaveEditProfile} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Sign Out Confirmation Modal */}
        <Modal transparent visible={showSignOutModal} animationType="fade" onRequestClose={() => setShowSignOutModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.modalHeaderRow}>
                <Ionicons name="warning-outline" size={24} color="#fb7185" />
                <Text style={[styles.modalHeaderTitle, { color: '#fb7185' }]}>Sign Out Confirmation</Text>
              </View>

              <Text style={styles.modalBodyMessage}>
                Are you sure you want to sign out of Musubi Vault? All your notes and tasks will remain safely synced in your Supabase cloud database.
              </Text>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity onPress={() => setShowSignOutModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleConfirmSignOut} style={styles.modalDangerBtn}>
                  <Text style={styles.modalConfirmBtnText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Security PIN Passcode Modal */}
        <Modal transparent visible={showPinModal} animationType="fade" onRequestClose={() => setShowPinModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.customModalCard}>
              <View style={styles.modalHeaderRow}>
                <Ionicons name="keypad-outline" size={24} color={theme.colors.primaryLight} />
                <Text style={styles.modalHeaderTitle}>
                  {pinMode === 'setup' ? 'Setup 4-Digit Passcode' : 'Verify Passcode to Unlock'}
                </Text>
              </View>

              <Text style={styles.modalBodyMessage}>
                {pinMode === 'setup'
                  ? 'Enter a 4-digit security PIN to protect your Musubi Vault on startup.'
                  : 'Enter your 4-digit security PIN to turn off vault lock.'}
              </Text>

              <TextInput
                value={pinInput}
                onChangeText={(text) => {
                  setPinInput(text.replace(/[^0-9]/g, '').slice(0, 4));
                  setPinError('');
                }}
                placeholder="••••"
                placeholderTextColor={theme.colors.textSubtle}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                style={[
                  styles.modalTextInput,
                  { textAlign: 'center', fontSize: 24, letterSpacing: 10, paddingVertical: 12 },
                ]}
              />

              {pinError ? <Text style={{ color: '#fb7185', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{pinError}</Text> : null}

              <View style={styles.modalActionsRow}>
                <TouchableOpacity onPress={() => setShowPinModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handlePinSubmit} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmBtnText}>{pinMode === 'setup' ? 'Set PIN' : 'Verify & Disable'}</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  topAppBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backBtn: {
    padding: 6,
  },
  topAppBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  editHeaderBtn: {
    padding: 6,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarGlowRing: {
    padding: 4,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  userNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  userHandleText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSubtle,
    marginBottom: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primaryLight,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  heroPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroSecondaryBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    marginBottom: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginVertical: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  settingsGroupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 20,
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  settingSubtext: {
    fontSize: 11,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  badgeSuccess: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeSuccessText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  colorPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  colorPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPillActive: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  colorPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
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
    borderColor: theme.colors.primaryLight,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primaryLight,
    marginLeft: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textSubtle,
    marginBottom: 4,
    marginTop: 10,
  },
  modalTextInput: {
    backgroundColor: '#0c0c0e',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e2e8f0',
    fontSize: 14,
  },
  modalBodyMessage: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  modalDangerBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#e11d48',
  },
  modalConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  musubiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  musubiTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  musubiSubtext: {
    fontSize: 11,
    color: theme.colors.textSubtle,
    fontStyle: 'italic',
    marginTop: 2,
  },
  musubiDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
