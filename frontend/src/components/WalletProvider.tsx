'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface WalletContextType {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    provider: ethers.BrowserProvider | null;
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
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);

    useEffect(() => {
        // Check if already connected
        checkConnection();

        // Listen for account changes
        if (typeof window !== 'undefined' && window.ethereum) {
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

    const checkConnection = async () => {
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
            console.error('Check connection error:', error);
        }
    };

    const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
            disconnect();
        } else {
            setAddress(accounts[0]);
            checkConnection();
        }
    };

    const handleChainChanged = () => {
        window.location.reload();
    };

    const connect = async () => {
        if (typeof window === 'undefined' || !window.ethereum) {
            // Redirect to setup page instead of alert
            window.location.href = '/setup';
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
        setAddress(null);
        setProvider(null);
        setSigner(null);
        setChainId(null);
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
