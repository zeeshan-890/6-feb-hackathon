'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { RumorData } from '@/hooks/useContracts';
import { getRumorById, getIPFSUrl, getCorrelations, voteOnRumor as apiVoteOnRumor, checkUserVoted, getUserStats } from '@/lib/api';
import VotingPanel from '@/components/VotingPanel';
import toast from 'react-hot-toast';

interface RumorContent {
    title: string;
    description: string;
    createdAt: string;
    evidenceHashes: string[];
}

export default function RumorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const rumorId = parseInt(params.id as string);

    const { token, user } = useAuth();

    const [rumor, setRumor] = useState<RumorData | null>(null);
    const [content, setContent] = useState<RumorContent | null>(null);
    const [userVoted, setUserVoted] = useState(false);
    const [author, setAuthor] = useState<any>(null);
    const [correlations, setCorrelations] = useState<{ supportive: any[]; contradictory: any[] }>({ supportive: [], contradictory: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (rumorId) loadRumor();
    }, [rumorId]);

    const loadRumor = async () => {
        setLoading(true);
        try {
            const data = await getRumorById(rumorId);
            if (!data) {
                toast.error('Rumor not found');
                router.push('/');
                return;
            }

            // Map backend response to RumorData shape
            const rumorData: RumorData = {
                rumorID: Number(data.rumorID),
                authorID: Number(data.authorID),
                authorWallet: data.authorWallet,
                contentHash: data.contentHash,
                evidenceHashes: data.evidenceHashes || [],
                hasEvidence: data.hasEvidence,
                initialConfidence: Number(data.currentConfidence),
                currentConfidence: Number(data.currentConfidence),
                status: ['ACTIVE','LOCKED','VERIFIED','DEBUNKED','DELETED'].indexOf(data.status),
                statusName: data.status,
                visible: data.visible,
                createdAt: new Date(data.createdAt),
                totalConfirmVotes: Number(data.totalConfirmVotes),
                totalDisputeVotes: Number(data.totalDisputeVotes),
                keywords: data.keywords || [],
            };
            setRumor(rumorData);

            // Content is already included in the backend response
            if (data.content) {
                setContent(data.content);
            }

            // Check if user has voted
            if (user?.walletAddress) {
                try {
                    const voted = await checkUserVoted(user.walletAddress, rumorId);
                    setUserVoted(voted);
                } catch (e) { /* ignore */ }
            }

            // Author stats from backend
            if (data.authorWallet) {
                try {
                    const stats = await getUserStats(data.authorWallet);
                    setAuthor(stats);
                } catch (e) { /* ignore */ }
            }

            // Load correlations
            if (data.relatedRumors) {
                setCorrelations(data.relatedRumors);
            } else {
                try {
                    const corr = await getCorrelations(rumorId);
                    setCorrelations(corr);
                } catch (e) { /* optional */ }
            }
        } catch (error) {
            console.error('Error loading rumor:', error);
            toast.error('Failed to load rumor');
        }
        setLoading(false);
    };

    const handleVote = async (voteType: 0 | 1) => {
        if (!token) {
            toast.error('Please login to vote');
            router.push('/login');
            return;
        }

        try {
            await apiVoteOnRumor(rumorId, voteType === 0, token);
            toast.success(voteType === 0 ? 'Vote confirmed!' : 'Vote disputed!');
            setUserVoted(true);

            // Refresh rumor data after short delay to allow block propagation
            setTimeout(() => {
                loadRumor();
            }, 2000);

        } catch (error: any) {
            toast.error(error.message || 'Failed to vote');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="badge badge-active">Active</span>;
            case 'LOCKED':
                return <span className="badge badge-locked">Locked</span>;
            case 'VERIFIED':
                return <span className="badge badge-credible">Verified</span>;
            case 'DEBUNKED':
                return <span className="badge badge-discredited">Debunked</span>;
            default:
                return null;
        }
    };

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-700 rounded w-1/2 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-700 rounded w-3/4 mx-auto"></div>
                </div>
            </div>
        );
    }

    if (!rumor) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <h1 className="text-2xl font-bold mb-4">Rumor not found</h1>
                <button onClick={() => router.push('/')} className="btn-primary">
                    Back to Home
                </button>
            </div>
        );
    }

    const confidencePercent = Math.min(Math.max(rumor.currentConfidence, -100), 100);

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Back Button */}
            <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-white mb-6 flex items-center"
            >
                ← Back
            </button>

            {/* Main Card */}
            <div className="card mb-6">
                {/* Header */}
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        {getStatusBadge(rumor.statusName)}
                        {rumor.hasEvidence && (
                            <span className="text-xs text-green-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Has Evidence
                            </span>
                        )}
                    </div>
                    <span className="text-gray-500 text-sm">{timeAgo(rumor.createdAt)}</span>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold mb-4">
                    {content?.title || `Rumor #${rumor.rumorID}`}
                </h1>

                {/* Description */}
                <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                    {content?.description || 'Loading content...'}
                </p>

                {/* Keywords */}
                {rumor.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {rumor.keywords.map((keyword) => (
                            <span key={keyword} className="text-sm bg-primary-500/20 text-primary-400 px-3 py-1 rounded-lg">
                                #{keyword}
                            </span>
                        ))}
                    </div>
                )}

                {/* Evidence */}
                {rumor.evidenceHashes.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">📎 Evidence</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {rumor.evidenceHashes.map((hash, i) => (
                                <a
                                    key={hash}
                                    href={getIPFSUrl(hash)}
                                    // Use IPFS gateway directly if direct viewing needed, or download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="glass rounded-lg p-4 text-center hover:bg-white/10 transition-colors"
                                >
                                    <svg className="w-8 h-8 mx-auto text-primary-400 mb-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm text-gray-400">Evidence {i + 1}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Confidence Score */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-400">Confidence Score</span>
                        <span className={`text-2xl font-bold ${confidencePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {confidencePercent > 0 ? '+' : ''}{confidencePercent}%
                        </span>
                    </div>
                    <div className="confidence-bar h-3">
                        <div
                            className={`confidence-fill ${confidencePercent > 0 ? 'confidence-positive' :
                                confidencePercent < 0 ? 'confidence-negative' : 'confidence-neutral'
                                }`}
                            style={{ width: `${Math.abs(confidencePercent)}%` }}
                        ></div>
                    </div>
                </div>

                {/* Author Info */}
                <div className="glass rounded-lg p-4 flex justify-between items-center">
                    <div>
                        <span className="text-gray-400 text-sm">Posted by</span>
                        <div className="font-medium">Student #{rumor.authorID}</div>
                    </div>
                    {author && (
                        <div className="text-right">
                            <span className="text-gray-400 text-sm">Author Credibility</span>
                            <div className="font-medium text-primary-400">{author.credibilityScore} CRED</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Voting Panel */}
            <VotingPanel
                rumor={rumor}
                userVoted={userVoted}
                onVote={handleVote}
                isConnected={!!token}
                isAuthor={!!user?.walletAddress && user.walletAddress.toLowerCase() === rumor.authorWallet?.toLowerCase()}
            />

            {/* Correlations */}
            {(correlations.supportive.length > 0 || correlations.contradictory.length > 0) && (
                <div className="card mt-6">
                    <h3 className="text-xl font-semibold mb-4">🔗 Related Rumors</h3>

                    {correlations.supportive.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-green-400 font-medium mb-2">Supporting ({correlations.supportive.length})</h4>
                            <div className="space-y-2">
                                {correlations.supportive.map((r) => (
                                    <a
                                        key={r.rumorID}
                                        href={`/rumor/${r.rumorID}`}
                                        className="block glass rounded-lg p-3 hover:bg-white/10 transition-colors"
                                    >
                                        Rumor #{r.rumorID}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {correlations.contradictory.length > 0 && (
                        <div>
                            <h4 className="text-red-400 font-medium mb-2">Contradicting ({correlations.contradictory.length})</h4>
                            <div className="space-y-2">
                                {correlations.contradictory.map((r) => (
                                    <a
                                        key={r.rumorID}
                                        href={`/rumor/${r.rumorID}`}
                                        className="block glass rounded-lg p-3 hover:bg-white/10 transition-colors"
                                    >
                                        Rumor #{r.rumorID}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

