import "../wwwroot/Content/css/bs5-styles.scss";
import "../wwwroot/Content/css/styles.less"

import { overrideViews } from "../typescript/overrides/views";
import { overrideComposition } from "../typescript/overrides/composition";
import { overrideSystem } from "../typescript/overrides/system";

overrideSystem();
overrideComposition();
overrideViews();

import system from "durandal/system";
system.debug(true);

require('../wwwroot/Content/css/fonts/icomoon.font');

const ko = require("knockout");
require("knockout.validation");
import "knockout-postbox";
require("knockout-delegated-events");
const { DirtyFlag } = require("external/dirtyFlag");
ko.DirtyFlag = DirtyFlag;

import extensions from "common/extensions";

extensions.install();

import "bootstrap/dist/js/bootstrap";
import "jquery-fullscreen-plugin/jquery.fullscreen";
import "bootstrap-select";

import "bootstrap-multiselect";
import "jquery-blockui";

import "bootstrap-duration-picker/src/bootstrap-duration-picker";
import "eonasdan-bootstrap-datetimepicker/src/js/bootstrap-datetimepicker";

import bootstrapModal from "durandalPlugins/bootstrapModal";
bootstrapModal.install();

import dialog from "plugins/dialog";
dialog.install({});

import pluginWidget from "plugins/widget";
pluginWidget.install({});


import { commonInit } from "components/common/shell/setup";

import { fn } from "@storybook/test";
import { useState } from "react";
import { createStoreConfiguration } from "components/store";
import { setEffectiveTestStore } from "components/storeCompat";
window.jest = { fn }

commonInit();

import studioSettings from "common/settings/studioSettings";
const mockJQueryPromise = () => $().promise();
studioSettings.default.configureLoaders(mockJQueryPromise, mockJQueryPromise, mockJQueryPromise, mockJQueryPromise);

import { Provider } from "react-redux";

import { resetAllMocks } from "@storybook/test";

const themes = {
    default: async () => {},
    classic: () => import("../wwwroot/Content/css/bs5-styles-classic.scss"),
    blue: () => import("../wwwroot/Content/css/bs5-styles-blue.scss"),
    light: () => import("../wwwroot/Content/css/bs5-styles-light.scss"),
};

const switchTheme = async (themeName) => {
    if (!themes[themeName]) return;
    await themes[themeName]();
};

export const decorators = [
    (Story, context) => {
        switchTheme(context.globals.theme);
        resetAllMocks();

        const [store] = useState(() => {
            const storeConfiguration = createStoreConfiguration();
            setEffectiveTestStore(storeConfiguration);
            return storeConfiguration;
        });

        return (
            <Provider store={store}>
                <div className="h-100">
                    {Story()}
                </div>
            </Provider>
        )
    }
]

export const globalTypes = {
    theme: {
        name: "Theme",
        description: "Global theme for components",
        defaultValue: "default",
        toolbar: {
            icon: "paintbrush",
            items: [
                { value: "default", title: "Default" },
                { value: "classic", title: "Classic" },
                { value: "blue", title: "Blue" },
                { value: "light", title: "Light" },
            ],
        },
    },
};
