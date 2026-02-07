'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet'; // Keep for Connect Wallet fallback if needed
import { useAuth } from '@/components/AuthProvider';
import { useContracts, StudentData } from '@/hooks/useContracts';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
    const router = useRouter();
    const { isConnected: isWalletConnected, address: walletAddress } = useWallet();
    const { token, user } = useAuth();
    const { getStudent, getCredibilityBalance, isRegistered } = useContracts();

    const [profile, setProfile] = useState<StudentData | null>(null);
    const [tokenBalance, setTokenBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [registered, setRegistered] = useState(false);

    useEffect(() => {
        if (token && user?.walletAddress) {
            loadProfile(user.walletAddress);
        } else if (isWalletConnected && walletAddress) {
            loadProfile(walletAddress);
        } else {
            setLoading(false);
        }
    }, [token, user, isWalletConnected, walletAddress]);

    const loadProfile = async (targetAddress: string) => {
        setLoading(true);
        try {
            const isReg = await isRegistered(targetAddress);
            setRegistered(isReg);

            if (isReg) {
                const studentData = await getStudent(targetAddress);
                setProfile(studentData);

                const balance = await getCredibilityBalance(targetAddress);
                setTokenBalance(balance);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
        setLoading(false);
    };

    if (!token && !isWalletConnected) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <div className="card max-w-md mx-auto">
                    <div className="text-6xl mb-4">🔐</div>
                    <h1 className="text-2xl font-bold mb-4">Login Required</h1>
                    <p className="text-gray-400 mb-8">Please login to view your profile</p>
                    <Link href="/login" className="btn-primary inline-block">
                        Login via Email
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-12">
                <div className="card max-w-4xl mx-auto animate-pulse">
                    <div className="flex gap-6">
                        <div className="w-24 h-24 bg-gray-700 rounded-2xl"></div>
                        <div className="flex-1">
                            <div className="h-8 bg-gray-700 rounded w-1/3 mb-2"></div>
                            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!registered) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <div className="card max-w-md mx-auto">
                    <div className="text-6xl mb-4">👋</div>
                    <h1 className="text-2xl font-bold mb-4">Not Registered</h1>
                    <p className="text-gray-400 mb-8">Complete registration to create your anonymous identity</p>
                    <Link href="/register" className="btn-primary inline-block">
                        Register Now
                    </Link>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <div className="card max-w-md mx-auto">
                    <div className="text-6xl mb-4">❌</div>
                    <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
                    <button onClick={() => user?.walletAddress && loadProfile(user.walletAddress)} className="btn-primary">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const accuracyRate = profile.accuratePredictions + profile.inaccuratePredictions > 0
        ? ((profile.accuratePredictions / (profile.accuratePredictions + profile.inaccuratePredictions)) * 100).toFixed(1)
        : 0;

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'NEW_USER':
                return { badge: 'badge-new', label: 'New User', description: 'Build credibility by making accurate predictions', icon: '🌱' };
            case 'CREDIBLE_USER':
                return { badge: 'badge-credible', label: 'Credible', description: 'Full voting power and trusted status', icon: '⭐' };
            case 'DISCREDITED':
                return { badge: 'badge-discredited', label: 'Discredited', description: 'Reduced influence - rebuild trust', icon: '⚠️' };
            default:
                return { badge: 'badge-new', label: status, description: '', icon: '👤' };
        }
    };

    const statusInfo = getStatusInfo(profile.statusName);

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            {/* Profile Header */}
            <div className="card mb-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl flex items-center justify-center text-4xl">
                        {statusInfo.icon}
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <h1 className="text-2xl font-bold">Student #{profile.studentID}</h1>
                            <span className={`badge ${statusInfo.badge}`}>{statusInfo.label}</span>
                        </div>
                        <p className="text-gray-400 text-sm font-mono mb-2">
                            {user?.walletAddress || walletAddress}
                        </p>
                        <p className="text-gray-500 text-sm">{statusInfo.description}</p>
                        <p className="text-gray-600 text-xs mt-2">
                            Member since {profile.registeredAt.toLocaleDateString()}
                        </p>
                    </div>

                    <div className="text-center">
                        <div className="text-4xl font-bold gradient-text">{tokenBalance}</div>
                        <div className="text-gray-400 text-sm">CRED Tokens</div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="card text-center">
                    <div className="text-2xl font-bold text-primary-400">{profile.votingPower / 100}%</div>
                    <div className="text-gray-400 text-sm">Voting Power</div>
                </div>
                <div className="card text-center">
                    <div className="text-2xl font-bold">{profile.totalPosts}</div>
                    <div className="text-gray-400 text-sm">Rumors Posted</div>
                </div>
                <div className="card text-center">
                    <div className="text-2xl font-bold">{profile.totalVotes}</div>
                    <div className="text-gray-400 text-sm">Votes Cast</div>
                </div>
                <div className="card text-center">
                    <div className="text-2xl font-bold text-green-400">{accuracyRate}%</div>
                    <div className="text-gray-400 text-sm">Accuracy Rate</div>
                </div>
            </div>

            {/* Prediction History */}
            <div className="card mb-8">
                <h2 className="text-xl font-semibold mb-4">📊 Prediction History</h2>
                <div className="flex items-center gap-8">
                    <div className="flex-1">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-green-400">✓ Accurate: {profile.accuratePredictions}</span>
                            <span className="text-red-400">✗ Inaccurate: {profile.inaccuratePredictions}</span>
                        </div>
                        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                                style={{ width: `${accuracyRate}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Credibility Progress */}
            <div className="card mb-8">
                <h2 className="text-xl font-semibold mb-4">📈 Credibility Progress</h2>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Progress to Credible User (30 CRED)</span>
                            <span>{Math.min(tokenBalance, 30)}/30</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
                                style={{ width: `${Math.min((tokenBalance / 30) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tips */}
            <div className="card">
                <h2 className="text-xl font-semibold mb-4">💡 How to Increase Credibility</h2>
                <ul className="space-y-3 text-gray-400">
                    <li className="flex items-start gap-3">
                        <span className="text-green-400">+5</span>
                        <span>Post rumors that get verified as true</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-green-400">+2</span>
                        <span>Vote on the correct side of verified rumors</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-primary-400">+</span>
                        <span>Provide evidence with your rumors for higher initial confidence</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-red-400">-</span>
                        <span>Avoid posting false rumors or voting incorrectly</span>
                    </li>
                </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8">
                <Link href="/submit" className="btn-primary flex-1 text-center">
                    Submit Rumor
                </Link>
                <Link href="/" className="btn-secondary flex-1 text-center">
                    Browse Rumors
                </Link>
            </div>
        </div>
    );
}
