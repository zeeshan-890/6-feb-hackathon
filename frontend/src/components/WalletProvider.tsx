'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337');

interface WalletContextType {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    provider: ethers.Provider | null;
    signer: ethers.Signer | null;
    chainId: number | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
    address: null,
    isConnected: false,
    isConnecting: false,
    provider: null,
    signer: null,
    chainId: null,
    connect: async () => { },
    disconnect: () => { },
    signMessage: async () => '',
});

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [provider, setProvider] = useState<ethers.Provider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);

    useEffect(() => {
        // Always create a read-only provider for blockchain reads
        const readOnlyProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
        setProvider(readOnlyProvider);
        setChainId(CHAIN_ID);

        // If MetaMask is available, try to connect for signing
        if (typeof window !== 'undefined' && window.ethereum) {
            checkMetaMaskConnection();
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
        }

        return () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, []);

    const checkMetaMaskConnection = async () => {
        if (typeof window === 'undefined' || !window.ethereum) return;
        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await browserProvider.listAccounts();
            if (accounts.length > 0) {
                const signerInstance = await browserProvider.getSigner();
                const network = await browserProvider.getNetwork();
                setProvider(browserProvider);
                setSigner(signerInstance);
                setAddress(await signerInstance.getAddress());
                setChainId(Number(network.chainId));
            }
        } catch (error) {
            console.error('MetaMask check error:', error);
        }
    };

    const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) { disconnect(); }
        else { setAddress(accounts[0]); checkMetaMaskConnection(); }
    };

    const handleChainChanged = () => { window.location.reload(); };

    const connect = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            console.log('MetaMask not available — using read-only provider');
            return;
        }
        setIsConnecting(true);
        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            await browserProvider.send('eth_requestAccounts', []);
            const signerInstance = await browserProvider.getSigner();
            const network = await browserProvider.getNetwork();
            setProvider(browserProvider);
            setSigner(signerInstance);
            setAddress(await signerInstance.getAddress());
            setChainId(Number(network.chainId));
        } catch (error) {
            console.error('Connection error:', error);
        }
        setIsConnecting(false);
    };

    const disconnect = () => {
        // Revert to read-only provider
        const readOnlyProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
        setProvider(readOnlyProvider);
        setSigner(null);
        setAddress(null);
        setChainId(CHAIN_ID);
    };

    const signMessage = async (message: string): Promise<string> => {
        if (!signer) throw new Error('No signer available');
        return await signer.signMessage(message);
    };

    return (
        <WalletContext.Provider value={{
            address,
            isConnected: !!address,
            isConnecting,
            provider,
            signer,
            chainId,
            connect,
            disconnect,
            signMessage,
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => useContext(WalletContext);
export default WalletProvider;
