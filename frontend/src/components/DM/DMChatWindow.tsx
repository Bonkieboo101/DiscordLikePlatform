import React, { useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { useDMStore } from '../../stores/dmStore';
import { initSocket } from '../../lib/socket';
import MessageItem from '../Chat/MessageItem';
import { useUploader } from '../../hooks/useUploader';
import { useDropzone } from 'react-dropzone';

export default function DMChatWindow({ conversationId }: { conversationId: string | null }) {
  const setMessages = useDMStore((s) => s.setMessages);
  const messages = useDMStore((s) => s.messages[conversationId || ''] || []);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const infinite = useInfiniteQuery(['dmmessages', conversationId], async ({ pageParam }) => {
    if (!conversationId) return [];
    const res = await api.get(`/api/dms/${conversationId}/messages`, { params: { cursor: pageParam, limit: 50 } });
    return res.data;
  }, {
    enabled: !!conversationId,
    getNextPageParam: (lastPage) => (lastPage.length ? lastPage[lastPage.length-1].id : undefined),
    onSuccess(data) {
      const flat = data.pages.flat().reverse();
      setMessages(conversationId || '', flat);
    }
  });

  useEffect(() => {
    if (!conversationId) return;
    const s = initSocket();
    s.emit('joinDM', { conversationId });
    return () => { s.emit('leaveDM', { conversationId }); };
  }, [conversationId]);

  useEffect(()=>{ scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages.length]);

  if (!conversationId) return <div>Select a conversation</div>;

  const { data: conv } = useQuery(['dmconv', conversationId], async () => {
    if (!conversationId) return null;
    const res = await api.get(`/api/dms/${conversationId}`);
    return res.data;
  }, { enabled: !!conversationId });

  const currentUser = useAuthStore((s)=>s.user);
  const otherUser = conv?.participants?.find((p:any)=>p.user.id !== currentUser?.id)?.user || conv?.participants?.find((p:any)=>p.user)?.user;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{padding:8,borderBottom:'1px solid #eee'}}>
        {conv && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:700}}>{conv.isGroup ? conv.name || 'Group' : otherUser?.name || otherUser?.email || 'Direct Message'}</div>
              {!conv.isGroup && otherUser && (
                <div style={{fontSize:12,color:'#666'}}>
                  <StatusDot status={otherUser.status} /> {otherUser.status} {otherUser.customStatus ? `— ${otherUser.customStatus}` : ''}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div ref={scrollRef} style={{flex:1,overflow:'auto',padding:8}}>
        {messages.map((m:any)=> <MessageItem key={m.id} message={m} />)}
      </div>
      <div style={{padding:8,position:'sticky',bottom:0,left:0,right:0,background:'#fff',zIndex:2}}>
        <ChatInput conversationId={conversationId} />
      </div>
    </div>
  );
}

function StatusDot({ status }:{ status?:string }){
  const color = status === 'ONLINE' ? 'green' : status === 'AWAY' ? '#f1c40f' : status === 'CUSTOM' ? '#3498db' : '#999';
  return <span style={{color,marginRight:6}}>●</span>;
}
}

function ChatInput({ conversationId }: { conversationId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const s = initSocket();
  const { uploads, addFiles, uploadAll, remove, cancel, retry, isUploading, pendingCount } = useUploader();

  const onDrop = (acceptedFiles: File[]) => {
    const allowed = acceptedFiles.filter((f) => f.size <= 10 * 1024 * 1024);
    addFiles(allowed);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

  const onSubmit = async (e:any) => {
    e.preventDefault();
    const v = inputRef.current?.value || '';
    if (!v && uploads.length === 0) return;
    const infos: any[] = [];
    try {
      if (uploads.length) {
        const res = await uploadAll();
        infos.push(...res);
      }
      s.emit('sendMessage', { conversationId, content: v, attachments: infos });
      inputRef.current!.value = '';
      uploads.forEach((u, idx) => { if (u.status === 'done') remove(idx); });
    } catch (err) {
      console.error('upload/send failed', err);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div {...getRootProps()} style={{display:'flex',alignItems:'center',gap:8,border:isDragActive ? '2px dashed #888' : '1px dashed #ddd',padding:8,borderRadius:6}}>
        <input {...getInputProps()} />
        <input ref={inputRef} placeholder="Message..." style={{width:'60%',border:'none',outline:'none'}} onFocus={()=>setTimeout(()=>window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),250)} />
        <div style={{display:'flex',gap:8}}>
          <button type="submit" disabled={isUploading}>{isUploading ? `Uploading ${pendingCount} files...` : 'Send'}</button>
        </div>
      </div>
      {uploads.length > 0 && (
        <div style={{display:'flex',gap:8,overflowX:'auto',marginTop:8}}>
          {uploads.map((u,i)=> (
            <div key={i} style={{minWidth:160,padding:8,border:'1px solid #ddd',borderRadius:6}}>
              <div style={{fontSize:12,fontWeight:600}}>{u.file.name}</div>
              <div style={{fontSize:11,color:'#666'}}>{Math.round(u.file.size/1024)} KB</div>
              <div style={{height:8,background:'#f0f0f0',borderRadius:4,overflow:'hidden',marginTop:6}}>
                <div style={{width:`${u.progress}%`,height:'100%',background:u.status==='error'?'#e74c3c':'#4caf50'}} />
              </div>
              <div style={{display:'flex',gap:8,marginTop:6}}>
                {u.status === 'uploading' && <button type="button" onClick={()=>cancel(i)}>Cancel</button>}
                {u.status === 'error' && <button type="button" onClick={()=>retry(i)}>Retry</button>}
                <button type="button" onClick={()=>remove(i)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
