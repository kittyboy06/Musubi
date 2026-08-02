import { fetchNotesFromSupabase, fetchTodosFromSupabase } from './supabaseSync';
import { supabase } from './supabase';

/**
 * Musubi Dynamic RAG (Retrieval-Augmented Generation) Engine
 * RAGs across ALL vault markdown notes, folders, tasks, deadlines, and project files.
 */

function calculateRelevanceScore(text, queryTerms) {
  if (!text || !queryTerms || queryTerms.length === 0) return 0;
  const lowerText = text.toLowerCase();
  let score = 0;

  queryTerms.forEach((term) => {
    if (!term) return;
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      score += matches.length * 3;
    } else if (lowerText.includes(term)) {
      score += 1;
    }
  });

  return score;
}

/**
 * Performs full RAG retrieval across all user data sources
 */
export async function retrieveVaultContext(query) {
  try {
    const [notes, todos] = await Promise.all([
      fetchNotesFromSupabase(),
      fetchTodosFromSupabase(),
    ]);

    const queryTerms = (query || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Score & rank notes
    const scoredNotes = (notes || []).map((note) => {
      const titleScore = calculateRelevanceScore(note.title, queryTerms) * 5;
      const folderScore = calculateRelevanceScore(note.folder_path, queryTerms) * 2;
      const contentScore = calculateRelevanceScore(note.content, queryTerms);
      const totalScore = titleScore + folderScore + contentScore;

      return {
        ...note,
        relevanceScore: totalScore,
      };
    });

    scoredNotes.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const relevantNotes = scoredNotes.filter((n) => n.relevanceScore > 0);
    const selectedNotes = relevantNotes.length > 0 ? relevantNotes.slice(0, 5) : [];

    const activeTodos = (todos || []).filter((t) => !t.completed);
    const deadlineTodos = activeTodos.filter((t) => t.deadline || t.priority);

    return {
      citedNotes: selectedNotes.map((n) => ({ id: n.id, title: n.title, folder_path: n.folder_path, content: n.content })),
      citedTasks: deadlineTodos.map((t) => ({ id: t.id, title: t.title, deadline: t.deadline, priority: t.priority })),
      allNotes: notes || [],
      allTodos: todos || [],
      queryTerms,
      hasDirectNoteMatch: relevantNotes.length > 0,
    };
  } catch (err) {
    console.warn('retrieveVaultContext error:', err);
    return {
      citedNotes: [],
      citedTasks: [],
      allNotes: [],
      allTodos: [],
      queryTerms: [],
      hasDirectNoteMatch: false,
    };
  }
}

/**
 * Main RAG Response Generator: Answers user queries relevantly with grounded context
 */
export async function generateRagResponse(userQuery, persona = 'friend') {
  const q = (userQuery || '').trim().toLowerCase();
  const ragData = await retrieveVaultContext(userQuery);

  // 1. Detect Meta / Capability Queries (e.g., "what can you do", "help", "who are you")
  if (
    q.includes('what can you do') ||
    q.includes('who are you') ||
    q.includes('help me') ||
    q.includes('how to use') ||
    q.includes('capabilities')
  ) {
    let reply = '';
    if (persona === 'tyler') {
      reply = `I am Tyler Durden. I don't sugarcoat reality.\n\nHere is what I can do for you in Musubi:\n` +
        `• **RAG Note Search**: Ask me about any of your ${ragData.allNotes.length} vault notes, journals, or project files.\n` +
        `• **Task & Deadline Enforcement**: Ask about your active deadlines so you stop procrastinating.\n` +
        `• **Brutal Accountability**: Challenge your routine and force you to take action today!\n\n` +
        `Ask me a real question about your notes or deadlines!`;
    } else {
      reply = `I am your Musubi Vault AI Assistant! I have full RAG access to all your notes and task schedules.\n\nHere is how I can help you:\n` +
        `🔍 **Search & Answer from Notes**: Ask about any topic, project, or file in your ${ragData.allNotes.length} Obsidian notes.\n` +
        `📅 **Task & Deadline Tracker**: Ask *"What are my deadlines?"* or *"Show high priority tasks"* to see active to-dos.\n` +
        `✍️ **Reflect & Organize**: Help you summarize journals, write new notes, or plan your week.\n\n` +
        `What would you like to explore or work on today?`;
    }

    return {
      reply,
      citedNotes: [],
      citedTasks: ragData.citedTasks.slice(0, 2),
    };
  }

  // 2. Detect Tasks / Deadline Queries (e.g., "tasks", "deadline", "todo", "what do i need to do")
  if (
    q.includes('task') ||
    q.includes('deadline') ||
    q.includes('todo') ||
    q.includes('due') ||
    q.includes('priority') ||
    q.includes('schedule')
  ) {
    const activeTasks = ragData.allTodos.filter((t) => !t.completed);

    let reply = persona === 'tyler'
      ? `Here is your raw task list. Stop making excuses and clear them out:\n\n`
      : `Here are your current active tasks and deadlines retrieved from your vault:\n\n`;

    if (activeTasks.length === 0) {
      reply += `🎉 No active tasks right now! You're completely caught up.`;
    } else {
      activeTasks.forEach((t, i) => {
        const priority = t.priority ? `[${t.priority.toUpperCase()}] ` : '';
        const deadline = t.deadline ? `(Due: ${t.deadline}) ` : '';
        const tag = t.tag ? `#${t.tag} ` : '';
        reply += `${i + 1}. **${t.title}** ${priority}${deadline}${tag}\n`;
      });
    }

    return {
      reply,
      citedNotes: ragData.citedNotes.slice(0, 2),
      citedTasks: ragData.citedTasks,
    };
  }

  // 3. Detect Direct Note Matches or Project Queries
  if (ragData.hasDirectNoteMatch) {
    const topNote = ragData.citedNotes[0];
    const snippet = (topNote.content || '').slice(0, 300).trim();

    let reply = persona === 'tyler'
      ? `Retrieved note **"${topNote.title}"** from your vault:\n\n`
      : `Based on your note **"${topNote.title}"**:\n\n`;

    reply += `> ${snippet}\n\n`;

    if (ragData.citedNotes.length > 1) {
      reply += `Related notes found: ${ragData.citedNotes.slice(1).map((n) => `**"${n.title}"**`).join(', ')}.\n\n`;
    }

    reply += persona === 'tyler'
      ? `What are you going to do with this information?`
      : `Would you like me to open this note or help you summarize it further?`;

    return {
      reply,
      citedNotes: ragData.citedNotes,
      citedTasks: ragData.citedTasks.slice(0, 2),
    };
  }

  // 4. General Conversational Query
  let reply = '';
  if (persona === 'tyler') {
    reply = `Regarding "${userQuery}": You are not your job or your excuses! Check your active project notes and get to work!`;
  } else {
    reply = `I searched your ${ragData.allNotes.length} vault notes for "${userQuery}".\n\n` +
      `While no exact title matched, I can search specific notes or summarize your task schedule whenever you like!`;
  }

  return {
    reply,
    citedNotes: ragData.allNotes.slice(0, 3).map((n) => ({ id: n.id, title: n.title, folder_path: n.folder_path, content: n.content })),
    citedTasks: ragData.citedTasks.slice(0, 2),
  };
}
