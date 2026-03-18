"use client";

import { useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { BotIcon, SendIcon, UserIcon } from "lucide-react";

const CHAT_API = "/api/chat";

export function CabinetChatPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, input, setInput, handleSubmit, isLoading } = useChat({
    api: CHAT_API,
    streamProtocol: "data",
    onError: (err) => console.error("Chat error:", err),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    handleSubmit(e);
  };

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r bg-card">
      <div className="shrink-0 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BotIcon className="h-4 w-4" />
          </span>
          AI-ассистент
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Выручка, отчёты, вопросы
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-8 text-center text-xs text-muted-foreground">
            <BotIcon className="h-8 w-8" />
            <p>Напишите сообщение</p>
            <p>Например: «Выручка за сегодня?»</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2",
              message.role === "user" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {message.role === "user" ? (
                <UserIcon className="h-3.5 w-3.5" />
              ) : (
                <BotIcon className="h-3.5 w-3.5" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-xs",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {typeof message.content === "string"
                  ? message.content
                  : ""}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <BotIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={onFormSubmit}
        className="shrink-0 border-t p-3"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Сообщение..."
            className="min-h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
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
    </aside>
  );
}
