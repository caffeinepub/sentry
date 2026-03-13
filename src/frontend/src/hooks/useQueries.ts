/**
 * useQueries — hybrid data layer.
 *
 * ICP canister (actor):  global memories, rules, knowledge edges, sentry avatar,
 *                        chat messages, custom GIFs, custom emojis
 * localStorage (localDB): user memories, personality, timeline, user avatar
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  KnowledgeEdge,
  Memory,
  PersonalityProfile,
  Rule,
  TimelineEntry,
  UserProfile,
} from "../backend.d";
import { getCurrentUser } from "../utils/localAuth";
import {
  addUserMemory,
  addTimelineEntry as dbAddTimeline,
  getPersonality as dbGetPersonality,
  getTimeline as dbGetTimeline,
  getUserMemories as dbGetUserMemories,
  setUserAvatar as dbSetUserAvatar,
  updatePersonality as dbUpdatePersonality,
  deleteUserMemory,
  getUserAvatar,
  updateUserMemory,
} from "../utils/localDB";
import { useActor } from "./useActor";

function user(): string {
  return getCurrentUser() || "guest";
}

// ── Canister message types (not in backend.d.ts yet) ─────────────────────────
export interface CanisterChatMessage {
  id: bigint;
  role: string;
  name: string;
  content: string;
  attachmentsJson: string;
  timestamp: bigint;
}
export interface CanisterCustomGif {
  id: bigint;
  url: string;
  gifLabel: string;
}
export interface CanisterCustomEmoji {
  id: bigint;
  emoji: string;
}

// ── Auth helper ────────────────────────────────────────────────────────────────

export function useGetCurrentUser() {
  return useQuery<string>({
    queryKey: ["currentUser"],
    queryFn: () => getCurrentUser() || "",
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// ── ICP: Global memories ───────────────────────────────────────────────────────

export function useGetMemories(isGlobal: boolean) {
  const { actor, isFetching } = useActor();
  return useQuery<Memory[]>({
    queryKey: ["memories", isGlobal],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMemories(isGlobal);
    },
    enabled: !!actor && !isFetching,
  });
}

// ── localStorage: User memories ────────────────────────────────────────────────

export function useGetUserMemories() {
  return useQuery<Memory[]>({
    queryKey: ["userMemories", user()],
    queryFn: () => dbGetUserMemories(user()),
  });
}

// ── ICP: Rules ─────────────────────────────────────────────────────────────────

export function useGetRules() {
  const { actor, isFetching } = useActor();
  return useQuery<Rule[]>({
    queryKey: ["rules"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRules();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── localStorage: Personality ──────────────────────────────────────────────────

export function useGetPersonality() {
  return useQuery<PersonalityProfile>({
    queryKey: ["personality", user()],
    queryFn: () => dbGetPersonality(user()),
  });
}

// ── localStorage: Timeline ─────────────────────────────────────────────────────

export function useGetTimeline() {
  return useQuery<TimelineEntry[]>({
    queryKey: ["timeline", user()],
    queryFn: () => dbGetTimeline(user()),
  });
}

// ── ICP: Knowledge edges ───────────────────────────────────────────────────────

export function useGetKnowledgeEdges() {
  const { actor, isFetching } = useActor();
  return useQuery<KnowledgeEdge[]>({
    queryKey: ["knowledgeEdges"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getKnowledgeEdges();
    },
    enabled: !!actor && !isFetching,
  });
}

// ── ICP: Sentry avatar ─────────────────────────────────────────────────────────

export function useGetSentryAvatar() {
  const { actor, isFetching } = useActor();
  const activeAIName = localStorage.getItem("sentry_active_ai") || "default";
  return useQuery<string>({
    queryKey: ["sentryAvatar", activeAIName],
    queryFn: async () => {
      const localKey =
        activeAIName !== "default"
          ? `sentry_avatar_${activeAIName}`
          : "sentry_avatar_v2";
      if (!actor)
        return (
          localStorage.getItem(localKey) ||
          localStorage.getItem("sentry_avatar_v2") ||
          ""
        );
      const canisterResult = await actor.getSentryAvatar();
      if (canisterResult) return canisterResult;
      return (
        localStorage.getItem(localKey) ||
        localStorage.getItem("sentry_avatar_v2") ||
        ""
      );
    },
    enabled: !!actor && !isFetching,
  });
}

// ── localStorage: User avatar ──────────────────────────────────────────────────

export function useGetUserAvatar() {
  const u = user();
  return useQuery<string>({
    queryKey: ["userAvatar", u],
    queryFn: () => getUserAvatar(u),
  });
}

// ── localStorage: Caller user profile (built from localDB) ────────────────────

export function useGetCallerUserProfile() {
  const u = user();
  const { data: avatarUrl = "" } = useGetUserAvatar();
  const profile: UserProfile = {
    username: u,
    avatarUrl,
    personality: dbGetPersonality(u),
    principalId: u,
  };
  return {
    data: u ? profile : null,
    isLoading: false,
    isFetched: true,
  };
}

// ── MUTATIONS ─────────────────────────────────────────────────────────────────

/** Add memory: global → ICP actor; user → localStorage */
export function useAddMemory() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      text: string;
      memoryType: string;
      concepts: string[];
      isGlobal: boolean;
    }) => {
      if (params.isGlobal) {
        if (!actor) throw new Error("Actor not ready");
        return actor.addMemory(
          params.text,
          params.memoryType,
          params.concepts,
          true,
        );
      }
      return addUserMemory(
        user(),
        params.text,
        params.memoryType,
        params.concepts,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["userMemories"] });
    },
  });
}

