import React, { useRef } from 'react';
import api from '../../utils/api';
import { useQueryClient } from '@tanstack/react-query';

export default function DMCreateModal() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  const onCreate = async () => {
    const v = inputRef.current?.value;
    if (!v) return;
    const ids = v.split(',').map((s)=>s.trim()).filter(Boolean);
    await api.post('/api/dms', { participantIds: ids });
    qc.invalidateQueries(['dms']);
    inputRef.current!.value = '';
  };

  return (
    <div>
      <input ref={inputRef} placeholder="participant ids (comma)" />
      <button onClick={onCreate}>Create DM</button>
    </div>
  );
}
