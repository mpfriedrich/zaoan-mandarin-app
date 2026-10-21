import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512];

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

/** App-Icon: eine aufgehende Sonne (早 = Morgen) auf warmem Verlauf. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const requested = Number((await params).size);
  const n = SIZES.includes(requested) ? requested : 512;
  const sun = n * 0.44;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(165deg, #FFC24A 0%, #FF8A3D 50%, #FF3D6B 100%)",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: n * 0.2, width: n, height: n * 0.42, display: "flex", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ marginTop: n * 0.42 - sun / 2, width: sun, height: sun, borderRadius: sun, background: "#FFFFFF" }} />
        </div>
        <div style={{ position: "absolute", left: n * 0.2, top: n * 0.66, width: n * 0.6, height: n * 0.045, borderRadius: n, background: "rgba(255,255,255,0.9)" }} />
        <div style={{ position: "absolute", left: n * 0.3, top: n * 0.75, width: n * 0.4, height: n * 0.045, borderRadius: n, background: "rgba(255,255,255,0.6)" }} />
      </div>
    ),
    { width: n, height: n },
  );
}
