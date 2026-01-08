export enum ChatMode {
    Pro = 'pro',
    Deep = 'deep',
    O4_Mini = 'o4-mini',
    GPT_4_1 = 'gpt-4.1',
    GPT_4_1_Mini = 'gpt-4.1-mini',
    GPT_4_1_Nano = 'gpt-4.1-nano',
    GPT_4o_Mini = 'gpt-4o-mini',
    LLAMA_4_SCOUT = 'llama-4-scout',
    GEMINI_2_FLASH = 'gemini-flash-2.0',
    GEMINI_2_5_PRO = 'gemini-2.5-pro',
    DEEPSEEK_R1 = 'deepseek-r1',
    CLAUDE_3_5_SONNET = 'claude-3-5-sonnet',
    CLAUDE_3_7_SONNET = 'claude-3-7-sonnet',
    CLAUDE_HAIKU = 'claude-haiku',
    LLAMA_3_3_70B = 'llama-3.3-70b',
}

export const ChatModeConfig: Record<
    ChatMode,
    {
        webSearch: boolean;
        imageUpload: boolean;
        retry: boolean;
        isNew?: boolean;
        isAuthRequired?: boolean;
        requiresApiKey?: boolean;
    }
> = {
    [ChatMode.Deep]: {
        webSearch: false,
        imageUpload: false,
        retry: false,
        isAuthRequired: true,
        requiresApiKey: true,
    },
    [ChatMode.Pro]: {
        webSearch: false,
        imageUpload: false,
        retry: false,
        isAuthRequired: true,
        requiresApiKey: true,
    },
    [ChatMode.GPT_4_1]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isNew: true,
        isAuthRequired: true,
    },
    [ChatMode.GPT_4_1_Mini]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isNew: true,
        isAuthRequired: true,
    },
    [ChatMode.GPT_4_1_Nano]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.LLAMA_4_SCOUT]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.O4_Mini]: {
        webSearch: true,
        imageUpload: false,
        retry: true,
        isNew: true,
        isAuthRequired: true,
    },
    [ChatMode.GPT_4o_Mini]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.CLAUDE_3_5_SONNET]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: true,
    },
    [ChatMode.CLAUDE_3_7_SONNET]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: true,
    },
    [ChatMode.GEMINI_2_FLASH]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.GEMINI_2_5_PRO]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.CLAUDE_HAIKU]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.LLAMA_3_3_70B]: {
        webSearch: true,
        imageUpload: false,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.DEEPSEEK_R1]: {
        webSearch: true,
        imageUpload: false,
        retry: true,
        isAuthRequired: true,
    },
};

export const CHAT_MODE_CREDIT_COSTS = {
    [ChatMode.Deep]: 10,
    [ChatMode.Pro]: 5,
    [ChatMode.LLAMA_4_SCOUT]: 1,
    [ChatMode.GPT_4o_Mini]: 1,
    [ChatMode.GPT_4_1]: 5,
    [ChatMode.GPT_4_1_Mini]: 2,
    [ChatMode.GPT_4_1_Nano]: 1,
    [ChatMode.O4_Mini]: 5,
    [ChatMode.CLAUDE_3_5_SONNET]: 5,
    [ChatMode.CLAUDE_3_7_SONNET]: 5,
    [ChatMode.CLAUDE_HAIKU]: 1,
    [ChatMode.GEMINI_2_FLASH]: 1,
    [ChatMode.GEMINI_2_5_PRO]: 3,
    [ChatMode.DEEPSEEK_R1]: 5,
    [ChatMode.LLAMA_3_3_70B]: 1,
};

export const getChatModeName = (mode: ChatMode) => {
    switch (mode) {
        case ChatMode.Deep:
            return 'Deep Research';
        case ChatMode.Pro:
            return 'Pro Search';
        case ChatMode.GPT_4_1:
            return 'GPT 4.1';
        case ChatMode.GPT_4_1_Mini:
            return 'GPT 4.1 Mini';
        case ChatMode.GPT_4_1_Nano:
            return 'GPT 4.1 Nano';
        case ChatMode.LLAMA_4_SCOUT:
            return 'Llama 4 Scout';
        case ChatMode.GPT_4o_Mini:
            return 'GPT 4o Mini';
        case ChatMode.CLAUDE_3_5_SONNET:
            return 'Claude 3.5 Sonnet';
        case ChatMode.CLAUDE_3_7_SONNET:
            return 'Claude 3.7 Sonnet';
        case ChatMode.O4_Mini:
            return 'O4 Mini';
        case ChatMode.DEEPSEEK_R1:
            return 'DeepSeek R1';
        case ChatMode.GEMINI_2_FLASH:
            return 'Gemini 2 Flash';
        case ChatMode.GEMINI_2_5_PRO:
            return 'Gemini 2.5 Pro';
        case ChatMode.CLAUDE_HAIKU:
            return 'Claude Haiku';
        case ChatMode.LLAMA_3_3_70B:
            return 'Llama 3.3 70B';
    }
};
