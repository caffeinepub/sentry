import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PersonalityProfile {
    analytical: number;
    friendliness: number;
    curiosity: number;
}
export interface KnowledgeEdge {
    relationType: string;
    toId: bigint;
    fromId: bigint;
}
export interface Rule {
    id: bigint;
    effect: string;
    timestamp: bigint;
    condition: string;
}
export interface Memory {
    id: bigint;
    isGlobal: boolean;
    text: string;
    concepts: Array<string>;
    timestamp: bigint;
    principalId: string;
    memoryType: string;
}
export interface TimelineEntry {
    id: bigint;
    personalitySnapshot: PersonalityProfile;
    event: string;
    timestamp: bigint;
}
export interface UserProfile {
    personality: PersonalityProfile;
    username: string;
    avatarUrl: string;
    principalId: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addKnowledgeEdge(fromId: bigint, toId: bigint, relationType: string): Promise<void>;
    addMemory(text: string, memoryType: string, concepts: Array<string>, isGlobal: boolean): Promise<bigint>;
    addRule(condition: string, effect: string): Promise<bigint>;
    addTimelineEntry(event: string, personalitySnapshot: PersonalityProfile): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    deleteMemory(id: bigint): Promise<boolean>;
    deleteRule(id: bigint): Promise<boolean>;
    exportGlobalData(): Promise<string>;
    exportUserData(): Promise<string>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getKnowledgeEdges(): Promise<Array<KnowledgeEdge>>;
    getMemories(isGlobal: boolean): Promise<Array<Memory>>;
    getPersonality(): Promise<PersonalityProfile>;
    getRules(): Promise<Array<Rule>>;
    getSentryAvatar(): Promise<string>;
    getTimeline(): Promise<Array<TimelineEntry>>;
    getUserMemories(): Promise<Array<Memory>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    importGlobalData(_jsonData: string): Promise<boolean>;
    importUserData(_jsonData: string): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setSentryAvatar(avatarUrl: string): Promise<void>;
    setUserAvatar(avatarUrl: string): Promise<void>;
    setUsername(username: string): Promise<void>;
    updatePersonality(curiosity: number, friendliness: number, analytical: number): Promise<void>;
}
