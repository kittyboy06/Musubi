import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Helper to ensure a user ID is available
 */
export async function getCurrentUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || 'demo-user-id';
  } catch (err) {
    return 'demo-user-id';
  }
}

/* ==========================================================================
   1. TODOS SYNC
   ========================================================================== */

export async function fetchTodosFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map((t) => ({
        id: t.id.toString(),
        title: t.title || t.text || '',
        priority: t.priority || 'MEDIUM',
        tag: t.tag || '#TODAY',
        done: !!t.done || !!t.completed,
      }));
    }
  } catch (err) {
    console.warn('Supabase fetchTodos error:', err);
  }
  return [];
}

export async function addTodoToSupabase(task) {
  try {
    const userId = await getCurrentUserId();
    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
      .from('todos')
      .insert([
        {
          user_id: userId,
          title: task.title,
          priority: task.priority || 'MEDIUM',
          tag: task.tag || '#TODAY',
          done: false,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ])
      .select();

    if (!error && data && data[0]) {
      return { ...task, id: data[0].id.toString() };
    }
  } catch (err) {
    console.warn('Supabase addTodo error:', err);
  }
  return task;
}

export async function toggleTodoInSupabase(id, doneStatus) {
  try {
    await supabase
      .from('todos')
      .update({ done: doneStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {
    console.warn('Supabase toggleTodo error:', err);
  }
}

const VAULT_CACHE_KEY = 'musubi_vault_notes_v1';

/* ==========================================================================
   2. NOTES & GRAPH SYNC
   ========================================================================== */

export async function fetchNotesFromSupabase() {
  let cached = [];
  try {
    const raw = await AsyncStorage.getItem(VAULT_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    console.warn('Cache read error:', e);
  }

  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const formatted = data.map((n) => ({
        ...n,
        folder_path: n.folder_path || n.path || '',
      }));
      AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(formatted)).catch(() => {});
      return formatted;
    }
  } catch (err) {
    console.warn('Supabase fetchNotes error:', err);
  }

  return cached;
}

export async function saveNoteToSupabase(note) {
  try {
    // 1. Save to local AsyncStorage vault cache first
    const raw = await AsyncStorage.getItem(VAULT_CACHE_KEY);
    let list = raw ? JSON.parse(raw) : [];

    const existingIdx = list.findIndex((n) => n.id === note.id);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...note, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...note, updated_at: new Date().toISOString() });
    }
    await AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Local vault cache write error:', e);
  }

  try {
    const userId = await getCurrentUserId();
    const timestamp = new Date().toISOString();

    if (note.id && !note.id.startsWith('temp-') && !note.id.startsWith('note-') && note.id.length > 10) {
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: note.title,
          content: note.content,
          folder_path: note.folder_path || '',
          image_url: note.attachedImage || null,
          updated_at: timestamp,
        })
        .eq('id', note.id)
        .select();

      if (!error && data) return data[0];
    } else {
      const { data, error } = await supabase
        .from('notes')
        .insert([
          {
            user_id: userId,
            title: note.title,
            content: note.content,
            folder_path: note.folder_path || '',
            image_url: note.attachedImage || null,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ])
        .select();

      if (!error && data) return data[0];
    }
  } catch (err) {
    console.warn('Supabase saveNote error:', err);
  }
  return note;
}

/* ==========================================================================
   3. SEPARATE AI PERSONA CONTEXT WINDOWS & CHAT SYNC
   ========================================================================== */

export async function fetchChatMessagesFromSupabase(persona) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('persona', persona)
      .order('created_at', { ascending: true });

    if (!error && data) {
      return data.map((m) => ({
        id: m.id.toString(),
        sender: m.sender,
        text: m.text,
        reference: m.reference_note,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
    }
  } catch (err) {
    console.warn(`Supabase fetchChatMessages (${persona}) error:`, err);
  }

  return [];
}

export async function saveChatMessageToSupabase(persona, message) {
  try {
    const userId = await getCurrentUserId();
    const timestamp = new Date().toISOString();

    await supabase.from('chat_messages').insert([
      {
        user_id: userId,
        persona: persona,
        sender: message.sender,
        text: message.text,
        reference_note: message.reference || null,
        created_at: timestamp,
      },
    ]);
  } catch (err) {
    console.warn(`Supabase saveChatMessage (${persona}) error:`, err);
  }
}
