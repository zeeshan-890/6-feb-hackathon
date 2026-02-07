'use client';

import Link from 'next/link';

interface RumorProps {
    rumor: {
        id: number;
        title: string;
        description: string;
        author: string;
        status: string;
        confidence: number;
        confirmVotes: number;
        disputeVotes: number;
        hasEvidence: boolean;
        createdAt: string;
        keywords: string[];
        isMock?: boolean;
    };
}

export default function RumorCard({ rumor }: RumorProps) {
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

    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const confidencePercent = Math.min(Math.max(rumor.confidence, -100), 100);
    const totalVotes = rumor.confirmVotes + rumor.disputeVotes;

    return (
        <Link href={rumor.isMock ? '#' : `/rumor/${rumor.id}`}>
            <div className={`card hover:border-primary-500/50 transition-all cursor-pointer ${rumor.isMock ? 'opacity-75' : ''}`}>
                {/* Header */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    {getStatusBadge(rumor.status)}
                    {rumor.hasEvidence && (
                        <span className="text-xs text-green-400 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Evidence
                        </span>
                    )}
                    <span className="text-gray-500 text-xs ml-auto">{timeAgo(rumor.createdAt)}</span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold mb-2 line-clamp-1">{rumor.title}</h3>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{rumor.description}</p>

                {/* Keywords */}
                {rumor.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                        {rumor.keywords.slice(0, 4).map((keyword) => (
                            <span key={keyword} className="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded">
                                #{keyword}
                            </span>
                        ))}
                        {rumor.keywords.length > 4 && (
                            <span className="text-xs text-gray-500">+{rumor.keywords.length - 4} more</span>
                        )}
                    </div>
                )}

                {/* Confidence Bar */}
                <div className="mb-4">
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                        <span>Confidence</span>
                        <span className={confidencePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {confidencePercent > 0 ? '+' : ''}{confidencePercent}%
                        </span>
                    </div>
                    <div className="confidence-bar h-2">
                        <div
                            className={`confidence-fill ${confidencePercent > 0 ? 'confidence-positive' :
                                    confidencePercent < 0 ? 'confidence-negative' : 'confidence-neutral'
                                }`}
                            style={{ width: `${Math.abs(confidencePercent)}%` }}
                        ></div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center text-sm">
                    <div className="text-gray-500">
                        By <span className="text-gray-400">{rumor.author}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-green-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {rumor.confirmVotes}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {rumor.disputeVotes}
                        </span>
                        <span className="text-gray-500">{totalVotes} votes</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
