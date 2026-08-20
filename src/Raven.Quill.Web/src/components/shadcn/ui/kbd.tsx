import { Fragment } from "react";
import { cn } from "@/lib/utils";

// border-current so the chip reads on whatever it sits on: tooltips paint light text on a dark
// ground, the rest of the app the other way round.
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
    return (
        <kbd
            data-slot="kbd"
            className={cn("rounded border border-current/30 px-1.5 py-0.5 font-mono text-[10px]", className)}
            {...props}
        />
    );
}

/**
 * Keys pressed one after the other rather than together — `Q` then `N`. The word carries the
 * distinction that spacing alone cannot, since a plain gap reads as a simultaneous combination.
 */
function KbdSequence({ keys }: { keys: string[] }) {
    return (
        <>
            {keys.map((key, index) => (
                <Fragment key={key}>
                    {index > 0 && <span className="text-[10px] opacity-70">then</span>}
                    <Kbd>{key}</Kbd>
                </Fragment>
            ))}
        </>
    );
}

export { Kbd, KbdSequence };
