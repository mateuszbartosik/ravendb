import { create } from "zustand";
import { api } from "@/api/api";
import {
    describeAssistantError,
    isAssistantConsentRequired,
    type AssistantRelevantLink,
} from "@/api/custom-services/assistant-service";
import { queryClient } from "@/lib/query-client";

export type AssistantMessage = {
    id: string;
    role: "user" | "assistant" | "error";
    text: string;
    relevantLinks?: AssistantRelevantLink[];
    /** Questions the service suggests asking next; the composer offers the first as ghost text. */
    followUpQuestions?: string[];
};

let messageIdCounter = 0;

function nextMessageId() {
    messageIdCounter += 1;
    return `assistant-message-${messageIdCounter}`;
}

// Kept out of the store: aborting is a transport concern, and nothing renders from it.
let streamAbortController: AbortController | null = null;

function markConsentRequired() {
    queryClient.setQueryData(api.queries.assistant.consent().queryKey, { status: "ConsentRequired" });
}

type AssistantChatState = {
    messages: AssistantMessage[];
    /** Ties the next turn to the same upstream conversation; null starts a fresh one. */
    conversationId: string | null;
    isStreaming: boolean;
    sendPrompt: (prompt: string) => Promise<void>;
    /** Re-asks the last question, replacing the turn it produced. */
    retryLastPrompt: () => Promise<void>;
    stopStreaming: () => void;
    clearMessages: () => void;
};

export const useAssistantChatStore = create<AssistantChatState>((set, get) => ({
    messages: [],
    conversationId: null,
    isStreaming: false,
    sendPrompt: async (prompt) => {
        if (get().isStreaming) {
            return;
        }

        const promptId = nextMessageId();
        const answerId = nextMessageId();
        set((state) => ({
            messages: [
                ...state.messages,
                { id: promptId, role: "user", text: prompt },
                { id: answerId, role: "assistant", text: "" },
            ],
        }));

        // A cleared conversation drops the answer bubble, and then there is nothing to update.
        const updateAnswer = (changes: Partial<AssistantMessage>) =>
            set((state) => ({
                messages: state.messages.map((message) =>
                    message.id === answerId ? { ...message, ...changes } : message,
                ),
            }));

        const dropAnswerIfEmpty = () =>
            set((state) => ({
                messages: state.messages.filter((message) => message.id !== answerId || message.text !== ""),
            }));

        const abortController = new AbortController();
        streamAbortController = abortController;
        set({ isStreaming: true });

        try {
            for await (const event of api.services.assistantChat.stream(
                { message: prompt, conversationId: get().conversationId },
                abortController.signal,
            )) {
                if (event.type === "chunk") {
                    updateAnswer({ text: event.answer });
                } else if (event.type === "done") {
                    const { ConversationId, Response } = event.result;
                    // An answer that came through empty would strand the "Thinking…" placeholder.
                    updateAnswer(
                        Response?.Answer
                            ? {
                                  text: Response.Answer,
                                  relevantLinks: Response.RelevantLinks ?? [],
                                  followUpQuestions: Response.FollowUpQuestions ?? [],
                              }
                            : { role: "error", text: "The AI assistant returned no answer." },
                    );
                    set({ conversationId: ConversationId ?? null });
                } else {
                    if (event.status === "ConsentRequired") {
                        markConsentRequired();
                    }

                    updateAnswer({ role: "error", text: event.message });
                }
            }
        } catch (error) {
            // Stopped by the operator (or by clearing the conversation) — a partial answer stands, but
            // an answer that never started would strand the "Thinking…" placeholder.
            if (abortController.signal.aborted) {
                dropAnswerIfEmpty();
                return;
            }

            if (isAssistantConsentRequired(error)) {
                markConsentRequired();
            }

            updateAnswer({ role: "error", text: describeAssistantError(error) });
        } finally {
            if (streamAbortController === abortController) {
                streamAbortController = null;
                set({ isStreaming: false });
            }
        }
    },
    retryLastPrompt: async () => {
        const { isStreaming, messages } = get();
        if (isStreaming) {
            return;
        }

        const lastPromptIndex = messages.findLastIndex((message) => message.role === "user");
        if (lastPromptIndex === -1) {
            return;
        }

        // Drop the turn being retried so the new answer replaces it rather than piling up beneath
        // it. The conversation id stays put: upstream already saw the question, so the retry reads
        // as a follow-up in the same conversation.
        const prompt = messages[lastPromptIndex].text;
        set({ messages: messages.slice(0, lastPromptIndex) });
        await get().sendPrompt(prompt);
    },
    stopStreaming: () => {
        streamAbortController?.abort();
        streamAbortController = null;
        set({ isStreaming: false });
    },
    clearMessages: () => {
        get().stopStreaming();
        set({ messages: [], conversationId: null });
    },
}));
