'use client';
import { useMcpToolsStore } from '@repo/common/store';
import { Alert, AlertDescription, DialogFooter } from '@repo/ui';
import { Button } from '@repo/ui/src/components/button';
import {
    IconBolt,
    IconBoltFilled,
    IconCode,
    IconKey,
    IconSettings2,
    IconTools,
    IconTrash,
} from '@tabler/icons-react';

import { Badge, Dialog, DialogContent, Input } from '@repo/ui';

import { useChatEditor } from '@repo/common/hooks';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { ApiKeys, useApiKeysStore } from '../store/api-keys.store';
import { SETTING_TABS, useAppStore } from '../store/app.store';
import { useChatStore } from '../store/chat.store';
import { ChatEditor } from './chat-input';
import { BYOKIcon, ToolIcon } from './icons';

export const SettingsModal = () => {
    const isSettingOpen = useAppStore(state => state.isSettingsOpen);
    const setIsSettingOpen = useAppStore(state => state.setIsSettingsOpen);
    const settingTab = useAppStore(state => state.settingTab);
    const setSettingTab = useAppStore(state => state.setSettingTab);

    const settingMenu = [
        {
            icon: <IconSettings2 size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'Customize',
            key: SETTING_TABS.PERSONALIZATION,
            component: <PersonalizationSettings />,
        },
        {
            icon: <IconBolt size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'Usage',
            key: SETTING_TABS.CREDITS,
            component: <CreditsSettings />,
        },
        {
            icon: <IconKey size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'API Keys',
            key: SETTING_TABS.API_KEYS,
            component: <ApiKeySettings />,
        },
        {
            icon: <IconCode size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'API',
            key: SETTING_TABS.DEVELOPER_API,
            component: <DeveloperApiSettings />,
        },
        {
            icon: <IconTools size={16} strokeWidth={2} className="text-muted-foreground" />,
            title: 'MCP Tools',
            key: SETTING_TABS.MCP_TOOLS,
            component: <MCPSettings />,
        },
    ];

    return (
        <Dialog open={isSettingOpen} onOpenChange={() => setIsSettingOpen(false)}>
            <DialogContent
                ariaTitle="Settings"
                className="h-full max-h-[90vh] md:max-h-[600px] w-full max-w-[95vw] md:!max-w-[760px] overflow-x-hidden rounded-xl p-0"
            >
                <div className="no-scrollbar relative max-w-full overflow-y-auto overflow-x-hidden">
                    <h3 className="border-border mx-5 border-b py-4 text-lg font-bold">Settings</h3>
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6 p-4">
                        <div className="flex md:w-[160px] flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible shrink-0">
                            {settingMenu.map(setting => (
                                <Button
                                    key={setting.key}
                                    rounded="full"
                                    className="justify-start"
                                    variant={settingTab === setting.key ? 'secondary' : 'ghost'}
                                    onClick={() => setSettingTab(setting.key)}
                                >
                                    {setting.icon}
                                    {setting.title}
                                </Button>
                            ))}
                        </div>
                        <div className="flex flex-1 flex-col overflow-hidden px-4">
                            {settingMenu.find(setting => setting.key === settingTab)?.component}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export const MCPSettings = () => {
    const [isAddToolDialogOpen, setIsAddToolDialogOpen] = useState(false);
    const { mcpConfig, addMcpConfig, removeMcpConfig, updateSelectedMCP, selectedMCP } =
        useMcpToolsStore();

    return (
        <div className="flex w-full flex-col gap-6 overflow-x-hidden">
            <div className="flex flex-col">
                <h2 className="flex items-center gap-1 text-base font-medium">MCP Tools</h2>
                <p className="text-muted-foreground text-xs">
                    Connect your MCP tools. This will only work with your own API keys.
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium">
                    Connected Tools{' '}
                    <Badge
                        variant="secondary"
                        className="text-brand inline-flex items-center gap-1 rounded-full bg-transparent"
                    >
                        <span className="bg-brand inline-block size-2 rounded-full"></span>
                        {mcpConfig && Object.keys(mcpConfig).length} Connected
                    </Badge>
                </p>
                {mcpConfig &&
                    Object.keys(mcpConfig).length > 0 &&
                    Object.keys(mcpConfig).map(key => (
                        <div
                            key={key}
                            className="bg-secondary divide-border border-border flex h-12 w-full flex-1 flex-row items-center gap-2 divide-x-2 rounded-lg border px-2.5 py-2"
                        >
                            <div className="flex w-full flex-row items-center gap-2">
                                <ToolIcon /> <Badge>{key}</Badge>
                                <p className="text-muted-foreground line-clamp-1 flex-1 text-sm">
                                    {mcpConfig[key]?.url}
                                </p>
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    tooltip="Delete Tool"
                                    onClick={() => {
                                        removeMcpConfig(key);
                                    }}
                                >
                                    <IconTrash
                                        size={14}
                                        strokeWidth={2}
                                        className="text-muted-foreground"
                                    />
                                </Button>
                            </div>
                        </div>
                    ))}

                <Button
                    size="sm"
                    rounded="full"
                    className="mt-2 self-start"
                    onClick={() => setIsAddToolDialogOpen(true)}
                >
                    Add Tool
                </Button>
            </div>

            <div className="mt-6 border-t border-dashed pt-6">
                <p className="text-muted-foreground text-xs">Learn more about MCP:</p>
                <div className="mt-2 flex flex-col gap-2 text-sm">
                    <a
                        href="https://mcp.composio.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center hover:underline"
                    >
                        Browse Composio MCP Directory →
                    </a>
                    <a
                        href="https://www.anthropic.com/news/model-context-protocol"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center hover:underline"
                    >
                        Read MCP Documentation →
                    </a>
                </div>
            </div>

            <AddToolDialog
                isOpen={isAddToolDialogOpen}
                onOpenChange={setIsAddToolDialogOpen}
                onAddTool={(name, config) => addMcpConfig(name, config)}
            />
        </div>
    );
};

type AddToolDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAddTool: (name: string, config: { url: string; headers?: Record<string, string> }) => void;
};

const AddToolDialog = ({ isOpen, onOpenChange, onAddTool }: AddToolDialogProps) => {
    const [mcpToolName, setMcpToolName] = useState('');
    const [mcpToolUrl, setMcpToolUrl] = useState('');
    const [mcpHeaders, setMcpHeaders] = useState<{ key: string; value: string }[]>([]);
    const [error, setError] = useState('');
    const { mcpConfig } = useMcpToolsStore();

    const handleAddTool = () => {
        if (!mcpToolName.trim()) {
            setError('Tool name is required');
            return;
        }

        if (!mcpToolUrl.trim()) {
            setError('Tool URL is required');
            return;
        }

        if (mcpConfig && mcpConfig[mcpToolName]) {
            setError('A tool with this name already exists');
            return;
        }

        setError('');

        const headers = mcpHeaders.reduce(
            (acc, h) => {
                if (h.key.trim() && h.value.trim()) {
                    acc[h.key.trim()] = h.value.trim();
                }
                return acc;
            },
            {} as Record<string, string>
        );

        onAddTool(mcpToolName, {
            url: mcpToolUrl,
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
        });

        setMcpToolName('');
        setMcpToolUrl('');
        setMcpHeaders([]);
        onOpenChange(false);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setError('');
            setMcpToolName('');
            setMcpToolUrl('');
            setMcpHeaders([]);
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent ariaTitle="Add MCP Tool" className="!max-w-md">
                <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold">Add New MCP Tool</h3>

                    {error && <p className="text-destructive text-sm font-medium">{error}</p>}

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Tool Name</label>
                        <Input
                            placeholder="Tool Name"
                            value={mcpToolName}
                            onChange={e => {
                                const key = e.target.value?.trim().toLowerCase().replace(/ /g, '-');
                                setMcpToolName(key);
                                if (error) setError('');
                            }}
                        />
                        <p className="text-muted-foreground text-xs">
                            Will be automatically converted to lowercase with hyphens
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Tool Server URL</label>
                        <Input
                            placeholder="https://your-mcp-server.com"
                            value={mcpToolUrl}
                            onChange={e => {
                                setMcpToolUrl(e.target.value);
                                if (error) setError('');
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">Headers</label>
                            <Button
                                size="xs"
                                variant="ghost"
                                rounded="full"
                                onClick={() =>
                                    setMcpHeaders(prev => [...prev, { key: '', value: '' }])
                                }
                            >
                                + Add Header
                            </Button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Add authentication headers if the MCP server requires an API key.
                        </p>
                        {mcpHeaders.map((header, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    placeholder="Header name"
                                    value={header.key}
                                    className="flex-1"
                                    onChange={e => {
                                        const updated = [...mcpHeaders];
                                        updated[index] = { ...updated[index], key: e.target.value };
                                        setMcpHeaders(updated);
                                    }}
                                />
                                <Input
                                    placeholder="Value"
                                    value={header.value}
                                    className="flex-1"
                                    type="password"
                                    onChange={e => {
                                        const updated = [...mcpHeaders];
                                        updated[index] = {
                                            ...updated[index],
                                            value: e.target.value,
                                        };
                                        setMcpHeaders(updated);
                                    }}
                                />
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => {
                                        setMcpHeaders(prev => prev.filter((_, i) => i !== index));
                                    }}
                                >
                                    <IconTrash
                                        size={14}
                                        strokeWidth={2}
                                        className="text-muted-foreground"
                                    />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter className="border-border mt-4 border-t pt-4">
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="bordered"
                            rounded={'full'}
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddTool} rounded="full">
                            Add Tool
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const ApiKeySettings = () => {
    const apiKeys = useApiKeysStore(state => state.getAllKeys());
    const setApiKey = useApiKeysStore(state => state.setKey);
    const [isEditing, setIsEditing] = useState<string | null>(null);

    const apiKeyList = [
        {
            name: 'OpenAI',
            key: 'OPENAI_API_KEY' as keyof ApiKeys,
            value: apiKeys.OPENAI_API_KEY,
            url: 'https://platform.openai.com/api-keys',
        },
        {
            name: 'Anthropic',
            key: 'ANTHROPIC_API_KEY' as keyof ApiKeys,
            value: apiKeys.ANTHROPIC_API_KEY,
            url: 'https://console.anthropic.com/settings/keys',
        },
        {
            name: 'Google Gemini',
            key: 'GEMINI_API_KEY' as keyof ApiKeys,
            value: apiKeys.GEMINI_API_KEY,
            url: 'https://ai.google.dev/api',
        },
    ];

    const validateApiKey = (apiKey: string, provider: string) => {
        // Validation logic will be implemented later
        console.log(`Validating ${provider} API key: ${apiKey}`);
        return true;
    };

    const handleSave = (keyName: keyof ApiKeys, value: string) => {
        setApiKey(keyName, value);
        setIsEditing(null);
    };

    const getMaskedKey = (key: string) => {
        if (!key) return '';
        return '****************' + key.slice(-4);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col">
                <h2 className="flex items-center gap-1 text-base font-semibold">
                    API Keys <BYOKIcon />
                </h2>

                <p className="text-muted-foreground text-xs">
                    By default, your API Key is stored locally on your browser and never sent
                    anywhere else.
                </p>
            </div>

            {apiKeyList.map(apiKey => (
                <div key={apiKey.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{apiKey.name} API Key:</span>
                        <a
                            href={apiKey.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 underline-offset-2 hover:underline"
                        >
                            (Get API key here)
                        </a>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEditing === apiKey.key ? (
                            <>
                                <div className="flex-1">
                                    <Input
                                        value={apiKey.value || ''}
                                        placeholder={`Enter ${apiKey.name} API key`}
                                        onChange={e => setApiKey(apiKey.key, e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleSave(apiKey.key, apiKey.value || '')}
                                >
                                    <span className="flex items-center gap-1">✓ Save</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-1 items-center gap-2 rounded-md border px-3 py-1.5">
                                    {apiKey.value ? (
                                        <span className="flex-1">{getMaskedKey(apiKey.value)}</span>
                                    ) : (
                                        <span className="text-muted-foreground flex-1 text-sm">
                                            No API key set
                                        </span>
                                    )}
                                </div>
                                <Button
                                    variant={'bordered'}
                                    size="sm"
                                    onClick={() => setIsEditing(apiKey.key)}
                                >
                                    {apiKey.value ? 'Change Key' : 'Add Key'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export const CreditsSettings = () => {
    const remainingCredits = useChatStore(state => state.creditLimit.remaining);
    const maxLimit = useChatStore(state => state.creditLimit.maxLimit);
    const resetDate = useChatStore(state => state.creditLimit.reset);

    const info = [
        {
            title: 'Plan',
            value: (
                <Badge variant="secondary" className="bg-brand/10 text-brand rounded-full">
                    <span className="text-xs font-medium">FREE</span>
                </Badge>
            ),
        },
        {
            title: 'Credits',
            value: (
                <div className="flex h-7 flex-row items-center gap-1 rounded-full py-1">
                    <IconBoltFilled size={14} strokeWidth={2} className="text-brand" />
                    <span className="text-brand text-sm font-medium">{remainingCredits}</span>
                    <span className="text-brand text-sm opacity-50">/</span>
                    <span className="text-brand text-sm opacity-50">{maxLimit}</span>
                </div>
            ),
        },
        {
            title: 'Next reset',
            value: moment(resetDate).fromNow(),
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col items-start gap-2">
                <h2 className="flex items-center gap-1 text-base font-medium">Usage Credits</h2>
                <Alert variant="info" className="w-full">
                    <AlertDescription className="text-muted-foreground/70 text-sm leading-tight">
                        You'll recieve some free credits everyday. Once credits are used, you can
                        use your own API keys to continue.
                    </AlertDescription>
                </Alert>

                <div className="divide-border flex w-full flex-col gap-1 divide-y">
                    {info.map(item => (
                        <div key={item.title} className="flex flex-row justify-between gap-1 py-4">
                            <span className="text-muted-foreground text-sm">{item.title}</span>
                            <span className="text-sm font-medium">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MAX_CHAR_LIMIT = 6000;

const PERSONA_PRESETS = [
    {
        label: 'Coding Assistant',
        instructions:
            'You are an expert software engineer. Provide concise, correct code with brief explanations. Prefer idiomatic patterns, point out edge cases, and suggest improvements when relevant.',
    },
    {
        label: 'Research Analyst',
        instructions:
            'You are a thorough research analyst. Break down complex topics, cite key sources when possible, and present findings in a structured way with clear takeaways.',
    },
    {
        label: 'Writing Coach',
        instructions:
            'You are a skilled writing coach. Help improve clarity, flow, and tone. Offer specific edits and explain why each change strengthens the writing.',
    },
    {
        label: 'Tutor',
        instructions:
            'You are a patient tutor. Explain concepts from first principles using simple language and concrete examples. Check for understanding and adapt to the learner\'s level.',
    },
    {
        label: 'Business Analyst',
        instructions:
            'You are an experienced business analyst. Focus on actionable insights, frameworks, and trade-offs. Keep responses structured and decision-oriented.',
    },
    {
        label: 'Creative Writer',
        instructions:
            'You are a creative writer with a vivid imagination. Lean into storytelling, use evocative language, and explore unexpected angles. Be expressive and inventive.',
    },
    {
        label: 'Concise',
        instructions:
            'Be extremely concise. Respond in as few words as possible. No filler, no preamble, no summaries. Get straight to the point.',
    },
    {
        label: 'Socratic',
        instructions:
            'Guide me with questions rather than giving direct answers. Help me think through problems by asking probing questions that surface my own reasoning.',
    },
];

export const PersonalizationSettings = () => {
    const customInstructions = useChatStore(state => state.customInstructions);
    const setCustomInstructions = useChatStore(state => state.setCustomInstructions);
    const { editor } = useChatEditor({
        charLimit: MAX_CHAR_LIMIT,
        defaultContent: customInstructions,
        placeholder: 'Enter your custom instructions',
        enableEnter: true,
        onUpdate(props) {
            setCustomInstructions(props.editor.getText());
        },
    });

    const applyPreset = (instructions: string) => {
        setCustomInstructions(instructions);
        editor?.commands.setContent(instructions, true, { preserveWhitespace: true });
    };

    return (
        <div className="flex flex-col gap-3 pb-3">
            <div>
                <h3 className="text-base font-semibold">Customize your AI Response</h3>
                <p className="text-muted-foreground text-sm">
                    These instructions will be added to the beginning of every message.
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium">Presets</p>
                <div className="flex flex-wrap gap-1.5">
                    {PERSONA_PRESETS.map(preset => (
                        <Button
                            key={preset.label}
                            variant="bordered"
                            size="xs"
                            rounded="full"
                            onClick={() => applyPreset(preset.instructions)}
                        >
                            {preset.label}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="shadow-subtle-sm border-border rounded-lg border p-3">
                <ChatEditor editor={editor} />
            </div>
        </div>
    );
};

export const DeveloperApiSettings = () => {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [hasKey, setHasKey] = useState(false);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/keys');
            if (res.ok) {
                const data = await res.json();
                setHasKey(data.hasKey);
                if (data.maskedKey) setMaskedKey(data.maskedKey);
            }
        } catch {
            // ignore
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const generateKey = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/keys', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setApiKey(data.apiKey);
                setHasKey(true);
                setMaskedKey(null);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const revokeKey = async () => {
        setIsLoading(true);
        try {
            await fetch('/api/v1/keys', { method: 'DELETE' });
            setHasKey(false);
            setApiKey(null);
            setMaskedKey(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-3">
            <div>
                <h2 className="text-base font-semibold">Developer API</h2>
                <p className="text-muted-foreground text-xs">
                    Use llmchat as a backend for your own apps. Your daily credits apply.{' '}
                    <a href="/docs" target="_blank" className="text-primary hover:underline">
                        View API docs →
                    </a>
                </p>
            </div>

            {apiKey ? (
                <Alert variant="info">
                    <AlertDescription className="flex flex-col gap-2">
                        <p className="text-xs font-medium">
                            Your API key (copy it now   it won't be shown again):
                        </p>
                        <code className="bg-background rounded px-2 py-1.5 text-xs break-all select-all">
                            {apiKey}
                        </code>
                        <Button
                            size="xs"
                            variant="ghost"
                            className="self-start"
                            onClick={() => navigator.clipboard.writeText(apiKey)}
                        >
                            Copy
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : hasKey ? (
                <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground text-xs font-medium">Current key</p>
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                        <code className="flex-1 text-xs">{maskedKey ?? '••••••••••••••••'}</code>
                    </div>
                </div>
            ) : null}

            <div className="flex gap-2">
                <Button
                    size="sm"
                    rounded="full"
                    onClick={generateKey}
                    disabled={isLoading}
                >
                    {hasKey ? 'Regenerate Key' : 'Generate API Key'}
                </Button>
                {hasKey && (
                    <Button
                        size="sm"
                        rounded="full"
                        variant="bordered"
                        onClick={revokeKey}
                        disabled={isLoading}
                    >
                        Revoke Key
                    </Button>
                )}
            </div>

            <div className="border-t border-dashed pt-4">
                <p className="text-muted-foreground text-xs font-medium mb-2">Quick example</p>
                <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
                    {`curl -X POST https://delph.tech/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gemini-flash-2.5","messages":[{"role":"user","content":"Hello!"}]}'`}
                </pre>
            </div>
        </div>
    );
};
