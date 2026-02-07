'use client';

import { useState } from 'react';
import { RumorData } from '@/hooks/useContracts';

interface VotingPanelProps {
    rumor: RumorData;
    userVoted: boolean;
    onVote: (voteType: 0 | 1) => Promise<void>;
    isConnected: boolean;
}

export default function VotingPanel({ rumor, userVoted, onVote, isConnected }: VotingPanelProps) {
    const [voting, setVoting] = useState(false);
    const [selectedVote, setSelectedVote] = useState<0 | 1 | null>(null);

    const isActive = rumor.statusName === 'ACTIVE';
    const totalVotes = rumor.totalConfirmVotes + rumor.totalDisputeVotes;
    const confirmPercent = totalVotes > 0 ? (rumor.totalConfirmVotes / totalVotes * 100).toFixed(0) : 50;
    const disputePercent = totalVotes > 0 ? (rumor.totalDisputeVotes / totalVotes * 100).toFixed(0) : 50;

    const handleVote = async (type: 0 | 1) => {
        if (!isConnected || userVoted || !isActive || voting) return;

        setVoting(true);
        setSelectedVote(type);
        try {
            await onVote(type);
        } finally {
            setVoting(false);
        }
    };

    return (
        <div className="card">
            <h3 className="text-xl font-semibold mb-4">🗳️ Vote on this Rumor</h3>

            {/* Vote Stats */}
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-green-400">✓ Confirm: {rumor.totalConfirmVotes}</span>
                    <span className="text-red-400">✗ Dispute: {rumor.totalDisputeVotes}</span>
                </div>
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                        className="bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${confirmPercent}%` }}
                    ></div>
                    <div
                        className="bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-500"
                        style={{ width: `${disputePercent}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{confirmPercent}%</span>
                    <span>{disputePercent}%</span>
                </div>
            </div>

            {/* Voting Buttons */}
            {!isConnected ? (
                <div className="text-center py-4 text-gray-400">
                    <p>Connect your wallet to vote</p>
                </div>
            ) : !isActive ? (
                <div className="text-center py-4 text-gray-400">
                    <p>Voting is closed for this rumor</p>
                </div>
            ) : userVoted ? (
                <div className="text-center py-4">
                    <div className="inline-flex items-center px-4 py-2 bg-primary-500/20 text-primary-400 rounded-lg">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        You have voted on this rumor
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleVote(0)}
                        disabled={voting}
                        className={`btn-confirm py-4 text-lg flex items-center justify-center gap-2 ${voting && selectedVote === 0 ? 'opacity-75' : ''
                            }`}
                    >
                        {voting && selectedVote === 0 ? (
                            <span className="animate-spin">⟳</span>
                        ) : (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        )}
                        Confirm
                    </button>
                    <button
                        onClick={() => handleVote(1)}
                        disabled={voting}
                        className={`btn-dispute py-4 text-lg flex items-center justify-center gap-2 ${voting && selectedVote === 1 ? 'opacity-75' : ''
                            }`}
                    >
                        {voting && selectedVote === 1 ? (
                            <span className="animate-spin">⟳</span>
                        ) : (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        )}
                        Dispute
                    </button>
                </div>
            )}

            {/* Info */}
            <p className="text-center text-gray-500 text-sm mt-4">
                Your vote is weighted by your credibility score
            </p>
        </div>
    );
}
