export async function GET() {
    return Response.json({
      alive: true,
      timestamp: new Date().toISOString(),
    })
  }