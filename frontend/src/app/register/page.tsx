'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { sendVerificationCode, confirmVerificationCode } from '@/lib/api';
import toast from 'react-hot-toast';

export default function RegisterPage() {
    const router = useRouter();
    const { login } = useAuth();

    const [step, setStep] = useState<'email' | 'verify' | 'complete'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [devCode, setDevCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Result data
    const [token, setToken] = useState('');
    const [walletAddress, setWalletAddress] = useState('');

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.toLowerCase().endsWith('.edu.pk')) {
            toast.error('Please use a valid Pakistani university email (.edu.pk)');
            return;
        }

        setLoading(true);
        try {
            const result = await sendVerificationCode(email);
            if (result.devCode) {
                setDevCode(result.devCode);
            }
            toast.success('Verification code sent!');
            setStep('verify');
        } catch (error: any) {
            toast.error(error.message || 'Failed to send code');
        }
        setLoading(false);
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        try {
            // This API call now registers the user, creates a wallet, and returns the token
            const result = await confirmVerificationCode(email, code);

            setToken(result.token);
            // @ts-ignore - API returns walletAddress but type might not reflect it yet without full reload
            setWalletAddress(result.walletAddress);

            // Auto-login
            login(result.token, { email: result.email, walletAddress: result.walletAddress });

            toast.success('Identity Created Successfully!');
            setStep('complete');
        } catch (error: any) {
            toast.error(error.message || 'Invalid code');
        }
        setLoading(false);
    };

    const copyToken = () => {
        navigator.clipboard.writeText(token);
        toast.success('Token copied to clipboard!');
    };

    const getProgress = () => {
        switch (step) {
            case 'email': return 33;
            case 'verify': return 66;
            case 'complete': return 100;
            default: return 0;
        }
    };

    if (step === 'complete') {
        return (
            <div className="container mx-auto px-4 py-12 text-center max-w-lg">
                <div className="card mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="text-6xl mb-6">🎉</div>
                    <h1 className="text-3xl font-bold mb-2">Identity Created!</h1>
                    <p className="text-gray-400 mb-8">
                        You have been essentially assigned a secure, anonymous blockchain identity.
                    </p>

                    <div className="bg-gray-900/50 rounded-xl p-6 mb-8 text-left border border-gray-700">
                        <div className="mb-4">
                            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Your Wallet Address (Public Identity)</label>
                            <code className="text-primary-400 font-mono text-sm break-all">{walletAddress}</code>
                        </div>

                        <div>
                            <label className="text-xs text-green-400 uppercase tracking-wider block mb-1">Your Permanent Login Token (KEEP SAFE)</label>
                            <div className="flex gap-2">
                                <code className="bg-black/50 p-3 rounded text-gray-300 font-mono text-xs break-all flex-1 border border-gray-700">
                                    {token}
                                </code>
                                <button onClick={copyToken} className="btn-secondary px-3 py-1 text-sm h-auto">
                                    Copy
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                ⚠️ This token is your ONLY way to login on other devices. We do not store passwords.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button onClick={() => router.push('/submit')} className="btn-primary w-full py-4 text-lg">
                            Submit Your First Rumor 🚀
                        </button>
                        <button onClick={() => router.push('/')} className="btn-secondary w-full">
                            Browse Feed
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-md">
            <h1 className="text-3xl font-bold text-center mb-2">Create Identity</h1>
            <p className="text-gray-400 text-center mb-8">Anonymous, Verified, Gasless</p>

            {/* Progress Bar */}
            <div className="mb-8">
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${getProgress()}%` }}
                    ></div>
                </div>
            </div>

            {/* Step 1: Email */}
            {step === 'email' && (
                <div className="card animate-in fade-in">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-3">📧</div>
                        <h2 className="text-xl font-semibold">University Email</h2>
                        <p className="text-sm text-gray-400">We verify your student status via email.<br />Your email is hashed and never revealed.</p>
                    </div>
                    <form onSubmit={handleSendCode}>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="student@university.edu.pk"
                            className="input w-full mb-4"
                            required
                        />
                        <button type="submit" disabled={loading || !email} className="btn-primary w-full">
                            {loading ? 'Sending Code...' : 'Send Verification Code'}
                        </button>
                    </form>
                </div>
            )}

            {/* Step 2: Verify */}
            {step === 'verify' && (
                <div className="card animate-in fade-in">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-3">🔐</div>
                        <h2 className="text-xl font-semibold">Verify Code</h2>
                        <p className="text-sm text-gray-400">Enter the code sent to {email}</p>
                    </div>
                    {devCode && (
                        <div className="glass rounded-lg p-3 mb-4 text-center border border-primary-500/30 bg-primary-500/10">
                            <span className="text-xs text-primary-300">Dev Code: </span>
                            <span className="text-primary-400 font-mono font-bold">{devCode}</span>
                        </div>
                    )}
                    <form onSubmit={handleVerifyCode}>
                        <input
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="input w-full mb-4 text-center text-3xl tracking-[0.5em] font-mono h-16"
                            maxLength={6}
                            required
                        />
                        <button type="submit" disabled={loading || code.length !== 6} className="btn-primary w-full">
                            {loading ? 'Creating Identity...' : 'Verify & Create Identity'}
                        </button>
                    </form>
                    <button onClick={() => setStep('email')} className="w-full text-center text-gray-500 text-sm mt-4 hover:text-gray-300">
                        ← Change email
                    </button>
                </div>
            )}
        </div>
    );
}
