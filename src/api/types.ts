// Shapes returned by mumu-rtc-backend (see its documents/urls.md and /api/docs).

export interface Paginated<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface Project {
  projectId: string;
  name: string;
  description: string | null;
  apiKey: string;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export type ProjectWithSecret = Project & { apiSecret: string };

export type ChannelType = "VIDEO_CALL" | "VOICE_CALL" | "LIVE_STREAM" | "DATA_CHANNEL";
export const CHANNEL_TYPES: ChannelType[] = ["VIDEO_CALL", "VOICE_CALL", "LIVE_STREAM", "DATA_CHANNEL"];

export interface Channel {
  channelId: string;
  projectId: string;
  name: string;
  description: string | null;
  type: ChannelType;
  roomStatus: "IDLE" | "ACTIVE";
  activeNodeId: string | null;
  roomStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RtcRole = "PUBLISHER" | "SUBSCRIBER" | "HOST" | "AUDIENCE";
export const RTC_ROLES: RtcRole[] = ["PUBLISHER", "SUBSCRIBER", "HOST", "AUDIENCE"];

export interface RtcToken {
  rtcTokenId: string;
  projectId: string;
  externalUserId: string;
  channelName: string;
  role: RtcRole;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}
export type IssuedRtcToken = RtcToken & { token: string };

export interface JoinResult {
  wsUrl: string;
  joinToken: string;
  joinTokenExpiresIn: number;
  nodeId: string;
  region: string;
  projectId: string;
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  externalUserId: string;
  role: RtcRole;
  iceServers: { urls: string[]; username?: string; credential?: string }[];
}

export interface RtcSession {
  rtcSessionId: string;
  projectId: string;
  channelId: string;
  externalUserId: string;
  role: RtcRole;
  nodeId: string | null;
  joinTime: string;
  leaveTime: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

export interface MediaStat {
  mediaStatId: string;
  rtcSessionId: string;
  bitrate: number | null;
  packetLoss: number | null;
  latencyMs: number | null;
  resolution: string | null;
  recordedAt: string;
}

export type RecordingStatus = "PENDING_START" | "STARTED" | "STOPPING" | "STOPPED" | "FAILED";
export interface RecordingJob {
  recordingJobId: string;
  channelId: string;
  projectId: string;
  externalUserId: string;
  nodeId: string | null;
  status: RecordingStatus;
  storagePath: string | null;
  failureReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export type UsageType = "VIDEO_MINUTES" | "AUDIO_MINUTES" | "DATA_TRANSFER_MB" | "RECORDING_STORAGE_MB";
export const USAGE_TYPES: UsageType[] = ["VIDEO_MINUTES", "AUDIO_MINUTES", "DATA_TRANSFER_MB", "RECORDING_STORAGE_MB"];

export interface UsageRecord {
  usageRecordId: string;
  projectId: string;
  externalUserId: string;
  channelId: string | null;
  usageType: UsageType;
  usageValue: number;
  sourceId: string | null;
  recordedAt: string;
}

export interface UsageSummary {
  from: string | null;
  to: string | null;
  totals: { usageType: UsageType; totalUsage: number; records: number }[];
}

export type WebhookEventType =
  | "CHANNEL_CREATED"
  | "CHANNEL_DELETED"
  | "SESSION_STARTED"
  | "SESSION_ENDED"
  | "RECORDING_STARTED"
  | "RECORDING_COMPLETED"
  | "RECORDING_FAILED"
  | "USER_JOINED"
  | "USER_LEFT";
export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
  "CHANNEL_CREATED",
  "CHANNEL_DELETED",
  "SESSION_STARTED",
  "SESSION_ENDED",
  "USER_JOINED",
  "USER_LEFT",
  "RECORDING_STARTED",
  "RECORDING_COMPLETED",
  "RECORDING_FAILED",
];

export interface WebhookEndpoint {
  webhookEndpointId: string;
  projectId: string;
  externalUserId: string;
  url: string;
  isActive: boolean;
  eventTypes: WebhookEventType[];
  createdAt: string;
  updatedAt: string;
}
export type WebhookEndpointWithSecret = WebhookEndpoint & { secret: string };

export interface WebhookDelivery {
  webhookDeliveryId: string;
  webhookEndpointId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  nextAttemptAt: string;
  lastStatusCode: number | null;
  lastError: string | null;
  deliveredAt: string | null;
}

export interface WebhookEvent {
  webhookEventId: string;
  projectId: string;
  externalUserId: string | null;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  delivered: boolean;
  createdAt: string;
  deliveries?: WebhookDelivery[];
}

export type NodeStatus = "ACTIVE" | "DRAINING" | "OFFLINE";
export interface MediaNode {
  mediaNodeId: string;
  nodeId: string;
  region: string;
  ipAddress: string;
  wsUrl: string;
  httpUrl: string;
  workerCount: number;
  status: NodeStatus;
  activeRooms: number;
  activePeers: number;
  cpuLoad: number | null;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListParams {
  offset?: number;
  limit?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
  [key: string]: string | number | boolean | undefined;
}
