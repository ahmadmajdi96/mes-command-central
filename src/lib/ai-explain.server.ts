import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";
const BASE = "https://ai.gateway.lovable.dev/v1";

export type Explanation = { cause: string; next_action: string; safe_to_retry: "yes" | "no" | "after_fix"; raw?: string };

const SYSTEM = `You are an integrations support engineer for an order management system (OMS).
The OMS exchanges signed JSON messages with ERP, warehouse (WMS), fulfillment partners and sales channels.
Inbound types: order.create, order.status, order.cancel, shipment.confirm, fulfillment.status, inventory.adjust.
Outbound messages are POSTed to the configured endpoint and retried up to 5 times with exponential backoff; after that they become "dead".
Inbound messages are de-duplicated by message ID; a processed inbound message must never be re-applied.
Given one failed message, explain the most likely cause and recommend ONE safe next action for an operations admin.
Never suggest editing the database directly, disabling signature checks, or re-sending something that was already applied.
Reply with ONLY a JSON object: {"cause": string (max 3 sentences), "next_action": string (max 3 sentences, concrete steps), "safe_to_retry": "yes" | "no" | "after_fix"}.`;

export async function explainFailure(msg: Record<string, unknown>, endpoint: Record<string, unknown> | null): Promise<Explanation> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");
  const provider = createOpenAI({
    baseURL: BASE,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const payload = JSON.stringify(msg.payload ?? {}).slice(0, 4000);
  const context = {
    system: msg.system, direction: msg.direction, type: msg.message_type, status: msg.status,
    attempts: msg.attempts, error: msg.error, signature_valid: msg.signature_valid,
    response: msg.response, next_retry_at: msg.next_retry_at, created_at: msg.created_at,
    endpoint: endpoint ? { configured: !!endpoint.url, enabled: endpoint.enabled, host: endpoint.url ? new URL(String(endpoint.url)).host : null, events: endpoint.events } : null,
    payload,
  };
  let streamError: unknown = null;
  const result = streamText({
    model: provider.responses(MODEL),
    system: SYSTEM,
    prompt: JSON.stringify(context, null, 2),
    onError: ({ error }) => { streamError = error; },
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] },
    },
  });
  const text = (await result.text).trim();
  if (!text) {
    const e: any = streamError;
    const status = e?.statusCode ?? e?.status;
    if (status === 402) throw new Error("AI credits are used up. Add credits in Settings → Plans & credits.");
    if (status === 429) throw new Error("AI is busy right now. Try again in a minute.");
    if (status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error(e instanceof Error ? e.message : "The AI returned no answer.");
  }
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : text);
    const s = ["yes", "no", "after_fix"].includes(j.safe_to_retry) ? j.safe_to_retry : "after_fix";
    return { cause: String(j.cause ?? ""), next_action: String(j.next_action ?? ""), safe_to_retry: s };
  } catch {
    return { cause: text, next_action: "", safe_to_retry: "after_fix", raw: text };
  }
}
