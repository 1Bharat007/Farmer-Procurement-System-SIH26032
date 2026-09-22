"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log unexpected React rendering or lifecycle errors
    console.error("[GLOBAL REACT ERROR]", error);
  }, [error]);

  const isNetwork =
    error?.name === "TypeError" ||
    (error?.message && error.message.toLowerCase().includes("fetch")) ||
    (error?.message && error.message.toLowerCase().includes("network"));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="border-b border-[#DADCE0] bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-[4px] bg-[#0B3D91] flex items-center justify-center text-white font-medium text-[16px]">
              KS
            </div>
            <div>
              <span className="text-[16px] font-medium text-[#202124] block leading-tight">
                KisanSlot
              </span>
              <span className="text-[11px] text-[#5F6368] hidden sm:block leading-tight">
                Ministry of Consumer Affairs, Food & Public Distribution
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="text-[13px] text-[#0B3D91] hover:underline flex items-center space-x-1"
          >
            <Home className="w-4 h-4 mr-1" />
            Home
          </Link>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="max-w-xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center w-full">
        <Card className="border border-[#DADCE0] shadow-sm bg-white">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-[#FCE8E6] text-[#D93025] flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-[20px] font-medium text-[#202124]">
              {isNetwork ? "Network Connection Error" : "Something went wrong"}
            </CardTitle>
            <CardDescription className="text-[13px] text-[#5F6368] mt-1">
              {isNetwork
                ? "The application could not connect to the platform server. Please check your internet connection and try again."
                : "An unexpected application error occurred while displaying this page. Your data is safe."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {/* Error Details Box (clean, subtle) */}
            <div className="p-3 bg-[#F8F9FA] border border-[#DADCE0] rounded-[4px] text-[12px] text-[#5F6368] break-words">
              <span className="font-medium text-[#202124]">Detail: </span>
              {error?.message || "Internal application render error"}
              {error?.digest && (
                <div className="mt-1 text-[11px] text-[#80868B]">
                  Reference ID: {error.digest}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="default"
                onClick={() => reset()}
                className="flex-1 flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Link href="/" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DADCE0] bg-white py-4 text-center text-[12px] text-[#5F6368]">
        Smart India Hackathon 2026 • Problem Statement 26032
      </footer>
    </div>
  );
}
