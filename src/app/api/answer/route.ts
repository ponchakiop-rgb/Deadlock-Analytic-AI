import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Server as SocketIOServer } from "socket.io";

function getIO(): SocketIOServer | null {
  return ((global as Record<string, unknown>).__socketio__ as SocketIOServer) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const { messageId, answer } = await req.json();

    if (!messageId || !answer) {
      return NextResponse.json({ error: "Missing messageId or answer" }, { status: 400 });
    }

    // Update message
    const [updated] = await db
      .update(messages)
      .set({ answer, status: "answered", answeredAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Get session to find the user's socket
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, updated.sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Send answer to the specific user via Socket.IO
    const io = getIO();
    if (io) {
      // Emit to the specific socket by ID
      io.to(session.socketId).emit("answer_received", {
        messageId: updated.id,
        answer: updated.answer,
      });

      // Notify admin that message was answered
      io.to("admin_room").emit("question_answered", {
        messageId: updated.id,
        answer: updated.answer,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/answer error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
