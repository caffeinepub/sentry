/* eslint-disable */

// @ts-nocheck

import { IDL } from '@icp-sdk/core/candid';

export const _CaffeineStorageCreateCertificateResult = IDL.Record({
  'method' : IDL.Text,
  'blob_hash' : IDL.Text,
});
export const _CaffeineStorageRefillInformation = IDL.Record({
  'proposed_top_up_amount' : IDL.Opt(IDL.Nat),
});
export const _CaffeineStorageRefillResult = IDL.Record({
  'success' : IDL.Opt(IDL.Bool),
  'topped_up_amount' : IDL.Opt(IDL.Nat),
});
export const PersonalityProfile = IDL.Record({
  'analytical' : IDL.Float64,
  'friendliness' : IDL.Float64,
  'curiosity' : IDL.Float64,
});
export const UserRole = IDL.Variant({
  'admin' : IDL.Null,
  'user' : IDL.Null,
  'guest' : IDL.Null,
});
export const UserProfile = IDL.Record({
  'personality' : PersonalityProfile,
  'username' : IDL.Text,
  'avatarUrl' : IDL.Text,
  'principalId' : IDL.Text,
});
export const KnowledgeEdge = IDL.Record({
  'relationType' : IDL.Text,
  'toId' : IDL.Nat,
  'fromId' : IDL.Nat,
});
export const Memory = IDL.Record({
  'id' : IDL.Nat,
  'isGlobal' : IDL.Bool,
  'text' : IDL.Text,
  'concepts' : IDL.Vec(IDL.Text),
  'timestamp' : IDL.Int,
  'principalId' : IDL.Text,
  'memoryType' : IDL.Text,
});
export const Rule = IDL.Record({
  'id' : IDL.Nat,
  'effect' : IDL.Text,
  'timestamp' : IDL.Int,
  'condition' : IDL.Text,
});
export const TimelineEntry = IDL.Record({
  'id' : IDL.Nat,
  'personalitySnapshot' : PersonalityProfile,
  'event' : IDL.Text,
  'timestamp' : IDL.Int,
});
export const ChatMessage = IDL.Record({
  'id' : IDL.Nat,
  'role' : IDL.Text,
  'name' : IDL.Text,
  'content' : IDL.Text,
  'attachmentsJson' : IDL.Text,
  'timestamp' : IDL.Int,
});
export const CustomGif = IDL.Record({
  'id' : IDL.Nat,
  'url' : IDL.Text,
  'gifLabel' : IDL.Text,
});
export const CustomEmoji = IDL.Record({
  'id' : IDL.Nat,
  'emoji' : IDL.Text,
});

