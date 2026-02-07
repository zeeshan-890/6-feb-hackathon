const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export interface RumorContent {
    title: string;
    description: string;
    createdAt: string;
    evidenceHashes: string[];
}

export interface PreparedRumor {
    contentHash: string;
    evidenceHashes: string[];
    keywords: string[];
    potentialCorrelations: any[];
}

// Auth APIs
export async function sendVerificationCode(email: string): Promise<{ message: string; devCode?: string }> {
    const res = await fetch(`${BACKEND_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function confirmVerificationCode(email: string, code: string): Promise<{ token: string; email: string; walletAddress: string }> {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function loginWithToken(token: string): Promise<{ user: any }> {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}


// Rumor APIs
export async function createRumor(
    title: string,
    description: string,
    evidenceFiles: File[],
    token: string
): Promise<{ success: boolean; rumorId: string; contentHash: string }> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    evidenceFiles.forEach(file => formData.append('evidence', file));

    const res = await fetch(`${BACKEND_URL}/api/rumors/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function voteOnRumor(rumorId: number, voteType: boolean, token: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/votes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rumorId, voteType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
}


export async function getRumorContent(contentHash: string): Promise<RumorContent | null> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/rumors/0/content?hash=${contentHash}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function indexRumor(rumorID: number, contentHash: string, keywords: string[]): Promise<void> {
    await fetch(`${BACKEND_URL}/api/rumors/${rumorID}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentHash, keywords }),
    });
}

export async function getRumors(options?: {
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
}): Promise<{ rumors: any[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.search) params.append('search', options.search);

    const res = await fetch(`${BACKEND_URL}/api/rumors?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

// Single rumor detail via backend API
export async function getRumorById(rumorId: number): Promise<any> {
    const res = await fetch(`${BACKEND_URL}/api/rumors/${rumorId}`);
    if (!res.ok) {
        if (res.status === 404) return null;
        const data = await res.json();
        throw new Error(data.error);
    }
    return await res.json();
}

// User APIs
export async function getUserProfile(address: string): Promise<any> {
    const res = await fetch(`${BACKEND_URL}/api/users/${address}`);
    if (!res.ok) {
        if (res.status === 404) return null;
        const data = await res.json();
        throw new Error(data.error);
    }
    return await res.json();
}

export async function getUserStats(address: string): Promise<any> {
    const res = await fetch(`${BACKEND_URL}/api/users/${address}/stats`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

export async function checkUserVoted(address: string, rumorId: number): Promise<boolean> {
    const res = await fetch(`${BACKEND_URL}/api/users/${address}/votes/${rumorId}`);
    const data = await res.json();
    return data.voted;
}

// Correlation APIs
export async function getCorrelations(rumorId: number): Promise<{ supportive: any[]; contradictory: any[] }> {
    const res = await fetch(`${BACKEND_URL}/api/correlations/${rumorId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}

// IPFS Gateway URL
export function getIPFSUrl(hash: string): string {
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
}
