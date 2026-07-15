import { notFound } from "next/navigation";
import { TopicPreviewPage } from "@/components/learn/topic-preview-page";
import { getTopicPreview } from "@/lib/content/topic-previews";

export default function EverydayConversationPage() {
  const topic = getTopicPreview("everyday-conversation");
  if (!topic) notFound();
  return <TopicPreviewPage topic={topic} />;
}
