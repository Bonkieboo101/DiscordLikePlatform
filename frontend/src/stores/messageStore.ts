import create from 'zustand';

type Message = any;

type MessageState = {
  messages: Record<string, Message[]>; // channelId -> messages[] (desc or asc, we'll keep asc)
  currentChannelId: string | null;
  typing: Record<string, any[]>; // channelId -> list of typing users
  setCurrentChannel: (id: string | null) => void;
  setMessages: (channelId: string, msgs: Message[]) => void;
  addMessage: (channelId: string, msg: Message) => void;
  updateMessage: (channelId: string, msg: Message) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setTyping: (channelId: string, users: any[]) => void;
};

export const useMessageStore = create<MessageState>((set) => ({
  messages: {},
  currentChannelId: null,
  typing: {},
  setCurrentChannel: (id) => set({ currentChannelId: id }),
  setMessages: (channelId, msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } })),
  addMessage: (channelId, msg) => set((s) => ({ messages: { ...s.messages, [channelId]: [...(s.messages[channelId] || []), msg] } })),
  updateMessage: (channelId, msg) => set((s) => ({ messages: { ...s.messages, [channelId]: (s.messages[channelId] || []).map((m) => m.id === msg.id ? msg : m) } })),
  removeMessage: (channelId, messageId) => set((s) => ({ messages: { ...s.messages, [channelId]: (s.messages[channelId] || []).filter((m) => m.id !== messageId) } })),
  setTyping: (channelId, users) => set((s) => ({ typing: { ...s.typing, [channelId]: users } }))
}));