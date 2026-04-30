"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    return (
        <div className="min-h-dvh bg-white flex items-center justify-center">
            <div className="text-center">
                <p className="text-gray-500 mb-4">Local mode: redirecting...</p>
            </div>
        </div>
    );
}
}
