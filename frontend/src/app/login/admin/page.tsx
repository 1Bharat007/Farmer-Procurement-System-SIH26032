"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, authStorage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [locale, setLocale] = React.useState<"en" | "hi">("en");

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const t = {
    en: {
      appName: "KisanSlot",
      backHome: "Back to Home",
      title: "Centre Staff & Officer Login",
      subtitle: "Sign in with your government procurement operator or officer credentials.",
      usernameLabel: "Username or Staff ID",
      usernamePlaceholder: "e.g. admin or operator_karnal",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your secure password",
      submitBtn: "Sign In to Admin Console",
      demoHint: "Demo Admin Credentials: username: admin / password: admin123",
      footer: "Ministry of Consumer Affairs, Food & Public Distribution • SIH 2026",
    },
    hi: {
      appName: "किसानस्लॉट",
      backHome: "मुख्य पृष्ठ पर लौटें",
      title: "केंद्र कर्मचारी एवं अधिकारी लॉगिन",
      subtitle: "अपने सरकारी खरीद ऑपरेटर या प्रशासनिक पहचान से साइन इन करें।",
      usernameLabel: "उपयोगकर्ता नाम / स्टाफ आईडी",
      usernamePlaceholder: "उदा. admin या operator_karnal",
      passwordLabel: "पासवर्ड",
      passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
      submitBtn: "प्रशासनिक कंसोल में साइन इन करें",
      demoHint: "डेमो स्टाफ क्रेडेंशियल्स: यूज़रनेम: admin / पासवर्ड: admin123",
      footer: "उपभोक्ता मामले, खाद्य एवं सार्वजनिक वितरण मंत्रालय • SIH 2026",
    },
  }[locale];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation: required fields
    if (!username.trim() || !password.trim()) {
      setError(
        locale === "en"
          ? "Please enter both username and password."
          : "कृपया उपयोगकर्ता नाम और पासवर्ड दोनों दर्ज करें।"
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Authenticate via POST /api/auth/token/
      const res = await apiClient.auth.loginStaff({
        username: username.trim(),
        password: password.trim(),
      });

      // 2. Save tokens to localStorage
      authStorage.saveTokens(res.tokens || res, res.user);

      // 3. Confirm role and fetch profile details from GET /api/auth/me/
      try {
        const me = await apiClient.auth.getCurrentUser();
        const mergedUser = {
          ...res.user,
          ...me,
          centre_name: me?.profile?.centre_name || res.user?.centre_name,
        };
        authStorage.saveTokens(res.tokens || res, mergedUser);
      } catch (profileErr) {
        console.warn("Profile verification warning:", profileErr);
      }

      // 4. Redirect to /dashboard
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.message ||
          (locale === "en"
            ? "Invalid username or password."
            : "अमान्य उपयोगकर्ता नाम या पासवर्ड।")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="border-b border-[#DADCE0] bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] sm:text-[14px] font-medium text-[#0B3D91] hover:underline flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            {t.backHome}
          </Link>

          <LanguageToggle
            currentLocale={locale}
            onLocaleChange={(loc) => setLocale(loc)}
          />
        </div>
      </header>

      {/* Centered Login Card (Fits above the fold on mobile) */}
      <main className="max-w-md mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col justify-center w-full">
        <Card className="border-[#DADCE0] shadow-none bg-white p-5 sm:p-7">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-6 h-6 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-[12px] font-medium text-[#0B3D91] uppercase tracking-wider">
                Staff Authentication
              </span>
            </div>
            <CardTitle size="large" className="text-[20px] sm:text-[22px]">
              {t.title}
            </CardTitle>
            <CardDescription className="text-[13px] leading-[18px]">
              {t.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-2.5">
                  {error}
                </div>
              )}

              <Input
                label={t.usernameLabel}
                placeholder={t.usernamePlaceholder}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              <Input
                label={t.passwordLabel}
                placeholder={t.passwordPlaceholder}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="default"
                disabled={loading}
                className="w-full h-11 text-[14px]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {t.submitBtn}
              </Button>
            </form>

            <div className="mt-4 pt-3 border-t border-[#DADCE0] text-center">
              <p className="text-[11px] text-[#5F6368] bg-[#F8F9FA] border border-[#DADCE0] rounded-[4px] p-2">
                💡 {t.demoHint}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DADCE0] bg-white py-3 text-center text-[11px] text-[#5F6368]">
        {t.footer}
      </footer>
    </div>
  );
}
