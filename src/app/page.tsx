"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";

type Phase = "idle" | "submitting" | "processing" | "answered";

interface Message {
  messageId: string;
  question: string;
  answer: string;
  phase: Phase;
  displayedAnswer: string;
}

const PROCESSING_MESSAGES = [
  "ИНИЦИАЛИЗАЦИЯ НЕЙРОННОГО ПРОТОКОЛА...",
  "СКАНИРОВАНИЕ МЕТА-ДАННЫХ СЕЗОНА...",
  "АНАЛИЗ ВРАЖЕСКОГО БИЛДА...",
  "РАСЧЁТ ОПТИМАЛЬНЫХ КОНТРМЕР...",
  "ОБРАБОТКА ТАКТИЧЕСКИХ ПАТТЕРНОВ...",
  "СИНХРОНИЗАЦИЯ С БАЗОЙ ДАННЫХ...",
  "АЛГОРИТМ ФОРМИРУЕТ ОТВЕТ...",
];

export default function HomePage() {
  const { socket, socketId, connected } = useSocket();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MESSAGES[0]);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [booted, setBooted] = useState(false);
  const processingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const pendingMessage = messages.find((m) => m.phase === "processing" || m.phase === "submitting");

  // Boot sequence
  useEffect(() => {
    const lines = [
      "> DEADLOCK AI TACTICAL ENGINE v4.2.1",
      "> ЗАГРУЗКА МОДУЛЕЙ АНАЛИЗА...",
      "> ПОДКЛЮЧЕНИЕ К СЕРВЕРАМ VALVE...",
      "> ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ГЕРОЕВ...",
      "> КАЛИБРОВКА НЕЙРОСЕТИ...",
      "> СИСТЕМА ГОТОВА. ОЖИДАНИЕ ЗАПРОСА.",
    ];
    let i = 0;
    const timer = setInterval(() => {
      if (i < lines.length) {
        setBootLines((prev) => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(timer);
        setTimeout(() => setBooted(true), 600);
      }
    }, 350);
    return () => clearInterval(timer);
  }, []);

  // Rotate processing messages
  useEffect(() => {
    if (pendingMessage) {
      let idx = 0;
      processingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % PROCESSING_MESSAGES.length;
        setProcessingMsg(PROCESSING_MESSAGES[idx]);
      }, 1800);
    } else {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
    }
    return () => {
      if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
    };
  }, [pendingMessage]);

  // Type answer character by character
  const typeAnswer = useCallback((messageId: string, answer: string) => {
    let i = 0;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    typingIntervalRef.current = setInterval(() => {
      if (i <= answer.length) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === messageId
              ? { ...m, displayedAnswer: answer.slice(0, i), phase: i === answer.length ? "answered" : "answered" }
              : m
          )
        );
        i++;
      } else {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      }
    }, 18);
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleAnswer = ({ messageId, answer }: { messageId: string; answer: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === messageId
            ? { ...m, answer, phase: "answered", displayedAnswer: "" }
            : m
        )
      );
      typeAnswer(messageId, answer);
    };

    socket.on("answer_received", handleAnswer);
    return () => {
      socket.off("answer_received", handleAnswer);
    };
  }, [socket, typeAnswer]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, booted]);

  const handleSubmit = async () => {
    if (!input.trim() || !socketId || pendingMessage) return;

    const question = input.trim();
    setInput("");

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        messageId: tempId,
        question,
        answer: "",
        phase: "submitting",
        displayedAnswer: "",
      },
    ]);

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, socketId }),
      });
      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === tempId
            ? { ...m, messageId: data.messageId, phase: "processing" }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.messageId === tempId
            ? { ...m, phase: "answered", answer: "ОШИБКА СОЕДИНЕНИЯ. ПОВТОРИТЕ ЗАПРОС.", displayedAnswer: "ОШИБКА СОЕДИНЕНИЯ. ПОВТОРИТЕ ЗАПРОС." }
            : m
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!booted) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="max-w-2xl w-full px-8">
          <div className="mb-8 flex justify-center">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-2 border-purple-500 rotate-slow opacity-60" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
              <div className="absolute inset-2 border border-yellow-400 rotate-reverse opacity-40" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl">⬡</span>
              </div>
            </div>
          </div>
          <div className="font-mono text-sm space-y-1">
            {bootLines.map((line, i) => (
              <div key={i} className={`${i === bootLines.length - 1 ? "text-purple-400" : "text-gray-500"}`}>
                {line}
              </div>
            ))}
            {bootLines.length > 0 && bootLines.length < 6 && (
              <div className="text-purple-400 cursor-blink">&nbsp;</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Header */}
      <header className="relative border-b border-purple-900/50 bg-black/40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex-shrink-0">
              <div className="absolute inset-0 border border-purple-500 rotate-slow opacity-80" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
              <div className="absolute inset-1 border border-yellow-400/50 rotate-reverse opacity-60" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
            </div>
            <div>
              <div className="font-['Orbitron',sans-serif] font-black text-base text-yellow-400 neon-gold-glow tracking-widest flicker">
                DEADLOCK AI
              </div>
              <div className="text-xs text-purple-400/60 tracking-widest">TACTICAL ANALYSIS ENGINE</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"} ${connected ? "status-pending" : ""}`} />
            <span className={connected ? "text-green-400" : "text-red-400"}>
              {connected ? "СИСТЕМА ОНЛАЙН" : "ПОДКЛЮЧЕНИЕ..."}
            </span>
          </div>
        </div>
        {/* Decorative line */}
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-60" />
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Welcome block */}
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="relative inline-block mb-6">
              <div className="w-20 h-20 mx-auto relative">
                <div className="absolute inset-0 border-2 border-purple-500/50 rotate-slow" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
                <div className="absolute inset-3 border border-yellow-400/40 rotate-reverse" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🔬</div>
              </div>
            </div>
            <h1 className="font-['Orbitron',sans-serif] font-black text-2xl text-yellow-400 neon-gold-glow mb-3 tracking-wider">
              ТАКТИЧЕСКИЙ МОДУЛЬ
            </h1>
            <p className="text-purple-400/70 text-sm max-w-md mx-auto leading-relaxed mb-6">
              АЛГОРИТМ ГОТОВ К АНАЛИЗУ. ВВЕДИТЕ КОНТЕКСТ МАТЧА:<br />
              ГЕРОЙ / ПРОТИВНИК / МИНУТА / ТЕКУЩАЯ СИТУАЦИЯ
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Что собрать на Абрамсе?",
                "Как контрить Хейз?",
                "Лучший старт для Мо и Кrill?",
                "Тактика на поздней игре",
              ].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="text-xs px-3 py-1.5 border border-purple-700/50 text-purple-400 hover:border-purple-400 hover:text-purple-200 transition-all rounded-sm font-mono"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div key={msg.messageId} className="space-y-4">
            {/* User question */}
            <div className="flex justify-end">
              <div className="max-w-2xl">
                <div className="text-right text-xs text-purple-500/50 mb-1 font-mono">ЗАПРОС</div>
                <div className="bg-purple-900/20 border border-purple-700/40 rounded-sm px-4 py-3 text-sm text-purple-100">
                  {msg.question}
                </div>
              </div>
            </div>

            {/* AI response */}
            <div className="flex justify-start">
              <div className="max-w-2xl w-full">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 border border-yellow-400/60 flex items-center justify-center" style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                  </div>
                  <div className="text-xs text-yellow-400/60 font-mono">DEADLOCK AI</div>
                </div>

                {(msg.phase === "submitting" || msg.phase === "processing") ? (
                  <div className="bg-black/40 border border-purple-800/40 rounded-sm px-4 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-purple-500"
                            style={{
                              animation: `statusPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-yellow-400 text-xs status-pending">{processingMsg}</span>
                    </div>
                    <div className="h-px bg-purple-900/50 mb-2">
                      <div className="h-full bg-gradient-to-r from-purple-600 to-yellow-400 load-bar" />
                    </div>
                    <div className="text-xs text-purple-500/50 font-mono">
                      &gt; {socketId ? `SESSION_ID: ${socketId.slice(0, 8)}...` : "CONNECTING..."}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-yellow-700/30 rounded-sm px-4 py-4 relative corner-tl">
                    <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">
                      {msg.displayedAnswer}
                      {msg.displayedAnswer.length < msg.answer.length && (
                        <span className="text-purple-400 animate-pulse">█</span>
                      )}
                    </div>
                    {msg.displayedAnswer === msg.answer && msg.answer && (
                      <div className="mt-3 pt-2 border-t border-purple-900/30 text-xs text-purple-600/50 font-mono">
                        &gt; АНАЛИЗ ЗАВЕРШЁН. УДАЧИ В МАТЧЕ.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <footer className="border-t border-purple-900/50 bg-black/60 backdrop-blur-sm">
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 py-4">
          {pendingMessage && (
            <div className="mb-3 text-center text-xs text-yellow-400/60 font-mono status-pending">
              ⟳ ДОЖДИТЕСЬ ОТВЕТА ПЕРЕД НОВЫМ ЗАПРОСОМ
            </div>
          )}
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <div className="absolute top-0 left-0 text-xs text-purple-600/40 font-mono px-3 pt-2">&gt;_</div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Введите запрос... (напр: играю на Абрамсе против Хейз, 15 минута, что собрать?)"
                disabled={!!pendingMessage || !connected}
                rows={2}
                className="deadlock-input w-full pl-8 pr-4 pt-2 pb-2 text-sm resize-none rounded-sm disabled:opacity-40 disabled:cursor-not-allowed placeholder-purple-800"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || !!pendingMessage || !connected}
              className="deadlock-btn px-5 py-3 bg-purple-900/50 border border-purple-500/60 text-purple-200 text-xs hover:bg-purple-800/60 hover:border-purple-400 disabled:opacity-30 disabled:cursor-not-allowed rounded-sm pulse-purple"
            >
              АНАЛИЗ
            </button>
          </div>
          <div className="mt-2 text-xs text-purple-700/40 font-mono text-center">
            ENTER — отправить &nbsp;|&nbsp; SHIFT+ENTER — новая строка
          </div>
        </div>
      </footer>
    </div>
  );
}
