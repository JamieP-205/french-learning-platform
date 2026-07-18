import { PublicDemoLesson } from "@/components/demo/public-demo-lesson";
import { getSeedMission } from "@/lib/content/seed";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return (
    <main id="main-content" className="page-shell py-10">
      <PublicDemoLesson mission={getSeedMission()} mode={mode === "short" ? "short" : "full"} />
    </main>
  );
}
