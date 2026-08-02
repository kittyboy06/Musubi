import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Helper to ensure a user ID is available
 */
export async function getCurrentUserId() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || 'd2fe77b6-b871-442f-9d5f-c435561d61c2';
  } catch (err) {
    return 'd2fe77b6-b871-442f-9d5f-c435561d61c2';
  }
}

/* ==========================================================================
   1. TODOS SYNC
   ========================================================================== */

const LOCAL_TODOS_KEY = 'musubi_local_todos_v1';

export async function fetchTodosFromSupabase() {
  let localTodos = [];
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TODOS_KEY);
    if (raw) localTodos = JSON.parse(raw);
  } catch (e) {}

  try {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const formatted = data.map((t) => ({
        id: t.id.toString(),
        title: t.title || t.text || '',
        priority: t.priority || 'MEDIUM',
        tag: t.tag || '#TODAY',
        done: !!t.done || !!t.completed,
        due_date: t.due_date || t.due_at || null,
      }));
      AsyncStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(formatted)).catch(() => {});
      return formatted;
    }
  } catch (err) {}

  return localTodos;
}

export async function addTodoToSupabase(task) {
  const newTask = { ...task, id: task.id || Date.now().toString(), done: false };

  try {
    const raw = await AsyncStorage.getItem(LOCAL_TODOS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(newTask);
    await AsyncStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(list));
  } catch (e) {}

  try {
    const userId = await getCurrentUserId();
    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
      .from('todos')
      .insert([
        {
          user_id: userId,
          title: task.title,
          text: task.title,
          priority: task.priority || 'MEDIUM',
          tag: task.tag || '#TODAY',
          done: false,
          due_date: task.due_date || null,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ])
      .select();

    if (!error && data && data[0]) {
      return { ...newTask, id: data[0].id.toString() };
    }
  } catch (err) {}

  return newTask;
}

export async function updateTodoDueDateInSupabase(id, dueDate) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TODOS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      const updated = list.map((t) => (t.id === id ? { ...t, due_date: dueDate } : t));
      await AsyncStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(updated));
    }
  } catch (e) {}

  try {
    await supabase
      .from('todos')
      .update({ due_date: dueDate, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {}
}

export async function toggleTodoInSupabase(id, doneStatus) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TODOS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      const updated = list.map((t) => (t.id === id ? { ...t, done: doneStatus } : t));
      await AsyncStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(updated));
    }
  } catch (e) {}

  try {
    await supabase
      .from('todos')
      .update({ done: doneStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {}
}

export async function updateTodoPriorityInSupabase(id, priority) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TODOS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      const updated = list.map((t) => (t.id === id ? { ...t, priority } : t));
      await AsyncStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(updated));
    }
  } catch (e) {}

  try {
    await supabase
      .from('todos')
      .update({ priority, updated_at: new Date().toISOString() })
      .eq('id', id);
  } catch (err) {}
}

import initialVaultSeed from './initialVaultSeed.json';

const VAULT_CACHE_KEY = 'musubi_vault_notes_v1';

/* ==========================================================================
   2. NOTES & GRAPH SYNC
   ========================================================================== */

export async function fetchNotesFromSupabase() {
  let cached = [];
  try {
    const raw = await AsyncStorage.getItem(VAULT_CACHE_KEY);
    if (raw) {
      cached = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }

  // Seed initial ObsidianCloud notes if local vault is empty
  if (!cached || cached.length === 0) {
    cached = initialVaultSeed;
    AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(initialVaultSeed)).catch(() => {});
  }

  // Sync initial seed notes & folders to Supabase database in background
  syncInitialSeedToSupabase().catch(() => {});

  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data && data.length > 0) {
      const formatted = data.map((n) => {
        let folder_path = n.folder_path || '';
        let title = n.title || 'Untitled';
        if (!folder_path && title.includes('/')) {
          const parts = title.split('/');
          title = parts.pop();
          folder_path = parts.join('/');
        }
        return {
          id: n.id,
          title,
          folder_path,
          content: n.body || n.content || '',
          created_at: n.created_at,
          updated_at: n.updated_at,
        };
      });
      AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(formatted)).catch(() => {});
      return formatted;
    }
  } catch (err) {
    console.warn('Supabase fetchNotes error:', err);
  }

  return cached;
}

