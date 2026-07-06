import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Server as SocketIOServer } from "socket.io";

function getIO(): SocketIOServer | null {
  return ((global as Record<string, unknown>).__socketio__ as SocketIOServer) ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const { question, socketId } = await req.json();

    if (!question || !socketId) {
      return NextResponse.json({ error: "Missing question or socketId" }, { status: 400 });
    }

    // Upsert session
    let session = await db
      .select()
      .from(sessions)
      .where(eq(sessions.socketId, socketId))
      .limit(1);

    let sessionId: string;

    if (session.length === 0) {
      const [newSession] = await db
        .insert(sessions)
        .values({ socketId })
        .returning();
      sessionId = newSession.id;
    } else {
      sessionId = session[0].id;
    }

    // Insert message
    const [message] = await db
      .insert(messages)
      .values({ sessionId, question, status: "pending" })
      .returning();

    // Notify admin via Socket.IO
    const io = getIO();
    if (io) {
      io.to("admin_room").emit("new_question", {
        messageId: message.id,
        sessionId,
        socketId,
        question,
        createdAt: message.createdAt,
      });
    }

    return NextResponse.json({ messageId: message.id, sessionId });
  } catch (err) {
    console.error("POST /api/questions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rows = await db
      .select({
        id: messages.id,
        sessionId: messages.sessionId,
        socketId: sessions.socketId,
        question: messages.question,
        answer: messages.answer,
        status: messages.status,
        createdAt: messages.createdAt,
        answeredAt: messages.answeredAt,
      })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .orderBy(desc(messages.createdAt))
      .limit(100);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/questions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
