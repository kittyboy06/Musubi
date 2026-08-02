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
    const payload = await req.json();
    const record = payload.record || payload;

    if (!record || !record.id) {
      return new Response(
        JSON.stringify({ error: "Missing note record or ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const noteId = record.id;
    const title = record.title || "";
    const content = record.content || record.body || "";
    const textToEmbed = `${title}\n${content}`.trim();

    if (!textToEmbed) {
      return new Response(
        JSON.stringify({ message: "Note content empty, skipping embedding" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("EXPO_PUBLIC_GEMINI_API_KEY") || "";
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    let embedding: number[] = [];

    if (geminiApiKey) {
      // Use Gemini Embedding Model (3072 dim truncated to 1536 dim)
      const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`;
      const res = await fetch(embedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: textToEmbed }] },
          outputDimensionality: 1536,
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(`Gemini Embedding Error: ${resData.error?.message || res.statusText}`);
      }

      embedding = resData.embedding?.values || [];
    } else if (openaiApiKey) {
      // Fallback to OpenAI Embedding Model
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: textToEmbed,
        }),
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(`OpenAI Embedding Error: ${resData.error?.message || res.statusText}`);
      }

      embedding = resData.data[0].embedding;
    } else {
      throw new Error("No API key available for embedding generation (GEMINI_API_KEY or OPENAI_API_KEY)");
    }

    // Save embedding back to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from("notes")
      .update({ embedding })
      .eq("id", noteId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, noteId, embeddingLength: embedding.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("generate-embedding error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