export async function syncInitialSeedToSupabase() {
  try {
    const { data: existing, error } = await supabase.from('notes').select('id');
    if (error) return;

    if (!existing || existing.length === 0) {
      const userId = await getCurrentUserId();
      const recordsToInsert = initialVaultSeed.map((n) => ({
        user_id: userId,
        title: n.title,
        content: n.content,
        folder_path: n.folder_path || '',
        created_at: n.created_at || new Date().toISOString(),
        updated_at: n.updated_at || new Date().toISOString(),
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('notes')
        .insert(recordsToInsert)
        .select();

      if (!insertErr && inserted && inserted.length > 0) {
        const formatted = inserted.map((n) => ({
          ...n,
          folder_path: n.folder_path || n.path || '',
        }));
        await AsyncStorage.setItem(VAULT_CACHE_KEY, JSON.stringify(formatted));
      }
    }
  } catch (err) {
    console.warn('syncInitialSeedToSupabase error:', err);
  }
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
    const fullTitle = note.folder_path ? `${note.folder_path}/${note.title}` : note.title;

    if (note.id && !note.id.startsWith('temp-') && !note.id.startsWith('note-') && note.id.length > 10) {
      const { data, error } = await supabase
        .from('notes')
        .update({
          user_id: userId,
          title: fullTitle,
          body: note.content || '',
          updated_at: timestamp,
        })
        .eq('id', note.id)
        .select();

      if (!error && data && data[0]) return data[0];
    } else {
      const { data, error } = await supabase
        .from('notes')
        .insert([
          {
            user_id: userId,
            title: fullTitle,
            body: note.content || '',
            created_at: timestamp,
            updated_at: timestamp,
          },
        ])
        .select();

      if (!error && data && data[0]) return data[0];
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

/* ==========================================================================
   4. REALTIME DATABASE SYNC ACROSS DEVICES
   ========================================================================== */

/**
 * Subscribe to realtime changes on the notes table
 */
export function subscribeToRealtimeNotes(onUpdate) {
  try {
    const channel = supabase
      .channel('public:notes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        async (payload) => {
          console.log('Realtime note update received:', payload.eventType);
          const freshNotes = await fetchNotesFromSupabase();
          if (onUpdate) onUpdate(freshNotes, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime notes subscription error:', err);
    return () => {};
  }
}

/**
 * Upload Image to Supabase Storage bucket 'vault-images' and return public CDN URL
 */
export async function uploadImageToSupabaseStorage(fileBlobOrUri, fileName) {
  try {
    const cleanFileName = `${Date.now()}_${fileName ? fileName.replace(/[^a-zA-Z0-9._-]/g, '') : 'note_image.png'}`;
    const filePath = `notes/${cleanFileName}`;

    let uploadBody = fileBlobOrUri;
    if (typeof fileBlobOrUri === 'string' && fileBlobOrUri.startsWith('data:')) {
      const response = await fetch(fileBlobOrUri);
      uploadBody = await response.blob();
    }

    const { data, error } = await supabase.storage
      .from('vault-images')
      .upload(filePath, uploadBody, {
        contentType: typeof uploadBody === 'object' && uploadBody.type ? uploadBody.type : 'image/png',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error:', error);
      return fileBlobOrUri;
    }

    const { data: publicUrlData } = supabase.storage
      .from('vault-images')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || fileBlobOrUri;
  } catch (err) {
    console.warn('uploadImageToSupabaseStorage exception:', err);
    return fileBlobOrUri;
  }
}

/**
 * Subscribe to realtime changes on the todos table
 */
export function subscribeToRealtimeTodos(onUpdate) {
  try {
    const channel = supabase
      .channel('public:todos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        async (payload) => {
          console.log('Realtime todo update received:', payload.eventType);
          const freshTodos = await fetchTodosFromSupabase();
          if (onUpdate) onUpdate(freshTodos, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime todos subscription error:', err);
    return () => {};
  }
}

/**
 * Subscribe to realtime changes on chat_messages table
 */
export function subscribeToRealtimeChat(persona, onUpdate) {
  try {
    const channel = supabase
      .channel(`public:chat_messages:${persona}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `persona=eq.${persona}` },
        async (payload) => {
          console.log(`Realtime chat message (${persona}) received:`, payload);
          const freshMessages = await fetchChatMessagesFromSupabase(persona);
          if (onUpdate) onUpdate(freshMessages, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn(`Realtime chat subscription (${persona}) error:`, err);
    return () => {};
  }
}
