export interface ChatMessage {
  id: string;
  role: "user" | "sentry";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  name?: string;
  avatarUrl?: string;
  commandType?: string;
  highlightedNodeIds?: bigint[];
}

export interface Attachment {
  type: "image" | "gif" | "audio" | "video" | "file" | "link";
  url: string;
  name?: string;
  mimeType?: string;
}

export interface SentryState {
  messages: ChatMessage[];
  userAvatarUrl: string;
  sentryAvatarUrl: string;
  username: string;
}
