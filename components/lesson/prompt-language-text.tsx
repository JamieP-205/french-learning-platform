type PromptLanguageTextProps = {
  text: string;
  frenchSegments: string[];
};

export function PromptLanguageText({ text, frenchSegments }: PromptLanguageTextProps) {
  const segments = frenchSegments.filter((segment) => segment.length > 0);
  if (segments.length === 0) return text;

  const parts: Array<{ text: string; french: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    let nextStart = -1;
    let nextSegment = "";

    for (const segment of segments) {
      const start = text.indexOf(segment, cursor);
      if (start === -1) continue;
      if (nextStart === -1 || start < nextStart || (start === nextStart && segment.length > nextSegment.length)) {
        nextStart = start;
        nextSegment = segment;
      }
    }

    if (nextStart === -1) {
      parts.push({ text: text.slice(cursor), french: false });
      break;
    }
    if (nextStart > cursor) {
      parts.push({ text: text.slice(cursor, nextStart), french: false });
    }
    parts.push({ text: nextSegment, french: true });
    cursor = nextStart + nextSegment.length;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.french ? <span lang="fr" key={index}>{part.text}</span> : part.text,
      )}
    </>
  );
}
