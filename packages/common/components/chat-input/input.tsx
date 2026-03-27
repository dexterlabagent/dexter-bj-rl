'use client';
import { useAuth } from '@repo/common/context';
import {
    ImageAttachment,
    ImageDropzoneRoot,
    MessagesRemainingBadge,
} from '@repo/common/components';
import { useImageAttachment } from '@repo/common/hooks';
import { ChatModeConfig } from '@repo/shared/config';
import { Button, cn, Flex, Tooltip } from '@repo/ui';
import { IconFileText, IconX } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams, usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAgentStream } from '../../hooks/agent-provider';
import { useChatEditor } from '../../hooks/use-editor';
import { useDocumentAttachment } from '../../hooks/use-document-attachment';
import { useChatStore } from '../../store';
import { ExamplePrompts } from '../exmaple-prompts';
import { ChatModeButton, GeneratingStatus, SendStopButton, WebSearchButton } from './chat-actions';
import { ChatEditor } from './chat-editor';
import { ImageUpload } from './image-upload';

export const ChatInput = ({
    showGreeting = true,
    showBottomBar = true,
    isFollowUp = false,
}: {
    showGreeting?: boolean;
    showBottomBar?: boolean;
    isFollowUp?: boolean;
}) => {
    const { isSignedIn } = useAuth();

    const { threadId: currentThreadId } = useParams();
    const { editor } = useChatEditor({
        placeholder: isFollowUp ? 'Ask follow up' : 'Ask anything',
        onInit: ({ editor }) => {
            if (typeof window !== 'undefined' && !isFollowUp) {
                const draftMessage = window.localStorage.getItem('draft-message');
                if (draftMessage) {
                    editor.commands.setContent(draftMessage, true, { preserveWhitespace: true });
                }
            }
        },
        onUpdate: ({ editor }) => {
            if (typeof window !== 'undefined' && !isFollowUp) {
                window.localStorage.setItem('draft-message', editor.getText());
            }
        },
    });
    const size = currentThreadId ? 'base' : 'sm';
    const getThreadItems = useChatStore(state => state.getThreadItems);
    const threadItemsLength = useChatStore(useShallow(state => state.threadItems.length));
    const { handleSubmit } = useAgentStream();
    const createThread = useChatStore(state => state.createThread);
    const useWebSearch = useChatStore(state => state.useWebSearch);
    const isGenerating = useChatStore(state => state.isGenerating);
    const isChatPage = usePathname().startsWith('/chat');
    const imageAttachment = useChatStore(state => state.imageAttachment);
    const clearImageAttachment = useChatStore(state => state.clearImageAttachment);
    const stopGeneration = useChatStore(state => state.stopGeneration);
    const hasTextInput = !!editor?.getText();
    const { dropzonProps, handleImageUpload } = useImageAttachment();
    const { documentContext, handleDocumentUpload, clearDocumentContext } = useDocumentAttachment();
    const activeCharacter = useChatStore(state => state.activeCharacter);
    const setActiveCharacter = useChatStore(state => state.setActiveCharacter);
    const { push } = useRouter();
    const chatMode = useChatStore(state => state.chatMode);
    const sendMessage = async () => {
        if (
            !isSignedIn &&
            !!ChatModeConfig[chatMode as keyof typeof ChatModeConfig]?.isAuthRequired
        ) {
            push('/sign-in');
            return;
        }

        if (!editor?.getText()) {
            return;
        }

        let threadId = currentThreadId?.toString();

        if (!threadId) {
            const optimisticId = crypto.randomUUID();
            push(`/chat/${optimisticId}`);
            createThread(optimisticId, {
                title: editor?.getText(),
            });
            threadId = optimisticId;
        }

        // First submit the message
        const formData = new FormData();
        formData.append('query', editor.getText());
        imageAttachment?.base64 && formData.append('imageAttachment', imageAttachment?.base64);
        const threadItems = currentThreadId ? await getThreadItems(currentThreadId.toString()) : [];

        console.log('threadItems', threadItems);

        handleSubmit({
            formData,
            newThreadId: threadId,
            messages: threadItems.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            ),
            useWebSearch,
        });
        window.localStorage.removeItem('draft-message');
        editor.commands.clearContent();
        clearImageAttachment();
        clearDocumentContext();
    };

    const renderChatInput = () => (
        <AnimatePresence>
            <motion.div
                className="w-full px-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={`chat-input`}
                transition={{ duration: 0.2, ease: 'easeOut' }}
            >
                <Flex
                    direction="col"
                    className={cn(
                        'bg-background border-border/60 shadow-subtle-sm relative z-10 w-full rounded-2xl border'
                    )}
                >
                    <ImageDropzoneRoot dropzoneProps={dropzonProps}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.15 }}
                            className="flex w-full flex-shrink-0 overflow-hidden rounded-lg"
                        >
                            {editor?.isEditable ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    className="w-full"
                                >
                                    {activeCharacter && (
                                        <div className="border-border/50 mx-3 mt-2 flex items-center gap-2 rounded-lg border bg-violet-50 px-2.5 py-1.5 dark:bg-violet-950/30">
                                            <span className="text-base leading-none">{activeCharacter.emoji}</span>
                                            <span className="text-xs font-medium text-violet-700 dark:text-violet-300 flex-1">
                                                {activeCharacter.name}
                                            </span>
                                            <button
                                                onClick={() => setActiveCharacter(null)}
                                                className="text-violet-400 hover:text-violet-600 shrink-0"
                                            >
                                                <IconX size={12} />
                                            </button>
                                        </div>
                                    )}
                                    <ImageAttachment />
                                    {documentContext && (
                                        <div className="border-border/50 mx-3 mt-2 flex items-center gap-1.5 rounded-md border bg-blue-50 px-2.5 py-1.5 dark:bg-blue-950/30">
                                            <IconFileText size={13} className="text-blue-500 shrink-0" />
                                            <span className="text-xs text-blue-700 dark:text-blue-300 line-clamp-1 flex-1">
                                                {documentContext.fileName}
                                            </span>
                                            <button
                                                onClick={clearDocumentContext}
                                                className="text-blue-400 hover:text-blue-600 shrink-0"
                                            >
                                                <IconX size={12} />
                                            </button>
                                        </div>
                                    )}
                                    <Flex className="flex w-full flex-row items-end gap-0">
                                        <ChatEditor
                                            sendMessage={sendMessage}
                                            editor={editor}
                                            className="px-3 pt-3"
                                        />
                                    </Flex>

                                    <Flex
                                        className="border-border/50 w-full gap-0 border-t px-2 py-2"
                                        gap="none"
                                        items="center"
                                        justify="between"
                                    >
                                        {isGenerating && !isChatPage ? (
                                            <GeneratingStatus />
                                        ) : (
                                            <Flex gap="xs" items="center" className="shrink-0">
                                                <ChatModeButton />
                                                {/* <AttachmentButton /> */}
                                                <WebSearchButton />
                                                {/* <ToolsMenu /> */}
                                                <ImageUpload
                                                    id="image-attachment"
                                                    label="Image"
                                                    tooltip="Image Attachment"
                                                    showIcon={true}
                                                    handleImageUpload={handleImageUpload}
                                                />
                                                <Tooltip content="Attach PDF">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        onClick={() =>
                                                            document
                                                                .getElementById('pdf-attachment')
                                                                ?.click()
                                                        }
                                                    >
                                                        <IconFileText size={16} strokeWidth={2} />
                                                    </Button>
                                                </Tooltip>
                                                <input
                                                    type="file"
                                                    id="pdf-attachment"
                                                    accept="application/pdf"
                                                    className="hidden"
                                                    onChange={handleDocumentUpload}
                                                />
                                            </Flex>
                                        )}

                                        <Flex gap="md" items="center">
                                            <SendStopButton
                                                isGenerating={isGenerating}
                                                isChatPage={isChatPage}
                                                stopGeneration={stopGeneration}
                                                hasTextInput={hasTextInput}
                                                sendMessage={sendMessage}
                                            />
                                        </Flex>
                                    </Flex>
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="flex h-24 w-full items-center justify-center"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div className="animate-pulse">Loading editor...</div>
                                </motion.div>
                            )}
                        </motion.div>
                    </ImageDropzoneRoot>
                </Flex>
            </motion.div>
            <MessagesRemainingBadge key="remaining-messages" />
        </AnimatePresence>
    );

    const renderChatBottom = () => (
        <>
            <Flex items="center" justify="center" gap="sm">
                {/* <ScrollToBottomButton /> */}
            </Flex>
            {renderChatInput()}
        </>
    );

    useEffect(() => {
        editor?.commands.focus('end');
    }, [currentThreadId]);

    return (
        <div
            className={cn(
                'w-full',
                currentThreadId
                    ? 'absolute bottom-0'
                    : ' absolute inset-0 flex h-full w-full flex-col items-center justify-center'
            )}
        >
            {currentThreadId && (
                <div className=" pointer-events-none h-12 w-full" />
            )}
            <div
                className={cn(
                    'mx-auto flex w-full max-w-3xl flex-col items-start',
                    currentThreadId && 'bg-secondary',
                    !threadItemsLength && 'justify-start',
                    size === 'sm' && 'px-4 md:px-8'
                )}
            >
                <Flex
                    items="start"
                    justify="start"
                    direction="col"
                    className={cn('w-full pb-4', threadItemsLength > 0 ? 'mb-0' : 'h-full')}
                >
                    {!currentThreadId && showGreeting && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="mb-4 flex w-full flex-col items-center gap-1"
                        >
                            <AnimatedTitles />
                        </motion.div>
                    )}

                    {renderChatBottom()}
                    {!currentThreadId && showGreeting && <ExamplePrompts />}

                    {/* <ChatFooter /> */}
                </Flex>
            </div>
        </div>
    );
};

