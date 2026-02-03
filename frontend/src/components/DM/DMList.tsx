import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../utils/api';
import { useDMStore } from '../../stores/dmStore';

export default function DMList() {
  const setCurrent = useDMStore((s) => s.setCurrentConversation);
  const qc = useQueryClient();
  const { data: convs } = useQuery(['dms'], async () => {
    const res = await api.get('/api/dms');
    return res.data;
  });

  const { data: unreads } = useQuery(['unreads'], async () => {
    const res = await api.get('/api/unreads');
    return res.data;
  });

  const onSelect = async (c:any) => {
    setCurrent(c.id);
    try { await api.post(`/api/dms/${c.id}/read`); qc.invalidateQueries(['unreads']);
      try { const s = initSocket(); s.emit('markAsRead', { conversationId: c.id }); } catch (e) {}
    } catch (err) { }
  };

  return (
    <div>
      <h3>Direct Messages</h3>
      <ul>
        {convs?.map((c:any)=> (
          <li key={c.id}><button onClick={()=>onSelect(c)}>{c.name || c.participants.filter((p:any)=>p.user.id !== undefined).map((p:any)=>p.user.name || p.user.email).join(', ')} { (unreads || []).find((u:any)=>u.conversationId===c.id)?.count ? <span style={{background:'red',color:'#fff',borderRadius:12,padding:'2px 6px',fontSize:12,marginLeft:8}}>{(unreads || []).find((u:any)=>u.conversationId===c.id)?.count}</span> : null }</button></li>
        ))}
      </ul>
    </div>
  );
}
