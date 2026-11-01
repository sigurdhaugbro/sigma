import { ImageResponse } from "next/og";

/** Per-prototype home-screen icon: initials on Sigma's black + amber. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "Sigma").trim() || "Sigma";
  const size = Math.min(1024, Math.max(120, Number(url.searchParams.get("size")) || 180));
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0B0D",
          color: "#FBBF24",
          fontSize: Math.round(size * 0.42),
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        {initials || "Σ"}
      </div>
    ),
    { width: size, height: size },
  );
}
