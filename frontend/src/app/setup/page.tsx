'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/hooks/useWallet';

export default function SetupPage() {
    const { isConnected, connect, chainId } = useWallet();
    const [step, setStep] = useState(1);

    const addLocalNetwork = async () => {
        if (typeof window === 'undefined' || !window.ethereum) return;

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x7A69', // 31337 in hex
                    chainName: 'Localhost 8545',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['http://127.0.0.1:8545'],
                }],
            });
            setStep(4);
        } catch (error) {
            console.error('Failed to add network:', error);
        }
    };

    const addPolygonAmoy = async () => {
        if (typeof window === 'undefined' || !window.ethereum) return;

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x13882', // 80002 in hex
                    chainName: 'Polygon Amoy Testnet',
                    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                    rpcUrls: ['https://rpc-amoy.polygon.technology'],
                    blockExplorerUrls: ['https://www.oklink.com/amoy'],
                }],
            });
            setStep(4);
        } catch (error) {
            console.error('Failed to add network:', error);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-4xl font-bold text-center mb-4">
                <span className="gradient-text">Getting Started</span>
            </h1>
            <p className="text-gray-400 text-center mb-12">
                Follow these steps to set up your wallet and start using Campus Rumors
            </p>

            {/* Step 1: Install MetaMask */}
            <div className={`card mb-6 ${step >= 1 ? 'border-primary-500/50' : 'opacity-50'}`}>
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${step > 1 ? 'bg-green-500' : 'bg-primary-600'}`}>
                        {step > 1 ? '✓' : '1'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-2">Install MetaMask</h2>
                        <p className="text-gray-400 mb-4">
                            MetaMask is a free browser extension that lets you interact with blockchain apps securely.
                        </p>

                        {step === 1 && (
                            <div className="space-y-4">
                                <a
                                    href="https://metamask.io/download/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary inline-flex items-center gap-2"
                                >
                                    <span className="text-xl">🦊</span>
                                    Download MetaMask
                                </a>
                                <p className="text-sm text-gray-500">
                                    After installing, create a new wallet and save your recovery phrase safely.
                                </p>
                                <button
                                    onClick={() => setStep(2)}
                                    className="text-primary-400 text-sm hover:underline"
                                >
                                    I already have MetaMask →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 2: Add Network */}
            <div className={`card mb-6 ${step >= 2 ? 'border-primary-500/50' : 'opacity-50'}`}>
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${step > 2 ? 'bg-green-500' : step >= 2 ? 'bg-primary-600' : 'bg-gray-700'}`}>
                        {step > 2 ? '✓' : '2'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-2">Add Network</h2>
                        <p className="text-gray-400 mb-4">
                            Connect to the Campus Rumors network. Click the button below to add it automatically.
                        </p>

                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        onClick={addLocalNetwork}
                                        className="glass p-4 rounded-lg hover:bg-white/10 transition-colors text-left"
                                    >
                                        <div className="text-lg font-semibold mb-1">🏠 Local Network</div>
                                        <div className="text-sm text-gray-400">For development & testing</div>
                                        <div className="text-xs text-green-400 mt-2">Free, instant transactions</div>
                                    </button>
                                    <button
                                        onClick={addPolygonAmoy}
                                        className="glass p-4 rounded-lg hover:bg-white/10 transition-colors text-left"
                                    >
                                        <div className="text-lg font-semibold mb-1">🔷 Polygon Amoy</div>
                                        <div className="text-sm text-gray-400">Testnet deployment</div>
                                        <div className="text-xs text-yellow-400 mt-2">Get free tokens from faucet</div>
                                    </button>
                                </div>
                                <button
                                    onClick={() => setStep(3)}
                                    className="text-gray-500 text-sm hover:text-gray-300"
                                >
                                    Skip for now →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 3: Get Test Tokens (for testnet) */}
            <div className={`card mb-6 ${step >= 3 ? 'border-primary-500/50' : 'opacity-50'}`}>
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${step > 3 ? 'bg-green-500' : step >= 3 ? 'bg-primary-600' : 'bg-gray-700'}`}>
                        {step > 3 ? '✓' : '3'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-2">Get Test Tokens (Optional)</h2>
                        <p className="text-gray-400 mb-4">
                            If using a testnet, get free tokens to pay for transactions. <strong>Local network doesn't need this!</strong>
                        </p>

                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="glass rounded-lg p-4">
                                    <h3 className="font-medium mb-2">Using Local Network?</h3>
                                    <p className="text-sm text-gray-400 mb-3">
                                        Import a test account from your terminal. Look for the accounts listed when you ran <code className="text-primary-400">npx hardhat node</code>
                                    </p>
                                    <div className="bg-gray-900 rounded p-3 text-xs font-mono text-gray-300 overflow-x-auto">
                                        Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266<br />
                                        Private Key: 0xac0974bec39a17e36ba4a6b4d238ff...
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        In MetaMask: Menu → Import Account → Paste private key
                                    </p>
                                </div>

                                <div className="glass rounded-lg p-4">
                                    <h3 className="font-medium mb-2">Using Polygon Amoy?</h3>
                                    <a
                                        href="https://faucet.polygon.technology/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-400 hover:underline text-sm"
                                    >
                                        Get free MATIC from Polygon Faucet →
                                    </a>
                                </div>

                                <button onClick={() => setStep(4)} className="btn-primary">
                                    Continue →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 4: Connect Wallet */}
            <div className={`card mb-6 ${step >= 4 ? 'border-primary-500/50' : 'opacity-50'}`}>
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isConnected ? 'bg-green-500' : step >= 4 ? 'bg-primary-600' : 'bg-gray-700'}`}>
                        {isConnected ? '✓' : '4'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
                        <p className="text-gray-400 mb-4">
                            Connect MetaMask to start using Campus Rumors!
                        </p>

                        {step >= 4 && (
                            <div className="space-y-4">
                                {isConnected ? (
                                    <div className="glass rounded-lg p-4 flex items-center gap-3">
                                        <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                                        <span className="text-green-400">Wallet Connected!</span>
                                        <span className="text-gray-500 text-sm ml-auto">
                                            Chain: {chainId === 31337 ? 'Localhost' : chainId === 80002 ? 'Polygon Amoy' : chainId}
                                        </span>
                                    </div>
                                ) : (
                                    <button onClick={connect} className="btn-primary">
                                        🦊 Connect MetaMask
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* All Done */}
            {isConnected && (
                <div className="card text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold mb-4">You're All Set!</h2>
                    <p className="text-gray-400 mb-6">
                        Your wallet is connected. Now register with your university email to start posting and voting on rumors.
                    </p>
                    <Link href="/register" className="btn-primary inline-block">
                        Continue to Registration →
                    </Link>
                </div>
            )}

            {/* Help Section */}
            <div className="mt-12 glass rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">❓ Need Help?</h3>
                <div className="space-y-3 text-sm text-gray-400">
                    <details className="cursor-pointer">
                        <summary className="font-medium text-white hover:text-primary-400">What is MetaMask?</summary>
                        <p className="mt-2 pl-4">
                            MetaMask is a secure digital wallet that lets you interact with blockchain applications.
                            It's like a password manager for Web3 - your identity is controlled by you, not a corporation.
                        </p>
                    </details>
                    <details className="cursor-pointer">
                        <summary className="font-medium text-white hover:text-primary-400">Is it safe?</summary>
                        <p className="mt-2 pl-4">
                            Yes! MetaMask is open-source and used by millions. Your private keys never leave your device.
                            Just never share your recovery phrase with anyone.
                        </p>
                    </details>
                    <details className="cursor-pointer">
                        <summary className="font-medium text-white hover:text-primary-400">Do I need to pay?</summary>
                        <p className="mt-2 pl-4">
                            On the local network (for testing), everything is free. On testnets, you get free tokens from faucets.
                            There are no real costs for using this demo.
                        </p>
                    </details>
                </div>
            </div>
        </div>
    );
}