/** Delete memory: global → ICP actor; user memory → localStorage */
export function useDeleteMemory() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: bigint; isGlobal?: boolean }) => {
      if (params.isGlobal !== false && actor) {
        // Try actor first for global memories
        try {
          return await actor.deleteMemory(params.id);
        } catch {
          // Fall through to localStorage
        }
      }
      deleteUserMemory(user(), params.id);
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["userMemories"] });
    },
  });
}

/** Update memory text — only user memories (localStorage) can be edited */
export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: bigint; text: string }) => {
      updateUserMemory(user(), params.id, params.text);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userMemories"] });
    },
  });
}

/** Add rule → ICP actor */
export function useAddRule() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { condition: string; effect: string }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.addRule(params.condition, params.effect);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

/** Delete rule → ICP actor */
export function useDeleteRule() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteRule(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

/** Add timeline entry → localStorage per user */
export function useAddTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      event: string;
      personalitySnapshot: PersonalityProfile;
    }) => dbAddTimeline(user(), params.event, params.personalitySnapshot),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeline"] }),
  });
}

/** Update personality → localStorage per user */
export function useUpdatePersonality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: PersonalityProfile) => dbUpdatePersonality(user(), p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personality"] }),
  });
}

/** Set user avatar → localStorage per user */
export function useSetUserAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => dbSetUserAvatar(user(), url),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userAvatar"] }),
  });
}

/** Set sentry avatar → ICP actor + localStorage fallback */
export function useSetSentryAvatar() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const activeAIName =
        localStorage.getItem("sentry_active_ai") || "default";
      const localKey =
        activeAIName !== "default"
          ? `sentry_avatar_${activeAIName}`
          : "sentry_avatar_v2";
      localStorage.setItem(localKey, url);
      if (!actor) return;
      try {
        await actor.setSentryAvatar(url);
      } catch {
        // already saved to localStorage above, silent fallback
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentryAvatar"] }),
  });
}

/** Save caller user profile → localStorage */
export function useSaveCallerUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      dbSetUserAvatar(profile.principalId || user(), profile.avatarUrl);
      dbUpdatePersonality(profile.principalId || user(), profile.personality);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userAvatar"] });
      qc.invalidateQueries({ queryKey: ["personality"] });
    },
  });
}

/** Add knowledge edge → ICP actor */
export function useAddKnowledgeEdge() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      fromId: bigint;
      toId: bigint;
      relationType: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.addKnowledgeEdge(
        params.fromId,
        params.toId,
        params.relationType,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledgeEdges"] }),
  });
}

// ── Import / Export ────────────────────────────────────────────────────────────

export function useExportUserData() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.exportUserData();
    },
  });
}

export function useExportGlobalData() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.exportGlobalData();
    },
  });
}

export function useImportUserData() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jsonData: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.importUserData(jsonData);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useImportGlobalData() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jsonData: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.importGlobalData(jsonData);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ── ICP: Chat Messages ─────────────────────────────────────────────────────────

export function useGetChatMessages() {
  const { actor, isFetching } = useActor();
  return useQuery<CanisterChatMessage[]>({
    queryKey: ["chatMessages"],
    queryFn: async () => {
      if (!actor) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).getChatMessages();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3000,
  });
}

export function useAddChatMessage() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (msg: {
      role: string;
      name: string;
      content: string;
      attachmentsJson: string;
    }) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).addChatMessage(
        msg.role,
        msg.name,
        msg.content,
        msg.attachmentsJson,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatMessages"] }),
  });
}

export function useClearChatMessages() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).clearChatMessages();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatMessages"] }),
  });
}

// ── ICP: Custom GIFs ───────────────────────────────────────────────────────────

export function useGetCustomGifs() {
  const { actor, isFetching } = useActor();
  return useQuery<CanisterCustomGif[]>({
    queryKey: ["customGifs"],
    queryFn: async () => {
      if (!actor) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).getCustomGifs();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddCustomGif() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      url,
      gifLabel,
    }: { url: string; gifLabel: string }) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).addCustomGif(url, gifLabel);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customGifs"] }),
  });
}

export function useDeleteCustomGif() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).deleteCustomGif(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customGifs"] }),
  });
}

// ── ICP: Custom Emojis ─────────────────────────────────────────────────────────

export function useGetCustomEmojis() {
  const { actor, isFetching } = useActor();
  return useQuery<CanisterCustomEmoji[]>({
    queryKey: ["customEmojis"],
    queryFn: async () => {
      if (!actor) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).getCustomEmojis();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddCustomEmoji() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emoji: string) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).addCustomEmoji(emoji);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customEmojis"] }),
  });
}

export function useDeleteCustomEmoji() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).deleteCustomEmoji(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customEmojis"] }),
  });
}
