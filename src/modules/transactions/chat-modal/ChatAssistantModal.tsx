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
import { BotIcon, SendIcon, UserIcon } from "lucide-react";
import type { useChatAssistant } from "./use-chat-assistant";

type ChatAssistantModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: ReturnType<typeof useChatAssistant>;
};

export function ChatAssistantModal({
  open,
  onOpenChange,
  chat,
}: ChatAssistantModalProps) {
  const { messages, input, setInput, handleSubmit, isLoading } = chat;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BotIcon className="h-4 w-4" />
            </span>
            AI-ассистент Reco
          </DialogTitle>
          <p className="text-muted-foreground text-sm font-normal">
            Спросите выручку за день, возможности ассистента или задайте вопрос
          </p>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex min-h-[280px] max-h-[50vh] flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 py-12 text-center">
              <BotIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                Напишите сообщение, чтобы начать диалог
              </p>
              <p className="text-muted-foreground/80 text-xs">
                Например: «Какая выручка за сегодня?» или «Что ты умеешь?»
              </p>
            </div>
          )}

          {messages.map((message: Message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user"
                  ? "flex-row-reverse"
                  : "flex-row",
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
