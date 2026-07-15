import { notFound } from "next/navigation";
import { TopicPreviewPage } from "@/components/learn/topic-preview-page";
import { getTopicPreview } from "@/lib/content/topic-previews";

export default function TravelBasicsPage() {
  const topic = getTopicPreview("travel-basics");
  if (!topic) notFound();
  return <TopicPreviewPage topic={topic} />;
}