type AnimatedTitlesProps = {
    titles?: string[];
};

const AnimatedTitles = ({ titles = [] }: AnimatedTitlesProps) => {
    const [greeting, setGreeting] = React.useState<string>('');

    React.useEffect(() => {
        const getTimeBasedGreeting = () => {
            const hour = new Date().getHours();

            if (hour >= 5 && hour < 12) {
                return 'Good morning';
            } else if (hour >= 12 && hour < 18) {
                return 'Good afternoon';
            } else {
                return 'Good evening';
            }
        };

        setGreeting(getTimeBasedGreeting());

        // Update the greeting if the component is mounted during a time transition
        const interval = setInterval(() => {
            const newGreeting = getTimeBasedGreeting();
            if (newGreeting !== greeting) {
                setGreeting(newGreeting);
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [greeting]);

    return (
        <Flex
            direction="col"
            className="relative h-[60px] w-full items-center justify-center overflow-hidden"
        >
            <AnimatePresence mode="wait">
                <motion.h1
                    key={greeting}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{
                        duration: 0.8,
                        ease: 'easeInOut',
                    }}
                    className="text-foreground/50 text-center text-[32px] font-semibold tracking-tight"
                >
                    {greeting}
                </motion.h1>
            </AnimatePresence>
        </Flex>
    );
};
