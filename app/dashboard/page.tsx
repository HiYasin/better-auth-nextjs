"use client"
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending } = useSession();

    useEffect(() => {
        if (!isPending && !session) {
            router.push("/login");
        }
    }, [session, isPending, router]);

    if (isPending) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    const handleSignOut = async () => {
        await signOut();
        router.push("/");
    };
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <Button 
                        onClick={handleSignOut}
                        variant="outline"
                    >
                        Sign Out
                    </Button>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{session?.user?.name}</h2>
                            <p className="text-gray-600 mt-1">{session?.user?.email}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500">User ID</p>
                            <p className="text-gray-900 font-mono text-sm">{session?.user?.id}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-gray-500 text-sm font-medium">Total Users</h2>
                        <p className="text-3xl font-bold text-gray-900 mt-2">1,234</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-gray-500 text-sm font-medium">Active Sessions</h2>
                        <p className="text-3xl font-bold text-gray-900 mt-2">456</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-gray-500 text-sm font-medium">Revenue</h2>
                        <p className="text-3xl font-bold text-gray-900 mt-2">$12,543</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
                    <div className="space-y-3">
                        <p className="text-gray-600">No activity yet</p>
                    </div>
                </div>
            </div>
        </div>
    );
}