import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { initSocket } from '../lib/socket';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function UserBadge(){
  const user = useAuthStore((s)=>s.user);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'ONLINE'|'AWAY'|'OFFLINE'|'CUSTOM'>('ONLINE');
  const [custom, setCustom] = useState('');

  if(!user) return <div />;

  const save = async () => {
    try {
      await api.patch(`/api/users/${user.id}/status`, { status, customStatus: custom });
      const s = initSocket();
      s.emit('setStatus', { status, customStatus: custom });
      toast.success('Status updated');
      setEditing(false);
    } catch (err:any) { toast.error(err?.message || 'Failed to update status'); }
  };

  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      {user.avatar ? <img src={user.avatar} width={32} height={32} alt="avatar"/> : <div style={{width:32,height:32,background:'#ccc',borderRadius:6}} />}
      <div>
        <div>{user.name || user.email}</div>
        <div style={{fontSize:12,color:'#666'}}>
          <button onClick={()=>setEditing((s)=>!s)} style={{fontSize:12}}>Set status</button>
        </div>
        {editing && (
          <div style={{marginTop:8}}>
            <select value={status} onChange={(e)=>setStatus(e.target.value as any)}>
              <option value="ONLINE">Online</option>
              <option value="AWAY">Away</option>
              <option value="OFFLINE">Offline</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <input placeholder="Custom status" value={custom} onChange={(e)=>setCustom(e.target.value)} style={{marginLeft:8}} />
            <button onClick={save} style={{marginLeft:8}}>Save</button>
          </div>
        )}
      </div>
    </div>
  );
}
