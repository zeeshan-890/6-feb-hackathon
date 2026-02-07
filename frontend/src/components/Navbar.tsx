'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function Navbar() {
    const pathname = usePathname();
    const { user, isLoggedIn, logout, isLoading } = useAuth();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="glass sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl">🔮</span>
                        <span className="font-bold text-xl gradient-text hidden sm:block">Campus Rumors</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <Link href="/" className={`px-3 py-2 rounded-lg ${isActive('/') ? 'text-primary-400' : 'text-gray-400 hover:text-white'}`}>
                            Home
                        </Link>
                        {isLoggedIn && (
                            <>
                                <Link href="/submit" className={`px-3 py-2 rounded-lg ${isActive('/submit') ? 'text-primary-400' : 'text-gray-400 hover:text-white'}`}>
                                    Submit
                                </Link>
                                <Link href="/profile" className={`px-3 py-2 rounded-lg ${isActive('/profile') ? 'text-primary-400' : 'text-gray-400 hover:text-white'}`}>
                                    Profile
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {isLoading ? (
                            <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse"></div>
                        ) : isLoggedIn ? (
                            <>
                                <div className="glass px-3 py-2 rounded-lg flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    <span className="text-sm">{user?.email}</span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="text-gray-400 hover:text-red-400 p-2"
                                    title="Logout"
                                >
                                    ✕
                                </button>
                            </>
                        ) : (
                            <Link href="/login" className="btn-primary text-sm">
                                Login
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
