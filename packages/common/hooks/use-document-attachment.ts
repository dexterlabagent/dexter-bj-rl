'use client';
import { useChatStore } from '@repo/common/store';
import { useToast } from '@repo/ui';
import { ChangeEvent, useCallback } from 'react';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

export const useDocumentAttachment = () => {
    const setDocumentContext = useChatStore(state => state.setDocumentContext);
    const clearDocumentContext = useChatStore(state => state.clearDocumentContext);
    const documentContext = useChatStore(state => state.documentContext);
    const { toast } = useToast();

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        const textParts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
                .map((item: any) => ('str' in item ? item.str : ''))
                .join(' ');
            textParts.push(pageText);
        }

        return textParts.join('\n\n');
    };

    const handleDocumentUpload = useCallback(
        async (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (file.type !== 'application/pdf') {
                toast({
                    title: 'Invalid format',
                    description: 'Only PDF files are supported.',
                    variant: 'destructive',
                });
                return;
            }

            if (file.size > MAX_PDF_SIZE) {
                toast({
                    title: 'File too large',
                    description: 'PDF size should be less than 10MB.',
                    variant: 'destructive',
                });
                return;
            }

            try {
                toast({ title: 'Reading PDF...', description: file.name });
                const text = await extractTextFromPdf(file);

                if (!text.trim()) {
                    toast({
                        title: 'No text found',
                        description: 'The PDF appears to be empty or image-only.',
                        variant: 'destructive',
                    });
                    return;
                }

                setDocumentContext({ text, fileName: file.name });
                toast({ title: 'PDF loaded', description: `${file.name} is ready to chat with.` });
            } catch (err) {
                console.error('PDF parse error:', err);
                toast({
                    title: 'Failed to read PDF',
                    description: 'Could not extract text from this PDF.',
                    variant: 'destructive',
                });
            }

            // reset input so same file can be re-uploaded
            e.target.value = '';
        },
        [setDocumentContext, toast]
    );

    return { documentContext, handleDocumentUpload, clearDocumentContext };
};
