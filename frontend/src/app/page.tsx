'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import RumorCard from '@/components/RumorCard';
import { useAuth } from '@/components/AuthProvider';
import { getRumors } from '@/lib/api';

export default function Home() {
    const { isLoggedIn, user } = useAuth();

    const [rumors, setRumors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [stats, setStats] = useState({ total: 0, active: 0, votes: 0 });
    const [userRegistered, setUserRegistered] = useState(false);

    useEffect(() => {
        loadRumors();
        if (isLoggedIn && user?.walletAddress) {
            setUserRegistered(true); // If they have a wallet, they're registered
        }
    }, [isLoggedIn, user]);

    const loadRumors = async () => {
        setLoading(true);
        try {
            const data = await getRumors({ limit: 20 });

            if (data.total === 0) {
                setRumors([{
                    id: 0,
                    title: "Welcome to Campus Rumors!",
                    description: "This is an example rumor. Once you register and submit rumors, they will appear here with live blockchain data.",
                    author: "System",
                    status: "ACTIVE",
                    confidence: 50,
                    confirmVotes: 0,
                    disputeVotes: 0,
                    hasEvidence: false,
                    createdAt: new Date().toISOString(),
                    keywords: ["welcome", "example"],
                    isMock: true,
                }]);
                setStats({ total: 0, active: 0, votes: 0 });
                setLoading(false);
                return;
            }

            let activeCount = 0;
            let totalVotes = 0;

            const loadedRumors = data.rumors.map((r: any) => {
                const confirmVotes = Number(r.totalConfirmVotes) || 0;
                const disputeVotes = Number(r.totalDisputeVotes) || 0;
                if (r.status === 'ACTIVE') activeCount++;
                totalVotes += confirmVotes + disputeVotes;

                return {
                    id: Number(r.rumorID),
                    title: r.content?.title || `Rumor #${r.rumorID}`,
                    description: r.content?.description || 'Content loading...',
                    author: `Student #${r.authorID}`,
                    status: r.status,
                    confidence: Number(r.currentConfidence),
                    confirmVotes,
                    disputeVotes,
                    hasEvidence: r.hasEvidence,
                    createdAt: r.createdAt,
                    keywords: r.keywords || [],
                };
            });

            setRumors(loadedRumors);
            setStats({ total: data.total, active: activeCount, votes: totalVotes });
        } catch (error) {
            console.error('Error loading rumors:', error);
        }
        setLoading(false);
    };

    const filteredRumors = rumors.filter(rumor => {
        if (filter === 'active') return rumor.status === 'ACTIVE';
        if (filter === 'locked') return rumor.status === 'LOCKED';
        return true;
    });

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Hero Section */}
            <div className="text-center mb-12">
                <h1 className="text-5xl font-bold mb-4">
                    <span className="gradient-text">Campus Rumors</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                    Decentralized, anonymous rumor verification powered by community voting and AI
                </p>

                {!isLoggedIn && (
                    <div className="mt-8">
                        <Link href="/register" className="btn-primary inline-block">
                            Get Started →
                        </Link>
                    </div>
                )}

                {isLoggedIn && !userRegistered && (
                    <div className="mt-8">
                        <Link href="/register" className="btn-primary inline-block">
                            Complete Registration →
                        </Link>
                    </div>
                )}
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="card text-center">
                    <div className="text-3xl font-bold gradient-text">{stats.total}</div>
                    <div className="text-gray-400 text-sm">Total Rumors</div>
                </div>
                <div className="card text-center">
                    <div className="text-3xl font-bold gradient-text">{stats.active}</div>
                    <div className="text-gray-400 text-sm">Active Rumors</div>
                </div>
                <div className="card text-center">
                    <div className="text-3xl font-bold gradient-text">{stats.votes}</div>
                    <div className="text-gray-400 text-sm">Total Votes</div>
                </div>
                <div className="card text-center">
                    <div className="text-3xl font-bold gradient-text">
                        {isLoggedIn ? (userRegistered ? '✓' : '—') : '—'}
                    </div>
                    <div className="text-gray-400 text-sm">Your Status</div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 mb-8 justify-between items-center">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === 'all' ? 'bg-primary-600 text-white' : 'glass text-gray-300'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === 'active' ? 'bg-primary-600 text-white' : 'glass text-gray-300'
                            }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setFilter('locked')}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === 'locked' ? 'bg-primary-600 text-white' : 'glass text-gray-300'
                            }`}
                    >
                        Locked
                    </button>
                    <button
                        onClick={loadRumors}
                        className="px-4 py-2 rounded-lg glass text-gray-300 hover:bg-white/10"
                    >
                        ↻ Refresh
                    </button>
                </div>

                {isLoggedIn && userRegistered && (
                    <Link href="/submit" className="btn-primary">
                        + Submit Rumor
                    </Link>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-6 bg-gray-700 rounded w-1/4 mb-3"></div>
                            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Rumors List */}
            {!loading && (
                <div className="space-y-4">
                    {filteredRumors.map((rumor) => (
                        <RumorCard key={rumor.id} rumor={rumor} />
                    ))}
                </div>
            )}

            {!loading && filteredRumors.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-gray-400 text-lg">No rumors found</p>
                    {isLoggedIn && userRegistered && (
                        <Link href="/submit" className="btn-primary inline-block mt-4">
                            Be the first to submit!
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
