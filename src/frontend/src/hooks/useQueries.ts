/**
 * useQueries — hybrid data layer.
 *
 * Profile-scoped localStorage: global memories, user memories, rules, timeline
 * (keyed by active AI profile ID so each profile has independent knowledge)
 * ICP canister (actor): knowledge edges, sentry avatar, custom GIFs, emojis
 * localStorage (localDB): personality, user avatar
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  KnowledgeEdge,
  Memory,
  PersonalityProfile,
  TimelineEntry,
  UserProfile,
} from "../backend.d";
import { getCurrentUser } from "../utils/localAuth";
import type { ProfileRule } from "../utils/localDB";
import {
  addProfileGlobalMemory,
  addProfileRule,
  addProfileTimelineEntry,
  addProfileUserMemory,
  addUserMemory,
  addTimelineEntry as dbAddTimeline,
  deleteTimelineEntry as dbDeleteTimeline,
  getPersonality as dbGetPersonality,
  getTimeline as dbGetTimeline,
  getUserMemories as dbGetUserMemories,
  setUserAvatar as dbSetUserAvatar,
  updatePersonality as dbUpdatePersonality,
  updateTimelineEntry as dbUpdateTimeline,
  deleteProfileGlobalMemory,
  deleteProfileRule,
  deleteProfileTimelineEntry,
  deleteProfileUserMemory,
  deleteUserMemory,
  getActiveProfileId,
  getProfileGlobalMemories,
  getProfileRules,
  getProfileTimeline,
  getProfileUserMemories,
  getUserAvatar,
  profileGlobalKey,
  profileRulesKey,
  saveBig,
  updateProfileGlobalMemory,
  updateProfileRule,
  updateProfileTimelineEntry,
  updateProfileUserMemory,
  updateUserMemory,
} from "../utils/localDB";
import { useActor } from "./useActor";

function user(): string {
  return getCurrentUser() || "guest";
}

function profileId(): string {
  return getActiveProfileId();
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

// ── Profile-scoped: Global memories ───────────────────────────────────────────

export function useGetMemories(isGlobal: boolean) {
  const { actor } = useActor();
  const pid = profileId();
  const username = user();
  return useQuery<Memory[]>({
    queryKey: ["profile_memories", pid, isGlobal, username],
    queryFn: async () => {
      if (isGlobal) {
        // Seed default profile from canister on first load if empty
        if (pid === "default") {
          const existing = getProfileGlobalMemories("default");
          if (existing.length === 0 && actor) {
            try {
              const canisterMems = await actor.getMemories(true);
              if (canisterMems.length > 0) {
                saveBig(profileGlobalKey("default"), canisterMems);
                return canisterMems;
              }
            } catch {
              // silent fallback
            }
          }
          return getProfileGlobalMemories("default");
        }
        return getProfileGlobalMemories(pid);
      }
      // User memories
      return getProfileUserMemories(pid, username);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

// ── Profile-scoped: User memories ─────────────────────────────────────────────

export function useGetUserMemories() {
  const pid = profileId();
  const username = user();
  return useQuery<Memory[]>({
    queryKey: ["profile_user_memories", pid, username],
    queryFn: () => {
      const mems = getProfileUserMemories(pid, username);
      // Seed default from legacy key if empty
      if (mems.length === 0 && pid === "default") {
        return dbGetUserMemories(username);
      }
      return mems;
    },
    staleTime: 0,
  });
}

// ── Profile-scoped: Rules ─────────────────────────────────────────────────────

export function useGetRules() {
  const { actor } = useActor();
  const pid = profileId();
  return useQuery<ProfileRule[]>({
    queryKey: ["profile_rules", pid],
    queryFn: async () => {
      if (pid === "default") {
        const existing = getProfileRules("default");
        if (existing.length === 0 && actor) {
          try {
            const canisterRules = await actor.getRules();
            if (canisterRules.length > 0) {
              // Map Rule to ProfileRule shape
              const mapped: ProfileRule[] = canisterRules.map(
                (r: {
                  id: bigint;
                  condition: string;
                  effect: string;
                  timestamp?: bigint;
                }) => ({
                  id: r.id,
                  condition: r.condition,
                  effect: r.effect,
                  timestamp: r.timestamp ?? BigInt(Date.now()) * 1_000_000n,
                }),
              );
              saveBig(profileRulesKey("default"), mapped);
              return mapped;
            }
          } catch {
            // silent fallback
          }
        }
        return getProfileRules("default");
      }
      return getProfileRules(pid);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export type { ProfileRule } from "../utils/localDB";

// ── localStorage: Personality ──────────────────────────────────────────────────

export function useGetPersonality() {
  return useQuery<PersonalityProfile>({
    queryKey: ["personality", user()],
    queryFn: () => dbGetPersonality(user()),
  });
}

// ── Profile-scoped: Timeline ──────────────────────────────────────────────────

export function useGetTimeline() {
  const pid = profileId();
  const username = user();
  return useQuery<TimelineEntry[]>({
    queryKey: ["profile_timeline", pid, username],
    queryFn: () => {
      const tl = getProfileTimeline(pid, username);
      // Seed default from legacy key if empty
      if (tl.length === 0 && pid === "default") {
        return dbGetTimeline(username);
      }
      return tl;
    },
    staleTime: 0,
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

/** Add memory: global → profile-scoped localStorage; user → profile-scoped localStorage */
export function useAddMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      text: string;
      memoryType: string;
      concepts: string[];
      isGlobal: boolean;
    }) => {
      const pid = profileId();
      const username = user();
      if (params.isGlobal) {
        return addProfileGlobalMemory(
          pid,
          params.text,
          params.memoryType,
          params.concepts,
        );
      }
      return addProfileUserMemory(
        pid,
        username,
        params.text,
        params.memoryType,
        params.concepts,
      );
    },
    onSuccess: () => {
      const pid = profileId();
      const username = user();
      qc.invalidateQueries({
        queryKey: ["profile_memories", pid, true, username],
      });
      qc.invalidateQueries({
        queryKey: ["profile_memories", pid, false, username],
      });
      qc.invalidateQueries({
        queryKey: ["profile_user_memories", pid, username],
      });
    },
  });
}

