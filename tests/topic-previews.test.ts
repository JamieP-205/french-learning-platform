import { describe, expect, it } from "vitest";
import { getActiveTopicPreviews, getTopicPreview, topicPreviews } from "../lib/content/topic-previews";

describe("topic preview content", () => {
  it("includes active beginner topics beyond introductions", () => {
    const activeTopics = getActiveTopicPreviews().map((topic) => topic.slug);

    expect(activeTopics).toContain("introduce-yourself");
    expect(activeTopics).toContain("cafe-food");
    expect(activeTopics).toContain("travel-basics");
    expect(activeTopics).toContain("work-basics");
    expect(activeTopics).toContain("everyday-conversation");
  });

  it("gives public preview topics useful phrase sets with accepted answers", () => {
    for (const slug of ["cafe-food", "travel-basics", "work-basics", "everyday-conversation"]) {
      const topic = getTopicPreview(slug);

      expect(topic).toBeTruthy();
      expect(topic?.phrases.length).toBeGreaterThanOrEqual(4);

      for (const phrase of topic?.phrases ?? []) {
        expect(phrase.french.length).toBeGreaterThan(3);
        expect(phrase.english.length).toBeGreaterThan(3);
        expect(phrase.acceptedAnswers).toContain(phrase.french);
        expect(phrase.note.length).toBeGreaterThan(5);
      }
    }
  });

  it("does not mark empty planned topics as active", () => {
    const activeSlugs = getActiveTopicPreviews().map((topic) => topic.slug);
    const plannedSlugs = topicPreviews.filter((topic) => topic.status === "planned").map((topic) => topic.slug);

    for (const slug of plannedSlugs) {
      expect(activeSlugs).not.toContain(slug);
    }
  });
});
