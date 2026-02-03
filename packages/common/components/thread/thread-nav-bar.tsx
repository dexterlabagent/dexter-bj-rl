import { useChatStore } from '@repo/common/store';
import { Thread, ThreadItem } from '@repo/shared/types';
import { Button, Tooltip } from '@repo/ui';
import { IconDownload } from '@tabler/icons-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';


const formatThreadAsMarkdown = (thread: Thread, items: ThreadItem[]): string => {
    const lines: string[] = [];
    lines.push(`# ${thread.title || 'Conversation'}`);
    lines.push('');
    lines.push(`*Exported from llmchat on ${new Date().toLocaleDateString()}*`);
    lines.push('');

    const sorted = [...items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const item of sorted) {
        if (item.query) {
            lines.push(`**You:** ${item.query}`);
            lines.push('');
        }
        if (item.answer?.text) {
            lines.push(`**Assistant:** ${item.answer.text}`);
            lines.push('');
        }
        if (item.sources && item.sources.length > 0) {
            lines.push('**Sources:**');
            item.sources.forEach((src, i) => {
                lines.push(`${i + 1}. [${src.title}](${src.link})`);
            });
            lines.push('');
        }
        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
};

export const ThreadNavBar = () => {
    const { threadId: currentThreadId } = useParams();
    const getThread = useChatStore(useShallow(state => state.getThread));
    const getThreadItems = useChatStore(state => state.getThreadItems);
    const activeCharacter = useChatStore(state => state.activeCharacter);
    const [thread, setThread] = useState<Thread | null>(null);

    useEffect(() => {
        getThread(currentThreadId?.toString() ?? '').then(setThread);
    }, [currentThreadId]);

    const handleExport = async () => {
        if (!currentThreadId || !thread) return;
        const items = await getThreadItems(currentThreadId.toString());
        const markdown = formatThreadAsMarkdown(thread, items);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(thread.title || 'conversation').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="border-border bg-secondary absolute left-0 right-0 top-0 z-[100] flex h-10 w-full flex-row items-center justify-between border-b px-4">
            <div className="w-8" />
            <div className="flex flex-col items-center">
                {activeCharacter && (
                    <div className="flex items-center gap-1 text-xs text-violet-500 dark:text-violet-400 font-medium leading-none mb-0.5">
                        <span>{activeCharacter.emoji}</span>
                        <span>{activeCharacter.name}</span>
                    </div>
                )}
                <p className="line-clamp-1 max-w-[calc(100%-5rem)] sm:max-w-md lg:max-w-xl text-center text-sm font-medium">
                    {thread?.title}
                </p>
            </div>
            <Tooltip content="Export as Markdown">
                <Button variant="ghost" size="icon-sm" onClick={handleExport}>
                    <IconDownload size={15} strokeWidth={2} className="text-muted-foreground" />
                </Button>
            </Tooltip>
        </div>
    );
};
