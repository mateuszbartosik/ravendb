import React, { useEffect } from 'react';
import { addons, types } from '@storybook/addons';
import { useGlobals } from '@storybook/api';
import { AddonPanel } from '@storybook/components';
import "../../../wwwroot/Content/scss/_colors.scss";

const ADDON_ID = 'ravendb/theme-switcher';
const PANEL_ID = `${ADDON_ID}/panel`;

addons.register(ADDON_ID, api => {
  addons.add(PANEL_ID, {
    title: 'Theme Switcher',
    type: types.PANEL,
    render: ({ active, key }) => {
      const [globals, updateGlobals] = useGlobals();

      const handleChange = event => {
        const theme = event.target.value;

        updateGlobals({
          theme,
        });
      };

      return (
        <AddonPanel active={active} key={key}>
          <select value={globals.theme} onChange={handleChange}>
            <option value="default">default</option>
            <option value="classic">classic</option>
            <option value="blue">blue</option>
            <option value="light">light</option>
          </select>
        </AddonPanel>
      );
    },
  });
});

const themes = {
    default: {
      '--bs-white': '#f0f1f6',
      '--bs-gray-100': '#c3c3cf',
      '--bs-gray-200': '#acadbf',
      '--bs-gray-300': '#8f8fa2',
      '--bs-gray-400': '#727489',
      '--bs-gray-500': '#595b71',
      '--bs-gray-600': '#424554',
      '--bs-gray-700': '#353742',
      '--bs-gray-800': '#262936',
      '--bs-gray-900': '#1e1f2b',
      '--bs-black': '#181826',
      '--bs-gray-base': 'var(--bs-black)',
      '--bs-gray-base-light': 'var(--bs-gray-900)',
      '--bs-gray-darker': 'var(--bs-gray-800)',
      '--bs-gray-dark': 'var(--bs-gray-600)',
      '--bs-gray': 'var(--bs-gray-400)',
      '--bs-gray-light': 'var(--bs-gray-200)',
      '--bs-gray-lighter': 'var(--bs-white)',
      '--color-1': '#f75e71',
      '--color-1-1': '#f57564',
      '--color-1-2': '#f38861',
      '--color-1-3': '#ee9d5f',
      '--color-2': '#f0ae5e',
      '--color-2-1': '#f0bf54',
      '--color-2-2': '#edcd51',
      '--color-2-3': '#c4d451',
      '--color-3': '#7bd85d',
      '--color-3-1': '#51d27a',
      '--color-3-2': '#44beaa',
      '--color-3-3': '#2fb7d2',
      '--color-4': '#2f9ef3',
      '--color-4-1': '#5186ee',
      '--color-4-2': '#7069ee',
      '--color-4-3': '#8361d4',
      '--color-5': '#945ab5',
      '--color-5-1': '#ba50a1',
      '--color-5-2': '#d8559d',
      '--color-5-3': '#ed558c',
      '--bs-secondary': 'var(--bs-gray-600)',
      '--bs-body-bg': '#181826',
      '--bs-border-color': 'var(--bs-gray-300)',
      '--bs-border-color-light': 'var(--bs-gray-600)',
      '--bs-border-color-disabled': 'var(--bs-border-color-light)',
      '--text-color': 'var(--bs-gray-200)',
      '--text-muted-color': 'var(--bs-gray-300)',
      '--text-emphasis': 'var(--bs-gray-100)',
      '--text-emphasis-color': 'var(--bs-gray-100)',
      '--base-text-color': 'var(--bs-gray-100)',
      '--base-text-muted-color': 'var(--bs-gray-200)',
      '--base-text-emphasis-color': 'var(--bs-white)',
      '--panel-header-bg': 'var(--bs-gray-800)',
      '--panel-bg-1': 'var(--bs-gray-900)',
      '--panel-bg-2': 'var(--bs-gray-800)',
      '--panel-bg-3': 'var(--bs-gray-700)',
      '--base-panel-header-bg': 'var(--panel-header-bg)',
      '--base-panel-bg-1': 'var(--panel-bg-1)',
      '--base-panel-bg-2': 'var(--panel-bg-2)',
      '--base-panel-bg-3': 'var(--panel-bg-3)',
      '--well-bg': 'var(--bs-body-bg)',
      '--base-well-bg': 'var(--bs-body-bg)',
      '--primary': 'var(--color-5)',
      '--success': 'var(--color-3)',
      '--info': 'var(--color-4)',
      '--warning': 'var(--color-2)',
      '--danger': 'var(--color-1)',
      '--light': 'var(--bs-gray-100)',
      '--dark': 'var(--bs-gray-900)',
      '--bs-link-color': '#c072ee',
      '--shadow-color': 'var(--bs-black)',
      '--bs-card-cap-bg': 'var(--panel-header-bg)',
    },
    blue: {
        '--bs-white': '#f4f5fb',
        '--bs-gray-100': '#e1e3ef',
        '--bs-gray-200': '#c8ccdf',
        '--bs-gray-300': '#a9b0c6',
        '--bs-gray-400': '#6d779f',
        '--bs-gray-500': '#586491',
        '--bs-gray-600': '#4a567c',
        '--bs-gray-700': '#3d4867',
        '--bs-gray-800': '#2f3a52',
        '--bs-gray-900': '#232e45',
        '--bs-black': '#172138',
        '--bs-secondary': 'var(--bs-gray-400)',
        '--bs-body-bg': 'var(--bs-black)',
        '--bs-border-color': 'var(--bs-gray-600)',
        '--bs-border-color-light': 'var(--bs-gray-400)',
        '--bs-border-color-disabled': 'var(--bs-border-color-light)',
        '--text-color': 'var(--bs-gray-900)',
        '--text-muted-color': 'var(--bs-gray-800)',
        '--text-emphasis': 'var(--bs-white)',
        '--text-emphasis-color': 'var(--bs-black)',
        '--base-text-color': 'var(--bs-gray-100)',
        '--base-text-muted-color': 'var(--bs-gray-200)',
        '--base-text-emphasis-color': 'var(--bs-white)',
        '--panel-header-bg': 'var(--bs-white)',
        '--panel-bg-1': 'var(--bs-gray-100)',
        '--panel-bg-2': 'var(--bs-gray-200)',
        '--panel-bg-3': 'var(--bs-gray-300)',
        '--base-panel-header-bg': 'var(--bs-gray-800)',
        '--base-panel-bg-1': 'var(--bs-gray-900)',
        '--base-panel-bg-2': 'var(--bs-gray-800)',
        '--base-panel-bg-3': 'var(--bs-gray-700)',
        '--well-bg': 'var(--bs-gray-200)',
        '--base-well-bg': 'var(--bs-black)',
        '--bs-card-cap-bg': 'var(--panel-header-bg)',
    },
    light: {
        '--bs-white': '#ffffff',
        '--bs-gray-100': '#f0f1f6',
        '--bs-gray-200': '#e5e6ea',
        '--bs-gray-300': '#dbdde3',
        '--bs-gray-400': '#c5c8d4',
        '--bs-gray-500': '#afb2c6',
        '--bs-gray-600': '#999db7',
        '--bs-gray-700': '#8085a1',
        '--bs-gray-800': '#666d8a',
        '--bs-gray-900': '#484d63',
        '--bs-black': '#292d3d',
        '--color-1': '#F06582',
        '--color-1-1': '#F26D65',
        '--color-1-2': '#F27C53',
        '--color-1-3': '#EB9345',
        '--color-2': '#ECA13D',
        '--color-2-1': '#ECB32A',
        '--color-2-2': '#E7BD1A',
        '--color-2-3': '#A9BA2E',
        '--color-3': '#50BB2D',
        '--color-3-1': '#31BF5E',
        '--color-3-2': '#2EA490',
        '--color-3-3': '#279EB6',
        '--color-4': '#1793F2',
        '--color-4-1': '#3A76EC',
        '--color-4-2': '#5A52EB',
        '--color-4-3': '#734DCF',
        '--color-5': '#884CA9',
        '--color-5-1': '#B64594',
        '--color-5-2': '#D3468D',
        '--color-5-3': '#EB3E7C',
        '--bs-secondary': 'var(--bs-gray-600)',
        '--bs-body-bg': 'var(--bs-gray-300)',
        '--bs-border-color': 'var(--bs-gray-500)',
        '--bs-border-color-light': 'var(--bs-gray-400)',
        '--bs-border-color-disabled': 'var(--bs-border-color-light)',
        '--text-color': 'var(--bs-gray-800)',
        '--text-muted-color': 'var(--bs-gray-700)',
        '--text-emphasis': 'var(--bs-gray-900)',
        '--text-emphasis-color': 'var(--bs-gray-900)',
        '--base-text-color': 'var(--bs-gray-900)',
        '--base-text-muted-color': 'var(--bs-gray-800)',
        '--base-text-emphasis-color': 'var(--bs-black)',
        '--panel-header-bg': 'var(--bs-gray-100)',
        '--panel-bg-1': 'var(--bs-gray-200)',
        '--panel-bg-2': 'var(--bs-gray-300)',
        '--panel-bg-3': 'var(--bs-gray-400)',
        '--base-panel-header-bg': 'var(--panel-header-bg)',
        '--base-panel-bg-1': 'var(--bs-gray-100)',
        '--base-panel-bg-2': 'var(--bs-gray-200)',
        '--base-panel-bg-3': 'var(--panel-bg-3)',
        '--well-bg': 'var(--bs-gray-300)',
        '--base-well-bg': 'var(--bs-body-bg)',
        '--bs-card-cap-bg': 'var(--panel-header-bg)',
        '--bs-card-bg': 'var(--panel-bg-1)'
    },
  }
  export const ThemeProvider = ({ theme, children }) => {
    useEffect(() => {
        for (let key in themes['default']) {
          document.documentElement.style.removeProperty(key);
        }
        const themeVariables = themes[theme];
        for (let key in themeVariables) {
          document.documentElement.style.setProperty(key, themeVariables[key]);
        }
      }, [theme]);
    return <>{children}</>;
  };
