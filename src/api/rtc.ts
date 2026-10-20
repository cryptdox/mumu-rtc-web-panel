import { api } from "@/lib/api";
import type {
  Channel,
  ChannelType,
  IssuedRtcToken,
  JoinResult,
  ListParams,
  MediaNode,
  MediaStat,
  NodeStatus,
  Paginated,
  Plan,
  PlanLog,
  Project,
  ProjectWithSecret,
  RecordingJob,
  RtcRole,
  RtcSession,
  RtcToken,
  SubscriptionLog,
  SubscriptionOverview,
  SubscriptionRequest,
  SubscriptionRow,
  UsagePeriod,
  UsageRecord,
  UsageSummary,
  UsageType,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
  WebhookEvent,
  WebhookEventType,
} from "./types";

const enc = encodeURIComponent;

// ── Projects ────────────────────────────────────────────────────────────────
export const projects = {
  /** scope "all" = every project (platform admins only). */
  list: (q: ListParams & { scope?: "mine" | "all" }) => api<Paginated<Project>>("/api/project", { query: q }),
  get: (id: string) => api<Project>(`/api/project/${enc(id)}`),
  create: (body: { name: string; description?: string }) =>
    api<ProjectWithSecret>("/api/project", { method: "POST", body }),
  update: (id: string, body: Partial<Pick<Project, "name" | "description" | "isActive">>) =>
    api<Project>(`/api/project/${enc(id)}`, { method: "PUT", body }),
  rotateSecret: (id: string) => api<ProjectWithSecret>(`/api/project/${enc(id)}/rotate-secret`, { method: "POST" }),
  remove: (id: string) => api<void>(`/api/project/${enc(id)}`, { method: "DELETE" }),
};

// ── Channels ────────────────────────────────────────────────────────────────
export const channels = {
  list: (projectId: string, q: ListParams) => api<Paginated<Channel>>(`/api/channel/${enc(projectId)}`, { query: q }),
  get: (projectId: string, channelId: string) => api<Channel>(`/api/channel/${enc(projectId)}/${enc(channelId)}`),
  create: (projectId: string, body: { name: string; type: ChannelType; description?: string }) =>
    api<Channel>(`/api/channel/${enc(projectId)}`, { method: "POST", body }),
  update: (projectId: string, channelId: string, body: { name?: string; type?: ChannelType; description?: string | null }) =>
    api<Channel>(`/api/channel/${enc(projectId)}/${enc(channelId)}`, { method: "PUT", body }),
  remove: (projectId: string, channelId: string) =>
    api<void>(`/api/channel/${enc(projectId)}/${enc(channelId)}`, { method: "DELETE" }),
};

// ── Tokens ──────────────────────────────────────────────────────────────────
export const tokens = {
  list: (projectId: string, q: ListParams) => api<Paginated<RtcToken>>(`/api/token/${enc(projectId)}`, { query: q }),
  issue: (projectId: string, body: { externalUserId: string; channelName: string; role: RtcRole; ttlSeconds: number }) =>
    api<IssuedRtcToken>(`/api/token/${enc(projectId)}`, { method: "POST", body }),
  revoke: (projectId: string, rtcTokenId: string) =>
    api<RtcToken>(`/api/token/${enc(projectId)}/${enc(rtcTokenId)}`, { method: "DELETE" }),
  /** Exercise the client join flow with a token (no IAM auth — the RTC token is the credential). */
  testJoin: (token: string) => api<JoinResult>("/api/rtc/join", { method: "POST", auth: false, body: { token } }),
};

// ── Sessions & stats ────────────────────────────────────────────────────────
export const sessions = {
  listByChannel: (channelId: string, q: ListParams & { active?: boolean }) =>
    api<Paginated<RtcSession>>(`/api/session/channel/${enc(channelId)}`, { query: q }),
  stats: (rtcSessionId: string, q: ListParams) =>
    api<Paginated<MediaStat>>(`/api/media-stat/${enc(rtcSessionId)}`, { query: q }),
};

// ── Recording ───────────────────────────────────────────────────────────────
export const recordings = {
  listByChannel: (channelId: string, q: ListParams) =>
    api<Paginated<RecordingJob>>(`/api/recording-job/channel/${enc(channelId)}`, { query: q }),
  start: (channelId: string) => api<RecordingJob>(`/api/recording-job/${enc(channelId)}`, { method: "POST" }),
  stop: (recordingJobId: string) => api<RecordingJob>(`/api/recording-job/stop/${enc(recordingJobId)}`, { method: "PUT" }),
};

// ── Usage ───────────────────────────────────────────────────────────────────
export const usage = {
  summary: (projectId: string, q: { from?: string; to?: string }) =>
    api<UsageSummary>(`/api/usage-record/summary/${enc(projectId)}`, { query: q }),
  list: (projectId: string, q: ListParams & { from?: string; to?: string; usageType?: UsageType }) =>
    api<Paginated<UsageRecord>>(`/api/usage-record/${enc(projectId)}`, { query: q }),
};

