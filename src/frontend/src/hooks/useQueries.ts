import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  KnowledgeEdge,
  Memory,
  PersonalityProfile,
  Rule,
  TimelineEntry,
  UserProfile,
} from "../backend.d";
import { useActor } from "./useActor";

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

export function useGetUserMemories() {
  const { actor, isFetching } = useActor();
  return useQuery<Memory[]>({
    queryKey: ["userMemories"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getUserMemories();
    },
    enabled: !!actor && !isFetching,
  });
}

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

export function useGetPersonality() {
  const { actor, isFetching } = useActor();
  return useQuery<PersonalityProfile>({
    queryKey: ["personality"],
    queryFn: async () => {
      if (!actor) return { curiosity: 0.5, friendliness: 0.5, analytical: 0.5 };
      return actor.getPersonality();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetTimeline() {
  const { actor, isFetching } = useActor();
  return useQuery<TimelineEntry[]>({
    queryKey: ["timeline"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTimeline();
    },
    enabled: !!actor && !isFetching,
  });
}

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

export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });
  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useGetSentryAvatar() {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["sentryAvatar"],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getSentryAvatar();
    },
    enabled: !!actor && !isFetching,
  });
}

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
      if (!actor) throw new Error("Not connected");
      return actor.addMemory(
        params.text,
        params.memoryType,
        params.concepts,
        params.isGlobal,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["userMemories"] });
    },
  });
}

export function useDeleteMemory() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteMemory(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["userMemories"] });
    },
  });
}

export function useAddRule() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { condition: string; effect: string }) => {
      if (!actor) throw new Error("Not connected");
      return actor.addRule(params.condition, params.effect);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useDeleteRule() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Not connected");
      return actor.deleteRule(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
}

export function useAddTimelineEntry() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      event: string;
      personalitySnapshot: PersonalityProfile;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.addTimelineEntry(params.event, params.personalitySnapshot);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeline"] }),
  });
}

export function useUpdatePersonality() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: PersonalityProfile) => {
      if (!actor) throw new Error("Not connected");
      return actor.updatePersonality(p.curiosity, p.friendliness, p.analytical);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personality"] }),
  });
}

export function useSetUserAvatar() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.setUserAvatar(url);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currentUserProfile"] }),
  });
}

export function useSetSentryAvatar() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.setSentryAvatar(url);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentryAvatar"] }),
  });
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Not connected");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currentUserProfile"] }),
  });
}

export function useAddKnowledgeEdge() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      fromId: bigint;
      toId: bigint;
      relationType: string;
    }) => {
      if (!actor) throw new Error("Not connected");
      return actor.addKnowledgeEdge(
        params.fromId,
        params.toId,
        params.relationType,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledgeEdges"] }),
  });
}

export function useExportUserData() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.exportUserData();
    },
  });
}

export function useExportGlobalData() {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.exportGlobalData();
    },
  });
}

export function useImportUserData() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jsonData: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.importUserData(jsonData);
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useImportGlobalData() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jsonData: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.importGlobalData(jsonData);
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
