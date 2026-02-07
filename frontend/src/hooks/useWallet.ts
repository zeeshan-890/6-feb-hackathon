'use client';

import { useContext } from 'react';
import { createContext } from 'react';
import { WalletProvider as WalletProviderComponent, useWallet as useWalletFromProvider } from '@/components/WalletProvider';

// Re-export the hook from WalletProvider
export const useWallet = useWalletFromProvider;
