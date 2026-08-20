import { useState } from "react";
import { Globe } from "lucide-react";
import type { AssistantRelevantLink } from "@/api/custom-services/assistant-service";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/shadcn/ui/hover-card";

type DescribedUrl = { host: string; path: string; origin: string | null };

/**
 * Where to look for a site's icon, in order, stopping at the first that loads.
 *
 * A host declares its icon in the page's `<link rel="icon">`, which is no help here: reading it
 * means fetching the page, and the browser is not allowed to. So these are the conventions instead.
 * More than one is needed because the two RavenDB hosts disagree — ravendb.net answers /favicon.ico
 * and 404s on /img/favicon.ico, while docs.ravendb.net does exactly the reverse (Docusaurus puts it
 * under /img, and that is where the docs pages the assistant cites actually live).
 */
const FAVICON_PATHS = ["/favicon.ico", "/img/favicon.ico", "/favicon.svg"];

/**
 * The icon comes from the linked site itself. Prompt-kit asks Google's favicon service instead,
 * which would mean handing Google one request per pill saying which documentation page the operator
 * is reading; the site's own origin already has the file.
 */
function describeUrl(url: string): DescribedUrl {
    try {
        const { hostname, pathname, origin } = new URL(url);
        return { host: hostname.replace(/^www\./, ""), path: decodeURIComponent(pathname), origin };
    } catch {
        // The links come straight from the AI service, so an unparseable one is possible.
        return { host: url, path: "", origin: null };
    }
}

/** Decorative: the host and title beside it already say where the link goes. */
function SourceIcon({ origin }: { origin: string | null }) {
    // Each failed path moves on to the next; running out of them leaves the glyph.
    const [pathIndex, setPathIndex] = useState(0);
    const path = FAVICON_PATHS[pathIndex];

    if (origin === null || path === undefined) {
        return <Globe className="size-3.5 shrink-0" aria-hidden="true" />;
    }

    return (
        <img
            src={`${origin}${path}`}
            alt=""
            // no-referrer so fetching the icon does not tell the site which Quill page linked to it.
            referrerPolicy="no-referrer"
            // Shown as the site drew it: no ground behind it, and contain rather than cover so a
            // logo that is not square is scaled instead of cropped. Giving a transparent icon a
            // ground would only box in the blue raven the docs host serves, and the alternative —
            // white behind the dark-glyph ones only — cannot be told apart from here, since
            // deciding it means reading pixels that docs.ravendb.net serves without a CORS header.
            className="size-3.5 shrink-0 rounded-full object-contain"
            onError={() => setPathIndex(pathIndex + 1)}
        />
    );
}

/**
 * One cited documentation page, as a compact pill that opens a card on hover. The pill has room for
 * a few words, so the card is where the full title and the path it points at fit.
 */
export function AssistantSource({ link }: { link: AssistantRelevantLink }) {
    const { host, path, origin } = describeUrl(link.Url);
    const label = link.Title || host;

    return (
        <HoverCard openDelay={150} closeDelay={0}>
            <HoverCardTrigger asChild>
                <a
                    href={link.Url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-6 max-w-48 items-center gap-1.5 rounded-full bg-muted pr-2.5 pl-1.5 text-xs text-muted-foreground no-underline transition-colors hover:bg-primary/10 hover:text-primary-strong"
                >
                    <SourceIcon origin={origin} />
                    <span className="truncate">{label}</span>
                </a>
            </HoverCardTrigger>
            {/* Above the pill: the sources sit at the bottom of an answer, so a card below would
                open over the next turn or off the end of the transcript. */}
            <HoverCardContent side="top" align="start" className="w-72 p-0">
                <a href={link.Url} target="_blank" rel="noreferrer" className="flex flex-col gap-1.5 p-3 no-underline">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <SourceIcon origin={origin} />
                        <span className="truncate">{host}</span>
                    </span>
                    <span className="line-clamp-2 text-sm font-medium text-foreground">{label}</span>
                    {/* The service sends a title and a url and nothing else, and the page's own
                        description cannot be read from the browser — the docs host serves no CORS
                        header — so the path stands in for it. For these urls it is the part that
                        says which article and which language binding this is. */}
                    {path !== "" && path !== "/" && (
                        <span className="line-clamp-2 text-xs break-all text-muted-foreground">{path}</span>
                    )}
                </a>
            </HoverCardContent>
        </HoverCard>
    );
}
