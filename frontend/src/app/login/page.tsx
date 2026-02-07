'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function LoginPage() {
    const router = useRouter();
    const { login, isLoggedIn, isLoading } = useAuth();

    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [step, setStep] = useState<'email' | 'verify' | 'token'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [token, setToken] = useState('');
    const [newToken, setNewToken] = useState<string | null>(null);
    const [devCode, setDevCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isLoggedIn && !isLoading) {
            router.push('/');
        }
    }, [isLoggedIn, isLoading, router]);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    if (isLoggedIn) {
        return null;
    }

    // Login with existing token
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid token');
            }

            login(token.trim(), data.user);
            toast.success('Welcome back! 🎉');
            router.push('/');
        } catch (error: any) {
            toast.error(error.message || 'Login failed');
        }
        setLoading(false);
    };

    // Send verification code for registration
    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.toLowerCase().endsWith('.edu.pk')) {
            toast.error('Please use a valid Pakistani university email (.edu.pk)');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/send-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.alreadyRegistered) {
                    toast.error('Email already registered! Please login with your token.');
                    setMode('login');
                    return;
                }
                throw new Error(data.error || 'Failed to send code');
            }

            if (data.devCode) {
                setDevCode(data.devCode);
            }
            toast.success('Verification code sent!');
            setStep('verify');
        } catch (error: any) {
            toast.error(error.message || 'Failed to send code');
        }
        setLoading(false);
    };

    // Verify code and get permanent token
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Show the token to user
            setNewToken(data.token);
            setStep('token');
            toast.success('Registration successful! Save your token below.');
        } catch (error: any) {
            toast.error(error.message || 'Registration failed');
        }
        setLoading(false);
    };

    // Copy token to clipboard
    const copyToken = () => {
        if (newToken) {
            navigator.clipboard.writeText(newToken);
            toast.success('Token copied to clipboard!');
        }
    };

    // Continue after saving token
    const handleContinue = () => {
        if (newToken) {
            login(newToken, { email: email.split('@')[0] + '@...' });
            toast.success('You are now logged in!');
            router.push('/');
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-md">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-2">
                    <span className="gradient-text">Campus Rumors</span>
                </h1>
                <p className="text-gray-400">
                    {mode === 'login' ? 'Login with your token' : 'Register with university email'}
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex mb-6 glass rounded-lg p-1">
                <button
                    onClick={() => { setMode('login'); setStep('email'); }}
                    className={`flex-1 py-2 rounded-lg transition-colors ${mode === 'login' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}
                >
                    Login
                </button>
                <button
                    onClick={() => { setMode('register'); setStep('email'); }}
                    className={`flex-1 py-2 rounded-lg transition-colors ${mode === 'register' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}
                >
                    Register
                </button>
            </div>

            {/* LOGIN MODE */}
            {mode === 'login' && (
                <div className="card">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">�</div>
                        <h2 className="text-xl font-semibold">Enter Your Token</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Paste the token you received during registration
                        </p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <textarea
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            placeholder="Paste your 64-character token here..."
                            className="input w-full mb-4 h-24 font-mono text-sm resize-none"
                            required
                        />
                        <button
                            type="submit"
                            disabled={loading || token.length < 64}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <p className="text-xs text-gray-600 text-center mt-4">
                        Don't have a token? <button onClick={() => setMode('register')} className="text-primary-400 hover:underline">Register here</button>
                    </p>
                </div>
            )}

            {/* REGISTER MODE - Email Step */}
            {mode === 'register' && step === 'email' && (
                <div className="card">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">�</div>
                        <h2 className="text-xl font-semibold">University Email</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Verify your .edu.pk email to get your token
                        </p>
                    </div>

                    <form onSubmit={handleSendCode}>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="your.name@university.edu.pk"
                            className="input w-full mb-4"
                            required
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading || !email}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Sending...' : 'Send Verification Code'}
                        </button>
                    </form>
                </div>
            )}

            {/* REGISTER MODE - Verify Step */}
            {mode === 'register' && step === 'verify' && (
                <div className="card">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">🔐</div>
                        <h2 className="text-xl font-semibold">Enter Code</h2>
                    </div>

                    {devCode && (
                        <div className="glass rounded-lg p-4 mb-4 text-center">
                            <span className="text-xs text-gray-500">Dev Mode Code:</span>
                            <div className="text-2xl font-mono font-bold text-primary-400">{devCode}</div>
                        </div>
                    )}

                    <form onSubmit={handleRegister}>
                        <input
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="input w-full mb-4 text-center text-3xl tracking-[0.5em] font-mono"
                            maxLength={6}
                            required
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={loading || code.length !== 6}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Verifying...' : 'Get My Token'}
                        </button>
                    </form>

                    <button
                        onClick={() => { setStep('email'); setCode(''); setDevCode(null); }}
                        className="w-full text-center text-gray-500 text-sm mt-4 hover:text-gray-300"
                    >
                        ← Use different email
                    </button>
                </div>
            )}

            {/* REGISTER MODE - Token Display */}
            {mode === 'register' && step === 'token' && newToken && (
                <div className="card">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">🎉</div>
                        <h2 className="text-xl font-semibold">Your Token</h2>
                        <p className="text-red-400 text-sm mt-1 font-medium">
                            ⚠️ Save this token! You cannot recover it!
                        </p>
                    </div>

                    <div className="glass rounded-lg p-4 mb-4">
                        <div className="font-mono text-xs break-all text-primary-400 select-all">
                            {newToken}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button onClick={copyToken} className="btn-secondary w-full">
                            📋 Copy Token
                        </button>
                        <button onClick={handleContinue} className="btn-primary w-full">
                            I've Saved My Token - Continue →
                        </button>
                    </div>

                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400">
                            💡 <strong>Tip:</strong> Save your token somewhere safe (password manager, notes app).
                            You'll need it every time you login.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