export const idlService = IDL.Service({
  '_caffeineStorageBlobIsLive' : IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Bool], ['query']),
  '_caffeineStorageBlobsToDelete' : IDL.Func([], [IDL.Vec(IDL.Vec(IDL.Nat8))], ['query']),
  '_caffeineStorageConfirmBlobDeletion' : IDL.Func([IDL.Vec(IDL.Vec(IDL.Nat8))], [], []),
  '_caffeineStorageCreateCertificate' : IDL.Func([IDL.Text], [_CaffeineStorageCreateCertificateResult], []),
  '_caffeineStorageRefillCashier' : IDL.Func([IDL.Opt(_CaffeineStorageRefillInformation)], [_CaffeineStorageRefillResult], []),
  '_caffeineStorageUpdateGatewayPrincipals' : IDL.Func([], [], []),
  '_initializeAccessControlWithSecret' : IDL.Func([IDL.Text], [], []),
  'addKnowledgeEdge' : IDL.Func([IDL.Nat, IDL.Nat, IDL.Text], [], []),
  'addMemory' : IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Text), IDL.Bool], [IDL.Nat], []),
  'addRule' : IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], []),
  'addTimelineEntry' : IDL.Func([IDL.Text, PersonalityProfile], [IDL.Nat], []),
  'assignCallerUserRole' : IDL.Func([IDL.Principal, UserRole], [], []),
  'deleteMemory' : IDL.Func([IDL.Nat], [IDL.Bool], []),
  'deleteRule' : IDL.Func([IDL.Nat], [IDL.Bool], []),
  'exportGlobalData' : IDL.Func([], [IDL.Text], ['query']),
  'exportUserData' : IDL.Func([], [IDL.Text], ['query']),
  'getCallerUserProfile' : IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
  'getCallerUserRole' : IDL.Func([], [UserRole], ['query']),
  'getKnowledgeEdges' : IDL.Func([], [IDL.Vec(KnowledgeEdge)], ['query']),
  'getMemories' : IDL.Func([IDL.Bool], [IDL.Vec(Memory)], ['query']),
  'getPersonality' : IDL.Func([], [PersonalityProfile], ['query']),
  'getRules' : IDL.Func([], [IDL.Vec(Rule)], ['query']),
  'getSentryAvatar' : IDL.Func([], [IDL.Text], ['query']),
  'getTimeline' : IDL.Func([], [IDL.Vec(TimelineEntry)], ['query']),
  'getUserMemories' : IDL.Func([], [IDL.Vec(Memory)], ['query']),
  'getUserProfile' : IDL.Func([IDL.Principal], [IDL.Opt(UserProfile)], ['query']),
  'importGlobalData' : IDL.Func([IDL.Text], [IDL.Bool], []),
  'importUserData' : IDL.Func([IDL.Text], [IDL.Bool], []),
  'isCallerAdmin' : IDL.Func([], [IDL.Bool], ['query']),
  'saveCallerUserProfile' : IDL.Func([UserProfile], [], []),
  'setSentryAvatar' : IDL.Func([IDL.Text], [], []),
  'setUserAvatar' : IDL.Func([IDL.Text], [], []),
  'setUsername' : IDL.Func([IDL.Text], [], []),
  'updatePersonality' : IDL.Func([IDL.Float64, IDL.Float64, IDL.Float64], [], []),
  'addChatMessage' : IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text], [IDL.Nat], []),
  'getChatMessages' : IDL.Func([], [IDL.Vec(ChatMessage)], ['query']),
  'clearChatMessages' : IDL.Func([], [], []),
  'addCustomGif' : IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], []),
  'getCustomGifs' : IDL.Func([], [IDL.Vec(CustomGif)], ['query']),
  'deleteCustomGif' : IDL.Func([IDL.Nat], [IDL.Bool], []),
  'addCustomEmoji' : IDL.Func([IDL.Text], [IDL.Nat], []),
  'getCustomEmojis' : IDL.Func([], [IDL.Vec(CustomEmoji)], ['query']),
  'deleteCustomEmoji' : IDL.Func([IDL.Nat], [IDL.Bool], []),
});

export const idlInitArgs = [];

