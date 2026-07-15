import { describe, expect, it } from "vitest";
import { MockLearningRepository } from "../lib/data/mock-repository";

function profile(userId: string, displayName: string, completedSessions = 0) {
  return {
    userId,
    displayName,
    currentLevel: "A1" as const,
    learningGoals: ["travel"],
    interests: [],
    dailyMinutes: 10,
    preferredMode: "normal" as const,
    policyVersion: "test",
    completedSessions,
    currentStreak: completedSessions,
    streakFreezes: 0,
  };
}

describe("social repository", () => {
  it("supports friend requests, co-op challenges, reports, and blocking", async () => {
    const repository = new MockLearningRepository();
    const jamie = await repository.saveProfile(profile("social-jamie", "Jamie", 2));
    const amie = await repository.saveProfile(profile("social-amie", "Amie", 1));

    await repository.sendFriendRequestByCode(jamie.userId, amie.friendCode!);
    const incoming = await repository.getSocialSnapshot(amie.userId);
    expect(incoming.incomingRequests).toHaveLength(1);
    expect(incoming.incomingRequests[0].from.displayName).toBe("Jamie");

    await repository.respondFriendRequest(amie.userId, incoming.incomingRequests[0].id, "accepted");
    const connected = await repository.getSocialSnapshot(jamie.userId);
    expect(connected.friends).toHaveLength(1);
    expect(connected.friends[0].friend.displayName).toBe("Amie");

    const challenged = await repository.startCoopChallenge(jamie.userId, amie.userId);
    expect(challenged.activeChallenge).toMatchObject({ title: "Three-session co-op", targetSessions: 3 });

    await repository.reportSocialUser(jamie.userId, amie.userId, "other", "Test report");
    const blocked = await repository.blockSocialUser(jamie.userId, amie.userId);
    expect(blocked.friends).toHaveLength(0);
    expect(blocked.blockedUserIds).toContain(amie.userId);
  });
});
