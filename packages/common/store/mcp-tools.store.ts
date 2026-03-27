'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type McpServerConfig = {
    url: string;
    headers?: Record<string, string>;
};

type McpState = {
    mcpConfig: Record<string, McpServerConfig>;
    selectedMCP: string[];
};

type McpActions = {
    setMcpConfig: (mcpConfig: Record<string, McpServerConfig>) => void;
    addMcpConfig: (name: string, config: McpServerConfig) => void;
    removeMcpConfig: (key: string) => void;
    getMcpConfig: () => Record<string, McpServerConfig>;
    getSelectedMCP: () => Record<string, McpServerConfig>;
    updateSelectedMCP: (updater: (prev: string[]) => string[]) => void;
};

export const useMcpToolsStore = create<McpState & McpActions>()(
    persist(
        immer((set, get) => ({
            mcpConfig: {},
            selectedMCP: [],
            getSelectedMCP: () => {
                const selectedMCP = get().selectedMCP;
                const mcpConfig = get().mcpConfig;
                return selectedMCP.reduce(
                    (acc, mcp) => {
                        if (mcpConfig[mcp]) {
                            acc[mcp] = mcpConfig[mcp];
                        }
                        return acc;
                    },
                    {} as Record<string, McpServerConfig>
                );
            },

            updateSelectedMCP: (updater: (prev: string[]) => string[]) => {
                set(state => {
                    state.selectedMCP = updater(state.selectedMCP);
                });
            },

            setMcpConfig: (mcpConfig: Record<string, McpServerConfig>) => {
                set(state => {
                    state.mcpConfig = mcpConfig;
                });
            },

            addMcpConfig: (name: string, config: McpServerConfig) => {
                set(state => {
                    state.mcpConfig[name] = config;
                });
            },

            removeMcpConfig: (key: string) => {
                set(state => {
                    const newMcpConfig = { ...state.mcpConfig };
                    delete newMcpConfig[key];
                    state.mcpConfig = newMcpConfig;
                });
            },

            getMcpConfig: () => {
                return get().mcpConfig;
            },
        })),
        {
            name: 'mcp-tools-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
