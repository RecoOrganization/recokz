"use client";

import { useRef, useEffect } from "react";
import type { Message } from "@ai-sdk/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { BotIcon, SendIcon, UserIcon, SparklesIcon } from "lucide-react";
import type { useChatAssistant } from "./use-chat-assistant";

type ChatAssistantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: ReturnType<typeof useChatAssistant>;
};

const QUICK_QUESTIONS = [
  { label: "💰 Выручка сегодня", text: "Какая выручка за сегодня?" },
  {
    label: "📊 Топ транзакций",
    text: "Покажи топ-10 самых крупных транзакций за последние 30 дней",
  },
  {
    label: "📋 Последняя сверка",
    text: "Расскажи подробнее о результатах последней сверки: сколько совпало, сколько нет?",
  },
  {
    label: "📈 Динамика за неделю",
    text: "Покажи статистику транзакций за последние 7 дней",
  },
  {
    label: "❓ Что такое КНП?",
    text: "Что такое КНП (Код Назначения Платежа) и как он используется в бухучёте Казахстана?",
  },
  {
    label: "➕ Как создать транзакцию?",
    text: "Как создать транзакцию вручную в разделе «Приём оплат»?",
  },
];

export function ChatAssistantModal({
  open,
  onOpenChange,
  chat,
}: ChatAssistantModalProps) {
  const { messages, input, setInput, handleSubmit, isLoading, append } = chat;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  };

  const onQuickQuestion = (text: string) => {
    if (isLoading) return;
    append({ role: "user", content: text });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Шапка */}
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SparklesIcon className="h-4 w-4" />
            </span>
            AI-ассистент Reco
          </DialogTitle>
          <p className="text-muted-foreground text-sm font-normal">
            Анализ транзакций, бухучёт, помощь по платформе
          </p>
        </DialogHeader>

        {/* Сообщения */}
        <div
          ref={scrollRef}
          className="flex min-h-[280px] max-h-[50vh] flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {/* Пустое состояние */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 py-8 text-center">
                <BotIcon className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Чем могу помочь?</p>
                  <p className="text-muted-foreground/80 text-xs mt-1">
                    Анализирую ваши данные в реальном времени
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Быстрые вопросы:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q.text}
                      onClick={() => onQuickQuestion(q.text)}
                      disabled={isLoading}
                      className="text-left rounded-lg border bg-background px-3 py-2.5 text-xs hover:bg-muted/50 hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Список сообщений */}
          {messages.map((message: Message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {message.role === "user" ? (
                  <UserIcon className="h-4 w-4" />
                ) : (
                  <BotIcon className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {/* Индикатор загрузки */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BotIcon className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-2.5">
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Поле ввода */}
        <form
          onSubmit={handleFormSubmit}
          className="shrink-0 border-t bg-background p-4"
        >
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Введите сообщение..."
              rows={1}
              className="min-h-10 max-h-32 w-full resize-none rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
