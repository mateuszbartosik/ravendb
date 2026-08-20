import { useLocation } from "react-router";

/** Shown when the current route has no starter prompts of its own. */
const GENERAL_PROMPTS = ["What can you help me with?", "How do I create an app?", "What is an agent?"];

// First match wins, so a more specific route comes before the one that would also claim it:
// every app page sits under the app route the overview pattern matches.
const ROUTE_PROMPTS: { pattern: RegExp; prompts: string[] }[] = [
    {
        pattern: /^\/apps\/[^/]+\/agents\/[^/]+\/edit/,
        prompts: ["What does this setting do?", "How do I write a system prompt?", "How do I give an agent tools?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/agents/,
        prompts: ["How do I create an agent?", "What can an agent do?", "How do I test an agent?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/data-source/,
        prompts: ["How do I connect a data source?", "Which data sources are supported?", "How often does data sync?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/conversations/,
        prompts: ["How do I find a conversation?", "Can I export conversations?", "How long are these kept?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/(channels|web-widget)/,
        prompts: ["How do I embed the web widget?", "Which channels are supported?", "How do I style the widget?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/analytics/,
        prompts: ["What do these metrics mean?", "How do I track agent quality?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/settings/,
        prompts: ["What can I configure here?", "How do I rename this app?"],
    },
    {
        pattern: /^\/apps\/[^/]+\/?$/,
        prompts: ["What can this app do?", "How do I add an agent?", "How do I connect a channel?"],
    },
    {
        pattern: /^\/app\/add/,
        prompts: ["What do I need to create an app?", "Which data source should I pick?"],
    },
    {
        pattern: /^\/connection-strings/,
        prompts: [
            "Which AI providers are supported?",
            "How do I add a connection string?",
            "Where do I get an API key?",
        ],
    },
    {
        pattern: /^\/certificates/,
        prompts: ["How do I upload a certificate?", "How do I renew a certificate?"],
    },
    {
        pattern: /^\/ip-configuration/,
        prompts: ["Which IPs should I allow?", "How do I restrict access by IP?"],
    },
    {
        pattern: /^\/usage/,
        prompts: ["How is usage calculated?", "What counts as a request?", "How do I reduce my usage?"],
    },
    {
        pattern: /^\/license/,
        prompts: ["What does my license include?", "How do I upgrade?", "When does my license expire?"],
    },
];

/** Starter prompts for the empty conversation, picked from wherever the operator currently is. */
export function useAssistantSuggestions() {
    const { pathname } = useLocation();
    return ROUTE_PROMPTS.find(({ pattern }) => pattern.test(pathname))?.prompts ?? GENERAL_PROMPTS;
}
