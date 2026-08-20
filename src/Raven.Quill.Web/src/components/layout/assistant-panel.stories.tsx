import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, spyOn, waitFor, within } from "storybook/test";
import { AI_LICENSE_UNAVAILABLE_MESSAGE } from "@/api/custom-services/assistant-service";
import { assistantMocks } from "@/mocks/assistant-mocks";
import { defaultApiMocks } from "@/mocks/default-mocks";
import { AssistantPanel } from "./assistant-panel";
import { useAssistantStore } from "./assistant-store";

const meta = {
    title: "Layout/Assistant panel",
    component: AssistantPanel,
    // The panel only asks about consent once it is open, which in the app is the operator's toggle.
    beforeEach: () => {
        useAssistantStore.setState({ isOpen: true });
    },
    decorators: [
        (Story) => (
            <div className="flex h-svh w-96 flex-col p-2">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof AssistantPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConsentGranted: Story = {
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(() => expect(canvas.getByRole("textbox", { name: /message the ai assistant/i })).toBeEnabled());
    },
};

export const WithoutWebGl: Story = {
    name: "Without WebGL",
    // A browser with no usable GPU refuses every WebGL context, while 2D canvases keep working.
    beforeEach: () => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        const refuseWebGl = function (this: HTMLCanvasElement, contextId: string, options?: unknown) {
            return contextId.startsWith("webgl") ? null : getContext.call(this, contextId, options);
        } as typeof getContext;
        const getContextSpy = spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(refuseWebGl);

        return () => getContextSpy.mockRestore();
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // The empty-state animation loads lazily, so wait until it has asked for WebGL and been refused.
        await waitFor(
            () => expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("webgl2", expect.anything()),
            { timeout: 10_000 },
        );
        await new Promise((resolve) => setTimeout(resolve));

        expect(canvas.getByRole("heading", { name: /how can i help/i })).toBeVisible();
        expect(canvas.getByRole("textbox", { name: /message the ai assistant/i })).toBeEnabled();
    },
};

export const ConsentRequired: Story = {
    parameters: {
        msw: {
            handlers: {
                assistant: [assistantMocks.consent({ status: "ConsentRequired" }), ...defaultApiMocks.assistant],
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(() => expect(canvas.getByRole("button", { name: /review the terms of use/i })).toBeEnabled());
        expect(canvas.queryByRole("textbox", { name: /message the ai assistant/i })).not.toBeInTheDocument();
    },
};

export const LicenseWithoutAssistant: Story = {
    parameters: {
        msw: {
            handlers: {
                assistant: [assistantMocks.consent({ status: "InvalidCredentials" }), ...defaultApiMocks.assistant],
            },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(() => expect(canvas.getByRole("alert")).toHaveTextContent(AI_LICENSE_UNAVAILABLE_MESSAGE));
    },
};

export const ConsentCheckFailed: Story = {
    parameters: {
        msw: {
            handlers: { assistant: [assistantMocks.consentUnavailable(), ...defaultApiMocks.assistant] },
        },
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        await waitFor(() => expect(canvas.getByRole("button", { name: /try again/i })).toBeEnabled());
    },
};
