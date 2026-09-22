"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle, Locale } from "@/components/ui/language-toggle";
import {
  ArrowLeft,
  Check,
  Search,
  Calendar,
  AlertCircle,
  FileText,
} from "lucide-react";

export default function StyleGuidePage() {
  const [currentLocale, setCurrentLocale] = React.useState<Locale>("en");
  const [inputValue, setInputValue] = React.useState("Kisan Registration No: 8849201");
  const [inputError, setInputError] = React.useState("987654321");

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#202124] flex flex-col font-sans">
      {/* Google Minimal Top Bar */}
      <header className="border-b border-[#DADCE0] bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="text-[14px] font-medium text-[#0B3D91] hover:underline flex items-center mr-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
            <div className="h-5 w-px bg-[#DADCE0]" />
            <span className="text-[16px] font-medium text-[#202124] tracking-normal">
              KisanSlot Design System
            </span>
            <Badge variant="info">v1.0 • Google Standard</Badge>
          </div>

          <div className="flex items-center space-x-3">
            <LanguageToggle
              currentLocale={currentLocale}
              onLocaleChange={(loc) => setCurrentLocale(loc)}
            />
            <Button size="sm" variant="outline">
              Documentation
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-12">
        {/* Design System Header */}
        <section className="border-b border-[#DADCE0] pb-6">
          <h1 className="text-[22px] leading-[28px] font-medium text-[#202124]">
            Design System & Component Style Guide
          </h1>
          <p className="text-[14px] leading-[20px] text-[#5F6368] mt-1 max-w-3xl">
            Established design specifications for the KisanSlot procurement platform. Adheres to Material Design 3 guidelines: clean white surfaces, Google background gray separations, Google Navy (#0B3D91) branding, Roboto typography scale, and 8px grid whitespace.
          </p>
        </section>

        {/* 1. Color Palette */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              1. Color Palette Tokens
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Defined in <code className="text-[#0B3D91] bg-[#F8F9FA] px-1 py-0.5 rounded-[4px] border border-[#DADCE0]">tailwind.config.ts</code> as named tokens.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Primary Navy */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#0B3D91]" />
              <div className="text-[14px] font-medium text-[#202124]">Google Navy</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#0B3D91</div>
              <div className="text-[12px] text-[#5F6368]">Primary brand, headers, buttons</div>
            </div>

            {/* Google Blue Accent */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#1A73E8]" />
              <div className="text-[14px] font-medium text-[#202124]">Google Blue</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#1A73E8</div>
              <div className="text-[12px] text-[#5F6368]">Active states & link accents</div>
            </div>

            {/* Google Success Green */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#1E8E3E]" />
              <div className="text-[14px] font-medium text-[#202124]">Success Green</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#1E8E3E</div>
              <div className="text-[12px] text-[#5F6368]">Confirmed slots, completed status</div>
            </div>

            {/* Google Error Red */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#D93025]" />
              <div className="text-[14px] font-medium text-[#202124]">Error Red</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#D93025</div>
              <div className="text-[12px] text-[#5F6368]">Failed validation, cancellations</div>
            </div>

            {/* Surface White */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#FFFFFF] border border-[#DADCE0]" />
              <div className="text-[14px] font-medium text-[#202124]">Surface White</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#FFFFFF</div>
              <div className="text-[12px] text-[#5F6368]">Dominant page & card surface</div>
            </div>

            {/* Background Gray */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#F8F9FA] border border-[#DADCE0]" />
              <div className="text-[14px] font-medium text-[#202124]">Neutral Canvas Gray</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#F8F9FA</div>
              <div className="text-[12px] text-[#5F6368]">Subtle section separation</div>
            </div>

            {/* Text Primary */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#202124]" />
              <div className="text-[14px] font-medium text-[#202124]">Primary Text</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#202124</div>
              <div className="text-[12px] text-[#5F6368]">Near-black for readability</div>
            </div>

            {/* Divider Border */}
            <div className="rounded-[8px] border border-[#DADCE0] p-4 bg-white space-y-2">
              <div className="h-12 rounded-[4px] bg-[#DADCE0]" />
              <div className="text-[14px] font-medium text-[#202124]">Divider Gray</div>
              <div className="text-[12px] text-[#5F6368] font-mono">#DADCE0</div>
              <div className="text-[12px] text-[#5F6368]">1px borders & separators</div>
            </div>
          </div>
        </section>

        {/* 2. Typography Scale */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              2. Typography Scale (Roboto / Material Design 3)
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Hierarchical type scale using weight 500 for headers and 400 for content. No heavy bold (700+).
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="border-b border-[#DADCE0] pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12px] text-[#5F6368] uppercase font-mono">
                    Page Title (22px / 28px • Weight 500)
                  </div>
                  <h1 className="text-[22px] leading-[28px] font-medium text-[#202124] mt-1">
                    Grain Procurement Intake Schedule
                  </h1>
                </div>
                <span className="text-[12px] text-[#5F6368] font-mono">
                  text-[22px] leading-[28px] font-medium
                </span>
              </div>

              <div className="border-b border-[#DADCE0] pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12px] text-[#5F6368] uppercase font-mono">
                    Section Header (16px / 24px • Weight 500)
                  </div>
                  <h2 className="text-[16px] leading-[24px] font-medium text-[#202124] mt-1">
                    Available Delivery Windows & Centre Storage Capacity
                  </h2>
                </div>
                <span className="text-[12px] text-[#5F6368] font-mono">
                  text-[16px] leading-[24px] font-medium
                </span>
              </div>

              <div className="border-b border-[#DADCE0] pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12px] text-[#5F6368] uppercase font-mono">
                    Body Text (14px / 20px • Weight 400)
                  </div>
                  <p className="text-[14px] leading-[20px] text-[#202124] font-normal mt-1">
                    Farmers are allotted specific 45-minute windows for unloading at Weighbridge Gate 2. Please ensure your Jan-Dhan Aadhaar verification is current before entry.
                  </p>
                </div>
                <span className="text-[12px] text-[#5F6368] font-mono">
                  text-[14px] leading-[20px] font-normal
                </span>
              </div>

              <div className="border-b border-[#DADCE0] pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12px] text-[#5F6368] uppercase font-mono">
                    Secondary / Caption Text (12px / 16px • Weight 400)
                  </div>
                  <p className="text-[12px] leading-[16px] text-[#5F6368] font-normal mt-1">
                    Last updated 2 minutes ago by FCI Regional Depot (Nafed Central).
                  </p>
                </div>
                <span className="text-[12px] text-[#5F6368] font-mono">
                  text-[12px] leading-[16px] text-[#5F6368]
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12px] text-[#5F6368] uppercase font-mono">
                    Button Text (14px • Weight 500 • 0.25px Letter-Spacing)
                  </div>
                  <div className="text-[14px] leading-[20px] font-medium tracking-[0.25px] text-[#0B3D91] mt-1">
                    Confirm Slot Reservation
                  </div>
                </div>
                <span className="text-[12px] text-[#5F6368] font-mono">
                  text-[14px] font-medium tracking-[0.25px]
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 3. Buttons Showcase */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              3. Button Components
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Google-style buttons: 4px radius, no drop shadows, no pill shapes, no gradients.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Variants */}
              <div>
                <div className="text-[12px] text-[#5F6368] mb-3 font-medium uppercase">
                  Variants
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="default">Filled Primary (Navy)</Button>
                  <Button variant="outline">Outlined Secondary</Button>
                  <Button variant="text">Text-Only Action</Button>
                  <Button variant="secondary">Subtle Gray</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="destructiveText">Destructive Text</Button>
                  <Button disabled>Disabled State</Button>
                </div>
              </div>

              {/* Sizes & Icons */}
              <div className="border-t border-[#DADCE0] pt-4">
                <div className="text-[12px] text-[#5F6368] mb-3 font-medium uppercase">
                  Sizes & Functional Icons (Used Sparingly)
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small (h-8)</Button>
                  <Button size="default">Default (h-9)</Button>
                  <Button size="lg">Large (h-10)</Button>
                  <Button variant="default">
                    <Check className="w-4 h-4 mr-1.5" />
                    Verify Token
                  </Button>
                  <Button variant="outline">
                    <Search className="w-4 h-4 mr-1.5" />
                    Search Mandi
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4. Form Inputs */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              4. Form Inputs (Google Outlined Field Style)
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Labels above/inside the field, 1px border (#DADCE0) focusing to navy (#0B3D91), 4px border radius.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Farmer Aadhaar / Registration Number"
                  placeholder="Enter 12-digit Aadhaar or Kisan ID"
                  required
                  helperText="Required for Jan-Dhan direct benefit transfer verification."
                />

                <Input
                  label="Registered Mobile Number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="SMS slot reminder notifications will be sent here."
                />

                <Input
                  label="Procurement Centre Code"
                  value={inputError}
                  onChange={(e) => setInputError(e.target.value)}
                  error
                  errorMessage="Invalid centre code. Must match a registered Mandi depot ID."
                />

                <Input
                  label="Estimated Grain Weight (Quintals)"
                  defaultValue="45.50"
                  disabled
                  helperText="Calculated from pre-registered land acreage survey."
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 5. Status Badges */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              5. Status Badges (Google Status-Chip Pattern)
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Small pill-shaped chips with light tint backgrounds and contrasting text. Never solid saturated fills.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <div className="text-[12px] text-[#5F6368] mb-3 font-medium uppercase">
                  Standard Status Chips
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="success">Slot Confirmed</Badge>
                  <Badge variant="warning">In Queue • Position #4</Badge>
                  <Badge variant="error">Cancelled / Rejected</Badge>
                  <Badge variant="info">Gate #2 Open</Badge>
                  <Badge variant="neutral">Wheat (Kharif 2026)</Badge>
                </div>
              </div>

              <div className="border-t border-[#DADCE0] pt-4">
                <div className="text-[12px] text-[#5F6368] mb-3 font-medium uppercase">
                  With Status Indicator Dot
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="success" dot>
                    MSP Verified & Disbursed
                  </Badge>
                  <Badge variant="warning" dot>
                    Moisture Testing Pending
                  </Badge>
                  <Badge variant="error" dot>
                    Slot Expired
                  </Badge>
                  <Badge variant="info" dot>
                    Weighbridge Active
                  </Badge>
                  <Badge variant="neutral" dot>
                    Draft Reservation
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 6. Cards & Layout Surfaces */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              6. Cards & Section Separation
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Clean white cards with 1px #DADCE0 borders, 8px radius, subtle elevation on interactive cards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Procurement Centre Card Example */}
            <Card interactive>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="info">Active Centre</Badge>
                  <span className="text-[12px] text-[#5F6368]">Depot #402</span>
                </div>
                <CardTitle size="default" className="mt-2">
                  Karnal Central Grain Depot
                </CardTitle>
                <CardDescription>
                  District Karnal, Haryana • Operational Hours: 08:00 - 18:00
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-1.5 border-b border-[#DADCE0] text-[14px]">
                  <span className="text-[#5F6368]">Today&apos;s Intake Quota:</span>
                  <span className="font-medium text-[#202124]">1,200 Quintals</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#DADCE0] text-[14px]">
                  <span className="text-[#5F6368]">Current Queue Wait Time:</span>
                  <span className="font-medium text-[#1E8E3E]">~18 mins</span>
                </div>
                <div className="flex justify-between py-1.5 text-[14px]">
                  <span className="text-[#5F6368]">Weighbridge Capacity:</span>
                  <span className="font-medium text-[#202124]">4 Active Gates</span>
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t border-[#DADCE0] pt-4">
                <Button variant="text" size="sm">
                  View Live Tokens
                </Button>
                <Button variant="default" size="sm">
                  Book Slot
                </Button>
              </CardFooter>
            </Card>

            {/* Subtle Canvas Separation Box Example */}
            <div className="rounded-[8px] bg-[#F8F9FA] border border-[#DADCE0] p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-[#5F6368] text-[12px] font-medium uppercase">
                  <FileText className="w-4 h-4 text-[#0B3D91]" />
                  <span>Neutral Canvas Container (#F8F9FA)</span>
                </div>
                <h3 className="text-[16px] leading-[24px] font-medium text-[#202124] mt-2">
                  Farmer Required Documentation Notice
                </h3>
                <p className="text-[14px] leading-[20px] text-[#5F6368] mt-2">
                  When arriving at the procurement centre, farmers must present their generated digital QR token or SMS confirmation alongside their Bank Passbook for instant DBT clearance.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#DADCE0] flex items-center justify-between">
                <span className="text-[12px] text-[#5F6368]">Ministry Guidelines 2026</span>
                <Button variant="outline" size="sm">
                  Download Guidelines
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Language Switcher */}
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] leading-[24px] font-medium text-[#202124]">
              7. Language Switcher (Pill Toggle)
            </h2>
            <p className="text-[14px] leading-[20px] text-[#5F6368]">
              Clean top-right navigation pill for switching between English and Hindi locales.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[14px] font-medium text-[#202124]">
                  Active Language: {currentLocale === "en" ? "English (en-IN)" : currentLocale === "pa" ? "ਪੰਜਾਬੀ (pa-IN)" : "हिंदी (hi-IN)"}
                </div>
                <div className="text-[12px] text-[#5F6368] mt-0.5">
                  Synchronized with <code className="text-[#0B3D91]">next-intl</code> translation catalogs.
                </div>
              </div>
              <LanguageToggle
                currentLocale={currentLocale}
                onLocaleChange={(loc) => setCurrentLocale(loc)}
              />
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Google Minimal Footer */}
      <footer className="border-t border-[#DADCE0] bg-[#F8F9FA] mt-16 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#5F6368] gap-4">
          <div>
            Ministry of Consumer Affairs, Food & Public Distribution • SIH 2026 (Problem Statement 26032)
          </div>
          <div className="flex space-x-6">
            <Link href="/" className="hover:text-[#202124]">
              Home
            </Link>
            <Link href="/style-guide" className="hover:text-[#202124] text-[#0B3D91] font-medium">
              Style Guide
            </Link>
            <Link href="/farmer" className="hover:text-[#202124]">
              Farmer Portal
            </Link>
            <Link href="/admin" className="hover:text-[#202124]">
              Admin Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
