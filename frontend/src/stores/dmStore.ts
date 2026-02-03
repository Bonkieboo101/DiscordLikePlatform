import create from 'zustand';

type Message = any;

type DMState = {
  messages: Record<string, Message[]>; // conversationId -> messages[]
  currentConversationId: string | null;
  setCurrentConversation: (id: string | null) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;
  addMessage: (conversationId: string, msg: Message) => void;
  updateMessage: (conversationId: string, msg: Message) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
};

export const useDMStore = create<DMState>((set) => ({
  messages: {},
  currentConversationId: null,
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setMessages: (conversationId, msgs) => set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),
  addMessage: (conversationId, msg) => set((s) => ({ messages: { ...s.messages, [conversationId]: [...(s.messages[conversationId] || []), msg] } })),
  updateMessage: (conversationId, msg) => set((s) => ({ messages: { ...s.messages, [conversationId]: (s.messages[conversationId] || []).map((m) => m.id === msg.id ? msg : m) } })),
  removeMessage: (conversationId, messageId) => set((s) => ({ messages: { ...s.messages, [conversationId]: (s.messages[conversationId] || []).filter((m) => m.id !== messageId) } })),
}));
