"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bot, Send, RefreshCw, Sparkles, AlertTriangle,
  CheckSquare, Bell, BellRing, Loader2,
  User, Clock, ClipboardList, TrendingDown, MessageSquare,
  Zap, X, Check, RotateCcw, Mic, MicOff, Volume2, VolumeX, Square
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
  { icon: BellRing, label: "Send holiday notification to all staff", color: "text-pink-500" },
  { icon: CheckSquare, label: "Mark 2nd Oct as holiday for all", color: "text-teal-500" },
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
  // Strip action tags before rendering
  const cleaned = content
    .replace(/\[SEND_NOTIFICATION[^\]]*\]/g, "")
    .replace(/\[MARK_HOLIDAY[^\]]*\]/g, "")
    .replace(/\[BULK_NOTIFY[^\]]*\]/g, "")
    .trim();
  const lines = cleaned.split("\n");
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

  // Voice & Audio Speech State (Google Assistant Ultra-Low Latency Mode)
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const voiceOutputEnabledRef = useRef(true);
  const [isListening, setIsListening] = useState(false);
  const isListeningIntentRef = useRef(false);
  const [autoSendVoice, setAutoSendVoice] = useState(false);
  const autoSendVoiceRef = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const latestVoiceTranscriptRef = useRef<string>("");
  const activeUtterancesRef = useRef<number>(0);

  useEffect(() => {
    voiceOutputEnabledRef.current = voiceOutputEnabled;
  }, [voiceOutputEnabled]);

  useEffect(() => {
    autoSendVoiceRef.current = autoSendVoice;
  }, [autoSendVoice]);

  const getPreferredVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => (v.name.includes("Google") || v.name.includes("Natural")) && (v.lang.includes("en-IN") || v.lang.includes("hi")))
      || voices.find(v => v.lang.includes("en-IN") || v.lang.includes("hi-IN"))
      || voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
      || voices.find(v => v.lang.startsWith("en-"))
      || voices[0] || null;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const cleanTextForSpeech = (raw: string) => {
    return raw
      .replace(/\[SEND_NOTIFICATION[^\]]*\]/g, "")
      .replace(/\[MARK_HOLIDAY[^\]]*\]/g, "")
      .replace(/\[BULK_NOTIFY[^\]]*\]/g, "")
      .replace(/[•\-\*\_#]/g, " ")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n+/g, ". ")
      .trim();
  };

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      activeUtterancesRef.current = 0;
      setSpeakingMsgId(null);
    }
  }, []);

  const queueSentenceForSpeech = useCallback((sentence: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!voiceOutputEnabledRef.current) return;

    const cleaned = cleanTextForSpeech(sentence);
    // Ignore trivial punctuation fragments
    if (!cleaned || cleaned.replace(/[^a-zA-Z0-9]/g, "").length < 2) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleaned);
      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1.08; // crisp, responsive speed
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        activeUtterancesRef.current += 1;
        setSpeakingMsgId(msgId);
      };

      utterance.onend = () => {
        activeUtterancesRef.current = Math.max(0, activeUtterancesRef.current - 1);
        if (activeUtterancesRef.current === 0) {
          setSpeakingMsgId(null);
        }
      };

      utterance.onerror = () => {
        activeUtterancesRef.current = Math.max(0, activeUtterancesRef.current - 1);
        if (activeUtterancesRef.current === 0) {
          setSpeakingMsgId(null);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS error:", e);
    }
  }, [getPreferredVoice]);

  const speakFullText = useCallback((text: string, msgId?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stopSpeaking();

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return;

    const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
    for (const s of sentences.slice(0, 6)) {
      queueSentenceForSpeech(s, msgId || "active");
    }
  }, [stopSpeaking, queueSentenceForSpeech]);

  const stopListening = useCallback(() => {
    isListeningIntentRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* noop */ }
    }
    setIsListening(false);
  }, []);

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

  const handleSendRef = useRef<(text?: string) => Promise<void>>(async () => {});

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);
    abortRef.current = false;
    stopSpeaking();
    stopListening();

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
      let actionResult: any = null;
      let speechStreamBuffer = "";
      let sentencesSpokenCount = 0;

      for await (const chunk of stream) {
        if (abortRef.current) break;
        
        if (chunk.startsWith("__ACTION_RESULT__")) {
          try {
            actionResult = JSON.parse(chunk.slice(17));
          } catch (e) {
            console.error("Action parse err:", e);
          }
          continue;
        }

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

        // ULTRA-LOW LATENCY: Sentence-by-sentence TTS streaming (Google Assistant Experience)
        // Speak sentence 1 immediately while sentence 2 is still streaming!
        if (voiceOutputEnabledRef.current && sentencesSpokenCount < 5) {
          speechStreamBuffer += chunk;
          const match = speechStreamBuffer.match(/^(.*?[.!?\n]+)\s*(.*)$/s);
          if (match) {
            const completedSentence = match[1];
            speechStreamBuffer = match[2] || "";
            queueSentenceForSpeech(completedSentence, aiId);
            sentencesSpokenCount++;
          }
        }
      }

      // Finish speaking remaining buffer
      if (voiceOutputEnabledRef.current && speechStreamBuffer.trim() && sentencesSpokenCount < 5) {
        queueSentenceForSpeech(speechStreamBuffer.trim(), aiId);
      }

      // Mark streaming done and append action results status description if any
      setMessages(prev => prev.map(m => {
        if (m.id === aiId) {
          let updatedContent = m.content;
          if (actionResult) {
            if (actionResult.type === "holiday") {
              const dateInfo = actionResult.holidays?.[0]?.date || "";
              updatedContent += `\n\n🎉 Holiday Marked! Created ${actionResult.holidaysCreated} holiday record(s). Push notifications will be sent automatically on ${dateInfo} morning.`;
            } else if (actionResult.type === "bulk_notify") {
              updatedContent += `\n\n📢 Bulk Notification Sent: Push notifications delivered to ${actionResult.notified} staff member(s).`;
            } else if (actionResult.sent > 0) {
              updatedContent += `\n\n⚡ Action Successful: Sent push notification alert to ${actionResult.actions?.length || actionResult.sent} staff member(s).`;
            }
          }
          return { ...m, isStreaming: false, content: updatedContent };
        }
        return m;
      }));

      // Force notification panel refetch if any action was taken
      if (actionResult) {
        refetchNotifs();
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aiId
          ? { ...m, isTyping: false, isStreaming: false, content: "Unable to get AI response. Please check your connection and try again." }
          : m
      ));
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, queueSentenceForSpeech, refetchNotifs, stopListening, stopSpeaking]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Microphone speech recognition is not supported in this browser. Please use Chrome, Edge, or Android.");
      return;
    }

    setVoiceError(null);
    stopSpeaking();
    isListeningIntentRef.current = true;
    setIsListening(true);

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // English (India) with seamless Hinglish recognition

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        if (transcript) {
          setInput(transcript);
          latestVoiceTranscriptRef.current = transcript;

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          // Only auto-send if the user explicitly enabled Auto-Send mode
          if (autoSendVoiceRef.current && transcript.trim().length > 3) {
            silenceTimerRef.current = setTimeout(() => {
              if (isListeningIntentRef.current) {
                const query = latestVoiceTranscriptRef.current?.trim();
                if (query && !isSending) {
                  stopListening();
                  handleSendRef.current(query);
                }
              }
            }, 2500);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition warning:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          isListeningIntentRef.current = false;
          setIsListening(false);
          setVoiceError("Microphone access was denied. Please allow microphone permissions in your browser.");
        } else if (event.error === "network") {
          setVoiceError("Speech recognition network error. In Brave browser, please enable Google Services in settings or use Chrome.");
        }
      };

      recognition.onend = () => {
        // If user is still in listening mode, keep mic active (prevent auto-closing)!
        if (isListeningIntentRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            // ignore
          }
        }
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn("Speech recognition start failed:", err);
      isListeningIntentRef.current = false;
      setIsListening(false);
    }
  }, [stopSpeaking, stopListening, isSending]);

  const handleClearChat = useCallback(async () => {
    abortRef.current = true;
    stopSpeaking();
    stopListening();
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
            <p className="text-xs font-semibold text-slate-400">Powered by Gemini 3.8 Live & Flash • Voice & Sound Enabled • Full staff context</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-violet-200 bg-violet-50 text-violet-700 font-bold px-3 py-1">
          <Mic className="h-3.5 w-3.5 text-violet-600" />
          Gemini 3.8 Live AI
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
            
            <div className="flex items-center gap-2">
              {/* Voice Sound Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (speakingMsgId) stopSpeaking();
                  setVoiceOutputEnabled(!voiceOutputEnabled);
                }}
                className={cn(
                  "h-7 px-2.5 rounded-lg text-xs font-bold gap-1.5 transition-all",
                  voiceOutputEnabled
                    ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                )}
                title={voiceOutputEnabled ? "Voice Response Active (Click to mute)" : "Voice Response Muted (Click to enable)"}
              >
                {voiceOutputEnabled ? <Volume2 className="h-3.5 w-3.5 text-violet-600" /> : <VolumeX className="h-3.5 w-3.5" />}
                <span>Sound: {voiceOutputEnabled ? "ON" : "OFF"}</span>
              </Button>

              {/* Stop audio button if currently speaking */}
              {speakingMsgId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stopSpeaking}
                  className="h-7 px-2 text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-bold rounded-lg gap-1 animate-pulse"
                  title="Stop speaking"
                >
                  <Square className="h-3 w-3 fill-rose-600" /> Stop Sound
                </Button>
              )}

              <Button
                variant="ghost" size="sm"
                onClick={handleClearChat}
                className="h-7 gap-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 text-xs font-bold rounded-lg"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
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
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60 gap-3">
                      <p className={cn("text-[10px] font-bold", msg.role === "user" ? "text-blue-200 text-right w-full" : "text-slate-400")}>
                        {dayjs(msg.timestamp).format("hh:mm A")}
                        {msg.isStreaming && <span className="ml-1 text-violet-400">● typing...</span>}
                      </p>
                      {msg.role === "assistant" && !msg.isStreaming && (
                        <button
                          type="button"
                          onClick={() => {
                            if (speakingMsgId === msg.id) {
                              stopSpeaking();
                            } else {
                              speakFullText(msg.content, msg.id);
                            }
                          }}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 shrink-0",
                            speakingMsgId === msg.id
                              ? "bg-rose-100 text-rose-700 animate-pulse font-black"
                              : "text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                          )}
                          title={speakingMsgId === msg.id ? "Stop voice" : "Listen to audio response"}
                        >
                          {speakingMsgId === msg.id ? (
                            <>
                              <Square className="h-3 w-3 fill-rose-600 text-rose-600" />
                              <span>Stop Sound</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" />
                              <span>Listen 🔊</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
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

          {/* Input & Voice Bar */}
          <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
            {/* Speech error alert */}
            {voiceError && (
              <div className="mb-2 flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold animate-in fade-in shadow-2xs">
                <span className="flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{voiceError}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="text-amber-700 hover:text-amber-900 font-bold ml-2 text-base px-1 leading-none"
                >
                  ×
                </button>
              </div>
            )}

            {/* Google Assistant Listening Wave Banner */}
            {isListening && (
              <div className="mb-2.5 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border border-blue-200 text-slate-800 text-xs font-bold animate-in fade-in shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#4285F4] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#EA4335] animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FBBC05] animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#34A853] animate-bounce" style={{ animationDelay: "450ms" }} />
                  </div>
                  <span className="text-slate-700 font-extrabold">Mic Active: Listening... Speak naturally!</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAutoSendVoice(prev => !prev)}
                    className={cn(
                      "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all shadow-2xs",
                      autoSendVoice
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                    title="Toggle hands-free auto-send after you pause"
                  >
                    Auto-Send: {autoSendVoice ? "ON" : "OFF"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const query = latestVoiceTranscriptRef.current?.trim() || input.trim();
                      stopListening();
                      if (query) handleSendRef.current(query);
                    }}
                    className="text-[10px] font-black uppercase text-violet-700 bg-violet-100 hover:bg-violet-200 px-2.5 py-1 rounded-lg border border-violet-200 shadow-2xs"
                  >
                    Send Now
                  </button>
                  <button
                    type="button"
                    onClick={stopListening}
                    className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-800 bg-white px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs"
                  >
                    Stop Mic
                  </button>
                </div>
              </div>
            )}

            {/* Speaking Live Audio Status Bar */}
            {speakingMsgId && !isListening && (
              <div className="mb-2 flex items-center justify-between px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-xs font-bold animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                  <span className="text-[11px] font-bold text-violet-700">AI Assistant Speaking... (Tap 🎙️ Mic or Stop to interrupt)</span>
                </div>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-800 bg-white px-2 py-0.5 rounded-md border border-rose-200"
                >
                  Stop
                </button>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening to your voice..." : "Ask anything about your staff… (Type or click 🎙️ Mic to speak)"}
                className={cn(
                  "min-h-[44px] max-h-[120px] resize-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all",
                  isListening ? "border-rose-400 bg-rose-50/20 ring-2 ring-rose-200" : "border-slate-200"
                )}
                rows={1}
                disabled={isSending}
              />
              
              {/* Mic Option */}
              <Button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "h-11 w-11 p-0 rounded-xl shrink-0 transition-all shadow-sm border",
                  isListening
                    ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse ring-4 ring-rose-200 shadow-rose-200"
                    : "bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-700 border-slate-200"
                )}
                title={isListening ? "Listening... Click to stop" : "Speak to AI (Microphone)"}
              >
                {isListening ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5" />}
              </Button>

              {/* Send Button */}
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isSending}
                className="h-11 w-11 p-0 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 shadow-lg shadow-violet-200 shrink-0"
                title="Send Message"
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
