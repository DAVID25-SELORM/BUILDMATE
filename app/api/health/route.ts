export async function GET() {
  return Response.json({ status: "ok", service: "buildmate-webapp", timestamp: new Date().toISOString() });
}
