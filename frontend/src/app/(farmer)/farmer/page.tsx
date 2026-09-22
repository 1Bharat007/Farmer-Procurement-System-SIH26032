"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { apiClient, authStorage, getFriendlyErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Calendar, Clock, LogOut, ShieldCheck,
  Loader2, CheckCircle2, XCircle, ChevronRight,
  Package, AlertCircle, RefreshCw, X, MapPin, Building2, QrCode
} from "lucide-react";

interface FarmerUser {
  id: number;
  phone: string;
  phone_number?: string;
  full_name: string;
  village?: string;
  district?: string;
  state?: string;
  crop_type?: string;
  role: string;
}

interface Centre {
  id: number;
  name: string;
  address: string;
  district: string;
  state: string;
  daily_capacity: number;
  is_active: boolean;
}

interface Slot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  is_full: boolean;
  available_capacity: number;
  centre: number;
  centre_details?: {
    id: number;
    name: string;
    district: string;
    state: string;
  };
}

interface Booking {
  id: number;
  slot: number;
  slot_details?: Slot;
  status: string;
  quantity_kg: string;
  qr_code_token: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLE: Record<string, { label: string; variant: "success" | "error" | "warning" | "info" | "neutral" }> = {
  booked:     { label: "Booked",     variant: "info" },
  checked_in: { label: "Checked In", variant: "success" },
  in_queue:   { label: "In Queue",   variant: "warning" },
  completed:  { label: "Completed",  variant: "success" },
  cancelled:  { label: "Cancelled",  variant: "error" },
  no_show:    { label: "No Show",    variant: "neutral" },
};

const UPCOMING_STATUSES = ["booked", "checked_in", "in_queue"];
const PAST_STATUSES = ["completed", "cancelled", "no_show"];

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t?: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function getNext7Days() {
  const days: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

/**
 * Client-side QR Code renderer using lightweight 'qrcode' library.
 * Converts the server-issued qr_code_token UUID into a crisp QR image.
 */
function BookingQRCode({ token }: { token: string }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    let isMounted = true;
    QRCode.toDataURL(token, {
      width: 130,
      margin: 1,
      color: {
        dark: "#202124",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err) => console.error("QR generation failed:", err));

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!dataUrl) {
    return (
      <div className="w-[110px] h-[110px] bg-[#F1F3F4] rounded-[4px] flex items-center justify-center text-[#80868B]">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <img
        src={dataUrl}
        alt="Booking Check-In QR"
        className="w-[110px] h-[110px] border border-[#DADCE0] rounded-[4px] bg-white p-1"
      />
      <span className="text-[10px] text-[#5F6368] mt-1 font-medium text-center">
        Show at Mandi
      </span>
    </div>
  );
}

export default function FarmerPortalPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<FarmerUser | null>(null);
  const [activePanel, setActivePanel] = React.useState<"home" | "book" | "bookings">("home");
  const [bookingsFilter, setBookingsFilter] = React.useState<"upcoming" | "past">("upcoming");

  // Bookings state
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = React.useState(false);
  const [bookingsError, setBookingsError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<number | null>(null);

  // Booking Wizard state
  const [wizardStep, setWizardStep] = React.useState<1 | 2 | 3 | 4>(1);
  const [centres, setCentres] = React.useState<Centre[]>([]);
  const [centresLoading, setCentresLoading] = React.useState(false);
  const [centresError, setCentresError] = React.useState<string | null>(null);
  const [selectedCentre, setSelectedCentre] = React.useState<Centre | null>(null);
  const [selectedDate, setSelectedDate] = React.useState("");
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);
  const [quantity, setQuantity] = React.useState("1000");
  const [bookingLoading, setBookingLoading] = React.useState(false);
  const [bookingError, setBookingError] = React.useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = React.useState<Booking | null>(null);

  // Route protection: farmer role only
  React.useEffect(() => {
    const savedUser = authStorage.getUser();
    if (!savedUser) {
      router.push("/login/farmer");
      return;
    }
    if (savedUser.role && savedUser.role !== "farmer") {
      router.push("/dashboard");
      return;
    }
    setUser(savedUser);
  }, [router]);

  // Load bookings from API
  const loadBookings = React.useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const res = await apiClient.bookings.list();
      const list = Array.isArray(res) ? res : res?.results || res?.data || [];
      setBookings(list);
    } catch (err: any) {
      setBookingsError(getFriendlyErrorMessage(err, "Failed to load bookings."));
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  // Load bookings on initial mount
  React.useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Load procurement centres
  const loadCentres = React.useCallback(async () => {
    setCentresLoading(true);
    setCentresError(null);
    try {
      const res = await apiClient.centres.list({ is_active: true });
      const list = Array.isArray(res) ? res : res?.results || res?.data || [];
      setCentres(list);
    } catch (err: any) {
      setCentresError(getFriendlyErrorMessage(err, "Failed to load procurement centres."));
    } finally {
      setCentresLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCentres();
  }, [loadCentres]);

  // Load slots for selected centre & date
  const loadSlots = React.useCallback(async () => {
    if (!selectedCentre || !selectedDate) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlot(null);
    try {
      const res = await apiClient.slots.list({
        centre: selectedCentre.id,
        date: selectedDate,
      });
      const list: Slot[] = Array.isArray(res) ? res : res?.results || res?.data || [];
      setSlots(list);
    } catch (err: any) {
      setSlotsError(getFriendlyErrorMessage(err, "Failed to load available slots."));
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedCentre, selectedDate]);

  React.useEffect(() => {
    if (wizardStep === 3) {
      loadSlots();
    }
  }, [wizardStep, loadSlots]);

  // Confirm booking & handle race conditions
  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await apiClient.bookings.create({
        slot: selectedSlot.id,
        quantity_kg: parseFloat(quantity) || 1000,
      });

      // Augment returned booking with slot details if missing for immediate display
      const newBooking: Booking = {
        ...res,
        slot_details: res.slot_details || selectedSlot,
      };

      // Add to upcoming list immediately without full page reload
      setBookings((prev) => [newBooking, ...prev]);
      setBookingSuccess(newBooking);
      setWizardStep(4);
    } catch (err: any) {
      const errorText = String(
        err?.data?.slot || err?.data?.detail || err?.message || ""
      ).toLowerCase();

      // Check for slot filled up race condition
      if (
        errorText.includes("maximum capacity") ||
        errorText.includes("capacity") ||
        errorText.includes("full") ||
        errorText.includes("no longer available")
      ) {
        setBookingError("This slot just filled up, please pick another.");
        // Refresh slots list to reflect current capacities
        loadSlots();
      } else {
        setBookingError(getFriendlyErrorMessage(err, "Failed to confirm booking. Please try again."));
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    setCancellingId(id);
    setActionError(null);
    try {
      await apiClient.bookings.cancel(id);
      await loadBookings();
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, "Failed to cancel booking. Please try again."));
    } finally {
      setCancellingId(null);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setSelectedCentre(null);
    setSelectedDate("");
    setSlots([]);
    setSelectedSlot(null);
    setQuantity("1000");
    setBookingError(null);
    setBookingSuccess(null);
  };

  const handleLogout = () => {
    authStorage.clear();
    router.push("/login/farmer");
  };

  // Filter available slots: only showing slots where booked_count < capacity
  const availableSlots = slots.filter(
    (s) => s.booked_count < s.capacity && !s.is_full
  );

  // Group bookings
  const upcomingBookings = bookings.filter((b) =>
    UPCOMING_STATUSES.includes(b.status)
  );
  const pastBookings = bookings.filter((b) =>
    PAST_STATUSES.includes(b.status)
  );

  const displayedBookings =
    bookingsFilter === "upcoming" ? upcomingBookings : pastBookings;

  const nextUpcoming = upcomingBookings[0];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-[#DADCE0] bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="text-[13px] sm:text-[14px] font-medium text-[#0B3D91] hover:underline flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />Home
            </Link>
            <div className="h-4 w-px bg-[#DADCE0]" />
            <span className="text-[14px] sm:text-[16px] font-medium text-[#202124]">
              Farmer Portal
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center space-x-2">
                <span className="text-[12px] sm:text-[13px] text-[#5F6368] hidden sm:inline">
                  +91 {user.phone || user.phone_number}
                </span>
                <Button
                  variant="text"
                  size="sm"
                  onClick={handleLogout}
                  className="text-[#D93025] hover:bg-[#FCE8E6]"
                >
                  <LogOut className="w-4 h-4 mr-1" />Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div className="border-b border-[#DADCE0] bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex space-x-1">
          {(["home", "book", "bookings"] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => {
                setActivePanel(panel);
                if (panel === "book") resetWizard();
              }}
              className={`px-4 py-3 text-[13px] sm:text-[14px] font-medium border-b-2 transition-colors ${
                activePanel === panel
                  ? "border-[#0B3D91] text-[#0B3D91]"
                  : "border-transparent text-[#5F6368] hover:text-[#202124]"
              }`}
            >
              {panel === "home"
                ? "Overview"
                : panel === "book"
                ? "Book a Slot"
                : `My Bookings (${upcomingBookings.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full space-y-6">
        {/* In-page Action Error Banner */}
        {actionError && (
          <div className="p-3 bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] flex items-center justify-between text-[13px] text-[#C5221F]">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-[#C5221F] hover:text-[#202124] text-[12px] font-medium ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* PANEL 1: OVERVIEW */}
        {activePanel === "home" && (
          <>
            <Card className="border-[#DADCE0] bg-white p-5 sm:p-6 shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="success" dot>Verified Farmer</Badge>
                    <span className="text-[12px] text-[#5F6368]">
                      ID: {user?.id ? `KS-${user.id}` : "Active"}
                    </span>
                  </div>
                  <h1 className="text-[20px] sm:text-[22px] font-medium text-[#202124] mt-2">
                    Welcome, {user?.full_name || "Farmer"}
                  </h1>
                  <p className="text-[13px] sm:text-[14px] text-[#5F6368] mt-1">
                    {user?.district ? `${user.district}, ${user.state || "India"}` : "Procurement Platform"} &bull; Primary Crop: {user?.crop_type || "Wheat"}
                  </p>
                </div>
                <Button
                  variant="default"
                  size="default"
                  className="h-10 text-[14px] shrink-0"
                  onClick={() => {
                    setActivePanel("book");
                    resetWizard();
                  }}
                >
                  <Calendar className="w-4 h-4 mr-2" />Book New Slot
                </Button>
              </div>
            </Card>

            {/* Next Scheduled Delivery Alert */}
            {nextUpcoming && (
              <Card className="border-[#CEEAD6] bg-[#E6F4EA]/40 shadow-none p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_STYLE[nextUpcoming.status]?.variant || "info"} dot>
                        Next Delivery: {STATUS_STYLE[nextUpcoming.status]?.label || nextUpcoming.status}
                      </Badge>
                      <span className="text-[12px] font-medium text-[#137333]">
                        Booking #{nextUpcoming.id}
                      </span>
                    </div>
                    <div className="text-[16px] font-medium text-[#202124] pt-1">
                      {nextUpcoming.slot_details?.centre_details?.name || "Karnal Central Grain Mandi"}
                    </div>
                    <div className="text-[13px] text-[#5F6368]">
                      {formatDate(nextUpcoming.slot_details?.date)} &bull; {formatTime(nextUpcoming.slot_details?.start_time)} to {formatTime(nextUpcoming.slot_details?.end_time)} &bull; {nextUpcoming.quantity_kg} kg
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <BookingQRCode token={nextUpcoming.qr_code_token} />
                  </div>
                </div>
              </Card>
            )}

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <Card
                className="border-[#DADCE0] bg-white p-5 shadow-none hover:border-[#0B3D91] transition-colors cursor-pointer"
                onClick={() => {
                  setActivePanel("book");
                  resetWizard();
                }}
              >
                <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91] mb-3">
                  <Calendar className="w-5 h-5" />
                </div>
                <h2 className="text-[16px] font-medium text-[#202124]">Book Delivery Slot</h2>
                <p className="text-[13px] leading-[18px] text-[#5F6368] mt-1.5">
                  Select your Mandi and preferred date/time slot to guarantee swift intake.
                </p>
                <div className="mt-3 flex items-center text-[13px] font-medium text-[#0B3D91]">
                  Book now <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Card>

              <Card
                className="border-[#DADCE0] bg-white p-5 shadow-none hover:border-[#0B3D91] transition-colors cursor-pointer"
                onClick={() => {
                  setActivePanel("bookings");
                  setBookingsFilter("upcoming");
                }}
              >
                <div className="w-8 h-8 rounded-[4px] bg-[#E6F4EA] flex items-center justify-center text-[#1E8E3E] mb-3">
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className="text-[16px] font-medium text-[#202124]">
                  Upcoming Bookings ({upcomingBookings.length})
                </h2>
                <p className="text-[13px] leading-[18px] text-[#5F6368] mt-1.5">
                  View scheduled dates, time windows, gate tokens, and check-in QR codes.
                </p>
                <div className="mt-3 flex items-center text-[13px] font-medium text-[#1E8E3E]">
                  View bookings <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Card>

              <Card
                className="border-[#DADCE0] bg-white p-5 shadow-none hover:border-[#0B3D91] transition-colors cursor-pointer"
                onClick={() => {
                  setActivePanel("bookings");
                  setBookingsFilter("past");
                }}
              >
                <div className="w-8 h-8 rounded-[4px] bg-[#F1F3F4] flex items-center justify-center text-[#5F6368] mb-3">
                  <Package className="w-5 h-5" />
                </div>
                <h2 className="text-[16px] font-medium text-[#202124]">
                  Past Deliveries ({pastBookings.length})
                </h2>
                <p className="text-[13px] leading-[18px] text-[#5F6368] mt-1.5">
                  Archive of completed deliveries, receipts, and past mandi intake tokens.
                </p>
                <div className="mt-3 flex items-center text-[13px] font-medium text-[#5F6368]">
                  View history <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Card>
            </div>
          </>
        )}

        {/* PANEL 2: BOOK A SLOT WIZARD */}
        {activePanel === "book" && (
          <div className="space-y-5">
            {wizardStep < 4 && (
              <div className="flex items-center space-x-2 text-[13px]">
                {(
                  [
                    { step: 1, label: "Select Centre" },
                    { step: 2, label: "Select Date" },
                    { step: 3, label: "Select Slot" },
                  ] as const
                ).map(({ step, label }, idx) => (
                  <React.Fragment key={step}>
                    {idx > 0 && <ChevronRight className="w-4 h-4 text-[#DADCE0]" />}
                    <span
                      className={`font-medium ${
                        wizardStep >= step ? "text-[#0B3D91]" : "text-[#5F6368]"
                      }`}
                    >
                      {step}. {label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* STEP 1: Select Centre */}
            {wizardStep === 1 && (
              <Card className="border-[#DADCE0] bg-white shadow-none">
                <CardHeader className="p-5 pb-3">
                  <CardTitle>Select Procurement Centre</CardTitle>
                  <CardDescription>
                    Choose an active MSP Mandi for crop delivery and weighing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  {centresLoading && (
                    <div className="flex items-center justify-center py-10 text-[#5F6368]">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading centres...
                    </div>
                  )}
                  {centresError && (
                    <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {centresError}
                      <button className="ml-auto underline" onClick={loadCentres}>
                        Retry
                      </button>
                    </div>
                  )}
                  {!centresLoading && !centresError && centres.length === 0 && (
                    <p className="text-[13px] text-[#5F6368] py-6 text-center">
                      No active procurement centres found.
                    </p>
                  )}
                  <div className="space-y-2 mt-1">
                    {centres.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCentre(c);
                          setWizardStep(2);
                        }}
                        className="w-full text-left p-4 border border-[#DADCE0] rounded-[6px] hover:border-[#0B3D91] hover:bg-[#F8F9FA] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="text-[14px] font-medium text-[#202124] flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#0B3D91]" />
                            {c.name}
                          </div>
                          <div className="text-[12px] text-[#5F6368] mt-0.5">
                            {c.district}, {c.state} &bull; Daily Intake Capacity: {c.daily_capacity}
                          </div>
                          <div className="text-[11px] text-[#80868B] mt-0.5">{c.address}</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#DADCE0] shrink-0 ml-3" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 2: Select Date */}
            {wizardStep === 2 && selectedCentre && (
              <Card className="border-[#DADCE0] bg-white shadow-none">
                <CardHeader className="p-5 pb-3">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="text-[#0B3D91] hover:underline text-[13px] self-start"
                  >
                    &larr; Change Mandi
                  </button>
                  <CardTitle className="mt-1">Select Delivery Date</CardTitle>
                  <CardDescription>
                    {selectedCentre.name} ({selectedCentre.district})
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {getNext7Days().map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setSelectedDate(d);
                          setWizardStep(3);
                        }}
                        className={`p-3.5 border rounded-[6px] text-left hover:border-[#0B3D91] transition-colors ${
                          selectedDate === d
                            ? "border-[#0B3D91] bg-[#E8F0FE]"
                            : "border-[#DADCE0] bg-white"
                        }`}
                      >
                        <div className="text-[12px] text-[#5F6368] font-medium">
                          {new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })}
                        </div>
                        <div className="text-[15px] font-medium text-[#202124] mt-0.5">
                          {new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 3: Choose Time Slot (Showing only slots where booked_count < capacity) */}
            {wizardStep === 3 && (
              <Card className="border-[#DADCE0] bg-white shadow-none">
                <CardHeader className="p-5 pb-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="text-[#0B3D91] hover:underline text-[13px] self-start"
                  >
                    &larr; Change Date
                  </button>
                  <CardTitle className="mt-1">Choose Available Time Slot</CardTitle>
                  <CardDescription>
                    {formatDate(selectedDate)} &bull; {selectedCentre?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  {slotsLoading && (
                    <div className="flex items-center justify-center py-10 text-[#5F6368]">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading available slots...
                    </div>
                  )}

                  {slotsError && (
                    <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {slotsError}
                      <button className="ml-auto underline" onClick={loadSlots}>
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Empty state when all slots are full or no slots exist */}
                  {!slotsLoading && !slotsError && availableSlots.length === 0 && (
                    <div className="text-center py-10 border border-dashed border-[#DADCE0] rounded-[6px]">
                      <Calendar className="w-8 h-8 text-[#DADCE0] mx-auto mb-2" />
                      <p className="text-[14px] font-medium text-[#202124]">
                        No available slots for this date
                      </p>
                      <p className="text-[12px] text-[#5F6368] mt-1">
                        All slots on {formatDate(selectedDate)} are at full capacity. Please pick another date.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setWizardStep(2)}
                      >
                        Pick Another Date
                      </Button>
                    </div>
                  )}

                  {/* Confirmation panel when a slot is picked */}
                  {selectedSlot && (
                    <div className="mb-4 p-4 border border-[#0B3D91] bg-[#E8F0FE]/40 rounded-[6px] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium text-[#0B3D91]">
                          Confirm Slot Selection
                        </span>
                        <button
                          onClick={() => setSelectedSlot(null)}
                          className="text-[#5F6368] hover:text-[#202124]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-[13px] text-[#202124]">
                        <strong>{formatTime(selectedSlot.start_time)} to {formatTime(selectedSlot.end_time)}</strong> &bull; {selectedSlot.available_capacity} spots remaining
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-[12px] text-[#5F6368] font-medium shrink-0">
                          Crop Quantity (kg):
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="50000"
                          step="100"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="h-9 w-36 border border-[#DADCE0] rounded-[4px] px-3 text-[14px] focus:border-[#0B3D91] focus:outline-none bg-white"
                        />
                      </div>

                      {/* Race condition error alert with specific messaging */}
                      {bookingError && (
                        <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-3 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{bookingError}</span>
                        </div>
                      )}

                      <Button
                        variant="default"
                        className="w-full h-10 text-[14px]"
                        disabled={bookingLoading}
                        onClick={handleConfirmBooking}
                      >
                        {bookingLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Confirming Reservation...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Confirm Booking
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Available Slots List (Only booked_count < capacity) */}
                  <div className="space-y-2 mt-2">
                    {availableSlots.map((s) => {
                      const isSelected = selectedSlot?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedSlot(s);
                            setBookingError(null);
                          }}
                          className={`w-full text-left p-4 border rounded-[6px] transition-colors flex items-center justify-between ${
                            isSelected
                              ? "border-[#0B3D91] bg-[#E8F0FE]/50 ring-1 ring-[#0B3D91]"
                              : "border-[#DADCE0] hover:border-[#0B3D91] bg-white"
                          }`}
                        >
                          <div>
                            <div className="text-[14px] font-medium text-[#202124]">
                              {formatTime(s.start_time)} to {formatTime(s.end_time)}
                            </div>
                            <div className="text-[12px] text-[#5F6368] mt-0.5">
                              {s.available_capacity} of {s.capacity} spots available
                            </div>
                          </div>
                          <Badge variant="success" dot>
                            Available
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* STEP 4: Success State */}
            {wizardStep === 4 && bookingSuccess && (
              <Card className="border-[#CEEAD6] bg-white shadow-none">
                <CardContent className="p-8 text-center">
                  <div className="w-14 h-14 bg-[#E6F4EA] rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-[#1E8E3E]" />
                  </div>
                  <h2 className="text-[20px] font-medium text-[#202124]">
                    Delivery Slot Confirmed!
                  </h2>
                  <p className="text-[13px] text-[#5F6368] mt-1.5">
                    Your appointment at <strong>{selectedCentre?.name}</strong> has been successfully booked.
                  </p>

                  <div className="mt-5 p-4 bg-[#F8F9FA] border border-[#DADCE0] rounded-[6px] text-left space-y-2.5 text-[13px] max-w-md mx-auto">
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">Mandi</span>
                      <span className="font-medium text-[#202124]">{selectedCentre?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">Delivery Date</span>
                      <span className="font-medium text-[#202124]">{formatDate(selectedDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">Time Window</span>
                      <span className="font-medium text-[#202124]">
                        {selectedSlot ? `${formatTime(selectedSlot.start_time)} to ${formatTime(selectedSlot.end_time)}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">Crop Quantity</span>
                      <span className="font-medium text-[#202124]">{quantity} kg</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#DADCE0]">
                      <span className="text-[#5F6368]">Status</span>
                      <Badge variant="info" dot>Booked</Badge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    <BookingQRCode token={bookingSuccess.qr_code_token} />
                    <span className="text-[11px] text-[#80868B] font-mono mt-1">
                      Token: {bookingSuccess.qr_code_token.slice(0, 8)}...
                    </span>
                  </div>

                  <div className="mt-6 flex gap-3 justify-center">
                    <Button
                      variant="default"
                      onClick={() => {
                        setActivePanel("bookings");
                        setBookingsFilter("upcoming");
                      }}
                    >
                      View in Upcoming Bookings
                    </Button>
                    <Button variant="outline" onClick={resetWizard}>
                      Book Another Slot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* PANEL 3: MY BOOKINGS (Upcoming & Past) */}
        {activePanel === "bookings" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-[18px] sm:text-[20px] font-medium text-[#202124]">
                  My Crop Bookings
                </h1>
                <p className="text-[13px] text-[#5F6368] mt-0.5">
                  Manage your scheduled delivery slots and gate check-in tokens.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setActivePanel("book");
                    resetWizard();
                  }}
                >
                  <Calendar className="w-4 h-4 mr-1.5" />
                  Book New Slot
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  onClick={loadBookings}
                  disabled={bookingsLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${bookingsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Sub-tabs: Upcoming vs Past */}
            <div className="flex space-x-2 border-b border-[#DADCE0]">
              <button
                onClick={() => setBookingsFilter("upcoming")}
                className={`pb-2.5 px-3 text-[14px] font-medium border-b-2 transition-colors ${
                  bookingsFilter === "upcoming"
                    ? "border-[#0B3D91] text-[#0B3D91]"
                    : "border-transparent text-[#5F6368] hover:text-[#202124]"
                }`}
              >
                Upcoming Bookings ({upcomingBookings.length})
              </button>
              <button
                onClick={() => setBookingsFilter("past")}
                className={`pb-2.5 px-3 text-[14px] font-medium border-b-2 transition-colors ${
                  bookingsFilter === "past"
                    ? "border-[#0B3D91] text-[#0B3D91]"
                    : "border-transparent text-[#5F6368] hover:text-[#202124]"
                }`}
              >
                Past Deliveries ({pastBookings.length})
              </button>
            </div>

            {bookingsLoading && (
              <div className="flex items-center justify-center py-16 text-[#5F6368]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your bookings...
              </div>
            )}

            {bookingsError && (
              <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {bookingsError}
                <button className="ml-auto underline" onClick={loadBookings}>
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!bookingsLoading && !bookingsError && displayedBookings.length === 0 && (
              <Card className="border-[#DADCE0] bg-white shadow-none">
                <CardContent className="p-10 text-center">
                  <Package className="w-10 h-10 text-[#DADCE0] mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-[#202124]">
                    {bookingsFilter === "upcoming"
                      ? "No upcoming bookings scheduled"
                      : "No past delivery history"}
                  </p>
                  <p className="text-[13px] text-[#5F6368] mt-1">
                    {bookingsFilter === "upcoming"
                      ? "Book your crop delivery slot to get an intake token."
                      : "Past completed and cancelled deliveries will appear here."}
                  </p>
                  {bookingsFilter === "upcoming" && (
                    <Button
                      variant="default"
                      className="mt-4"
                      onClick={() => {
                        setActivePanel("book");
                        resetWizard();
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-2" />Book a Slot
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Booking Cards */}
            <div className="space-y-3">
              {displayedBookings.map((b) => {
                const st = STATUS_STYLE[b.status] || {
                  label: b.status,
                  variant: "neutral" as const,
                };
                const canCancel = b.status === "booked";
                const isUpcoming = UPCOMING_STATUSES.includes(b.status);
                const slotObj = b.slot_details || (b as any).slot;
                const centreName =
                  slotObj?.centre_details?.name ||
                  centres.find((c) => c.id === slotObj?.centre)?.name ||
                  "Procurement Mandi";
                const district =
                  slotObj?.centre_details?.district ||
                  centres.find((c) => c.id === slotObj?.centre)?.district;

                return (
                  <Card key={b.id} className="border-[#DADCE0] bg-white shadow-none p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={st.variant} dot>
                            {st.label}
                          </Badge>
                          <span className="text-[13px] font-medium text-[#202124]">
                            {centreName}
                          </span>
                          <span className="text-[11px] text-[#80868B]">
                            &bull; Booking #{b.id}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] pt-1">
                          <div className="flex items-center text-[#202124]">
                            <Calendar className="w-4 h-4 mr-1.5 text-[#5F6368] shrink-0" />
                            <span className="font-medium">{formatDate(slotObj?.date)}</span>
                          </div>
                          <div className="flex items-center text-[#202124]">
                            <Clock className="w-4 h-4 mr-1.5 text-[#5F6368] shrink-0" />
                            <span>
                              {formatTime(slotObj?.start_time)} to {formatTime(slotObj?.end_time)}
                            </span>
                          </div>
                          <div className="flex items-center text-[#5F6368]">
                            <Package className="w-4 h-4 mr-1.5 text-[#5F6368] shrink-0" />
                            <span>
                              Quantity: <strong className="text-[#202124]">{b.quantity_kg} kg</strong>
                            </span>
                          </div>
                          {district && (
                            <div className="flex items-center text-[#5F6368]">
                              <MapPin className="w-4 h-4 mr-1.5 text-[#5F6368] shrink-0" />
                              <span>{district}</span>
                            </div>
                          )}
                        </div>

                        {canCancel && (
                          <div className="pt-2">
                            <Button
                              variant="destructiveText"
                              size="sm"
                              onClick={() => handleCancelBooking(b.id)}
                              disabled={cancellingId === b.id}
                            >
                              {cancellingId === b.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                              )}
                              Cancel Booking
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* QR code token for upcoming bookings */}
                      {isUpcoming && b.qr_code_token && (
                        <div className="shrink-0 flex flex-col items-center pt-2 sm:pt-0 sm:border-l sm:border-[#DADCE0] sm:pl-5">
                          <BookingQRCode token={b.qr_code_token} />
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#DADCE0] bg-white py-3 text-center text-[11px] text-[#5F6368]">
        Ministry of Consumer Affairs, Food & Public Distribution - SIH 2026
      </footer>
    </div>
  );
}