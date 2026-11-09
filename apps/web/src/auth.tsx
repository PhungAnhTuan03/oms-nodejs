import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Role } from './types';

export const getRole = () => localStorage.getItem('role') as Role | null;

export function RequireAuth({ children }: { children: ReactNode }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  window.location.href = '/login';
}
