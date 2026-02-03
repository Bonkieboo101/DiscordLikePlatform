import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useMessageStore } from '../stores/messageStore';
import { useDMStore } from '../stores/dmStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { queryClient } from './queryClient';
import toast from 'react-hot-toast';

let socket: Socket | null = null;

export function initSocket() {
  if (socket) return socket;
  const token = localStorage.getItem('token');
  socket = io((import.meta.env.VITE_API_URL || 'http://localhost:4000'), { auth: { token } });

  socket.on('connect', () => {
    console.log('socket connected', socket?.id);
  });

  socket.on('connected', (data) => {
    console.log('connected payload', data);
  });

  socket.on('messageCreated', (msg:any) => {
    if (msg.channelId) {
      useMessageStore.getState().addMessage(msg.channelId, msg);
      const current = useMessageStore.getState().currentChannelId;
      // if tab not active or different channel, and message mentions me, show toast
      const me = useAuthStore.getState().user;
      const isMention = msg.mentions?.some((m:any)=>m.user?.id === me?.id) || false;
      if ((document.hidden || current !== msg.channelId) && isMention) {
        toast(`Mentioned in #${msg.channelId} by ${msg.author?.name || msg.author?.email}`);
      }
    } else if (msg.conversationId) {
      useDMStore.getState().addMessage(msg.conversationId, msg);
      const current = useDMStore.getState().currentConversationId;
      const me = useAuthStore.getState().user;
      if ((document.hidden || current !== msg.conversationId)) {
        // show toast for new DM
        toast(`New message from ${msg.author?.name || msg.author?.email}`);
      }
    }
  });

  socket.on('messageUpdated', (msg) => {
    if (msg.channelId) useMessageStore.getState().updateMessage(msg.channelId, msg);
    else if (msg.conversationId) useDMStore.getState().updateMessage(msg.conversationId, msg);
  });

  socket.on('messageDeleted', (payload) => {
    const { id, channelId, conversationId } = payload as any;
    if (channelId) useMessageStore.getState().removeMessage(channelId, id);
    else if (conversationId) useDMStore.getState().removeMessage(conversationId, id);
  });

  socket.on('typing', (payload) => {
    const { user, isTyping, channelId, conversationId } = payload as any;
    if (channelId) {
      const users = useMessageStore.getState().typing[channelId] || [];
      let updated = users;
      if (isTyping) updated = [...new Map([...users, user].map((u)=>[u.id,u])).values()];
      else updated = users.filter((u:any)=>u.id !== user.id);
      useMessageStore.getState().setTyping(channelId, updated);
    } else if (conversationId) {
      // for DMs we don't track typing per store yet - could add if desired
    }
  });

  socket.on('presenceUpdate', ({ userId, isOnline }: any) => {
    console.log('presence update', userId, isOnline);
    queryClient.invalidateQueries(['members']);
  });

  socket.on('statusUpdate', (payload:any) => {
    console.log('status update', payload);
    // refresh members and dm/conversation data
    queryClient.invalidateQueries(['members']);
    queryClient.invalidateQueries(['dmconv']);
    queryClient.invalidateQueries(['dms']);
  });

  socket.on('notification', (n) => {
    if (n?.type === 'mention') {
      toast(`Mentioned by ${n.message.author?.name || n.message.author?.email}`);
    }
  });

  socket.on('unreadIncrement', (payload) => {
    queryClient.invalidateQueries(['unreads']);
  });

  socket.on('unreadCountsUpdated', (payload:any) => {
    // payload: { channelId?, conversationId?, unreadCount }
    queryClient.invalidateQueries(['unreads']);
    // also invalidate channels/dms lists so badges update
    queryClient.invalidateQueries(['channels']);
    queryClient.invalidateQueries(['dms']);
  });

  socket.on('error', (err) => console.error('socket error', err));

  return socket;
}

export function getSocket(){
  return socket;
}
