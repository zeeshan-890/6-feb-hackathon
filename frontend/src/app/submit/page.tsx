'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createRumor } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SubmitRumorPage() {
    const router = useRouter();
    const { token, user } = useAuth();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [keywords, setKeywords] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            if (files.length > 5) {
                toast.error('Maximum 5 evidence files allowed');
                return;
            }
            setEvidenceFiles(files);
        }
    };

    const addKeyword = (keyword: string) => {
        const clean = keyword.toLowerCase().trim();
        if (clean && !keywords.includes(clean)) {
            setKeywords([...keywords, clean]);
        }
    };

    const removeKeyword = (keyword: string) => {
        setKeywords(keywords.filter(k => k !== keyword));
    };

    const handleSubmit = async () => {
        if (!title.trim() || !description.trim()) {
            toast.error('Please fill in required fields');
            return;
        }

        if (!token) {
            toast.error('Please login to submit a rumor');
            router.push('/login');
            return;
        }

        setLoading(true);
        try {
            // Note: We are not handling manual keywords being sent yet in the API
            // but for MVP the backend generates them with AI. 
            // If we want to support manual keywords, backend/rumors.js needs update.
            // For now, let's just proceed with standard submission.

            const result = await createRumor(title, description, evidenceFiles, token);

            if (result.success) {
                toast.success('Rumor submitted successfully!');
                router.push(`/rumor/${result.rumorId}`);
            }
        } catch (error: any) {
            console.error('Error submitting:', error);
            toast.error(error.message || 'Failed to submit rumor');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
                <p className="mb-4">You need to log in with your permanent token to submit rumors.</p>
                <button onClick={() => router.push('/login')} className="btn-primary">
                    Go to Login
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Submit a Rumor</h1>
            <p className="text-gray-400 mb-8">Share something you've heard on campus</p>

            <div className="card space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium mb-2">Title *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Brief title for the rumor"
                        className="input w-full"
                        maxLength={100}
                    />
                    <div className="text-right text-xs text-gray-500 mt-1">{title.length}/100</div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium mb-2">Description *</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe the rumor in detail. Include dates, locations, and what you heard..."
                        className="input w-full h-40 resize-none"
                        maxLength={2000}
                    />
                    <div className="text-right text-xs text-gray-500 mt-1">{description.length}/2000</div>
                </div>

                {/* Evidence */}
                <div>
                    <label className="block text-sm font-medium mb-2">Evidence (Optional)</label>
                    <div className="glass rounded-lg p-6 border-2 border-dashed border-gray-700 hover:border-primary-500 transition-colors">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            multiple
                            accept="image/*,video/*,.pdf,.doc,.docx"
                            className="hidden"
                            id="evidence-upload"
                        />
                        <label htmlFor="evidence-upload" className="cursor-pointer block text-center">
                            <div className="text-4xl mb-2">📎</div>
                            <div className="text-gray-400">Click to upload evidence (max 5 files)</div>
                            <div className="text-gray-600 text-sm mt-1">Screenshots, documents, videos</div>
                        </label>
                    </div>

                    {evidenceFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {evidenceFiles.map((file, i) => (
                                <div key={i} className="glass rounded-lg p-3 flex justify-between items-center">
                                    <span className="text-sm truncate">{file.name}</span>
                                    <button
                                        onClick={() => setEvidenceFiles(evidenceFiles.filter((_, idx) => idx !== i))}
                                        className="text-red-400 hover:text-red-300 ml-2"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !title.trim() || !description.trim()}
                        className="btn-primary w-full"
                    >
                        {loading ? 'Submitting...' : 'Submit Rumor →'}
                    </button>
                    <p className="text-center text-gray-600 text-xs mt-2">
                        Your rumor will be processed by AI and verified on blockchain (gasless!)
                    </p>
                </div>
            </div>
        </div>
    );
}

