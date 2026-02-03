import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

function useQuery() {
  return new URLSearchParams(window.location.search);
}

export default function AuthSuccess() {
  const q = useQuery();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = q.get('token');
    if (token) {
      localStorage.setItem('token', token);
      // fetch user
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.user) {
            useAuthStore.getState().setAuth(data.user, token);
          }
          navigate('/dashboard');
        })
        .catch(() => navigate('/dashboard'));
    } else {
      navigate('/login');
    }
  }, []);

  return <div>Signing you in...</div>;
}
