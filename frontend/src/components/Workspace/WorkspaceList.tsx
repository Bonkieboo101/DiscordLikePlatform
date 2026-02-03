import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export default function WorkspaceList() {
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const current = useWorkspaceStore((s) => s.currentWorkspaceId);
  const setCurrent = useWorkspaceStore((s) => s.setCurrentWorkspace);

  const { data } = useQuery(['workspaces'], async () => {
    const res = await api.get('/api/workspaces');
    return res.data;
  }, {
    onSuccess(ws: any) {
      setWorkspaces(ws);
      if (!current && ws?.[0]) setCurrent(ws[0].id);
    }
  });

  return (
    <div className="workspace-list">
      <h4>Workspaces</h4>
      <ul>
        {data?.map((w: any) => (
          <li key={w.id} onClick={() => setCurrent(w.id)} style={{ fontWeight: current === w.id ? 'bold' : 'normal' }}>
            {w.iconUrl ? <img src={w.iconUrl} alt="icon" width={24} /> : <span>{w.name[0]?.toUpperCase()}</span>} {w.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
