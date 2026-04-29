"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

interface AuthRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
    limit?: number;
}

export function AuthRequiredModal({
    isOpen,
    onClose,
    limit = 5,
}: AuthRequiredModalProps) {
    const router = useRouter();

    if (!isOpen) return null;

    const handleLogin = () => {
        router.push("/login");
    };

    const handleSignup = () => {
        router.push("/signup");
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-199"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-200 w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-8 relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* Header */}
                    <div className="flex flex-col items-center justify-center mb-6 pt-2">
                        <h2 className="text-4xl font-light font-eb-garamond text-gray-900">
                            Continue?
                        </h2>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm leading-relaxed text-center">
                            You've reached your limit of {limit} queries. Create
                            a free account or log in to continue using
                            OpenJuris.
                        </p>

                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <Button
                                onClick={handleSignup}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Sign up for free
                            </Button>
                            <Button
                                onClick={handleLogin}
                                variant="ghost"
                                className="w-full bg-gray-100 hover:bg-gray-200 text-black border-0"
                            >
                                Log in
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
