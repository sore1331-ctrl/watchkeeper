// The server's clock, for checking the device's against (see lib/clock).
// A hosting platform keeps its clocks disciplined to a time standard; a phone
// or laptop only roughly so.

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
