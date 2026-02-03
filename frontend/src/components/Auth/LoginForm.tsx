import React from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';

export default function LoginForm() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const mutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post('/auth/login', data);
      return res.data;
    },
    onSuccess(data) {
      setAuth(data.user, data.token);
      toast.success('Logged in');
      import('../../lib/socket').then((m)=>m.initSocket());
    },
    onError(err: any) {
      toast.error(err?.response?.data?.error || err.message || 'Login failed');
    }
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        mutation.mutate({ email: String(fd.get('email') || ''), password: String(fd.get('password') || '') });
      }}
    >
      <div>
        <label>Email</label>
        <input name="email" type="email" />
      </div>
      <div>
        <label>Password</label>
        <input name="password" type="password" />
      </div>
      <button type="submit">Login</button>
      <div>
        <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/auth/google`}>Sign in with Google</a>
      </div>
    </form>
  );
}
