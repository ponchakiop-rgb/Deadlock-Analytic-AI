"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";

interface Question {
  messageId: string;
  sessionId: string;
  socketId: string;
  question: string;
  answer: string | null;
  status: "pending" | "answered";
  createdAt: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default function AdminPage() {
  const { socket, connected } = useSocket();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [authOk, setAuthOk] = useState(false);
  const [authInput, setAuthInput] = useState("");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Simple client-side access check
  const ADMIN_KEY = "deadlock-admin-2024";

  const handleAuth = () => {
    if (authInput === ADMIN_KEY) {
      setAuthOk(true);
    } else {
      setNotification("НЕВЕРНЫЙ КОД ДОСТУПА");
      setTimeout(() => setNotification(null), 2000);
    }
  };

  // Join admin room
  useEffect(() => {
    if (!socket || !authOk) return;
    socket.emit("join_admin");
  }, [socket, authOk]);

  // Load existing questions
  useEffect(() => {
    if (!authOk) return;
    fetch("/api/questions")
      .then((r) => r.json())
      .then((data: Question[]) => setQuestions(data.reverse()))
      .catch(console.error);
  }, [authOk]);

  // Real-time socket events
  useEffect(() => {
    if (!socket || !authOk) return;

    const handleNew = (data: {
      messageId: string;
      sessionId: string;
      socketId: string;
      question: string;
      createdAt: string;
    }) => {
      const newQ: Question = {
        messageId: data.messageId,
        sessionId: data.sessionId,
        socketId: data.socketId,
        question: data.question,
        answer: null,
        status: "pending",
        createdAt: data.createdAt,
      };
      setQuestions((prev) => [...prev, newQ]);
      setNewIds((prev) => new Set([...prev, data.messageId]));
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(data.messageId);
          return next;
        });
      }, 3000);
      setNotification(`НОВЫЙ ЗАПРОС: ${shortId(data.messageId)}`);
      setTimeout(() => setNotification(null), 3000);
    };

    const handleAnswered = ({ messageId, answer }: { messageId: string; answer: string }) => {
      setQuestions((prev) =>
        prev.map((q) =>
          q.messageId === messageId ? { ...q, answer, status: "answered" } : q
        )
      );
    };

    socket.on("new_question", handleNew);
    socket.on("question_answered", handleAnswered);

    return () => {
      socket.off("new_question", handleNew);
      socket.off("question_answered", handleAnswered);
    };
  }, [socket, authOk]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [questions]);

  const handleSend = async () => {
    if (!answer.trim() || !selected || sending) return;
    setSending(true);
    try {
      await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selected, answer: answer.trim() }),
      });
      setAnswer("");
      setSelected(null);
      setNotification("ОТВЕТ ОТПРАВЛЕН ПОЛЬЗОВАТЕЛЮ");
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification("ОШИБКА ОТПРАВКИ");
      setTimeout(() => setNotification(null), 2000);
    } finally {
      setSending(false);
    }
  };

  const selectedQuestion = questions.find((q) => q.messageId === selected);
  const pendingCount = questions.filter((q) => q.status === "pending").length;

  // Auth screen
  if (!authOk) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="border border-red-700/50 bg-black/80 p-8 rounded-sm relative">
            <div className="text-center mb-6">
              <div className="font-['Orbitron',sans-serif] font-black text-red-400 text-xl tracking-widest mb-1">
                ЗАЩИЩЁННАЯ ЗОНА
              </div>
              <div className="text-xs text-red-600/60 font-mono">MATRIX-ADMIN // УРОВЕНЬ ДОСТУПА: SIGMA</div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <div className="text-xs text-red-500/60 font-mono mb-1">КОД ДОСТУПА:</div>
                <input
                  type="password"
                  value={authInput}
                  onChange={(e) => setAuthInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                  placeholder="••••••••••••••••"
                  className="w-full deadlock-input px-3 py-2 text-sm border-red-700/50 focus:border-red-400"
                  style={{ borderColor: "rgba(185,28,28,0.5)" }}
                />
              </div>
              <button
                onClick={handleAuth}
                className="deadlock-btn w-full py-2 bg-red-900/40 border border-red-700/50 text-red-300 text-xs hover:bg-red-900/60 hover:border-red-500 rounded-sm"
              >
                АВТОРИЗАЦИЯ
              </button>
              {notification && (
                <div className="text-center text-xs text-red-400 font-mono animate-pulse">
                  ⚠ {notification}
                </div>
              )}
            </div>
            <div className="mt-4 text-center text-xs text-gray-700 font-mono">
              Ключ: deadlock-admin-2024
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-red-900/50 bg-black/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="font-['Orbitron',sans-serif] font-black text-red-400 text-sm tracking-widest">
              ADMIN // MATRIX CONTROL
            </div>
            <div className="text-xs text-gray-600 font-mono hidden md:block">
              DEADLOCK AI OPERATOR PANEL
            </div>
          </div>
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-yellow-400 font-mono status-pending">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                {pendingCount} В ОЧЕРЕДИ
              </div>
            )}
            <div className={`flex items-center gap-1 text-xs ${connected ? "text-green-400" : "text-red-400"}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
              <span className="font-mono">{connected ? "ONLINE" : "OFFLINE"}</span>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />
      </header>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-black border border-yellow-400/60 px-4 py-2 text-yellow-400 text-xs font-mono rounded-sm box-glow-gold animate-pulse">
          ⟳ {notification}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        {/* Left panel: question list */}
        <div className="w-80 flex-shrink-0 border-r border-red-900/30 flex flex-col bg-black/30">
          <div className="px-4 py-3 border-b border-red-900/30">
            <div className="text-xs text-gray-500 font-mono">
              ВХОДЯЩИЕ ЗАПРОСЫ ({questions.length})
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {questions.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-700 font-mono">
                <div className="mb-2">⬡</div>
                ОЖИДАНИЕ ЗАПРОСОВ...
              </div>
            ) : (
              [...questions].reverse().map((q) => (
                <button
                  key={q.messageId}
                  onClick={() => {
                    setSelected(q.messageId);
                    setAnswer("");
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-900/50 transition-all ${
                    selected === q.messageId
                      ? "bg-red-900/20 border-l-2 border-l-red-500"
                      : "hover:bg-gray-900/30 border-l-2 border-l-transparent"
                  } ${newIds.has(q.messageId) ? "bg-yellow-900/10" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-500">
                      #{shortId(q.messageId)}
                    </span>
                    <div className="flex items-center gap-1">
                      {newIds.has(q.messageId) && (
                        <span className="text-xs text-yellow-400 status-pending font-mono">NEW</span>
                      )}
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
                          q.status === "pending"
                            ? "text-yellow-400 bg-yellow-900/20 status-pending"
                            : "text-green-400 bg-green-900/20"
                        }`}
                      >
                        {q.status === "pending" ? "◉ ЖДЁТ" : "✓ ГОТОВО"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 line-clamp-2 font-mono leading-relaxed">
                    {q.question}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 font-mono">
                    {formatTime(q.createdAt)} &nbsp;·&nbsp; {shortId(q.socketId)}
                  </div>
                </button>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Right panel: reply area */}
        <div className="flex-1 flex flex-col">
          {selectedQuestion ? (
            <>
              {/* Question detail */}
              <div className="p-6 border-b border-red-900/30 bg-black/20">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-500 font-mono mb-1">
                      SESSION: {selectedQuestion.socketId.slice(0, 16)}...
                    </div>
                    <div className="text-xs text-gray-600 font-mono">
                      {formatTime(selectedQuestion.createdAt)} &nbsp;|&nbsp; MSG #{shortId(selectedQuestion.messageId)}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded-sm border ${
                      selectedQuestion.status === "pending"
                        ? "border-yellow-600/40 text-yellow-400 bg-yellow-900/10 status-pending"
                        : "border-green-600/40 text-green-400 bg-green-900/10"
                    }`}
                  >
                    {selectedQuestion.status === "pending" ? "ОЖИДАЕТ ОТВЕТА" : "ОТВЕЧЕНО"}
                  </span>
                </div>
                <div className="bg-purple-900/10 border border-purple-800/30 rounded-sm px-4 py-3">
                  <div className="text-xs text-purple-500/60 font-mono mb-2">ЗАПРОС ПОЛЬЗОВАТЕЛЯ:</div>
                  <div className="text-sm text-gray-200 font-mono leading-relaxed">
                    {selectedQuestion.question}
                  </div>
                </div>
                {selectedQuestion.answer && (
                  <div className="mt-3 bg-green-900/10 border border-green-800/30 rounded-sm px-4 py-3">
                    <div className="text-xs text-green-500/60 font-mono mb-2">ВАШИХ ОТВЕТ:</div>
                    <div className="text-sm text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">
                      {selectedQuestion.answer}
                    </div>
                  </div>
                )}
              </div>

              {/* Reply area */}
              {selectedQuestion.status === "pending" && (
                <div className="p-6 flex flex-col gap-4">
                  <div className="text-xs text-gray-500 font-mono">
                    &gt; ФОРМИРОВАНИЕ ТАКТИЧЕСКОГО ОТВЕТА:
                  </div>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Введите тактический анализ... Используйте конкретные рекомендации по предметам, стратегии и тайминги."
                    rows={8}
                    className="deadlock-input w-full px-4 py-3 text-sm resize-none rounded-sm"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleSend}
                      disabled={!answer.trim() || sending}
                      className="deadlock-btn px-6 py-2.5 bg-red-900/40 border border-red-600/50 text-red-200 text-xs hover:bg-red-800/50 hover:border-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
                    >
                      {sending ? "ОТПРАВКА..." : "ОТПРАВИТЬ ОТВЕТ"}
                    </button>
                    <button
                      onClick={() => setSelected(null)}
                      className="deadlock-btn px-4 py-2.5 border border-gray-700/50 text-gray-500 text-xs hover:border-gray-500 hover:text-gray-300 rounded-sm"
                    >
                      ОТМЕНА
                    </button>
                  </div>
                  <div className="text-xs text-gray-700 font-mono">
                    ОТВЕТ БУДЕТ МГНОВЕННО ДОСТАВЛЕН ЧЕРЕЗ SOCKET.IO
                  </div>
                </div>
              )}

              {selectedQuestion.status === "answered" && (
                <div className="p-6 flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3">✓</div>
                    <div className="text-sm text-green-400 font-mono">ОТВЕТ ДОСТАВЛЕН ПОЛЬЗОВАТЕЛЮ</div>
                    <button
                      onClick={() => setSelected(null)}
                      className="mt-4 text-xs text-gray-600 hover:text-gray-400 font-mono underline"
                    >
                      ← назад к списку
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4 opacity-20">⬡</div>
                <div className="text-sm text-gray-700 font-mono">
                  ВЫБЕРИТЕ ЗАПРОС ИЗ СПИСКА СЛЕВА
                </div>
                <div className="text-xs text-gray-800 font-mono mt-2">
                  {questions.length === 0
                    ? "ОЖИДАНИЕ ВХОДЯЩИХ ЗАПРОСОВ..."
                    : `${questions.length} ЗАПРОС(ОВ) В ОЧЕРЕДИ`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <footer className="border-t border-red-900/30 bg-black/60 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-mono text-gray-700">
          <span>TOTAL: {questions.length}</span>
          <span>PENDING: {pendingCount}</span>
          <span>ANSWERED: {questions.filter((q) => q.status === "answered").length}</span>
          <span className="text-red-900">MATRIX-ADMIN v1.0</span>
        </div>
      </footer>
    </div>
  );
}
