import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { theme } from '../utils/theme';
import {
  fetchChatMessagesFromSupabase,
  saveChatMessageToSupabase,
} from '../utils/supabaseSync';

export default function VaultChatScreen({ navigation }) {
  const [persona, setPersona] = useState('friend'); // 'friend' or 'tyler'
  const [friendMessages, setFriendMessages] = useState([]);
  const [tylerMessages, setTylerMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  // Load separate context windows from Supabase on mount
  useEffect(() => {
    async function loadChatHistories() {
      setLoadingHistory(true);
      const [fData, tData] = await Promise.all([
        fetchChatMessagesFromSupabase('friend'),
        fetchChatMessagesFromSupabase('tyler'),
      ]);
      setFriendMessages(fData);
      setTylerMessages(tData);
      setLoadingHistory(false);
    }
    loadChatHistories();
  }, []);

  const activeMessages = persona === 'friend' ? friendMessages : tylerMessages;

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const newMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // 1. Update active persona context window state
    if (persona === 'friend') {
      setFriendMessages((prev) => [...prev, newMsg]);
    } else {
      setTylerMessages((prev) => [...prev, newMsg]);
    }

    // 2. Save user message to Supabase for current persona
    saveChatMessageToSupabase(persona, newMsg);

    setLoading(true);

    try {
      // Supabase edge function or Gemini API call
      const { data, error } = await supabase.functions.invoke('chat-vault', {
        body: {
          prompt: userText,
          persona: persona,
        },
      });

      let aiReplyText = '';
      let refTitle = 'Journal Vault';

      if (!error && data?.reply) {
        aiReplyText = data.reply;
        refTitle = data.referencedNoteTitle || 'Journal Vault';
      } else {
        // Fallback separate persona responses
        if (persona === 'friend') {
          aiReplyText = `I completely understand how you feel about "${userText}". Take a moment, celebrate your efforts, and we will tackle the next step together!`;
          refTitle = 'Daily Reflection';
        } else {
          aiReplyText = `Stop letting "${userText}" control your narrative! You are not your job, your tasks, or your output. Take bold action today!`;
          refTitle = 'Habits Note';
        }
      }

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        sender: persona,
        text: aiReplyText,
        reference: refTitle,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if (persona === 'friend') {
        setFriendMessages((prev) => [...prev, aiMsg]);
      } else {
        setTylerMessages((prev) => [...prev, aiMsg]);
      }

      saveChatMessageToSupabase(persona, aiMsg);
    } catch (err) {
      console.warn('VaultChat call warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderMessageItem = ({ item }) => {
    if (item.sender === 'system') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemLine} />
          <Text style={styles.systemText}>{item.text}</Text>
          <View style={styles.systemLine} />
        </View>
      );
    }

    if (item.sender === 'user') {
      return (
        <View style={styles.userMsgWrapper}>
          <View style={styles.userBubble}>
            <Text style={styles.userMsgText}>{item.text}</Text>
          </View>
          <Text style={styles.msgTime}>{item.timestamp}</Text>
        </View>
      );
    }

    const isFriend = item.sender === 'friend';

    return (
      <View style={styles.aiMsgWrapper}>
        {/* Avatar header line */}
        <View style={styles.aiHeaderRow}>
          <View style={[styles.avatarCircle, isFriend ? styles.friendAvatar : styles.tylerAvatar]}>
            <Ionicons
              name={isFriend ? 'heart' : 'flame'}
              size={12}
              color={isFriend ? '#16a34a' : '#dc2626'}
            />
          </View>
          <Text style={styles.aiSenderLabel}>
            {isFriend ? 'Friend' : 'Tyler Durden'}
          </Text>
        </View>

        {/* Bubble */}
        <View
          style={[
            styles.aiBubble,
            isFriend ? styles.friendBubbleBorder : styles.tylerBubbleBorder,
          ]}
        >
          <Text style={styles.aiMsgText}>{item.text}</Text>
        </View>

        {/* Referenced Context Badge */}
        {item.reference && (
          <View style={styles.referenceBadge}>
            <Ionicons name="document-text-outline" size={12} color={theme.colors.primaryLight} style={{ marginRight: 4 }} />
            <Text style={styles.referenceText}>Referenced: {item.reference}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>VaultChat AI</Text>

          <TouchableOpacity onPress={() => Alert.alert('Settings', 'AI Model: Gemini 2.5 Flash')} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Segmented Persona Switcher Header */}
        <View style={styles.personaBar}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setPersona('friend')}
            style={[styles.personaTab, persona === 'friend' && styles.personaTabActive]}
          >
            <Ionicons
              name="heart"
              size={14}
              color={persona === 'friend' ? theme.colors.primary : theme.colors.textSubtle}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.personaText, persona === 'friend' && styles.personaTextActive]}>
              Friend
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setPersona('tyler')}
            style={[styles.personaTab, persona === 'tyler' && styles.personaTabActiveTyler]}
          >
            <Ionicons
              name="flame"
              size={14}
              color={persona === 'tyler' ? '#dc2626' : theme.colors.textSubtle}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.personaText, persona === 'tyler' && styles.personaTextActiveTyler]}>
              Tyler Durden
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chat List */}
        <FlatList
          ref={flatListRef}
          data={activeMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <Ionicons
                name={persona === 'friend' ? 'chatbubble-ellipses-outline' : 'flame-outline'}
                size={36}
                color={theme.colors.textSubtle}
                style={{ marginBottom: 10 }}
              />
              <Text style={{ color: theme.colors.textSubtle, fontSize: 13, textAlign: 'center' }}>
                No messages yet with {persona === 'friend' ? 'your Friend AI' : 'Tyler'}. Start a conversation below!
              </Text>
            </View>
          }
        />

        {/* Suggested Prompt Pills */}
        <View style={styles.suggestedPillsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity onPress={() => setInputMessage('Analyze my week')} style={styles.suggestedPill}>
              <Text style={styles.suggestedPillText}>Analyze my week</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInputMessage('Rewrite my tasks')} style={styles.suggestedPill}>
              <Text style={styles.suggestedPillText}>Rewrite my tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInputMessage('Vent something')} style={styles.suggestedPill}>
              <Text style={styles.suggestedPillText}>Vent something</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn}>
            <Ionicons name="add" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder={`Message your ${persona === 'friend' ? 'Friend' : 'Tyler'}...`}
            placeholderTextColor={theme.colors.textSubtle}
            style={styles.chatInput}
            multiline
          />

          <TouchableOpacity
            disabled={loading || !inputMessage.trim()}
            onPress={sendMessage}
            style={[
              styles.sendBtn,
              persona === 'tyler' && styles.sendBtnTyler,
              (!inputMessage.trim() || loading) && styles.sendBtnDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

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

          <TouchableOpacity onPress={() => navigation.navigate('GraphView')} style={styles.navItem}>
            <Ionicons name="stats-chart-outline" size={20} color={theme.colors.textSubtle} />
            <Text style={styles.navText}>GRAPH</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItemActive}>
            <Ionicons name="chatbubbles" size={20} color={theme.colors.primaryLight} />
            <Text style={styles.navTextActive}>AI CHAT</Text>
            <View style={styles.activeDot} />
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
  personaBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  personaTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  personaTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  personaTabActiveTyler: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  personaText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  personaTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  personaTextActiveTyler: {
    color: '#dc2626',
    fontWeight: '800',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  userMsgWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    maxWidth: '82%',
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    borderTopRightRadius: 2,
  },
  userMsgText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    color: theme.colors.textSubtle,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  aiMsgWrapper: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    maxWidth: '85%',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  friendAvatar: { backgroundColor: '#dcfce7' },
  tylerAvatar: { backgroundColor: '#fee2e2' },
  aiSenderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  aiBubble: {
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  friendBubbleBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  tylerBubbleBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  aiMsgText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  referenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  referenceText: {
    fontSize: 11,
    color: theme.colors.primaryLight,
    fontWeight: '600',
  },
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  systemLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  systemText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: theme.colors.textSubtle,
    marginHorizontal: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnTyler: {
    backgroundColor: '#dc2626',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  suggestedPillsBar: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  suggestedPill: {
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
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
