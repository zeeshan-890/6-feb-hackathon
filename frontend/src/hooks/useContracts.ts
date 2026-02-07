'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '@/hooks/useWallet';
import {
    IDENTITY_REGISTRY_ABI,
    RUMOR_REGISTRY_ABI,
    VOTING_SYSTEM_ABI,
    CREDIBILITY_TOKEN_ABI,
    CONTRACT_ADDRESSES
} from '@/lib/contracts';

export interface StudentData {
    studentID: string;
    walletAddress: string;
    credibilityScore: number;
    status: number;
    statusName: string;
    votingPower: number;
    registeredAt: Date;
    totalPosts: number;
    totalVotes: number;
    accuratePredictions: number;
    inaccuratePredictions: number;
}

export interface RumorData {
    rumorID: number;
    authorID: number;
    authorWallet: string;
    contentHash: string;
    evidenceHashes: string[];
    hasEvidence: boolean;
    initialConfidence: number;
    currentConfidence: number;
    status: number;
    statusName: string;
    visible: boolean;
    createdAt: Date;
    totalConfirmVotes: number;
    totalDisputeVotes: number;
    keywords: string[];
}

const STATUS_NAMES = ['NONE', 'NEW_USER', 'CREDIBLE_USER', 'DISCREDITED', 'BLOCKED'];
const RUMOR_STATUS_NAMES = ['ACTIVE', 'LOCKED', 'VERIFIED', 'DEBUNKED', 'DELETED'];

