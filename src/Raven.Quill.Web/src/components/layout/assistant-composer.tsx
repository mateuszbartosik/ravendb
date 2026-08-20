import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowUp, Square } from "lucide-react";
import { useAssistantChatStore, type AssistantMessage } from "@/components/layout/assistant-chat-store";
import { useAssistantStore } from "@/components/layout/assistant-store";
import { FormTextarea } from "@/components/form/form-textarea";
import { Button } from "@/components/shadcn/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/ui/tooltip";
import { cn } from "@/lib/utils";

type PromptFormData = {
    prompt: string;
};

// The ghost suggestion is a separate element layered over the field, so the two have to carry the
// same type metrics or the suggestion will not sit on the line the caret is on.
const COMPOSER_TEXT_CLASSES = "px-1.5 py-0.5 text-base md:py-1 md:text-sm";

/** The newest answer, and only while it is the newest: a follow-up to an older turn is stale advice. */
function lastAnswerWithFollowUp(messages: AssistantMessage[]) {
    const lastMessage = messages.at(-1);
    return lastMessage?.role === "assistant" && lastMessage.followUpQuestions?.length ? lastMessage : undefined;
}

export function AssistantComposer() {
    const sendPrompt = useAssistantChatStore((state) => state.sendPrompt);
    const stopStreaming = useAssistantChatStore((state) => state.stopStreaming);
    const isStreaming = useAssistantChatStore((state) => state.isStreaming);
    const openCount = useAssistantStore((state) => state.openCount);
    // Two primitive selectors rather than one returning an object: zustand compares with Object.is,
    // and a fresh object every render would never compare equal.
    const followUp = useAssistantChatStore((state) => lastAnswerWithFollowUp(state.messages)?.followUpQuestions?.[0]);
    const followUpMessageId = useAssistantChatStore((state) => lastAnswerWithFollowUp(state.messages)?.id);
    const [dismissedFollowUpMessageId, setDismissedFollowUpMessageId] = useState<string | null>(null);

    const form = useForm<PromptFormData>({ defaultValues: { prompt: "" } });
    const prompt = useWatch({ control: form.control, name: "prompt" });
    const canSend = prompt.trim() !== "" && !isStreaming;
    // Only offered over an empty field: a follow-up replaces the whole message rather than
    // completing what has been typed, which is also why no mirror element is needed to place it.
    const ghostFollowUp =
        prompt === "" && !isStreaming && followUpMessageId !== dismissedFollowUpMessageId ? followUp : undefined;

    // DOM side effect with no event to hang it on: opening the panel puts the caret in the
    // composer. The count starts at zero, so a panel restored as open on load takes no focus.
    useEffect(() => {
        if (openCount > 0) {
            form.setFocus("prompt");
        }
    }, [openCount, form]);

    // Deliberately not RHF's handleSubmit: FormTextarea disables itself while `formState.isSubmitting`
    // is set, and handleSubmit publishes that flag before it awaits — so the textarea would render
    // disabled, lose the focus it had, and never get the caret back for the next message. A non-empty
    // prompt is the only rule here, and `canSend` already applies it.
    function send() {
        if (!canSend) {
            return;
        }

        const trimmedPrompt = prompt.trim();
        form.reset();
        form.setFocus("prompt");
        void sendPrompt(trimmedPrompt);
    }

    // Accepting fills the composer rather than sending, the way shell and editor autosuggestions do,
    // so the question can be edited before it goes.
    function acceptFollowUp() {
        if (!ghostFollowUp) {
            return;
        }

        form.setValue("prompt", ghostFollowUp);
        form.setFocus("prompt");
        // RHF focuses the field but leaves the caret at the start, which would put typing in front of
        // the accepted question.
        if (document.activeElement instanceof HTMLTextAreaElement) {
            document.activeElement.setSelectionRange(ghostFollowUp.length, ghostFollowUp.length);
        }
    }

    return (
        <form
            className="p-3"
            onSubmit={(event) => {
                event.preventDefault();
                send();
            }}
        >
            {/* The wrapper carries the border and the focus ring so the composer reads as one
                control, and the textarea inside is stripped bare — otherwise the ring lands around
                a box that already has a frame of its own. The ring is dialled down from the field
                default: this composer takes focus whenever the panel opens, so its focused state is
                the one on screen most of the time.

                Laying the two out as a row rather than floating the button over the text is what
                keeps them level: the wrapper's padding sets the button's inset on every side, and
                `items-end` holds it against the last line of text as the textarea grows. */}
            <div className="flex items-end gap-1.5 rounded-lg border border-input p-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25 dark:bg-input/30">
                <div className="relative min-w-0 flex-1">
                    <FormTextarea
                        control={form.control}
                        name="prompt"
                        aria-label="Message the AI assistant"
                        // The ghost sits in the same place the placeholder would, so only one of
                        // them can be on screen at a time.
                        placeholder={ghostFollowUp ? "" : "Ask me anything…"}
                        rows={1}
                        // The padding tracks the field's own responsive type size (text-base,
                        // md:text-sm) so one line of text is exactly as tall as the button beside it.
                        textareaClassName={cn(
                            COMPOSER_TEXT_CLASSES,
                            "max-h-40 min-h-0 resize-none border-0 bg-transparent focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
                        )}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                send();
                                return;
                            }

                            if (!ghostFollowUp) {
                                return;
                            }

                            // Tab is only swallowed while a suggestion is on screen, and Escape
                            // clears it — so the field is never a keyboard trap.
                            if (event.key === "Tab" || event.key === "ArrowRight") {
                                event.preventDefault();
                                acceptFollowUp();
                            } else if (event.key === "Escape") {
                                event.preventDefault();
                                // The panel closes on Escape too; dismissing the suggestion is the
                                // nearer meaning, so a second Escape is what closes the panel.
                                event.stopPropagation();
                                setDismissedFollowUpMessageId(followUpMessageId ?? null);
                            }
                        }}
                    />
                    {ghostFollowUp && (
                        <div
                            className={cn(
                                COMPOSER_TEXT_CLASSES,
                                "pointer-events-none absolute inset-0 flex items-center gap-1.5 text-muted-foreground",
                            )}
                        >
                            <span className="truncate">{ghostFollowUp}</span>
                            <button
                                type="button"
                                onClick={acceptFollowUp}
                                // Restores clicks for this one element, so the rest of the overlay
                                // still lets the caret be placed in the field underneath it.
                                className="pointer-events-auto shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:bg-muted hover:text-foreground"
                                aria-label={`Use suggested question: ${ghostFollowUp}`}
                            >
                                Tab
                            </button>
                        </div>
                    )}
                </div>
                {isStreaming ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="secondary"
                                onClick={stopStreaming}
                                className="rounded-full"
                                aria-label="Stop answering"
                            >
                                <Square aria-hidden="true" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Stop answering</TooltipContent>
                    </Tooltip>
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="submit"
                                size="icon-sm"
                                disabled={!canSend}
                                className="rounded-full"
                                aria-label="Send message"
                            >
                                <ArrowUp aria-hidden="true" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send message</TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="pt-2 text-center text-[0.6875rem] text-muted-foreground">
                Responses are AI-generated and may require verification.
            </div>
        </form>
    );
}
