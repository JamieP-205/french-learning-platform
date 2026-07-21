import { ImageResponse } from "next/og";

export const alt = "French for Life: practical French for everyday life";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The same fox mark as app/icon.svg, inlined so the social card needs no
// extra asset. Satori renders it through an img data URI.
const foxMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="head" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dd8a58"/><stop offset="100%" stop-color="#c2683c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#f4ead6"/><g><path d="M21 24l-4-13c5 1 9 5 11 9z" fill="#c2683c"/><path d="M22 22l-2-8c3 1 5 3 7 6z" fill="#3c2a20"/><path d="M43 24l4-13c-5 1-9 5-11 9z" fill="#c2683c"/><path d="M42 22l2-8c-3 1-5 3-7 6z" fill="#3c2a20"/><path d="M32 52c-9 0-16-5-18-13-2-6 1-13 6-17 4-3 8-5 12-5s8 2 12 5c5 4 8 11 6 17-2 8-9 13-18 13z" fill="url(#head)"/><path d="M32 52c-4 0-8-1-11-4 1-6 5-11 11-13 6 2 10 7 11 13-3 3-7 4-11 4z" fill="#f4ead6"/><ellipse cx="24.5" cy="31" rx="2.6" ry="3" fill="#2a2018"/><ellipse cx="39.5" cy="31" rx="2.6" ry="3" fill="#2a2018"/><path d="M32 42c-1.6 0-2.6-0.9-2.6-2.2 1-0.9 4.2-0.9 5.2 0 0 1.3-1 2.2-2.6 2.2z" fill="#2a2018"/><path d="M18 47c4 3 9 5 14 5s10-2 14-5c1 2 1 4 0 5-4 3-9 5-14 5s-10-2-14-5c-1-1-1-3 0-5z" fill="#44638d"/></g></svg>`;

const foxMarkUri = `data:image/svg+xml;base64,${Buffer.from(foxMark).toString("base64")}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          backgroundColor: "#f8f2e4",
          backgroundImage: "radial-gradient(circle at 88% 8%, #efe6d0 0%, #efe6d0 28%, transparent 29%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foxMarkUri} width={280} height={280} alt="" style={{ borderRadius: 60 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, color: "#1f2c40", letterSpacing: -2 }}>
            French for Life
          </div>
          <div style={{ fontSize: 42, fontWeight: 600, color: "#a84a30", marginTop: 18 }}>
            Practical French for everyday life.
          </div>
          <div style={{ fontSize: 32, color: "#4c576b", marginTop: 14 }}>
            Learn it first. Then use it. Ten minutes at a time.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
