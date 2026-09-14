"use client";

import * as React from "react";
import Link from "next/link";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, UserCheck, Shield } from "lucide-react";

export default function LandingPage() {
  const [locale, setLocale] = React.useState<"en" | "hi" | "pa">("en");

  const content = {
    en: {
      appName: "KisanSlot",
      ministry: "Ministry of Consumer Affairs, Food & Public Distribution",
      headline: "Farmer Grain Procurement & Live Queue Management",
      subheadline:
        "Book your grain delivery time slot at nearby procurement centres and track real-time gate queue status.",
      farmerTitle: "Farmer Login",
      farmerDesc: "Enter mobile number to get OTP for slot booking and live token tracking.",
      farmerBtn: "Farmer Login",
      adminTitle: "Centre Staff Login",
      adminDesc: "Staff portal for weighbridge operators, quality inspectors, and centre admins.",
      adminBtn: "Centre Staff Login",
      footer: "Smart India Hackathon 2026 • Problem Statement 26032",
    },
    hi: {
      appName: "किसानस्लॉट",
      ministry: "उपभोक्ता मामले, खाद्य एवं सार्वजनिक वितरण मंत्रालय",
      headline: "किसान अनाज खरीद एवं लाइव कतार प्रबंधन",
      subheadline:
        "निकटतम खरीद केंद्र पर अनाज वितरण हेतु समय स्लॉट बुक करें और वास्तविक समय कतार स्थिति देखें।",
      farmerTitle: "किसान लॉगिन",
      farmerDesc: "स्लॉट बुकिंग और लाइव टोकन ट्रैकिंग के लिए अपना मोबाइल नंबर दर्ज करें।",
      farmerBtn: "किसान लॉगिन",
      adminTitle: "केंद्र कर्मचारी लॉगिन",
      adminDesc: "वेब्रिज ऑपरेटरों, गुणवत्ता निरीक्षकों और केंद्र प्रबंधकों के लिए पोर्टल।",
      adminBtn: "कर्मचारी लॉगिन",
      footer: "स्मार्ट इंडिया हैकथॉन 2026 • समस्या विवरण 26032",
    },
    pa: {
      appName: "ਕਿਸਾਨਸਲਾਟ",
      ministry: "ਖਪਤਕਾਰ ਮਾਮਲੇ, ਭੋਜਨ ਅਤੇ ਜਨਤਕ ਵੰਡ ਮੰਤਰਾਲਾ",
      headline: "ਕਿਸਾਨ ਅਨਾਜ ਖਰੀਦ ਅਤੇ ਲਾਈਵ ਕਤਾਰ ਪ੍ਰਬੰਧਨ",
      subheadline:
        "ਨੇੜੇ ਦੇ ਖਰੀਦ ਕੇਂਦਰ ਵਿੱਚ ਅਨਾਜ ਵੰਡਣ ਲਈ ਸਮਾਂ ਸਲਾਟ ਬੁੱਕ ਕਰੋ ਅਤੇ ਅਸਲ-ਸਮੇਂ ਕਤਾਰ ਸਥਿਤੀ ਦੇਖੋ।",
      farmerTitle: "ਕਿਸਾਨ ਲੌਗਇਨ",
      farmerDesc: "ਸਲਾਟ ਬੁਕਿੰਗ ਅਤੇ ਲਾਈਵ ਟੋਕਨ ਟਰੈਕਿੰਗ ਲਈ ਆਪਣਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਾਖਲ ਕਰੋ।",
      farmerBtn: "ਕਿਸਾਨ ਲੌਗਇਨ",
      adminTitle: "ਕੇਂਦਰ ਕਰਮਚਾਰੀ ਲੌਗਇਨ",
      adminDesc: "ਵੇਬ੍ਰਿਜ ਓਪਰੇਟਰਾਂ, ਗੁਣਵੱਤਾ ਨਿਰੀਖਕਾਂ ਅਤੇ ਕੇਂਦਰ ਪ੍ਰਬੰਧਕਾਂ ਲਈ ਪੋਰਟਲ।",
      adminBtn: "ਕਰਮਚਾਰੀ ਲੌਗਇਨ",
      footer: "ਸਮਾਰਟ ਇੰਡੀਆ ਹੈਕਾਥੌਨ 2026 • ਸਮੱਸਿਆ ਵੇਰਵਾ 26032",
    },
  };

  const t = content[locale];

  return (
    <div className={`min-h-screen bg-white text-[#202124] flex flex-col justify-between font-sans${locale === "pa" ? " font-gurmukhi" : ""}`}>
      {/* Top Bar */}
      <header className="border-b border-[#DADCE0] bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Government Emblem / Clean Utility Logo */}
            <div className="w-8 h-8 rounded-[4px] bg-[#0B3D91] flex items-center justify-center text-white font-medium text-[16px]">
              KS
            </div>
            <div>
              <span className="text-[16px] font-medium text-[#202124] tracking-normal block leading-tight">
                {t.appName}
              </span>
              <span className="text-[11px] text-[#5F6368] hidden sm:block leading-tight">
                {t.ministry}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <LanguageToggle
              currentLocale={locale}
              onLocaleChange={(loc) => setLocale(loc)}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area (Centered, above the fold on mobile & desktop) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex-1 flex flex-col justify-center w-full">
        {/* Short, clear utility headline */}
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-6 sm:mb-10">
          <h1 className="text-[20px] sm:text-[22px] leading-[26px] sm:leading-[28px] font-medium text-[#202124]">
            {t.headline}
          </h1>
          <p className="text-[13px] sm:text-[14px] leading-[18px] sm:leading-[20px] text-[#5F6368] font-normal">
            {t.subheadline}
          </p>
        </div>

        {/* Two Primary Action Cards (Side-by-side on desktop, stacked on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto w-full">
          {/* Farmer Login Card */}
          <Card className="border-[#DADCE0] hover:border-[#0B3D91] transition-all p-5 sm:p-6 flex flex-col justify-between shadow-none hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.2)]">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91]">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h2 className="text-[16px] font-medium text-[#202124]">
                  {t.farmerTitle}
                </h2>
              </div>
              <p className="text-[13px] leading-[18px] text-[#5F6368] pt-1">
                {t.farmerDesc}
              </p>
            </div>

            <div className="pt-5 mt-auto">
              <Link href="/login/farmer" className="block w-full">
                <Button variant="default" className="w-full h-11 text-[14px] font-medium">
                  {t.farmerBtn}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Centre Staff Login Card */}
          <Card className="border-[#DADCE0] hover:border-[#0B3D91] transition-all p-5 sm:p-6 flex flex-col justify-between shadow-none hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.2)]">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-[4px] bg-[#F1F3F4] flex items-center justify-center text-[#5F6368]">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="text-[16px] font-medium text-[#202124]">
                  {t.adminTitle}
                </h2>
              </div>
              <p className="text-[13px] leading-[18px] text-[#5F6368] pt-1">
                {t.adminDesc}
              </p>
            </div>

            <div className="pt-5 mt-auto">
              <Link href="/login/admin" className="block w-full">
                <Button variant="outline" className="w-full h-11 text-[14px] font-medium">
                  {t.adminBtn}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#DADCE0] bg-[#F8F9FA] py-3 text-center">
        <p className="text-[11px] sm:text-[12px] text-[#5F6368]">
          {t.footer}
        </p>
      </footer>
    </div>
  );
}
