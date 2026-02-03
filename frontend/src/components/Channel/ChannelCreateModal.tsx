import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export default function ChannelCreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const mutation = useMutation({
    mutationFn: async (data: { name: string; topic?: string }) => {
      const res = await api.post(`/api/workspaces/${workspaceId}/channels`, data);
      return res.data;
    },
    onSuccess() {
      qc.invalidateQueries(['channels', workspaceId]);
      toast.success('Channel created');
      onClose();
    },
    onError(err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create channel');
    }
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        mutation.mutate({ name: String(fd.get('name') || ''), topic: String(fd.get('topic') || '') });
      }}
    >
      <div>
        <label>Name</label>
        <input name="name" />
      </div>
      <div>
        <label>Topic</label>
        <input name="topic" />
      </div>
      <button type="submit">Create</button>
      <button type="button" onClick={onClose}>Cancel</button>
    </form>
  );
}
