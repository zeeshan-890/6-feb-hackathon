'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    email?: string;
    emailHash?: string;
    walletAddress?: string;
    createdAt?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoggedIn: false,
    isLoading: true,
    login: () => { },
    logout: () => { },
    refreshUser: async () => { },
});

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing token on mount
        const savedToken = localStorage.getItem('user_token');
        if (savedToken) {
            setToken(savedToken);
            verifyToken(savedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    const verifyToken = async (authToken: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: authToken }),
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                // Token invalid, clear it
                localStorage.removeItem('user_token');
                setToken(null);
            }
        } catch (error) {
            console.error('Token verification failed:', error);
        }
        setIsLoading(false);
    };

    const login = (newToken: string, userData: User) => {
        localStorage.setItem('user_token', newToken);
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('user_token');
        setToken(null);
        setUser(null);
    };

    const refreshUser = async () => {
        if (token) {
            await verifyToken(token);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoggedIn: !!token && !!user,
            isLoading,
            login,
            logout,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
