import { useEffect, useRef, useState } from "react";
import { ArrowDown, Copy, CornerDownRight, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";
import { useAssistantChatStore, type AssistantMessage } from "@/components/layout/assistant-chat-store";
import { AssistantEmptyStateReveal } from "@/components/layout/assistant-empty-state-reveal";
import { AssistantSource } from "@/components/layout/assistant-source";
import { useAssistantSuggestions } from "@/components/layout/assistant-suggestions";
import { Button } from "@/components/shadcn/ui/button";
import { KbdSequence } from "@/components/shadcn/ui/kbd";
import { Skeleton } from "@/components/shadcn/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/ui/tooltip";
import { cn, copyToClipboard } from "@/lib/utils";

// How far from the bottom still counts as "following along", so a streaming answer keeps scrolling.
const STICK_TO_BOTTOM_THRESHOLD_PX = 48;

function AssistantMessageItem({ message, isLast }: { message: AssistantMessage; isLast: boolean }) {
    const isStreaming = useAssistantChatStore((state) => state.isStreaming);
    const retryLastPrompt = useAssistantChatStore((state) => state.retryLastPrompt);
    // Only the newest turn offers a retry: replaying an older one would discard every turn after it.
    const canRetry = isLast && !isStreaming;

    if (message.role === "user") {
        return (
            // wrap-anywhere rather than break-words: only `overflow-wrap: anywhere` also shrinks the
            // bubble's min-content width, so an unbroken run of characters wraps instead of pushing
            // the whole panel sideways.
            // text-primary-strong, not text-primary: the brand mid-step is 2.61:1 as text (see the
            // palette notes in index.css), and primary-strong is the same hue at a legible weight.
            <div className="ml-auto max-w-[85%] rounded-lg rounded-br-none bg-primary/10 px-3 py-2 text-sm wrap-anywhere whitespace-pre-wrap text-primary-strong">
                {message.text}
            </div>
        );
    }

    if (message.role === "error") {
        return (
            <div className="max-w-[85%] rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm wrap-anywhere text-destructive">
                {message.text}
                {canRetry && (
                    <Button variant="destructive" size="xs" className="mt-2" onClick={() => void retryLastPrompt()}>
                        <RotateCcw aria-hidden="true" />
                        Try again
                    </Button>
                )}
            </div>
        );
    }

    return (
        // The answer is whatever markdown the service sends: long urls and identifiers wrap, and a
        // code block — which cannot wrap — scrolls within itself rather than widening the panel.
        <div className="group/message rounded-lg py-2 text-sm wrap-anywhere [&_pre]:overflow-x-auto">
            {message.text === "" ? (
                <AssistantPendingAnswer />
            ) : (
                <>
                    <Streamdown>{message.text}</Streamdown>
                    <AssistantRelevantLinks links={message.relevantLinks} />
                    {/* An answer still streaming in is not worth copying yet, and retrying it would
                        mean cancelling the stream it is already producing. */}
                    {!(isLast && isStreaming) && (
                        <AssistantMessageActions text={message.text} canRetry={canRetry} onRetry={retryLastPrompt} />
                    )}
                </>
            )}
        </div>
    );
}

function AssistantPendingAnswer() {
    return (
        <div className="flex flex-col gap-2">
            <span className="animate-pulse text-muted-foreground">Thinking…</span>
            {/* Stands in for the answer about to arrive, so the panel shows its shape rather than a
                bare line of text. Decorative: the wait is already announced by the live region. */}
            <div className="flex flex-col gap-1.5" aria-hidden="true">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-2/3" />
            </div>
        </div>
    );
}

function AssistantMessageActions({
    text,
    canRetry,
    onRetry,
}: {
    text: string;
    canRetry: boolean;
    onRetry: () => Promise<void>;
}) {
    return (
        <div
            className={cn(
                "mt-1 flex items-center gap-0.5 transition-opacity",
                // The newest answer keeps its actions on show — it is the one being acted on, and
                // hover never fires on touch. Older answers stay quiet until pointed at or tabbed to.
                canRetry ? "opacity-100" : "opacity-0 group-hover/message:opacity-100 focus-within:opacity-100",
            )}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => void copyToClipboard(text)}
                        aria-label="Copy answer"
                    >
                        <Copy aria-hidden="true" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    Copy answer
                    {/* The chord acts on the newest answer, so it is only advertised there. */}
                    {canRetry && <KbdSequence keys={["Q", "C"]} />}
                </TooltipContent>
            </Tooltip>
            {canRetry && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void onRetry()}
                            aria-label="Regenerate answer"
                        >
                            <RotateCcw aria-hidden="true" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        Regenerate answer
                        <KbdSequence keys={["Q", "R"]} />
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

function AssistantRelevantLinks({ links }: { links: AssistantMessage["relevantLinks"] }) {
    // The links come straight from the AI service, so a blank url is possible and unlinkable.
    const linkedSources = links?.filter((link) => link.Url?.trim());

    if (!linkedSources || linkedSources.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">Related documentation</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
                {linkedSources.map((link) => (
                    <AssistantSource key={link.Url} link={link} />
                ))}
            </div>
        </div>
    );
}

function AssistantEmptyState() {
    const sendPrompt = useAssistantChatStore((state) => state.sendPrompt);
    const suggestions = useAssistantSuggestions();

    return (
        // The heading sits on the panel's midline with the prompts running below it, so the block
        // reads as one column anchored to the centre rather than floating in the middle of it.
        <div className="flex h-full flex-col">
            <AssistantEmptyStateReveal />
            <div className="flex flex-1 flex-col justify-center gap-5">
                <div>
                    <h2 className="font-medium">How can I help?</h2>
                    <p className="text-sm text-muted-foreground">Ask about your apps, conversations, or setup.</p>
                </div>
                <div>
                    <p className="text-[0.6875rem] font-medium tracking-wider text-muted-foreground uppercase">
                        Try asking
                    </p>
                    <div className="mt-1 flex flex-col">
                        {suggestions.map((suggestion) => (
                            <Button
                                key={suggestion}
                                variant="ghost"
                                size="sm"
                                // The prompts are whole questions, so a row wraps onto a second line
                                // rather than overflowing the panel at its narrowest.
                                className="h-auto justify-start gap-2 py-1.5 text-left whitespace-normal"
                                onClick={() => void sendPrompt(suggestion)}
                            >
                                <CornerDownRight className="text-muted-foreground" aria-hidden="true" />
                                {suggestion}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * What the live region says. Streaming rewrites the answer on every chunk, and a live region
 * wrapped around it would read the whole thing again each time — so this announces the state of the
 * turn rather than its text. The answer itself is left to be read from the transcript, where it is
 * rendered markup rather than the raw markdown a live region would spell out asterisks and all.
 */
function getAnswerStatus(lastMessage: AssistantMessage | undefined, isStreaming: boolean) {
    if (isStreaming) {
        return "Answering…";
    }

    if (!lastMessage || lastMessage.role === "user") {
        return "";
    }

    // Errors are plain sentences written for a person, so they are worth speaking in full.
    return lastMessage.role === "error" ? lastMessage.text : "Answer ready.";
}

export function AssistantMessages() {
    const messages = useAssistantChatStore((state) => state.messages);
    const isStreaming = useAssistantChatStore((state) => state.isStreaming);
    const scrollRef = useRef<HTMLDivElement>(null);
    // Content growing does not fire a scroll event, so the last scroll position is what decides
    // whether to follow the stream: scrolling up to re-read must not snap back down. It also drives
    // the jump-to-latest button, which is why it is state rather than a ref.
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Clearing the conversation (or a retry dropping the last turn) throws away the scroll position
    // the reader was parked at. Left as it was, "not following" would strand the next answer off
    // screen and leave the jump button pointing at nothing.
    const isEmpty = messages.length === 0;
    const [wasEmpty, setWasEmpty] = useState(isEmpty);
    if (isEmpty !== wasEmpty) {
        setWasEmpty(isEmpty);
        if (isEmpty) {
            setIsAtBottom(true);
        }
    }

    // DOM side effect with no event to hang it on: keep the newest message in view as it arrives
    // and while it streams in. Scrolling this container directly rather than calling
    // scrollIntoView keeps the app shell — itself a scroll container — from scrolling along.
    useEffect(() => {
        const scrollArea = scrollRef.current;
        if (scrollArea && isAtBottom) {
            scrollArea.scrollTop = scrollArea.scrollHeight;
        }
    }, [messages, isAtBottom]);

    const answerStatus = getAnswerStatus(messages.at(-1), isStreaming);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-3"
                aria-busy={isStreaming}
                onScroll={(event) => {
                    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                    setIsAtBottom(scrollHeight - scrollTop - clientHeight <= STICK_TO_BOTTOM_THRESHOLD_PX);
                }}
            >
                {messages.length === 0 ? (
                    <AssistantEmptyState />
                ) : (
                    <div className="flex flex-col gap-3">
                        {messages.map((message, index) => (
                            <AssistantMessageItem
                                key={message.id}
                                message={message}
                                isLast={index === messages.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!isAtBottom && messages.length > 0 && (
                <Button
                    variant="secondary"
                    size="sm"
                    className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full shadow-md"
                    onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })}
                >
                    <ArrowDown aria-hidden="true" />
                    Jump to latest
                </Button>
            )}

            <div aria-live="polite" className="sr-only">
                {answerStatus}
            </div>
        </div>
    );
}