export function useContracts() {
    const { signer, provider, isConnected, address } = useWallet();
    const [contracts, setContracts] = useState<{
        identityRegistry: ethers.Contract | null;
        rumorRegistry: ethers.Contract | null;
        votingSystem: ethers.Contract | null;
        credibilityToken: ethers.Contract | null;
    }>({
        identityRegistry: null,
        rumorRegistry: null,
        votingSystem: null,
        credibilityToken: null,
    });

    useEffect(() => {
        if (provider && CONTRACT_ADDRESSES.IDENTITY_REGISTRY) {
            const signerOrProvider = signer || provider;

            setContracts({
                identityRegistry: new ethers.Contract(
                    CONTRACT_ADDRESSES.IDENTITY_REGISTRY,
                    IDENTITY_REGISTRY_ABI,
                    signerOrProvider
                ),
                rumorRegistry: new ethers.Contract(
                    CONTRACT_ADDRESSES.RUMOR_REGISTRY,
                    RUMOR_REGISTRY_ABI,
                    signerOrProvider
                ),
                votingSystem: new ethers.Contract(
                    CONTRACT_ADDRESSES.VOTING_SYSTEM,
                    VOTING_SYSTEM_ABI,
                    signerOrProvider
                ),
                credibilityToken: new ethers.Contract(
                    CONTRACT_ADDRESSES.CREDIBILITY_TOKEN,
                    CREDIBILITY_TOKEN_ABI,
                    signerOrProvider
                ),
            });
        }
    }, [provider, signer]);

    // Check if user is registered
    const isRegistered = useCallback(async (walletAddress?: string): Promise<boolean> => {
        if (!contracts.identityRegistry) return false;
        const targetAddress = walletAddress || address;
        if (!targetAddress) return false;

        try {
            return await contracts.identityRegistry.isRegistered(targetAddress);
        } catch (error) {
            console.error('Error checking registration:', error);
            return false;
        }
    }, [contracts.identityRegistry, address]);

    // Get student data
    const getStudent = useCallback(async (walletAddress?: string): Promise<StudentData | null> => {
        if (!contracts.identityRegistry) return null;
        const targetAddress = walletAddress || address;
        if (!targetAddress) return null;

        try {
            const student = await contracts.identityRegistry.getStudent(targetAddress);
            if (student.studentID.toString() === '0') return null;

            return {
                studentID: student.studentID.toString(),
                walletAddress: student.walletAddress,
                credibilityScore: Number(student.credibilityScore),
                status: Number(student.status),
                statusName: STATUS_NAMES[Number(student.status)] || 'UNKNOWN',
                votingPower: Number(student.votingPower),
                registeredAt: new Date(Number(student.registeredAt) * 1000),
                totalPosts: Number(student.totalPosts),
                totalVotes: Number(student.totalVotes),
                accuratePredictions: Number(student.accuratePredictions),
                inaccuratePredictions: Number(student.inaccuratePredictions),
            };
        } catch (error) {
            console.error('Error getting student:', error);
            return null;
        }
    }, [contracts.identityRegistry, address]);

    // Register student
    const registerStudent = useCallback(async (emailHMAC: string, signature: string): Promise<boolean> => {
        if (!contracts.identityRegistry || !signer) return false;

        try {
            const tx = await contracts.identityRegistry.registerStudent(emailHMAC, signature);
            await tx.wait();
            return true;
        } catch (error) {
            console.error('Error registering student:', error);
            throw error;
        }
    }, [contracts.identityRegistry, signer]);

    // Get rumor
    const getRumor = useCallback(async (rumorID: number): Promise<RumorData | null> => {
        if (!contracts.rumorRegistry) return null;

        try {
            const rumor = await contracts.rumorRegistry.getRumor(rumorID);
            if (rumor.rumorID.toString() === '0') return null;

            return {
                rumorID: Number(rumor.rumorID),
                authorID: Number(rumor.authorID),
                authorWallet: rumor.authorWallet,
                contentHash: rumor.contentHash,
                evidenceHashes: rumor.evidenceHashes,
                hasEvidence: rumor.hasEvidence,
                initialConfidence: Number(rumor.initialConfidence),
                currentConfidence: Number(rumor.currentConfidence),
                status: Number(rumor.status),
                statusName: RUMOR_STATUS_NAMES[Number(rumor.status)] || 'UNKNOWN',
                visible: rumor.visible,
                createdAt: new Date(Number(rumor.createdAt) * 1000),
                totalConfirmVotes: Number(rumor.totalConfirmVotes),
                totalDisputeVotes: Number(rumor.totalDisputeVotes),
                keywords: rumor.keywords,
            };
        } catch (error) {
            console.error('Error getting rumor:', error);
            return null;
        }
    }, [contracts.rumorRegistry]);

    // Get total rumors
    const getTotalRumors = useCallback(async (): Promise<number> => {
        if (!contracts.rumorRegistry) return 0;
        try {
            return Number(await contracts.rumorRegistry.getTotalRumors());
        } catch (error) {
            console.error('Error getting total rumors:', error);
            return 0;
        }
    }, [contracts.rumorRegistry]);

    // Create rumor
    const createRumor = useCallback(async (
        contentHash: string,
        evidenceHashes: string[],
        keywords: string[]
    ): Promise<number> => {
        if (!contracts.rumorRegistry || !signer) throw new Error('Not connected');

        try {
            const tx = await contracts.rumorRegistry.createRumor(contentHash, evidenceHashes, keywords);
            const receipt = await tx.wait();

            // Extract rumor ID from event
            const event = receipt.logs.find((log: any) => {
                try {
                    const parsed = contracts.rumorRegistry!.interface.parseLog(log);
                    return parsed?.name === 'RumorCreated';
                } catch { return false; }
            });

            if (event) {
                const parsed = contracts.rumorRegistry.interface.parseLog(event);
                return Number(parsed?.args.rumorID);
            }

            return 0;
        } catch (error) {
            console.error('Error creating rumor:', error);
            throw error;
        }
    }, [contracts.rumorRegistry, signer]);

    // Vote on rumor
    const voteOnRumor = useCallback(async (rumorID: number, voteType: 0 | 1): Promise<boolean> => {
        if (!contracts.votingSystem || !signer) throw new Error('Not connected');

        try {
            const tx = await contracts.votingSystem.voteOnRumor(rumorID, voteType);
            await tx.wait();
            return true;
        } catch (error) {
            console.error('Error voting:', error);
            throw error;
        }
    }, [contracts.votingSystem, signer]);

    // Check if user has voted
    const hasVoted = useCallback(async (rumorID: number, walletAddress?: string): Promise<boolean> => {
        if (!contracts.votingSystem) return false;
        const targetAddress = walletAddress || address;
        if (!targetAddress) return false;

        try {
            return await contracts.votingSystem.hasUserVoted(rumorID, targetAddress);
        } catch (error) {
            console.error('Error checking vote:', error);
            return false;
        }
    }, [contracts.votingSystem, address]);

    // Get credibility token balance
    const getCredibilityBalance = useCallback(async (walletAddress?: string): Promise<number> => {
        if (!contracts.credibilityToken) return 0;
        const targetAddress = walletAddress || address;
        if (!targetAddress) return 0;

        try {
            return Number(await contracts.credibilityToken.balanceOf(targetAddress));
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }, [contracts.credibilityToken, address]);

    return {
        contracts,
        isRegistered,
        getStudent,
        registerStudent,
        getRumor,
        getTotalRumors,
        createRumor,
        voteOnRumor,
        hasVoted,
        getCredibilityBalance,
    };
}
