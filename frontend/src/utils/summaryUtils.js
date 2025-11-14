// utils/summaryUtils.js (or paste at top of DailyLogPage.jsx)
export function extractHumanSummaryAndStructured(wrapper) {
    // wrapper may be:
    // { parsed: {..., raw_text: "```json\n{...}\n```\n\nNarrative text..."}, raw_ai_text_snippet: "...", ... }
    const out = { text: null, structured: null };
  
    if (!wrapper) return out;
  
    // Prefer already structured parsed object if available
    if (wrapper.parsed && typeof wrapper.parsed === "object") {
      out.structured = wrapper.parsed;
    } else if (wrapper.parsed && typeof wrapper.parsed === "string") {
      // try to parse first balanced JSON from wrapper.parsed (loose)
      try {
        // find first '{' or '[' and parse balanced chunk
        const txt = wrapper.parsed;
        const start = txt.indexOf("{");
        if (start >= 0) {
          // naive approach: find last '}' and attempt parse progressively
          const last = txt.lastIndexOf("}");
          const candidate = txt.slice(start, last + 1);
          out.structured = JSON.parse(candidate);
        }
      } catch (e) {
        out.structured = null;
      }
    }
  
    // Now extract human-friendly text:
    // Priority: raw_ai_text_snippet (trim code fences), then wrapper.parsed raw_text after JSON, then structured's narrative fields.
    let candidateText = null;
    if (wrapper.raw_ai_text_snippet) candidateText = wrapper.raw_ai_text_snippet;
    else if (typeof wrapper.parsed === "string") candidateText = wrapper.parsed;
    else if (wrapper.parsed && wrapper.parsed.raw_text) candidateText = wrapper.parsed.raw_text;
    else if (wrapper.parsed && wrapper.parsed.human_summary) candidateText = wrapper.parsed.human_summary;
    else if (wrapper.parsed && wrapper.parsed.summary_text) candidateText = wrapper.parsed.summary_text;
  
    if (candidateText) {
      // Remove surrounding triple backticks and leading JSON block if present.
      // 1) strip code fences
      candidateText = candidateText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  
      // 2) if it starts with JSON, try to remove the JSON object block, leaving trailing narrative
      // find first '{' and matching '}' by simple scanning
      const firstBrace = candidateText.indexOf("{");
      if (firstBrace >= 0) {
        let depth = 0, inString = false, esc = false, endIndex = -1;
        for (let i = firstBrace; i < candidateText.length; i++) {
          const ch = candidateText[i];
          if (esc) { esc = false; continue; }
          if (ch === "\\") { esc = true; continue; }
          if (ch === '"' && !esc) { inString = !inString; continue; }
          if (inString) continue;
          if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) { endIndex = i; break; }
          }
        }
        if (endIndex > 0) {
          // narrative likely after endIndex
          const maybeNarrative = candidateText.slice(endIndex + 1).trim();
          if (maybeNarrative && maybeNarrative.length > 10) {
            candidateText = maybeNarrative;
          } else {
            // fallback: if there's markdown separators (---) or "###", try to split
            const afterSplit = candidateText.split(/\n-{3,}\n|###/).slice(1).join("\n").trim();
            if (afterSplit && afterSplit.length > 10) candidateText = afterSplit;
          }
        }
      }
  
      // Final cleanup: remove leftover triple backticks or excessive whitespace
      candidateText = candidateText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      out.text = candidateText;
    }
  
    return out;
  }
  