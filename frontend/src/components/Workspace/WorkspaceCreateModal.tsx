import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function WorkspaceCreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await api.post('/api/workspaces', data);
      return res.data;
    },
    onSuccess() {
      qc.invalidateQueries(['workspaces']);
      toast.success('Workspace created');
      onClose();
    },
    onError(err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create workspace');
    }
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        mutation.mutate({ name: String(fd.get('name') || ''), description: String(fd.get('description') || '') });
      }}
    >
      <div>
        <label>Name</label>
        <input name="name" />
      </div>
      <div>
        <label>Description</label>
        <input name="description" />
      </div>
      <button type="submit">Create</button>
      <button type="button" onClick={onClose}>Cancel</button>
    </form>
  );
}
