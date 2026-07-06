import { NextRequest, NextResponse } from "next/server";

// Socket.IO is handled by the custom server; this route just acknowledges
export function GET(_req: NextRequest) {
  return NextResponse.json({ status: "socket.io handled by custom server" });
}