export const idlFactory = ({ IDL }) => {
  const _CaffeineStorageCreateCertificateResult = IDL.Record({ 'method' : IDL.Text, 'blob_hash' : IDL.Text });
  const _CaffeineStorageRefillInformation = IDL.Record({ 'proposed_top_up_amount' : IDL.Opt(IDL.Nat) });
  const _CaffeineStorageRefillResult = IDL.Record({ 'success' : IDL.Opt(IDL.Bool), 'topped_up_amount' : IDL.Opt(IDL.Nat) });
  const PersonalityProfile = IDL.Record({ 'analytical' : IDL.Float64, 'friendliness' : IDL.Float64, 'curiosity' : IDL.Float64 });
  const UserRole = IDL.Variant({ 'admin' : IDL.Null, 'user' : IDL.Null, 'guest' : IDL.Null });
  const UserProfile = IDL.Record({ 'personality' : PersonalityProfile, 'username' : IDL.Text, 'avatarUrl' : IDL.Text, 'principalId' : IDL.Text });
  const KnowledgeEdge = IDL.Record({ 'relationType' : IDL.Text, 'toId' : IDL.Nat, 'fromId' : IDL.Nat });
  const Memory = IDL.Record({ 'id' : IDL.Nat, 'isGlobal' : IDL.Bool, 'text' : IDL.Text, 'concepts' : IDL.Vec(IDL.Text), 'timestamp' : IDL.Int, 'principalId' : IDL.Text, 'memoryType' : IDL.Text });
  const Rule = IDL.Record({ 'id' : IDL.Nat, 'effect' : IDL.Text, 'timestamp' : IDL.Int, 'condition' : IDL.Text });
  const TimelineEntry = IDL.Record({ 'id' : IDL.Nat, 'personalitySnapshot' : PersonalityProfile, 'event' : IDL.Text, 'timestamp' : IDL.Int });
  const ChatMessage = IDL.Record({ 'id' : IDL.Nat, 'role' : IDL.Text, 'name' : IDL.Text, 'content' : IDL.Text, 'attachmentsJson' : IDL.Text, 'timestamp' : IDL.Int });
  const CustomGif = IDL.Record({ 'id' : IDL.Nat, 'url' : IDL.Text, 'gifLabel' : IDL.Text });
  const CustomEmoji = IDL.Record({ 'id' : IDL.Nat, 'emoji' : IDL.Text });

  return IDL.Service({
    '_caffeineStorageBlobIsLive' : IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Bool], ['query']),
    '_caffeineStorageBlobsToDelete' : IDL.Func([], [IDL.Vec(IDL.Vec(IDL.Nat8))], ['query']),
    '_caffeineStorageConfirmBlobDeletion' : IDL.Func([IDL.Vec(IDL.Vec(IDL.Nat8))], [], []),
    '_caffeineStorageCreateCertificate' : IDL.Func([IDL.Text], [_CaffeineStorageCreateCertificateResult], []),
    '_caffeineStorageRefillCashier' : IDL.Func([IDL.Opt(_CaffeineStorageRefillInformation)], [_CaffeineStorageRefillResult], []),
    '_caffeineStorageUpdateGatewayPrincipals' : IDL.Func([], [], []),
    '_initializeAccessControlWithSecret' : IDL.Func([IDL.Text], [], []),
    'addKnowledgeEdge' : IDL.Func([IDL.Nat, IDL.Nat, IDL.Text], [], []),
    'addMemory' : IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Text), IDL.Bool], [IDL.Nat], []),
    'addRule' : IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], []),
    'addTimelineEntry' : IDL.Func([IDL.Text, PersonalityProfile], [IDL.Nat], []),
    'assignCallerUserRole' : IDL.Func([IDL.Principal, UserRole], [], []),
    'deleteMemory' : IDL.Func([IDL.Nat], [IDL.Bool], []),
    'deleteRule' : IDL.Func([IDL.Nat], [IDL.Bool], []),
    'exportGlobalData' : IDL.Func([], [IDL.Text], ['query']),
    'exportUserData' : IDL.Func([], [IDL.Text], ['query']),
    'getCallerUserProfile' : IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
    'getCallerUserRole' : IDL.Func([], [UserRole], ['query']),
    'getKnowledgeEdges' : IDL.Func([], [IDL.Vec(KnowledgeEdge)], ['query']),
    'getMemories' : IDL.Func([IDL.Bool], [IDL.Vec(Memory)], ['query']),
    'getPersonality' : IDL.Func([], [PersonalityProfile], ['query']),
    'getRules' : IDL.Func([], [IDL.Vec(Rule)], ['query']),
    'getSentryAvatar' : IDL.Func([], [IDL.Text], ['query']),
    'getTimeline' : IDL.Func([], [IDL.Vec(TimelineEntry)], ['query']),
    'getUserMemories' : IDL.Func([], [IDL.Vec(Memory)], ['query']),
    'getUserProfile' : IDL.Func([IDL.Principal], [IDL.Opt(UserProfile)], ['query']),
    'importGlobalData' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'importUserData' : IDL.Func([IDL.Text], [IDL.Bool], []),
    'isCallerAdmin' : IDL.Func([], [IDL.Bool], ['query']),
    'saveCallerUserProfile' : IDL.Func([UserProfile], [], []),
    'setSentryAvatar' : IDL.Func([IDL.Text], [], []),
    'setUserAvatar' : IDL.Func([IDL.Text], [], []),
    'setUsername' : IDL.Func([IDL.Text], [], []),
    'updatePersonality' : IDL.Func([IDL.Float64, IDL.Float64, IDL.Float64], [], []),
    'addChatMessage' : IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text], [IDL.Nat], []),
    'getChatMessages' : IDL.Func([], [IDL.Vec(ChatMessage)], ['query']),
    'clearChatMessages' : IDL.Func([], [], []),
    'addCustomGif' : IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], []),
    'getCustomGifs' : IDL.Func([], [IDL.Vec(CustomGif)], ['query']),
    'deleteCustomGif' : IDL.Func([IDL.Nat], [IDL.Bool], []),
    'addCustomEmoji' : IDL.Func([IDL.Text], [IDL.Nat], []),
    'getCustomEmojis' : IDL.Func([], [IDL.Vec(CustomEmoji)], ['query']),
    'deleteCustomEmoji' : IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};

export const init = ({ IDL }) => { return []; };
