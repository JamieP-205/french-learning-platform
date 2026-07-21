// The garden's milestones, shared by the garden scene, the celebration
// moment, and anything else that wants to say what grew. Thresholds live
// here and nowhere else.

export type GardenProgress = {
  sessionsCompleted: number;
  currentStreak: number;
  streakUnit?: "day" | "week";
  phrasesLearned: number;
  mistakesFixed: number;
  habit: { tone: "new" | "fresh" | "steady" | "comeback" };
};

export type GardenMilestone = {
  id: string;
  label: string;
  earnedBy: string;
  earned: boolean;
  current: number;
  target: number;
};

export function gardenMilestones(progress: GardenProgress): GardenMilestone[] {
  const unit = progress.streakUnit ?? "day";
  return [
    { id: "sprout", label: "First sprout", earnedBy: "Complete your first session", earned: progress.sessionsCompleted >= 1, current: progress.sessionsCompleted, target: 1 },
    { id: "flowers", label: "Wildflower bed", earnedBy: "Recall your first phrase", earned: progress.phrasesLearned >= 1, current: progress.phrasesLearned, target: 1 },
    { id: "bench", label: "Garden bench", earnedBy: "Repair a mistake through review", earned: progress.mistakesFixed >= 1, current: progress.mistakesFixed, target: 1 },
    { id: "path", label: "Stepping stones", earnedBy: "Complete 3 sessions", earned: progress.sessionsCompleted >= 3, current: progress.sessionsCompleted, target: 3 },
    { id: "sun", label: "Morning light", earnedBy: `Reach a 3-${unit} streak`, earned: progress.currentStreak >= 3, current: progress.currentStreak, target: 3 },
    { id: "cafe", label: "Little café cart", earnedBy: "Complete 5 sessions", earned: progress.sessionsCompleted >= 5, current: progress.sessionsCompleted, target: 5 },
    { id: "lanterns", label: "Evening lanterns", earnedBy: `Reach a 7-${unit} streak`, earned: progress.currentStreak >= 7, current: progress.currentStreak, target: 7 },
    { id: "tree", label: "Young chestnut tree", earnedBy: "Complete 10 sessions", earned: progress.sessionsCompleted >= 10, current: progress.sessionsCompleted, target: 10 },
    { id: "canopy", label: "Chestnut canopy", earnedBy: "Complete 20 sessions", earned: progress.sessionsCompleted >= 20, current: progress.sessionsCompleted, target: 20 },
  ];
}

export function earnedMilestoneIds(progress: GardenProgress): string[] {
  return gardenMilestones(progress)
    .filter((milestone) => milestone.earned)
    .map((milestone) => milestone.id);
}
