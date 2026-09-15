/**
 * Chat history formatting utilities
 */
type ChatHistoryMessage = {
    content?: unknown;
    role?: string;
    type?: string;
};
export declare const formatChatHistoryAsString: (history: ChatHistoryMessage[]) => string;
export {};
