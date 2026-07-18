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
  it("rotates a shared friend code without changing the learner profile", async () => {
    const repository = new MockLearningRepository();
    const sender = await repository.saveProfile(profile("rotation-sender", "Sender"));
    const recipient = await repository.saveProfile(profile("rotation-recipient", "Recipient"));
    const previousCode = recipient.friendCode!;

    const rotated = await repository.rotateFriendCode(recipient.userId, crypto.randomUUID());

    expect(rotated.friendCode).not.toBe(previousCode);
    expect(rotated.profile).toMatchObject({ userId: recipient.userId, displayName: "Recipient" });
    await expect(repository.sendFriendRequestByCode(sender.userId, previousCode)).rejects.toThrow(
      "That friend code could not be added.",
    );
    await repository.sendFriendRequestByCode(sender.userId, rotated.friendCode);
    expect((await repository.getSocialSnapshot(recipient.userId)).incomingRequests).toHaveLength(1);
  });

  it("does not rotate a friend code twice when the same request is retried", async () => {
    const repository = new MockLearningRepository();
    const learner = await repository.saveProfile(profile("rotation-retry-learner", "Learner"));
    const requestId = crypto.randomUUID();

    const first = await repository.rotateFriendCode(learner.userId, requestId);
    const retried = await repository.rotateFriendCode(learner.userId, requestId);

    expect(retried.friendCode).toBe(first.friendCode);
    const exported = await repository.exportLearnerData(learner.userId) as {
      friendCodeRotationRequests: {
        requestId: string;
        rotatedCode: string;
      }[];
    };
    expect(exported.friendCodeRotationRequests).toEqual([
      expect.objectContaining({
        requestId,
        rotatedCode: first.friendCode,
      }),
    ]);
  });

  it("supports friend requests, co-op challenges, reports, and blocking", async () => {
    const repository = new MockLearningRepository();
    const jamie = await repository.saveProfile(profile("social-jamie", "Jamie", 2));
    const amie = await repository.saveProfile(profile("social-amie", "Amie", 1));

    await repository.sendFriendRequestByCode(jamie.userId, amie.friendCode!);
    const incoming = await repository.getSocialSnapshot(amie.userId);
    expect(incoming.incomingRequests).toHaveLength(1);
    expect(incoming.incomingRequests[0].from.displayName).toBe("Jamie");
    expect(incoming.incomingRequests[0].from).toEqual({
      userId: jamie.userId,
      displayName: "Jamie",
    });
    const outgoing = await repository.getSocialSnapshot(jamie.userId);
    expect(outgoing.outgoingRequests[0].to).toEqual({
      displayName: "Amie",
    });

    await repository.respondFriendRequest(amie.userId, incoming.incomingRequests[0].id, "accepted");
    const connected = await repository.getSocialSnapshot(jamie.userId);
    expect(connected.friends).toHaveLength(1);
    expect(connected.friends[0].friend.displayName).toBe("Amie");

    const challenged = await repository.startCoopChallenge(jamie.userId, amie.userId);
    expect(challenged.activeChallenge).toMatchObject({
      title: "Three-session co-op",
      targetSessions: 3,
      yourProgress: 0,
      friendProgress: 0,
      combinedProgress: 0,
      status: "active",
    });

    await repository.saveProfile({ ...jamie, completedSessions: 4 });
    const inProgress = await repository.getSocialSnapshot(jamie.userId);
    expect(inProgress.activeChallenge).toMatchObject({ yourProgress: 2, friendProgress: 0, combinedProgress: 2, status: "active" });

    await repository.saveProfile({ ...amie, completedSessions: 2 });
    const completed = await repository.getSocialSnapshot(jamie.userId);
    expect(completed.activeChallenge).toMatchObject({ yourProgress: 2, friendProgress: 1, combinedProgress: 3, status: "completed" });
    expect(completed.activeChallenge?.completedAt).toBeTruthy();

    await repository.reportSocialUser(jamie.userId, amie.userId, "other", "Test report", crypto.randomUUID());
    const blocked = await repository.blockSocialUser(jamie.userId, amie.userId);
    expect(blocked.friends).toHaveLength(0);
    expect(blocked.blockedUserIds).toContain(amie.userId);
    expect(blocked.blockedUsers).toContainEqual({
      userId: amie.userId,
      displayName: "Amie",
    });

    const unblocked = await repository.unblockSocialUser(jamie.userId, amie.userId);
    expect(unblocked.blockedUserIds).not.toContain(amie.userId);
    expect(unblocked.blockedUsers).toHaveLength(0);
    await expect(repository.unblockSocialUser(jamie.userId, amie.userId)).resolves.toMatchObject({
      blockedUsers: [],
    });
  });

  it("holds a declined request for seven days before it can be sent again", async () => {
    const repository = new MockLearningRepository();
    const sender = await repository.saveProfile(profile("cooldown-sender", "Sender"));
    const recipient = await repository.saveProfile(profile("cooldown-recipient", "Recipient"));

    await repository.sendFriendRequestByCode(sender.userId, recipient.friendCode!);
    const incoming = await repository.getSocialSnapshot(recipient.userId);
    await repository.respondFriendRequest(recipient.userId, incoming.incomingRequests[0].id, "declined");

    await expect(repository.sendFriendRequestByCode(sender.userId, recipient.friendCode!)).rejects.toThrow(
      "Wait 7 days before sending another request",
    );
  });

  it("lets a recipient report and block an incoming request before accepting it", async () => {
    const repository = new MockLearningRepository();
    const sender = await repository.saveProfile(profile("pending-safety-sender", "Sender"));
    const recipient = await repository.saveProfile(profile("pending-safety-recipient", "Recipient"));

    await repository.sendFriendRequestByCode(sender.userId, recipient.friendCode!);
    await repository.reportSocialUser(
      recipient.userId,
      sender.userId,
      "harassment",
      "Unwanted request",
      crypto.randomUUID(),
    );
    const blocked = await repository.blockSocialUser(recipient.userId, sender.userId);

    expect(blocked.incomingRequests).toHaveLength(0);
    expect(blocked.blockedUserIds).toContain(sender.userId);
    expect((await repository.getSocialSnapshot(sender.userId)).outgoingRequests).toHaveLength(0);
  });

  it("records a retried moderation report only once", async () => {
    const repository = new MockLearningRepository();
    const reporter = await repository.saveProfile(profile("report-retry-sender", "Reporter"));
    const reported = await repository.saveProfile(profile("report-retry-target", "Reported"));
    const requestId = crypto.randomUUID();

    await repository.reportSocialUser(reporter.userId, reported.userId, "spam", undefined, requestId);
    await repository.reportSocialUser(reporter.userId, reported.userId, "spam", undefined, requestId);

    const exported = await repository.exportLearnerData(reporter.userId) as {
      socialReports: { id: string }[];
    };
    expect(exported.socialReports.filter((report) => report.id === requestId)).toHaveLength(1);
  });

  it("will not start a challenge after either learner blocks the other", async () => {
    const repository = new MockLearningRepository();
    const first = await repository.saveProfile(profile("blocked-challenge-first", "First"));
    const second = await repository.saveProfile(profile("blocked-challenge-second", "Second"));

    await repository.sendFriendRequestByCode(first.userId, second.friendCode!);
    const incoming = await repository.getSocialSnapshot(second.userId);
    await repository.respondFriendRequest(second.userId, incoming.incomingRequests[0].id, "accepted");
    await repository.blockSocialUser(second.userId, first.userId);

    await expect(repository.startCoopChallenge(first.userId, second.userId)).rejects.toThrow(
      "Add this learner as a friend",
    );
  });

  it("allows only one active co-op challenge per learner", async () => {
    const repository = new MockLearningRepository();
    const first = await repository.saveProfile(profile("one-challenge-first", "First"));
    const second = await repository.saveProfile(profile("one-challenge-second", "Second"));
    const third = await repository.saveProfile(profile("one-challenge-third", "Third"));

    await repository.sendFriendRequestByCode(first.userId, second.friendCode!);
    let incoming = await repository.getSocialSnapshot(second.userId);
    await repository.respondFriendRequest(second.userId, incoming.incomingRequests[0].id, "accepted");
    await repository.sendFriendRequestByCode(third.userId, second.friendCode!);
    incoming = await repository.getSocialSnapshot(second.userId);
    const thirdRequest = incoming.incomingRequests.find((request) => request.from.userId === third.userId);
    expect(thirdRequest).toBeDefined();
    await repository.respondFriendRequest(second.userId, thirdRequest!.id, "accepted");

    await repository.startCoopChallenge(first.userId, second.userId);
    await expect(repository.startCoopChallenge(third.userId, second.userId)).rejects.toThrow(
      "Finish your active co-op challenge",
    );
  });
});
