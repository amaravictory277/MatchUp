import type { Metadata } from 'next';
import { AuthForm } from '../../components/auth/auth-form';

export const metadata: Metadata = { title: 'Sign in | MatchUp', description: 'Sign in or create your MatchUp account.' };

export default function AuthPage() { return <AuthForm />; }
