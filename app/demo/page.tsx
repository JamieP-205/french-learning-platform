import { PublicDemoLesson } from "@/components/demo/public-demo-lesson";
import { getSeedMission } from "@/lib/content/seed";

export default function DemoPage() {
  return (
    <main className="page-shell py-10">
      <PublicDemoLesson mission={getSeedMission()} />
    </main>
  );
}
