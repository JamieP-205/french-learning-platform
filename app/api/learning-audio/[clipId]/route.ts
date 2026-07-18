import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { audioSourceForFrench } from "@/lib/content/french-audio";
import { getScoredActivityById } from "@/lib/content/scored-missions";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ clipId: string }> },
) {
  const { clipId } = await params;
  if (!/^[a-z0-9-]{1,100}$/.test(clipId)) {
    return NextResponse.json({ error: "Audio clip not found." }, { status: 404 });
  }

  const activity = getScoredActivityById(clipId);
  if (
    !activity ||
    (activity.type !== "dictation" && activity.type !== "speak_repeat") ||
    !activity.targetText
  ) {
    return NextResponse.json({ error: "Audio clip not found." }, { status: 404 });
  }

  const publicSource = audioSourceForFrench(activity.targetText);
  if (!publicSource) {
    return NextResponse.json({ error: "Audio clip not found." }, { status: 404 });
  }

  const publicRoot = resolve(process.cwd(), "public");
  const audioRoot = resolve(publicRoot, "audio", "french");
  const audioPath = resolve(publicRoot, publicSource.replace(/^\/+/, ""));
  if (!audioPath.startsWith(`${audioRoot}${sep}`)) {
    return NextResponse.json({ error: "Audio clip not found." }, { status: 404 });
  }

  try {
    const audio = await readFile(audioPath);
    return new NextResponse(Uint8Array.from(audio), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(audio.byteLength),
        "Content-Type": "audio/mpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Audio clip not found." }, { status: 404 });
  }
}
