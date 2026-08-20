import { useEffect } from "react";
import { useAssistantChatStore } from "@/components/layout/assistant-chat-store";
import { useAssistantStore } from "@/components/layout/assistant-store";
import { COMPACT_LAYOUT_MEDIA_QUERY } from "@/lib/use-media-query";
import { copyToClipboard } from "@/lib/utils";

/** Held with ⌘/Ctrl to toggle the panel. */
export const ASSISTANT_SHORTCUT_KEY = "i";

/** Pressed on its own, then followed by one of {@link ASSISTANT_CHORDS}. */
export const ASSISTANT_CHORD_LEADER = "q";

export const ASSISTANT_CHORDS = {
    newConversation: "n",
    pin: "p",
    copyAnswer: "c",
    regenerate: "r",
} as const;

/** How long the leader stays armed. Long enough to be typed deliberately, short enough not to lurk. */
const CHORD_TIMEOUT_MS = 1500;

const CHORD_ACTIONS: Record<string, () => void> = {
    [ASSISTANT_CHORDS.newConversation]: () => {
        // Opening also puts the caret in the composer, so the chord leaves a conversation ready to type
        // into rather than merely emptied.
        useAssistantStore.getState().setOpen(true);
        useAssistantChatStore.getState().clearMessages();
    },
    [ASSISTANT_CHORDS.pin]: () => {
        const { isOpen, isPinned, setPinned } = useAssistantStore.getState();
        // Mirrors the header control, which exists only while the panel is open and there is room to
        // dock it. Toggling out of sight would rearrange the layout with nothing on screen to explain it.
        if (isOpen && !window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches) {
            setPinned(!isPinned);
        }
    },
    [ASSISTANT_CHORDS.copyAnswer]: () => {
        // Allowed with the panel closed: copying what the assistant just said is a fair thing to want
        // while reading the page, and the copy itself raises a toast.
        const lastAnswer = useAssistantChatStore
            .getState()
            .messages.findLast((message) => message.role === "assistant" && message.text !== "");

        if (lastAnswer) {
            void copyToClipboard(lastAnswer.text);
        }
    },
    [ASSISTANT_CHORDS.regenerate]: () => {
        useAssistantStore.getState().setOpen(true);
        // The store already ignores this while streaming and with nothing to retry.
        void useAssistantChatStore.getState().retryLastPrompt();
    },
};

// A chord is typed rather than held, so it only makes sense where the keystrokes are not going into a
// field — the same rule Gmail and Linear apply to theirs.
function isTypingTarget(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
}

/**
 * The assistant's keyboard surface, registered once for the whole app:
 *
 * - ⌘/Ctrl+I toggles the panel. Opening it bumps `openCount`, which is what moves the caret into the
 *   composer — so one keystroke both summons the panel and starts the message.
 * - `Q` followed by a second key runs a panel command. Unlike the suggestions, these four are the same
 *   wherever you are, which is what makes them worth committing to muscle memory.
 */
export function useAssistantShortcuts() {
    useEffect(() => {
        let chordTimeoutId: number | undefined;
        let isLeaderArmed = false;

        const disarmLeader = () => {
            window.clearTimeout(chordTimeoutId);
            isLeaderArmed = false;
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key?.toLowerCase();

            if (key === ASSISTANT_SHORTCUT_KEY && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                const { isOpen, setOpen } = useAssistantStore.getState();
                setOpen(!isOpen);
                return;
            }

            if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
                disarmLeader();
                return;
            }

            if (isLeaderArmed) {
                const runChord = CHORD_ACTIONS[key];
                // Disarm before running either way: a key that completes no chord ends the sequence
                // rather than leaving the leader armed for the next thing typed.
                disarmLeader();

                if (runChord) {
                    event.preventDefault();
                    runChord();
                }
                return;
            }

            if (key === ASSISTANT_CHORD_LEADER) {
                isLeaderArmed = true;
                chordTimeoutId = window.setTimeout(disarmLeader, CHORD_TIMEOUT_MS);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.clearTimeout(chordTimeoutId);
        };
    }, []);
}
