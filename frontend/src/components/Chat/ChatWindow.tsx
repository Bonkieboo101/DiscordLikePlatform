import React, { useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../utils/api';
import { useMessageStore } from '../../stores/messageStore';
import { initSocket } from '../../lib/socket';
import MessageItem from './MessageItem';
import { useUploader } from '../../hooks/useUploader';
import { useDropzone } from 'react-dropzone';

export default function ChatWindow({ channelId }: { channelId: string | null }) {
  const qc = useQueryClient();
  const setMessages = useMessageStore((s) => s.setMessages);
  const messages = useMessageStore((s) => s.messages[channelId || ''] || []);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const infinite = useInfiniteQuery(['messages', channelId], async ({ pageParam }) => {
    if (!channelId) return [];
    const res = await api.get(`/api/workspaces/${''}/channels/${channelId}/messages`, { params: { cursor: pageParam, limit: 50 } });
    return res.data;
  }, {
    enabled: !!channelId,
    getNextPageParam: (lastPage) => (lastPage.length ? lastPage[lastPage.length-1].id : undefined),
    onSuccess(data) {
      // flatten pages and reverse to ascending order
      const flat = data.pages.flat().reverse();
      setMessages(channelId || '', flat);
    }
  });

  useEffect(() => {
    if (!channelId) return;
    const s = initSocket();
    s.emit('joinChannel', { channelId });
    return () => {
      s.emit('leaveChannel', { channelId });
    };
  }, [channelId]);

  useEffect(()=>{
    // scroll to bottom on new messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  if (!channelId) return <div>Select a channel</div>;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div ref={scrollRef} style={{flex:1,overflow:'auto',padding:8}}>
        {messages.map((m:any)=> <MessageItem key={m.id} message={m} />)}
      </div>
      <div style={{padding:8,position:'sticky',bottom:0,left:0,right:0,background:'#fff',zIndex:2}}>
        <ChatInput channelId={channelId} />
      </div>
    </div>
  );
}

function ChatInput({ channelId }: { channelId: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const s = initSocket();
  const typingTimeout = useRef<number | null>(null);
  const setTyping = (val: boolean) => { s.emit('typing', { channelId, isTyping: val }); };
  const { uploads, addFiles, uploadAll, remove, cancel, retry, isUploading, pendingCount } = useUploader();

  const onChange = () => {
    setTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(()=>{ setTyping(false); typingTimeout.current = null; }, 1500);
  };

  const onDrop = (acceptedFiles: File[]) => {
    const allowed = acceptedFiles.filter((f) => f.size <= 10 * 1024 * 1024);
    addFiles(allowed);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = inputRef.current?.value || '';
    if (!v && uploads.length === 0) return;
    // upload files first
    const infos: any[] = [];
    try {
      if (uploads.length) {
        const res = await uploadAll();
        infos.push(...res);
      }
      s.emit('sendMessage', { channelId, content: v, attachments: infos });
      inputRef.current!.value = '';
      // clear successful uploads
      uploads.forEach((u, idx) => { if (u.status === 'done') remove(idx); });
      setTyping(false);
    } catch (err) {
      console.error('upload/send failed', err);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{display:'flex',flexDirection:'column',gap:8}}>
      <div {...getRootProps()} style={{display:'flex',alignItems:'center',gap:8,border:isDragActive ? '2px dashed #888' : '1px dashed #ddd',padding:8,borderRadius:6}}>
        <input {...getInputProps()} />
        <input ref={inputRef} placeholder="Message..." style={{flex:1,border:'none',outline:'none'}} onKeyDown={(e)=>{ if(e.key==='@'){ /* mentions */ } }} onChange={onChange} onFocus={()=>setTimeout(()=>window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),250)} />
        <div style={{display:'flex',gap:8}}>
          <button type="submit" disabled={isUploading}>{isUploading ? `Uploading ${pendingCount} files...` : 'Send'}</button>
        </div>
      </div>
      {uploads.length > 0 && (
        <div style={{display:'flex',gap:8,overflowX:'auto'}}>
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
