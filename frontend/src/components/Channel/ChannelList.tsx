import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../utils/api';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useMessageStore } from '../../stores/messageStore';

export default function ChannelList() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const qc = useQueryClient();
  const { data } = useQuery(['channels', workspaceId], async () => {
    if (!workspaceId) return [];
    const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
    return res.data;
  }, { enabled: !!workspaceId });

  const { data: unreads } = useQuery(['unreads'], async () => {
    const res = await api.get('/api/unreads');
    return res.data;
  }, { enabled: !!workspaceId });

  const setCurrent = useMessageStore((s)=>s.setCurrentChannel);

  const onSelect = async (c:any) => {
    setCurrent(c.id);
    if (workspaceId) {
      try { await api.post(`/api/workspaces/${workspaceId}/channels/${c.id}/read`); qc.invalidateQueries(['unreads']);
        try { const s = initSocket(); s.emit('markAsRead', { channelId: c.id }); } catch (e) {}
      } catch (err) { }
    }
  };

  return (
    <div className="channel-list">
      <h5>Channels</h5>
      <ul>
        {data?.map((c: any) => {
          const unread = (unreads || []).find((u:any)=>u.channelId===c.id)?.count;
          return (
          <li key={c.id} onClick={()=>onSelect(c)} style={{cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}># {c.name} {unread ? <span style={{background:'red',color:'#fff',borderRadius:12,padding:'2px 6px',fontSize:12}}>{unread}</span> : null}</li>
        )})}
      </ul>
    </div>
  );
}
