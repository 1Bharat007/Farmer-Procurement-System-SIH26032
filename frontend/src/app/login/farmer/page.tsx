"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, authStorage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LanguageToggle, Locale } from "@/components/ui/language-toggle";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export default function FarmerLoginPage() {
  const router = useRouter();
  const [locale, setLocale] = React.useState<Locale>("en");

  // Login form states
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [devOtpHint, setDevOtpHint] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Registration inline accordion state
  const [showRegister, setShowRegister] = React.useState(false);
  const [regData, setRegData] = React.useState({
    phone: "",
    full_name: "",
    village: "",
    district: "",
    state: "",
    preferred_language: "hi",
    crop_type: "Wheat",
  });
  const [regLoading, setRegLoading] = React.useState(false);
  const [regError, setRegError] = React.useState<string | null>(null);

  const t = {
    en: {
      appName: "KisanSlot",
      backHome: "Back to Home",
      title: "Farmer Login",
      subtitle: "Enter your registered mobile number to receive a verification OTP.",
      phoneLabel: "Mobile Number",
      phonePlaceholder: "10-digit mobile number (e.g. 9876543210)",
      sendOtpBtn: "Send OTP",
      otpLabel: "Enter 6-Digit OTP",
      otpPlaceholder: "6-digit OTP code",
      otpSentMsg: "OTP sent to +91 ",
      changePhone: "Change Number",
      verifyBtn: "Verify OTP & Login",
      resendOtp: "Resend OTP",
      newFarmerPrompt: "New farmer?",
      registerLink: "Register here",
      hideRegister: "Back to simple login",
      registerTitle: "Farmer Quick Registration",
      fullNameLabel: "Full Name (as per Aadhaar)",
      villageLabel: "Village",
      districtLabel: "District",
      stateLabel: "State",
      cropLabel: "Primary Crop Type",
      registerBtn: "Complete Registration & Login",
    },
    hi: {
      appName: "किसानस्लॉट",
      backHome: "मुख्य पृष्ठ पर लौटें",
      title: "किसान लॉगिन",
      subtitle: "सत्यापन ओटीपी प्राप्त करने के लिए अपना पंजीकृत मोबाइल नंबर दर्ज करें।",
      phoneLabel: "मोबाइल नंबर",
      phonePlaceholder: "10-अंकीय मोबाइल नंबर (उदा. 9876543210)",
      sendOtpBtn: "ओटीपी भेजें",
      otpLabel: "6-अंकीय ओटीपी दर्ज करें",
      otpPlaceholder: "6-अंकीय ओटीपी कोड",
      otpSentMsg: "ओटीपी भेजा गया: +91 ",
      changePhone: "नंबर बदलें",
      verifyBtn: "ओटीपी सत्यापित कर लॉगिन करें",
      resendOtp: "ओटीपी पुनः भेजें",
      newFarmerPrompt: "नए किसान हैं?",
      registerLink: "यहाँ नया पंजीकरण करें",
      hideRegister: "लॉगिन पर वापस जाएं",
      registerTitle: "किसान त्वरित पंजीकरण",
      fullNameLabel: "पूरा नाम (आधार अनुसार)",
      villageLabel: "गाँव",
      districtLabel: "ज़िला",
      stateLabel: "राज्य",
      cropLabel: "मुख्य फसल का प्रकार",
      registerBtn: "पंजीकरण पूर्ण कर लॉगिन करें",
    },
  }[locale === "pa" ? "hi" : locale];

  // Send OTP handler
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError(
        locale === "en"
          ? "Please enter a valid 10-digit mobile number."
          : "कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें।"
      );
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.auth.sendFarmerOTP(cleanPhone);
      setOtpSent(true);
      if (res.dev_otp) {
        setDevOtpHint(res.dev_otp);
      }
    } catch (err: any) {
      let errorMsg =
        err.message ||
        (locale === "en"
          ? "Failed to send OTP. Please try again."
          : "ओटीपी भेजने में विफल। पुनः प्रयास करें।");
      if (err.status === 429) {
        errorMsg =
          locale === "en"
            ? "Rate limit exceeded. Maximum 3 OTP requests allowed per 10 minutes. Please wait before trying again."
            : "ओटीपी अनुरोध सीमा समाप्त। 10 मिनट में अधिकतम 3 अनुरोध मान्य हैं। कृपया प्रतीक्षा करें।";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanPhone = phone.trim().replace(/\D/g, "");
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6) {
      setError(
        locale === "en"
          ? "Please enter the 6-digit OTP code."
          : "कृपया 6-अंकीय ओटीपी कोड दर्ज करें।"
      );
      return;
    }

    setLoading(true);
    try {
      // Pass optional inline registration fields if available
      const regPayload = regData.full_name
        ? {
            full_name: regData.full_name.trim(),
            village: regData.village.trim(),
            district: regData.district.trim(),
            state: regData.state.trim(),
            preferred_language: regData.preferred_language || locale,
            crop_type: regData.crop_type || "Wheat",
          }
        : undefined;

      const res = await apiClient.auth.verifyFarmerOTP(
        cleanPhone,
        cleanOtp,
        regPayload
      );
      authStorage.saveTokens(res.tokens || res, res.user);
      router.push("/farmer");
    } catch (err: any) {
      let errorMsg =
        err.message ||
        (locale === "en"
          ? "Invalid or expired OTP."
          : "अमान्य या समाप्त ओटीपी।");
      if (err.data?.detail) {
        errorMsg = err.data.detail;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Inline Registration handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    const cleanPhone = (regData.phone || phone).trim().replace(/\D/g, "");

    if (cleanPhone.length !== 10) {
      setRegError(
        locale === "en"
          ? "Please enter a valid 10-digit mobile number."
          : "कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें।"
      );
      return;
    }
    if (!regData.full_name.trim()) {
      setRegError(
        locale === "en"
          ? "Please enter your full name."
          : "कृपया अपना पूरा नाम दर्ज करें।"
      );
      return;
    }

    setRegLoading(true);
    try {
      // 1. Send OTP to the farmer's mobile number
      const res = await apiClient.auth.sendFarmerOTP(cleanPhone);
      setPhone(cleanPhone);
      setOtpSent(true);
      if (res.dev_otp) {
        setDevOtpHint(res.dev_otp);
      }
      // 2. Transition back to OTP verification view with registration fields preserved for the verify-otp call
      setShowRegister(false);
    } catch (err: any) {
      let errorMsg =
        err.message ||
        (locale === "en"
          ? "Failed to send OTP. Please try again."
          : "ओटीपी भेजने में विफल। पुनः प्रयास करें।");
      if (err.status === 429) {
        errorMsg =
          locale === "en"
            ? "Rate limit exceeded. Maximum 3 OTP requests allowed per 10 minutes. Please wait before trying again."
            : "ओटीपी अनुरोध सीमा समाप्त। 10 मिनट में अधिकतम 3 अनुरोध मान्य हैं। कृपया प्रतीक्षा करें।";
      }
      setRegError(errorMsg);
    } finally {
      setRegLoading(false);
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
            onLocaleChange={(loc) => {
              setLocale(loc);
              setRegData((prev) => ({ ...prev, preferred_language: loc }));
            }}
          />
        </div>
      </header>

      {/* Centered Login Card Container (Fits above the fold on mobile) */}
      <main className="max-w-md mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col justify-center w-full">
        <Card className="border-[#DADCE0] shadow-none bg-white p-5 sm:p-7">
          <CardHeader className="p-0 pb-4">
            <CardTitle size="large" className="text-[20px] sm:text-[22px]">
              {showRegister ? t.registerTitle : t.title}
            </CardTitle>
            <CardDescription className="text-[13px] leading-[18px]">
              {showRegister
                ? locale === "en"
                  ? "Enter your details to generate your digital farmer procurement identity."
                  : "अपनी डिजिटल किसान खरीद पहचान बनाने के लिए विवरण दर्ज करें।"
                : t.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            {!showRegister ? (
              /* OTP Login Flow */
              <div className="space-y-4">
                {error && (
                  <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-2.5">
                    {error}
                  </div>
                )}

                {!otpSent ? (
                  /* Step 1: Enter Phone Number */
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <Input
                      label={t.phoneLabel}
                      placeholder={t.phonePlaceholder}
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />

                    <Button
                      type="submit"
                      variant="default"
                      disabled={loading || phone.length !== 10}
                      className="w-full h-11 text-[14px]"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {t.sendOtpBtn}
                    </Button>
                  </form>
                ) : (
                  /* Step 2: Enter OTP Code on Same Page */
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="flex items-center justify-between text-[12px] bg-[#E8F0FE] text-[#0B3D91] p-2 rounded-[4px]">
                      <span>
                        {t.otpSentMsg}
                        <strong>{phone}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                          setError(null);
                        }}
                        className="text-[#0B3D91] underline font-medium hover:text-[#082E6E]"
                      >
                        {t.changePhone}
                      </button>
                    </div>

                    {devOtpHint && (
                      <div className="text-[11px] text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] rounded-[4px] p-2">
                        Demo OTP Code: <strong>{devOtpHint}</strong> (or 123456)
                      </div>
                    )}

                    <Input
                      label={t.otpLabel}
                      placeholder={t.otpPlaceholder}
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />

                    <Button
                      type="submit"
                      variant="default"
                      disabled={loading || otp.length !== 6}
                      className="w-full h-11 text-[14px]"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {t.verifyBtn}
                    </Button>
                  </form>
                )}

                {/* Inline Toggle to Registration */}
                <div className="pt-3 border-t border-[#DADCE0] text-center">
                  <span className="text-[13px] text-[#5F6368] mr-1">
                    {t.newFarmerPrompt}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(true);
                      setRegData((prev) => ({ ...prev, phone: phone }));
                      setError(null);
                    }}
                    className="text-[13px] font-medium text-[#0B3D91] hover:underline"
                  >
                    {t.registerLink}
                  </button>
                </div>
              </div>
            ) : (
              /* Inline Registration Form (Expanded on same page) */
              <form onSubmit={handleRegister} className="space-y-3.5">
                {regError && (
                  <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-2.5">
                    {regError}
                  </div>
                )}

                <Input
                  label={t.phoneLabel}
                  type="tel"
                  maxLength={10}
                  value={regData.phone || phone}
                  onChange={(e) =>
                    setRegData({ ...regData, phone: e.target.value.replace(/\D/g, "") })
                  }
                  required
                />

                <Input
                  label={t.fullNameLabel}
                  placeholder="e.g. Ramesh Kumar"
                  value={regData.full_name}
                  onChange={(e) => setRegData({ ...regData, full_name: e.target.value })}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t.villageLabel}
                    placeholder="e.g. Karnal Rural"
                    value={regData.village}
                    onChange={(e) => setRegData({ ...regData, village: e.target.value })}
                  />

                  <Input
                    label={t.districtLabel}
                    placeholder="e.g. Karnal"
                    value={regData.district}
                    onChange={(e) => setRegData({ ...regData, district: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t.stateLabel}
                    placeholder="e.g. Haryana"
                    value={regData.state}
                    onChange={(e) => setRegData({ ...regData, state: e.target.value })}
                  />

                  <div className="flex flex-col space-y-1">
                    <label className="text-[12px] leading-[16px] font-medium text-[#5F6368]">
                      {t.cropLabel}
                    </label>
                    <select
                      value={regData.crop_type}
                      onChange={(e) =>
                        setRegData({ ...regData, crop_type: e.target.value })
                      }
                      className="h-10 w-full rounded-[4px] border border-[#DADCE0] bg-white px-2.5 text-[14px] text-[#202124] focus:border-[#0B3D91] focus:outline-none"
                    >
                      <option value="Wheat">Wheat (गेहूँ)</option>
                      <option value="Paddy (Common)">Paddy - Common (धान)</option>
                      <option value="Paddy (Grade A)">Paddy - Grade A (धान)</option>
                      <option value="Mustard">Mustard (सरसों)</option>
                      <option value="Pulses/Gram">Pulses / Gram (चना/दाल)</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="default"
                  disabled={regLoading}
                  className="w-full h-11 text-[14px] mt-2"
                >
                  {regLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  {t.registerBtn}
                </Button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegister(false);
                      setRegError(null);
                    }}
                    className="text-[13px] text-[#5F6368] hover:text-[#0B3D91] hover:underline"
                  >
                    {t.hideRegister}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DADCE0] bg-white py-3 text-center text-[11px] text-[#5F6368]">
        Ministry of Consumer Affairs, Food & Public Distribution • SIH 2026
      </footer>
    </div>
  );
}
