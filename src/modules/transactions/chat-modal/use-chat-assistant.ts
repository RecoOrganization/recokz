"use client";

import { useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";

const CHAT_API = "/api/chat";

export function useChatAssistant() {
  const [open, setOpen] = useState(false);

  const chat = useChat({
    api: CHAT_API,
    streamProtocol: "data",
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);
  const toggleModal = useCallback(() => setOpen((prev) => !prev), []);

  return {
    open,
    openModal,
    closeModal,
    toggleModal,
    ...chat,
  };
}
