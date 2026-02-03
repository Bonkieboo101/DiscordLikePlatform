import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token) || localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
