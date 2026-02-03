import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export default function MemberList(){
  const workspaceId = useWorkspaceStore((s)=>s.currentWorkspaceId);
  const { data } = useQuery(['members', workspaceId], async ()=>{
    if(!workspaceId) return [];
    const res = await api.get(`/api/workspaces/${workspaceId}/members`);
    return res.data;
  }, { enabled: !!workspaceId });

  return (
    <div>
      <h5>Members</h5>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8,fontSize:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><StatusDot status={'ONLINE'} /> Online</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><StatusDot status={'AWAY'} /> Away</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><StatusDot status={'OFFLINE'} /> Offline</div>
      </div>
      <ul>
        {data?.map((u:any)=> (
          <li key={u.id} style={{display:'flex',alignItems:'center',gap:8}}>
            {u.avatar ? <img src={u.avatar} width={24} /> : <div style={{width:24,height:24,background:'#ccc'}}/>}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <strong>{u.name || u.email}</strong>
                <span style={{fontSize:12,color:'#666'}}>{u.customStatus ? `— ${u.customStatus}` : ''}</span>
              </div>
              <div style={{fontSize:12,color:'#666'}}>
                <StatusDot status={u.status} /> {u.status}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusDot({ status }:{ status?:string }){
  const color = status === 'ONLINE' ? 'green' : status === 'AWAY' ? '#f1c40f' : status === 'CUSTOM' ? '#3498db' : '#999';
  const label = status === 'ONLINE' ? 'Online' : status === 'AWAY' ? 'Away' : status === 'CUSTOM' ? 'Custom status' : 'Offline';
  return <span role="img" aria-label={label} style={{color,marginRight:6}}>●</span>;
}
