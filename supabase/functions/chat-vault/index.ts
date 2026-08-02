import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { query, persona = "friend", user_id } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("EXPO_PUBLIC_GEMINI_API_KEY") || "";
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    // 1. Generate query embedding
    let queryEmbedding: number[] = [];

    if (geminiApiKey) {
      const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`;
      const res = await fetch(embedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: query }] },
          outputDimensionality: 1536,
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(`Embedding Error: ${resData.error?.message || res.statusText}`);
      }
      queryEmbedding = resData.embedding?.values || [];
    } else if (openaiApiKey) {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: query,
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(`OpenAI Embedding Error: ${resData.error?.message || res.statusText}`);
      }
      queryEmbedding = resData.data[0].embedding;
    }

    // 2. Perform match_notes RPC search in Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://rpkputnpkevmypioyixh.supabase.co";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authHeader = req.headers.get("Authorization");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
    });

    const { data: matchedNotes, error: rpcError } = await supabase.rpc("match_notes", {
      query_embedding: queryEmbedding,
      match_threshold: 0.05,
      match_count: 5,
      p_user_id: user_id || null,
    });

    if (rpcError) {
      console.warn("RPC match_notes warn:", rpcError.message);
    }

    const contextNotes = matchedNotes || [];
    const contextFormatted = contextNotes.length > 0
      ? contextNotes.map((n: any, i: number) => `--- Journal Entry ${i + 1}: "${n.title}" ---\n${n.content}`).join("\n\n")
      : "No specific prior journal entries retrieved for this query.";

    // 3. Construct System Prompt based on persona
    let systemPrompt = "";
    if (persona.toLowerCase() === "tyler") {
      systemPrompt = `You are Tyler Durden from Fight Club. You are raw, gritty, confrontational, anti-complacency, bold, and unapologetic.
Your task is to speak directly to the user about their life, journal thoughts, and struggles.
Use tough love, challenge their comfort zones, tear down superficial excuses, and instill existential urgency.
Incorporate Tyler's philosophy ("The things you own end up owning you", "It's only after we've lost everything that we're free to do anything").
Reference the user's journal entries naturally if relevant to call out their patterns or hypocrisy. Keep it razor-sharp and punchy.`;
    } else {
      systemPrompt = `You are a warm, supportive, empathetic, and constructive best friend and personal guide.
Your goal is to help the user reflect deeply, feel genuinely understood, and offer comforting, practical, and upliftment-focused insights based on their personal journal entries.
Always be compassionate, thoughtful, non-judgmental, and encouraging.`;
    }

    const promptWithContext = `SYSTEM INSTRUCTION:\n${systemPrompt}\n\nRETRIEVED JOURNAL CONTEXT:\n${contextFormatted}\n\nUSER QUERY:\n${query}`;

    // 4. Generate Chat Response
    let replyText = "";

    if (geminiApiKey) {
      const chatUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const chatRes = await fetch(chatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptWithContext }] }],
        }),
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok || chatData.error) {
        throw new Error(`Gemini Chat Error: ${chatData.error?.message || chatRes.statusText}`);
      }

      replyText = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    } else if (openaiApiKey) {
      const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `CONTEXT:\n${contextFormatted}\n\nUSER QUESTION:\n${query}` },
          ],
        }),
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok || chatData.error) {
        throw new Error(`OpenAI Chat Error: ${chatData.error?.message || chatRes.statusText}`);
      }

      replyText = chatData.choices?.[0]?.message?.content || "No response generated.";
    } else {
      throw new Error("No API key configured for chat-vault (GEMINI_API_KEY or OPENAI_API_KEY)");
    }

    return new Response(
      JSON.stringify({
        reply: replyText,
        persona,
        retrievedNotes: contextNotes.map((n: any) => ({ id: n.id, title: n.title, similarity: n.similarity })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("chat-vault error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
