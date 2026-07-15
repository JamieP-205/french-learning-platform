import { LessonPlayer } from "@/components/lesson/lesson-player";

export default async function LessonPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <LessonPlayer sessionId={sessionId} />;
}
