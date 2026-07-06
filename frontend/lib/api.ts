// Backend requests go through Next.js rewrite: /api/backend/* → backend
const BASE = "/api/backend";
const V1 = `${BASE}/api/v1`;

export type Dimension =
  | "gender"
  | "caste"
  | "ethnicity"
  | "religion"
  | "disability"
  | "region"
  | "age";

export interface AuditRequest {
  name: string;
  target: {
    provider: string;
    base_url: string;
    model: string;
    api_key: string;
    temperature?: number;
    max_tokens?: number;
  };
  dimensions: Dimension[];
  context_domain: string;
  jurisdictions: string[];
}

export interface AuditResponse {
  id: string;
  status: string;
  created_at: string;
  stream_url: string;
}

export async function createAudit(req: AuditRequest): Promise<AuditResponse> {
  const r = await fetch(`${V1}/audits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Create audit failed: ${r.status} ${text}`);
  }
  return r.json();
}

export async function getAudit(id: string) {
  const r = await fetch(`${V1}/audits/${id}`);
  if (!r.ok) throw new Error("Not found");
  return r.json();
}

export async function listAudits() {
  const r = await fetch(`${V1}/audits`);
  if (!r.ok) return [];
  return r.json();
}

export function reportPdfUrl(id: string) {
  return `${V1}/audits/${id}/report.pdf`;
}

export type SSEEvent =
  | { event: "hello"; data: { run_id: string } }
  | { event: "run_started"; data: any }
  | { event: "agent_queued"; data: { step: number; agent: string } }
  | { event: "agent_completed"; data: { step: number; agent: string; output_preview: string } }
  | { event: "run_completed"; data: any }
  | { event: "run_failed"; data: any }
  | { event: "retry_wait"; data: { attempt: number; wait_seconds: number; reason: string } }
  | { event: "ping"; data: any };

export function openAuditStream(
  runId: string,
  onEvent: (ev: SSEEvent) => void,
  onError?: (e: Event) => void,
): () => void {
  const es = new EventSource(`${V1}/audits/${runId}/stream`);
  const kinds = [
    "hello",
    "run_started",
    "agent_queued",
    "agent_completed",
    "run_completed",
    "run_failed",
    "retry_wait",
    "ping",
  ];
  kinds.forEach((k) => {
    es.addEventListener(k, (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        onEvent({ event: k as any, data });
      } catch {
        /* ignore */
      }
    });
  });
  es.onerror = (e) => {
    onError?.(e);
  };
  return () => es.close();
}
