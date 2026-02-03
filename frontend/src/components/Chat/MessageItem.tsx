import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { initSocket } from '../../lib/socket';

export default function MessageItem({ message }: { message: any }) {
  const user = useAuthStore((s)=>s.user);
  const s = initSocket();
  const isMine = user?.id === message.authorId;
  const toggleReaction = (emoji: string) => {
    const users = message.reactions?.[emoji] || [];
    const has = users.includes(user?.id);
    if (has) s.emit('removeReaction', { messageId: message.id, emoji });
    else s.emit('addReaction', { messageId: message.id, emoji });
  };

  // Lightbox state
  const images = (message.attachments || []).filter((a:any)=>a.mimeType?.startsWith('image/'));
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openAt = (idx:number) => { setCurrentIndex(idx); setIsOpen(true); };
  const close = () => setIsOpen(false);
  const next = () => setCurrentIndex((i) => (i + 1) % images.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + images.length) % images.length);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }, [isOpen, images.length]);

  useEffect(()=>{ document.addEventListener('keydown', onKey); return ()=>document.removeEventListener('keydown', onKey); }, [onKey]);

  // small swipeable image helper for touch devices
  function SwipeableImage({ src, onPrev, onNext }: { src: string; onPrev: ()=>void; onNext: ()=>void }) {
    const [startX, setStartX] = useState<number | null>(null);
    const onTouchStart = (e: React.TouchEvent) => setStartX(e.touches[0].clientX);
    const onTouchEnd = (e: React.TouchEvent) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > 40) onPrev();
      else if (dx < -40) onNext();
      setStartX(null);
    };
    return (
      <img src={src} style={{maxWidth:'100%',maxHeight:'100%',borderRadius:8, touchAction:'pan-y'}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} alt="preview" />
    );
  }

  return (
    <div style={{padding:6,borderBottom:'1px solid #eee'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        {message.author?.avatar ? <img src={message.author.avatar} width={28} style={{borderRadius:14}}/> : <div style={{width:28,height:28,background:'#ccc',borderRadius:14}}/>}
        <div style={{flex:1}}>
          <div style={{fontWeight:600}}>{message.author?.name || message.author?.email}</div>
          <div>{message.content}</div>

          {message.attachments && message.attachments.length > 0 && (
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
              {message.attachments.map((a:any, idx:number) => (
                a.mimeType?.startsWith('image/') ? (
                  <img key={a.url} src={a.url} style={{maxWidth:320,borderRadius:6,cursor:'pointer'}} onClick={()=>openAt(images.findIndex((im:any)=>im.url===a.url) || 0)} />
                ) : (
                  <div key={a.url}><a href={a.url} target="_blank" rel="noreferrer">{a.filename}</a> <span style={{color:'#666',fontSize:12}}>({Math.round(a.size/1024)} KB)</span></div>
                )
              ))}
            </div>
          )}

          <div style={{fontSize:12,color:'#666'}}>{new Date(message.createdAt).toLocaleString()}</div>
          <div style={{marginTop:6}}>
            {message.reactions && Object.entries(message.reactions).map(([emoji, users]: any) => (
              <button key={emoji} onClick={()=>toggleReaction(emoji)} style={{marginRight:6}}>{emoji} {users.length}</button>
            ))}
            <button onClick={()=>toggleReaction('👍')}>👍</button>
            <button onClick={()=>toggleReaction('❤️')}>❤️</button>
          </div>
        </div>
        {isMine && <div>
          <button onClick={()=>{ const newContent = prompt('Edit message', message.content); if(newContent!==null){ s.emit('editMessage',{ messageId: message.id, content: newContent }); } }}>Edit</button>
          <button onClick={()=>{ if(confirm('Delete message?')) s.emit('deleteMessage',{ messageId: message.id }); }}>Delete</button>
        </div>}
      </div>

      {isOpen && images.length > 0 && (
        <div onClick={close} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div onClick={(e)=>e.stopPropagation()} style={{position:'relative',maxWidth:'95%',maxHeight:'95%'}}
            role="dialog" aria-label="Image preview" aria-modal="true">
            <SwipeableImage src={images[currentIndex].url} onPrev={prev} onNext={next} />
            {images.length > 1 && (
              <>
                <button onClick={prev} style={{position:'absolute',left:-40,top:'50%',transform:'translateY(-50%)',background:'transparent',color:'#fff',fontSize:22,border:'none'}} aria-label="Previous image">◀</button>
                <button onClick={next} style={{position:'absolute',right:-40,top:'50%',transform:'translateY(-50%)',background:'transparent',color:'#fff',fontSize:22,border:'none'}} aria-label="Next image">▶</button>
              </>
            )}
            <button onClick={close} style={{position:'absolute',right:8,top:8,background:'rgba(0,0,0,0.4)',color:'#fff',border:'none',padding:6,borderRadius:6}} aria-label="Close preview">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