/** Delete memory: profile-scoped localStorage */
export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: bigint; isGlobal?: boolean }) => {
      const pid = profileId();
      const username = user();
      if (params.isGlobal !== false) {
        deleteProfileGlobalMemory(pid, params.id);
      } else {
        deleteProfileUserMemory(pid, username, params.id);
        // Also try legacy user memory
        deleteUserMemory(username, params.id);
      }
      return true;
    },
    onSuccess: () => {
      const pid = profileId();
      const username = user();
      qc.invalidateQueries({
        queryKey: ["profile_memories", pid],
      });
      qc.invalidateQueries({
        queryKey: ["profile_user_memories", pid, username],
      });
    },
  });
}

/** Update memory text — profile-scoped */
export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      text: string;
      isGlobal?: boolean;
    }) => {
      const pid = profileId();
      const username = user();
      if (params.isGlobal) {
        updateProfileGlobalMemory(pid, params.id, params.text);
      } else {
        updateProfileUserMemory(pid, username, params.id, params.text);
        updateUserMemory(username, params.id, params.text);
      }
    },
    onSuccess: () => {
      const pid = profileId();
      const username = user();
      qc.invalidateQueries({ queryKey: ["profile_memories", pid] });
      qc.invalidateQueries({
        queryKey: ["profile_user_memories", pid, username],
      });
    },
  });
}

/** Add rule → profile-scoped localStorage */
export function useAddRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { condition: string; effect: string }) => {
      const pid = profileId();
      return addProfileRule(pid, params.condition, params.effect);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile_rules", profileId()] });
    },
  });
}

/** Delete rule → profile-scoped localStorage */
export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      deleteProfileRule(profileId(), id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile_rules", profileId()] });
    },
  });
}

/** Update rule → profile-scoped localStorage */
export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: bigint;
      condition: string;
      effect: string;
    }) => {
      updateProfileRule(
        profileId(),
        params.id,
        params.condition,
        params.effect,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile_rules", profileId()] });
    },
  });
}

/** Add timeline entry → profile-scoped localStorage */
export function useAddTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      event: string;
      personalitySnapshot: PersonalityProfile;
    }) => {
      const pid = profileId();
      const username = user();
      // Also add to legacy per-user timeline so Timeline panel works
      dbAddTimeline(username, params.event, params.personalitySnapshot);
      return addProfileTimelineEntry(
        pid,
        username,
        params.event,
        params.personalitySnapshot,
      );
    },
    onSuccess: () => {
      const pid = profileId();
      qc.invalidateQueries({ queryKey: ["profile_timeline", pid] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

/** Delete timeline entry → profile-scoped localStorage */
export function useDeleteTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      const pid = profileId();
      const username = user();
      deleteProfileTimelineEntry(pid, username, id);
      dbDeleteTimeline(username, id);
    },
    onSuccess: () => {
      const pid = profileId();
      qc.invalidateQueries({ queryKey: ["profile_timeline", pid] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });
}

/** Update timeline entry → profile-scoped localStorage */
export function useUpdateTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: bigint; event: string }) => {
      const pid = profileId();
      const username = user();
      updateProfileTimelineEntry(pid, username, params.id, params.event);
      dbUpdateTimeline(username, params.id, params.event);
    },
    onSuccess: () => {
      const pid = profileId();
      qc.invalidateQueries({ queryKey: ["profile_timeline", pid] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
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
