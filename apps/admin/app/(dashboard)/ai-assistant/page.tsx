"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bot, Send, RefreshCw, Sparkles, AlertTriangle,
  CheckSquare, Bell, BellRing, Loader2,
  User, Clock, ClipboardList, TrendingDown, MessageSquare,
  Zap, X, Check, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  aiClearSession,
  fetchSmartNotifications, sendSmartNotifications,
  type SmartNotification
} from "@/lib/api";
import dayjs from "dayjs";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  isStreaming?: boolean;
}

// ─── Quick suggestion chips ────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  { icon: AlertTriangle, label: "Who missed most this month?", color: "text-rose-500" },
  { icon: TrendingDown, label: "Staff with low attendance?", color: "text-amber-500" },
  { icon: ClipboardList, label: "Who has overdue tasks?", color: "text-blue-500" },
  { icon: Clock, label: "Who hasn't checked in today?", color: "text-purple-500" },
  { icon: Zap, label: "Suggest salary deductions this month", color: "text-emerald-500" },
  { icon: Bell, label: "Generate attendance warning message", color: "text-indigo-500" },
];

// ─── Notification type config ──────────────────────────────────────────────────

const NOTIF_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  ABSENCE_WARNING:  { label: "Absence Warning",   icon: AlertTriangle, color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200" },
  TASK_REMINDER:    { label: "Task Reminder",      icon: ClipboardList, color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
  CHECKIN_REMINDER: { label: "Check-in Reminder",  icon: Clock,         color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  SALARY_WARNING:   { label: "Salary Warning",     icon: TrendingDown,  color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  DER_REMINDER:     { label: "DER Reminder",       icon: CheckSquare,   color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-200" },
  LATE_WARNING:     { label: "Late Warning",       icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
};

// ─── Plain text message renderer (no ** markdown) ─────────────────────────────

function PlainMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-violet-500 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}

// ─── Streaming fetch helper ────────────────────────────────────────────────────

async function* streamAiChat(message: string): AsyncGenerator<string> {
  const response = await fetch("/api/ai/chat-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message })
  });

  if (!response.ok || !response.body) {
    yield "Sorry, AI assistant is currently unavailable. Please try again.";
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.text) yield parsed.text;
      } catch { /* skip */ }
    }
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Hello! I'm your AI HR Assistant, powered by Gemini AI.\n\nI have access to all staff data — attendance, tasks, salary, leaves, and more. Ask me anything!\n\nTry asking:\n• Who has been absent most this month?\n• Show me overdue task summary\n• Which staff need a salary warning?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<boolean>(false);

  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: smartNotifications = [], isFetching: isLoadingNotifs, refetch: refetchNotifs } = useQuery({
    queryKey: ["smart-notifications"],
    queryFn: fetchSmartNotifications,
    refetchInterval: 5 * 60 * 1000
  });

  const sendNotifMutation = useMutation({
    mutationFn: (notif: SmartNotification) =>
      sendSmartNotifications([{ userId: notif.userId, title: notif.title, message: notif.message }]),
    onSuccess: (_, notif) => setSentIds(prev => new Set([...prev, notif.id]))
  });

  const sendAllMutation = useMutation({
    mutationFn: (notifs: SmartNotification[]) =>
      sendSmartNotifications(notifs.map(n => ({ userId: n.userId, title: n.title, message: n.message }))),
    onSuccess: (_, notifs) => setSentIds(prev => new Set([...prev, ...notifs.map(n => n.id)]))
  });

  const visibleNotifications = smartNotifications.filter(n => !dismissedIds.has(n.id));
  const unsentNotifications = visibleNotifications.filter(n => !sentIds.has(n.id));
  const sortedNotifications = [...visibleNotifications].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);
    abortRef.current = false;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date()
    };

    const aiId = `ai-${Date.now()}`;
    const aiMsg: ChatMessage = {
      id: aiId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isTyping: true
    };

    setMessages(prev => [...prev, userMsg, aiMsg]);

    try {
      const stream = streamAiChat(text);
      let first = true;

      for await (const chunk of stream) {
        if (abortRef.current) break;
        if (first) {
          first = false;
          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, isTyping: false, isStreaming: true, content: chunk } : m
          ));
        } else {
          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, content: m.content + chunk } : m
          ));
        }
      }

      // Mark streaming done
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, isStreaming: false } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aiId
          ? { ...m, isTyping: false, isStreaming: false, content: "Unable to get AI response. Please check your connection and try again." }
          : m
      ));
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  const handleClearChat = useCallback(async () => {
    abortRef.current = true;
    await aiClearSession().catch(() => {});
    setMessages([{
      id: "welcome-new",
      role: "assistant",
      content: "Chat cleared! I'm ready for a fresh conversation. What would you like to know about your staff?",
      timestamp: new Date()
    }]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-0">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-lg shadow-violet-200">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">AI Staff Assistant</h1>
            <p className="text-xs font-semibold text-slate-400">Powered by Gemini 3.5 Flash • Full staff context</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-violet-200 bg-violet-50 text-violet-700 font-bold px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" />
          Gemini AI
        </Badge>
      </div>

      {/* Main Split Panel */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* ── Left: Chat Panel ─────────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-0">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Conversation</span>
              <span className="text-[10px] font-bold text-slate-400">• {messages.filter(m => !m.isTyping).length} messages</span>
            </div>
            <Button
              variant="ghost" size="sm"
              onClick={handleClearChat}
              className="h-7 gap-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 text-xs font-bold rounded-lg"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                {/* Avatar */}
                <div className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                  msg.role === "user" ? "bg-blue-600" : "bg-gradient-to-br from-violet-600 to-indigo-600"
                )}>
                  {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                </div>

                {/* Bubble */}
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-4 py-3 shadow-sm",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-slate-50 border border-slate-200 text-slate-700 rounded-tl-sm"
                )}>
                  {msg.isTyping ? (
                    <div className="flex gap-1 items-center py-1 px-1">
                      <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : msg.role === "user" ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <PlainMessage content={msg.content} isStreaming={msg.isStreaming} />
                  )}
                  {!msg.isTyping && (
                    <p className={cn("text-[10px] mt-2 font-bold", msg.role === "user" ? "text-blue-200 text-right" : "text-slate-400")}>
                      {dayjs(msg.timestamp).format("hh:mm A")}
                      {msg.isStreaming && <span className="ml-1 text-violet-400">● typing...</span>}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick suggestions */}
          <div className="px-4 py-2 border-t border-slate-100 shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q.label}
                  disabled={isSending}
                  onClick={() => handleSend(q.label)}
                  className="flex items-center gap-1.5 shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-all disabled:opacity-50"
                >
                  <q.icon className={cn("h-3.5 w-3.5", q.color)} />
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your staff… (Enter to send, Shift+Enter for new line)"
                className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-slate-200 text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                rows={1}
                disabled={isSending}
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isSending}
                className="h-11 w-11 p-0 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 shadow-lg shadow-violet-200 shrink-0"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right: Smart Notifications Panel ─── */}
        <div className="w-[380px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">

          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <BellRing className="h-4 w-4 text-amber-500" />
                  {unsentNotifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 text-[8px] text-white font-black flex items-center justify-center">
                      {unsentNotifications.length > 9 ? "9+" : unsentNotifications.length}
                    </span>
                  )}
                </div>
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Smart Notifications</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchNotifs()} disabled={isLoadingNotifs}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg">
                <RefreshCw className={cn("h-3.5 w-3.5", isLoadingNotifs && "animate-spin")} />
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">AI-analyzed suggestions • Auto-refreshes every 5 min</p>
          </div>

          {unsentNotifications.length > 0 && (
            <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-blue-50 shrink-0">
              <Button
                onClick={() => sendAllMutation.mutate(unsentNotifications)}
                disabled={sendAllMutation.isPending}
                className="w-full h-8 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-xs font-black gap-2 shadow-sm"
              >
                {sendAllMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
                  : <><Send className="h-3.5 w-3.5" /> Send All ({unsentNotifications.length} notifications)</>
                }
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {isLoadingNotifs && smartNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
                <p className="text-xs font-bold text-slate-400">Analyzing staff data...</p>
              </div>
            ) : sortedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CheckSquare className="h-7 w-7 text-emerald-500" />
                </div>
                <p className="text-sm font-black text-slate-700">All Clear! 🎉</p>
                <p className="text-xs text-slate-400 text-center">No staff issues requiring notifications right now.</p>
              </div>
            ) : sortedNotifications.map(notif => {
              const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.ABSENCE_WARNING;
              const isSent = sentIds.has(notif.id);
              const isPending = sendNotifMutation.isPending && (sendNotifMutation.variables as any)?.id === notif.id;
              return (
                <div key={notif.id} className={cn(
                  "rounded-xl border p-3 transition-all",
                  isSent ? "opacity-60 bg-slate-50 border-slate-200" : `${config.bg} ${config.border}`,
                  notif.severity === "high" && !isSent && "ring-1 ring-rose-300"
                )}>
                  <div className="flex items-start gap-2.5">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", isSent ? "bg-emerald-100" : config.bg)}>
                      {isSent ? <Check className="h-4 w-4 text-emerald-600" /> : <config.icon className={cn("h-4 w-4", config.color)} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-900">{notif.userName}</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                          notif.severity === "high" ? "bg-rose-100 text-rose-700" :
                          notif.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                        )}>{notif.severity}</span>
                        {isSent && <span className="text-[9px] font-black text-emerald-600 uppercase">✓ Sent</span>}
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{config.label}</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{notif.message}</p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {notif.data.absences !== undefined && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">{notif.data.absences} absences</span>
                        )}
                        {notif.data.attendancePct !== undefined && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">{notif.data.attendancePct}% attendance</span>
                        )}
                        {notif.data.overdueTasks !== undefined && (
                          <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md">{notif.data.overdueTasks} overdue tasks</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!isSent && (
                        <button
                          onClick={() => sendNotifMutation.mutate(notif)}
                          disabled={isPending}
                          className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-violet-50 hover:border-violet-300 transition-all shadow-sm"
                          title="Send"
                        >
                          {isPending ? <Loader2 className="h-3 w-3 animate-spin text-violet-500" /> : <Send className="h-3 w-3 text-violet-600" />}
                        </button>
                      )}
                      <button
                        onClick={() => setDismissedIds(prev => new Set([...prev, notif.id]))}
                        className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-all shadow-sm"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <p className="text-[10px] text-slate-400 font-semibold text-center">
              {sentIds.size > 0 ? `✓ ${sentIds.size} notification${sentIds.size > 1 ? "s" : ""} sent this session` : "Notifications use real-time push • Staff mobile alert"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