// ── Webhooks ────────────────────────────────────────────────────────────────
export const webhooks = {
  listEndpoints: (projectId: string, q: ListParams) =>
    api<Paginated<WebhookEndpoint>>(`/api/webhook-endpoint/${enc(projectId)}`, { query: q }),
  createEndpoint: (projectId: string, body: { url: string; eventTypes: WebhookEventType[]; isActive?: boolean }) =>
    api<WebhookEndpointWithSecret>(`/api/webhook-endpoint/${enc(projectId)}`, { method: "POST", body }),
  updateEndpoint: (id: string, body: { url?: string; eventTypes?: WebhookEventType[]; isActive?: boolean }) =>
    api<WebhookEndpoint>(`/api/webhook-endpoint/${enc(id)}`, { method: "PUT", body }),
  rotateEndpointSecret: (id: string) =>
    api<WebhookEndpointWithSecret>(`/api/webhook-endpoint/${enc(id)}/rotate-secret`, { method: "POST" }),
  removeEndpoint: (id: string) => api<void>(`/api/webhook-endpoint/${enc(id)}`, { method: "DELETE" }),

  listEvents: (projectId: string, q: ListParams & { eventType?: WebhookEventType; delivered?: boolean }) =>
    api<Paginated<WebhookEvent>>(`/api/webhook-event/${enc(projectId)}`, { query: q }),
  getEvent: (projectId: string, id: string) => api<WebhookEvent>(`/api/webhook-event/${enc(projectId)}/${enc(id)}`),
  emitTest: (projectId: string, eventType: WebhookEventType) =>
    api<WebhookEvent>(`/api/webhook-event/${enc(projectId)}`, {
      method: "POST",
      body: { eventType, payload: { test: true, sentFrom: "mumu-rtc-web-panel" } },
    }),
  redeliver: (projectId: string, id: string) =>
    api<WebhookEvent>(`/api/webhook-event/${enc(projectId)}/${enc(id)}/redeliver`, { method: "POST" }),
};

// ── Media nodes (platform admin) ────────────────────────────────────────────
export const nodes = {
  list: (q: ListParams & { status?: NodeStatus; region?: string }) => api<Paginated<MediaNode>>("/api/media-node", { query: q }),
  setStatus: (mediaNodeId: string, status: NodeStatus) =>
    api<MediaNode>(`/api/media-node/${enc(mediaNodeId)}`, { method: "PUT", body: { status } }),
  remove: (mediaNodeId: string) => api<void>(`/api/media-node/${enc(mediaNodeId)}`, { method: "DELETE" }),
};

// ── Plans ───────────────────────────────────────────────────────────────────
export type PlanInput = Partial<Omit<Plan, "planDefinitionId" | "tier" | "billingCycle">>;
export const plans = {
  /** Public catalog — no login needed. */
  listPublic: () => api<Plan[]>("/api/plan", { auth: false }),
  listAll: () => api<Plan[]>("/api/plan/all"),
  create: (body: Pick<Plan, "tier" | "billingCycle"> & PlanInput) => api<Plan>("/api/plan", { method: "POST", body }),
  update: (id: string, body: PlanInput) => api<Plan>(`/api/plan/${enc(id)}`, { method: "PUT", body }),
  logs: (id: string) => api<PlanLog[]>(`/api/plan/${enc(id)}/logs`),
};

// ── Subscription (the signed-in developer's own) ────────────────────────────
export const subscription = {
  me: () => api<SubscriptionOverview>("/api/subscription/me"),
  usage: () => api<UsagePeriod[]>("/api/subscription/me/usage"),
  history: () => api<SubscriptionLog[]>("/api/subscription/me/history"),
  requests: () => api<SubscriptionRequest[]>("/api/subscription/me/requests"),
  request: (planDefinitionId: string, count: number) =>
    api<SubscriptionRequest>("/api/subscription/me/requests", { method: "POST", body: { planDefinitionId, count } }),
};

// ── Subscriptions (platform admin) ──────────────────────────────────────────
export const subscriptionsAdmin = {
  list: (q: ListParams & { tier?: string; expired?: boolean }) => api<Paginated<SubscriptionRow>>("/api/subscription", { query: q }),
  requests: (q: ListParams & { status?: string }) => api<Paginated<SubscriptionRequest>>("/api/subscription/requests", { query: q }),
  approve: (requestId: string) => api<SubscriptionOverview>(`/api/subscription/requests/${enc(requestId)}/approve`, { method: "POST" }),
  reject: (requestId: string) => api<SubscriptionRequest>(`/api/subscription/requests/${enc(requestId)}/reject`, { method: "POST" }),
  get: (userId: string) => api<SubscriptionOverview>(`/api/subscription/${enc(userId)}`),
  history: (userId: string) => api<SubscriptionLog[]>(`/api/subscription/${enc(userId)}/history`),
  assign: (userId: string, body: { planDefinitionId: string; count?: number; activeFrom?: string; activeTo?: string }) =>
    api<SubscriptionOverview>(`/api/subscription/${enc(userId)}`, { method: "PUT", body }),
};
