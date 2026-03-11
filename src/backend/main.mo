import AccessControl "authorization/access-control";
import MixinStorage "blob-storage/Mixin";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Array "mo:core/Array";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  // State variables
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  type Memory = {
    id : Nat;
    text : Text;
    memoryType : Text;
    concepts : [Text];
    timestamp : Int;
    isGlobal : Bool;
    principalId : Text;
  };

  module Memory {
    public func compare(memory1 : Memory, memory2 : Memory) : Order.Order {
      Nat.compare(memory1.id, memory2.id);
    };

    public func compareByTimestamp(memory1 : Memory, memory2 : Memory) : Order.Order {
      Int.compare(memory1.timestamp, memory2.timestamp);
    };
  };

  type Rule = {
    id : Nat;
    condition : Text;
    effect : Text;
    timestamp : Int;
  };

  type PersonalityProfile = {
    curiosity : Float;
    friendliness : Float;
    analytical : Float;
  };

  type TimelineEntry = {
    id : Nat;
    event : Text;
    timestamp : Int;
    personalitySnapshot : PersonalityProfile;
  };

  type UserProfile = {
    principalId : Text;
    username : Text;
    avatarUrl : Text;
    personality : PersonalityProfile;
  };

  type KnowledgeEdge = {
    fromId : Nat;
    toId : Nat;
    relationType : Text;
  };

  var nextId = 0;
  var sentryAvatarUrl = "/default-avatar.png";
  let memories = Map.empty<Nat, Memory>();
  let rules = Map.empty<Nat, Rule>();
  let knowledgeEdges = Map.empty<Nat, KnowledgeEdge>();
  let timelines = Map.empty<Text, [TimelineEntry]>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  func getNextId() : Nat {
    nextId += 1;
    nextId;
  };

  // Memories
  public shared ({ caller }) func addMemory(text : Text, memoryType : Text, concepts : [Text], isGlobal : Bool) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add memories");
    };
    if (isGlobal and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can add global memories");
    };
    let id = getNextId();
    let principalId = caller.toText();
    let memory : Memory = {
      id;
      text;
      memoryType;
      concepts;
      timestamp = Int.abs(id) * 1000;
      isGlobal;
      principalId;
    };
    memories.add(id, memory);
    id;
  };

  public query ({ caller }) func getMemories(isGlobal : Bool) : async [Memory] {
    memories.values().toArray().filter(
      func(memory) { memory.isGlobal == isGlobal }
    );
  };

  public query ({ caller }) func getUserMemories() : async [Memory] {
    let principalId = caller.toText();
    memories.values().toArray().filter(
      func(memory) { memory.principalId == principalId and not memory.isGlobal }
    );
  };

  public shared ({ caller }) func deleteMemory(id : Nat) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete memories");
    };
    switch (memories.get(id)) {
      case (null) { Runtime.trap("Memory not found") };
      case (?memory) {
        if (memory.isGlobal and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only admins can delete global memories");
        };
        if (not memory.isGlobal and memory.principalId != caller.toText()) {
          Runtime.trap("Unauthorized: Can only delete your own memories");
        };
        memories.remove(id);
        true;
      };
    };
  };

  // Rules
  public shared ({ caller }) func addRule(condition : Text, effect : Text) : async Nat {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can add rules");
    };
    let id = getNextId();
    let rule : Rule = {
      id;
      condition;
      effect;
      timestamp = Int.abs(id) * 1000;
    };
    rules.add(id, rule);
    id;
  };

  public query ({ caller }) func getRules() : async [Rule] {
    rules.values().toArray();
  };

  public shared ({ caller }) func deleteRule(id : Nat) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can delete rules");
    };
    switch (rules.get(id)) {
      case (null) { Runtime.trap("Rule not found") };
      case (?_) {
        rules.remove(id);
        true;
      };
    };
  };

  // Knowledge Edges
  public shared ({ caller }) func addKnowledgeEdge(fromId : Nat, toId : Nat, relationType : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add knowledge edges");
    };
    let id = getNextId();
    let edge : KnowledgeEdge = {
      fromId;
      toId;
      relationType;
    };
    knowledgeEdges.add(id, edge);
  };

  public query ({ caller }) func getKnowledgeEdges() : async [KnowledgeEdge] {
    knowledgeEdges.values().toArray();
  };

  // Personality Profile
  public query ({ caller }) func getPersonality() : async PersonalityProfile {
    switch (userProfiles.get(caller)) {
      case (null) {
        {
          curiosity = 0.5;
          friendliness = 0.5;
          analytical = 0.5;
        };
      };
      case (?profile) { profile.personality };
    };
  };

  public shared ({ caller }) func updatePersonality(curiosity : Float, friendliness : Float, analytical : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update personality");
    };
    let principalId = caller.toText();
    let updatedPersonality : PersonalityProfile = {
      curiosity;
      friendliness;
      analytical;
    };

    switch (userProfiles.get(caller)) {
      case (null) {
        let newProfile : UserProfile = {
          principalId;
          username = "";
          avatarUrl = "";
          personality = updatedPersonality;
        };
        userProfiles.add(caller, newProfile);
      };
      case (?profile) {
        let updatedProfile : UserProfile = {
          profile with personality = updatedPersonality;
        };
        userProfiles.add(caller, updatedProfile);
      };
    };
  };

  // Timeline
  public shared ({ caller }) func addTimelineEntry(event : Text, personalitySnapshot : PersonalityProfile) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add timeline entries");
    };
    let id = getNextId();
    let entry : TimelineEntry = {
      id;
      event;
      timestamp = Int.abs(id) * 1000;
      personalitySnapshot;
    };
    let principalId = caller.toText();
    let currentTimeline = switch (timelines.get(principalId)) {
      case (null) { [] };
      case (?timeline) { timeline };
    };
    timelines.add(principalId, currentTimeline.concat([entry]));
    id;
  };

  public query ({ caller }) func getTimeline() : async [TimelineEntry] {
    switch (timelines.get(caller.toText())) {
      case (null) { [] };
      case (?timeline) { timeline };
    };
  };

  // Avatars and Profiles
  public shared ({ caller }) func setUserAvatar(avatarUrl : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can set avatar");
    };
    let principalId = caller.toText();
    switch (userProfiles.get(caller)) {
      case (null) {
        let newProfile : UserProfile = {
          principalId;
          username = "";
          avatarUrl;
          personality = {
            curiosity = 0.5;
            friendliness = 0.5;
            analytical = 0.5;
          };
        };
        userProfiles.add(caller, newProfile);
      };
      case (?profile) {
        let updatedProfile : UserProfile = {
          profile with avatarUrl;
        };
        userProfiles.add(caller, updatedProfile);
      };
    };
  };

  public shared ({ caller }) func setSentryAvatar(avatarUrl : Text) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can set sentry avatar");
    };
    sentryAvatarUrl := avatarUrl;
  };

  public query ({ caller }) func getSentryAvatar() : async Text {
    sentryAvatarUrl;
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func setUsername(username : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can set username");
    };
    let principalId = caller.toText();
    switch (userProfiles.get(caller)) {
      case (null) {
        let newProfile : UserProfile = {
          principalId;
          username;
          avatarUrl = "";
          personality = {
            curiosity = 0.5;
            friendliness = 0.5;
            analytical = 0.5;
          };
        };
        userProfiles.add(caller, newProfile);
      };
      case (?profile) {
        let updatedProfile : UserProfile = {
          profile with username;
        };
        userProfiles.add(caller, updatedProfile);
      };
    };
  };

  // Data Export/Import
  public query ({ caller }) func exportUserData() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can export their data");
    };
    let principalId = caller.toText();
    switch (userProfiles.get(caller)) {
      case (null) {
        "{ \"principalId\": \"" # principalId # "\", \"username\": \"\", \"memories\": [], \"timeline\": [], \"personality\": { \"curiosity\": 0.5, \"friendliness\": 0.5, \"analytical\": 0.5 } }";
      };
      case (?profile) {
        "{ \"principalId\": \"" # principalId # "\", \"username\": \"" # profile.username # "\", \"memories\": [], \"timeline\": [], \"personality\": { \"curiosity\": " # profile.personality.curiosity.toText() # ", \"friendliness\": " # profile.personality.friendliness.toText() # ", \"analytical\": " # profile.personality.analytical.toText() # " } }";
      };
    };
  };

  public query ({ caller }) func exportGlobalData() : async Text {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can export global data");
    };
    "{ \"memories\": [], \"rules\": [] }";
  };

  public shared ({ caller }) func importUserData(_jsonData : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can import their data");
    };
    ignore _jsonData;
    false;
  };

  public shared ({ caller }) func importGlobalData(_jsonData : Text) : async Bool {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can import global data");
    };
    ignore _jsonData;
    false;
  };
};
