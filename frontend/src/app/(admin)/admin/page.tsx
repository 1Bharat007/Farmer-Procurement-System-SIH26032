"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, authStorage, getFriendlyErrorMessage } from "@/lib/api";
import { useQueueWebSocket } from "@/lib/useQueueWebSocket";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, BarChart3, Building2, LogOut, Users,
  Loader2, RefreshCw, AlertCircle, CheckCircle2, QrCode,
  Clock, Package, Check, Clipboard, TrendingUp
} from "lucide-react";

interface StaffUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
  is_staff: boolean;
  centre_id?: number;
  centre_name?: string;
}

interface QueueToken {
  id: number;
  token_number: number;
  status: string;
  estimated_wait_minutes: number;
  booking: number;
  centre: number;
  date: string;
  called_at: string | null;
}

interface Booking {
  id: number;
  status: string;
  quantity_kg: string;
  qr_code_token?: string;
  farmer?: number;
  farmer_details?: {
    id: number;
    full_name: string;
    phone_number: string;
  };
  slot?: number;
  slot_details?: {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    centre: number;
    centre_details?: {
      id: number;
      name: string;
      district: string;
    };
  };
  queue_token?: QueueToken;
}

const TOKEN_STATUS: Record<string, { label: string; variant: "info" | "warning" | "success" | "error" | "neutral" }> = {
  waiting:    { label: "Waiting",    variant: "info" },
  called:     { label: "Called",     variant: "warning" },
  processing: { label: "Processing", variant: "warning" },
  completed:  { label: "Completed",  variant: "success" },
  skipped:    { label: "Skipped",    variant: "error" },
};

const BOOKING_STATUS: Record<string, { label: string; variant: "info" | "warning" | "success" | "error" | "neutral" }> = {
  booked:     { label: "Booked",     variant: "info" },
  checked_in: { label: "Checked In", variant: "success" },
  in_queue:   { label: "In Queue",   variant: "warning" },
  completed:  { label: "Completed",  variant: "success" },
  cancelled:  { label: "Cancelled",  variant: "error" },
  no_show:    { label: "No Show",    variant: "neutral" },
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function AdminPortalPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<StaffUser | null>(null);
  const [activeTab, setActiveTab] = React.useState<"checkin" | "queue" | "bookings" | "stats">("checkin");
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionId, setActionId] = React.useState<number | null>(null);

  // QR Check-in State
  const [qrTokenInput, setQrTokenInput] = React.useState("");
  const [qrLoading, setQrLoading] = React.useState(false);
  const [qrResult, setQrResult] = React.useState<{
    success: boolean;
    message: string;
    farmer_name?: string;
    phone_number?: string;
    token_number?: number;
    centre_name?: string;
    quantity_kg?: string;
    time_window?: string;
    booking_id?: number;
  } | null>(null);

  React.useEffect(() => {
    const savedUser = authStorage.getUser();
    if (!savedUser) {
      router.push("/login/admin");
      return;
    }
    setUser(savedUser);
  }, [router]);

  // Analytics Dashboard State
  const [centresList, setCentresList] = React.useState<any[]>([]);
  const [selectedCentreId, setSelectedCentreId] = React.useState<number>(1);
  const [analyticsData, setAnalyticsData] = React.useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false);
  const [analyticsError, setAnalyticsError] = React.useState<string | null>(null);

  const loadAnalytics = React.useCallback(async (centreId: number) => {
    if (!centreId) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await apiClient.centres.getAnalytics(centreId);
      setAnalyticsData(data);
    } catch (err: any) {
      console.warn("Analytics fetch warning:", err);
      setAnalyticsError(getFriendlyErrorMessage(err, "Failed to load live analytics."));
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const fetchCentres = async () => {
      try {
        const res = await apiClient.centres.list();
        const list = Array.isArray(res) ? res : res?.results || [];
        setCentresList(list);
        if (list.length > 0) {
          const initialId = user?.centre_id || list[0].id;
          setSelectedCentreId(initialId);
          loadAnalytics(initialId);
        }
      } catch (e) {
        console.warn("Centres fetch warning:", e);
      }
    };
    if (user) {
      fetchCentres();
    }
  }, [user, loadAnalytics]);

  const loadBookings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.bookings.list();
      setBookings(Array.isArray(res) ? res : res?.results || res?.data || []);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, "Failed to load procurement data."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Live WebSocket queue connection with automatic REST resync on reconnect
  const { isConnected, isReconnecting } = useQueueWebSocket({
    centreId: user?.centre_id || 1,
    onMessage: () => {
      // Live event received from backend: refresh bookings & queue immediately
      loadBookings();
    },
    onResync: () => {
      // Re-fetch queue state via REST upon reconnection after drop
      loadBookings();
    },
    enabled: !!user,
  });

  // Handle direct QR check-in
  const handleQrCheckIn = async (tokenToUse?: string) => {
    const token = (tokenToUse || qrTokenInput).trim();
    if (!token) return;

    setQrLoading(true);
    setQrResult(null);
    setActionError(null);
    try {
      const res = await apiClient.bookings.checkInByQr(token);
      setQrResult({
        success: true,
        message: res.message || "Farmer checked in successfully.",
        farmer_name: res.farmer_name,
        phone_number: res.phone_number,
        token_number: res.token_number,
        centre_name: res.centre_name,
        quantity_kg: res.quantity_kg,
        time_window: res.time_window,
        booking_id: res.booking_id,
      });
      setQrTokenInput("");
      await loadBookings();
    } catch (err: any) {
      const errMsg = getFriendlyErrorMessage(err, "Invalid or already-used QR code.");
      setQrResult({
        success: false,
        message: errMsg,
      });
    } finally {
      setQrLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: number) => {
    setActionId(bookingId);
    setActionError(null);
    try {
      await apiClient.bookings.checkIn(bookingId);
      await loadBookings();
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, "Check-in failed. Please try again."));
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (bookingId: number) => {
    setActionId(bookingId);
    setActionError(null);
    try {
      await apiClient.bookings.cancel(bookingId);
      await loadBookings();
    } catch (err: any) {
      setActionError(getFriendlyErrorMessage(err, "Cancellation failed. Please try again."));
    } finally {
      setActionId(null);
    }
  };

  const handleLogout = () => {
    authStorage.clear();
    router.push("/login/admin");
  };

  const todayBookings = bookings.filter(
    (b) => (b.slot_details?.date || (b as any).slot?.date) === todayISO()
  );
  const queuedToday = todayBookings.filter((b) =>
    ["checked_in", "in_queue"].includes(b.status)
  );
  const completedToday = todayBookings.filter((b) => b.status === "completed");
  const pendingToday = todayBookings.filter((b) => b.status === "booked");

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col font-sans">
      <header className="border-b border-[#DADCE0] bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="text-[13px] sm:text-[14px] font-medium text-[#0B3D91] hover:underline flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />Home
            </Link>
            <div className="h-4 w-px bg-[#DADCE0]" />
            <span className="text-[14px] sm:text-[16px] font-medium text-[#202124]">
              Admin Console
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {isConnected ? (
              <Badge variant="success" className="text-[11px]">Live: Connected</Badge>
            ) : isReconnecting ? (
              <Badge variant="warning" className="text-[11px] animate-pulse">Live: Reconnecting...</Badge>
            ) : (
              <Badge variant="neutral" className="text-[11px]">Live: Offline</Badge>
            )}
            {user && (
              <div className="flex items-center space-x-2">
                <span className="text-[12px] sm:text-[13px] text-[#5F6368] hidden sm:inline">
                  {user.full_name || user.username} ({user.role})
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

      {/* In-page Action Error Banner */}
      {actionError && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 w-full">
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
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#DADCE0] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex space-x-1">
          {(["checkin", "queue", "bookings", "stats"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-[13px] sm:text-[14px] font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-[#0B3D91] text-[#0B3D91]"
                  : "border-transparent text-[#5F6368] hover:text-[#202124]"
              }`}
            >
              {tab === "checkin"
                ? "Gate Check-In"
                : tab === "queue"
                ? `Live Queue (${queuedToday.length})`
                : tab === "bookings"
                ? `All Bookings (${bookings.length})`
                : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full space-y-5">
        {/* Welcome Header */}
        <Card className="border-[#DADCE0] bg-white p-5 sm:p-6 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Badge variant="info" dot>
                  Staff Session: {user?.role?.toUpperCase() || "AUTHENTICATED"}
                </Badge>
                <span className="text-[12px] text-[#5F6368]">
                  ID: {user?.id ? `STAFF-${user.id}` : "Active"}
                </span>
              </div>
              <h1 className="text-[20px] sm:text-[22px] font-medium text-[#202124] mt-2">
                Welcome, {user?.full_name || user?.username || "Officer"}
              </h1>
              <p className="text-[13px] sm:text-[14px] text-[#5F6368] mt-1">
                {user?.centre_name || "Procurement Mandi"} &bull; Today:{" "}
                {new Date().toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
            <Button variant="text" size="sm" onClick={loadBookings} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>
        </Card>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Today Total", value: todayBookings.length, color: "#0B3D91", bg: "#E8F0FE" },
            { label: "In Queue", value: queuedToday.length, color: "#E37400", bg: "#FEF7E0" },
            { label: "Completed", value: completedToday.length, color: "#1E8E3E", bg: "#E6F4EA" },
            { label: "Pending Check-In", value: pendingToday.length, color: "#5F6368", bg: "#F8F9FA" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ backgroundColor: bg }} className="rounded-[8px] border border-[#DADCE0] p-4">
              <div className="text-[24px] font-semibold" style={{ color }}>{value}</div>
              <div className="text-[12px] text-[#5F6368] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="text-[13px] text-[#D93025] bg-[#FCE8E6] border border-[#FAD2CF] rounded-[4px] p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            <button className="ml-auto underline" onClick={loadBookings}>Retry</button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-[#5F6368]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading...
          </div>
        )}

        {/* TAB 1: QR GATE CHECK-IN */}
        {activeTab === "checkin" && !loading && (
          <div className="space-y-5">
            <Card className="border-[#DADCE0] bg-white shadow-none">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91]">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Farmer Gate Check-In</CardTitle>
                    <CardDescription>
                      Scan QR token or paste token UUID to issue a live queue token.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    placeholder="Scan or paste QR Token UUID (e.g. 9e84c49b-93c4-45fd...)"
                    className="flex-1 h-10 border border-[#DADCE0] rounded-[4px] px-3 text-[14px] text-[#202124] focus:border-[#0B3D91] focus:outline-none font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQrCheckIn();
                    }}
                  />
                  <Button
                    variant="default"
                    className="h-10 px-5 shrink-0"
                    disabled={qrLoading || !qrTokenInput.trim()}
                    onClick={() => handleQrCheckIn()}
                  >
                    {qrLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    )}
                    Check In Farmer
                  </Button>
                </div>

                {/* Result Feedback Banner */}
                {qrResult && (
                  <div
                    className={`p-4 rounded-[6px] border text-[13px] ${
                      qrResult.success
                        ? "bg-[#E6F4EA] border-[#CEEAD6] text-[#137333]"
                        : "bg-[#FCE8E6] border-[#FAD2CF] text-[#D93025]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {qrResult.success ? (
                        <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-[#1E8E3E]" />
                      ) : (
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-[#D93025]" />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold text-[14px]">
                          {qrResult.message}
                        </div>
                        {qrResult.success && (
                          <div className="text-[12px] space-y-0.5 text-[#202124] mt-1 pt-1 border-t border-[#CEEAD6]">
                            <div>
                              <strong>Queue Token Issued:</strong> #{qrResult.token_number}
                            </div>
                            <div>
                              <strong>Farmer:</strong> {qrResult.farmer_name} (+91-{qrResult.phone_number})
                            </div>
                            <div>
                              <strong>Mandi / Slot:</strong> {qrResult.centre_name} &bull; {qrResult.time_window}
                            </div>
                            <div>
                              <strong>Declared Quantity:</strong> {qrResult.quantity_kg} kg
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick select list for demo / testing */}
                <div className="pt-3 border-t border-[#DADCE0]">
                  <div className="text-[13px] font-medium text-[#202124] mb-2 flex items-center justify-between">
                    <span>Today's Pending Check-Ins ({pendingToday.length})</span>
                    <span className="text-[11px] text-[#80868B]">Click any card to check in instantly</span>
                  </div>

                  {pendingToday.length === 0 ? (
                    <p className="text-[12px] text-[#5F6368]">
                      All bookings for today have already checked in or no more pending deliveries.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pendingToday.map((b) => {
                        const farmerObj = b.farmer_details || (b as any).farmer;
                        const slotObj = b.slot_details || (b as any).slot;
                        return (
                          <button
                            key={b.id}
                            onClick={() => {
                              if (b.qr_code_token) {
                                setQrTokenInput(b.qr_code_token);
                                handleQrCheckIn(b.qr_code_token);
                              }
                            }}
                            className="p-3 border border-[#DADCE0] rounded-[6px] text-left hover:border-[#0B3D91] hover:bg-[#F8F9FA] transition-colors flex items-center justify-between group"
                          >
                            <div className="space-y-0.5">
                              <div className="text-[13px] font-medium text-[#202124] group-hover:text-[#0B3D91]">
                                {farmerObj?.full_name || `Farmer #${b.farmer}`}
                              </div>
                              <div className="text-[11px] text-[#5F6368]">
                                {slotObj ? `${formatTime(slotObj.start_time)} - ${formatTime(slotObj.end_time)}` : "Today"} &bull; {b.quantity_kg} kg
                              </div>
                              <div className="text-[10px] font-mono text-[#80868B] truncate max-w-[200px]">
                                Token: {b.qr_code_token?.slice(0, 8)}...
                              </div>
                            </div>
                            <Badge variant="neutral" className="shrink-0 text-[11px]">
                              Check In &rarr;
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: LIVE QUEUE */}
        {activeTab === "queue" && !loading && (
          <div className="space-y-3">
            <h2 className="text-[15px] font-medium text-[#202124]">
              Live Queue Board — Today ({todayISO()})
            </h2>
            {queuedToday.length === 0 && (
              <Card className="border-[#DADCE0] bg-white shadow-none">
                <CardContent className="p-10 text-center">
                  <Users className="w-10 h-10 text-[#DADCE0] mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-[#202124]">No farmers in queue today</p>
                  <p className="text-[13px] text-[#5F6368] mt-1">Checked-in bookings will appear here.</p>
                </CardContent>
              </Card>
            )}
            {queuedToday.map((b) => {
              const st = BOOKING_STATUS[b.status] || { label: b.status, variant: "neutral" as const };
              const token = b.queue_token;
              const slotObj = b.slot_details || (b as any).slot;
              const farmerObj = b.farmer_details || (b as any).farmer;
              return (
                <Card key={b.id} className="border-[#DADCE0] bg-white shadow-none p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#E8F0FE] rounded-[6px] flex items-center justify-center text-[#0B3D91] font-bold text-[18px] shrink-0">
                        {token?.token_number ?? "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-medium text-[#202124]">
                            {farmerObj?.full_name || "Farmer"}
                          </span>
                          <Badge variant={st.variant} dot>{st.label}</Badge>
                        </div>
                        <div className="text-[12px] text-[#5F6368] mt-0.5">
                          +91 {farmerObj?.phone_number || "—"}
                        </div>
                        <div className="text-[12px] text-[#5F6368]">
                          {slotObj ? `${formatTime(slotObj.start_time)} – ${formatTime(slotObj.end_time)}` : ""} &bull; {b.quantity_kg} kg
                        </div>
                        {token && <div className="text-[11px] text-[#80868B] mt-0.5">Est. wait: {token.estimated_wait_minutes} min</div>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" disabled={actionId === b.id} onClick={() => handleCheckIn(b.id)}>
                        {actionId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                        {b.status === "booked" ? "Check In" : "Advance"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* TAB 3: ALL BOOKINGS */}
        {activeTab === "bookings" && !loading && (
          <div className="space-y-3">
            <h2 className="text-[15px] font-medium text-[#202124]">All Bookings ({bookings.length})</h2>
            {bookings.length === 0 && (
              <Card className="border-[#DADCE0] bg-white shadow-none">
                <CardContent className="p-10 text-center">
                  <Building2 className="w-10 h-10 text-[#DADCE0] mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-[#202124]">No bookings found</p>
                </CardContent>
              </Card>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#DADCE0] text-[#5F6368] text-left">
                    <th className="pb-2 pr-4 font-medium">ID</th>
                    <th className="pb-2 pr-4 font-medium">Farmer</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Slot</th>
                    <th className="pb-2 pr-4 font-medium">Qty (kg)</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F3F4]">
                  {bookings.map((b) => {
                    const st = BOOKING_STATUS[b.status] || { label: b.status, variant: "neutral" as const };
                    const slotObj = b.slot_details || (b as any).slot;
                    const farmerObj = b.farmer_details || (b as any).farmer;
                    return (
                      <tr key={b.id} className="hover:bg-[#F8F9FA]">
                        <td className="py-2.5 pr-4 text-[#5F6368]">#{b.id}</td>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium text-[#202124]">{farmerObj?.full_name || "—"}</div>
                          <div className="text-[11px] text-[#5F6368]">+91 {farmerObj?.phone_number || "—"}</div>
                        </td>
                        <td className="py-2.5 pr-4 text-[#5F6368]">{slotObj?.date || "—"}</td>
                        <td className="py-2.5 pr-4 text-[#5F6368]">
                          {slotObj ? `${formatTime(slotObj.start_time)}-${formatTime(slotObj.end_time)}` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-[#202124]">{b.quantity_kg}</td>
                        <td className="py-2.5 pr-4"><Badge variant={st.variant}>{st.label}</Badge></td>
                        <td className="py-2.5">
                          <div className="flex gap-2">
                            {b.status === "booked" && (
                              <Button
                                variant="text"
                                size="sm"
                                disabled={actionId === b.id}
                                onClick={() => handleCheckIn(b.id)}
                                className="text-[#1E8E3E] hover:bg-[#E6F4EA] text-[11px] h-7 px-2"
                              >
                                {actionId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Check In"}
                              </Button>
                            )}
                            {!["completed", "cancelled"].includes(b.status) && (
                              <Button
                                variant="text"
                                size="sm"
                                disabled={actionId === b.id}
                                onClick={() => handleCancel(b.id)}
                                className="text-[#D93025] hover:bg-[#FCE8E6] text-[11px] h-7 px-2"
                              >
                                {actionId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ANALYTICS & STATS */}
        {activeTab === "stats" && (
          <div className="space-y-5">
            {/* Analytics Control Bar: Centre Selector & Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#DADCE0] rounded-[6px]">
              <div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="text-[16px] font-medium text-[#202124]">
                    Mandi Procurement Analytics
                  </h2>
                </div>
                <p className="text-[12px] sm:text-[13px] text-[#5F6368] mt-0.5">
                  Live footfall count, intake turnaround, no-show rate, and time-slot capacity for{" "}
                  <strong>
                    {centresList.find((c) => c.id === selectedCentreId)?.name ||
                      analyticsData?.centre_name ||
                      user?.centre_name ||
                      "Selected Mandi"}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {centresList.length > 1 && (
                  <div className="flex items-center space-x-2">
                    <label className="text-[12px] font-medium text-[#5F6368] shrink-0">
                      Mandi:
                    </label>
                    <select
                      value={selectedCentreId}
                      onChange={(e) => {
                        const newId = Number(e.target.value);
                        setSelectedCentreId(newId);
                        loadAnalytics(newId);
                      }}
                      className="h-9 border border-[#DADCE0] rounded-[4px] px-2.5 text-[13px] bg-white text-[#202124] focus:border-[#0B3D91] focus:outline-none"
                    >
                      {centresList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.district})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAnalytics(selectedCentreId)}
                  disabled={analyticsLoading}
                  className="h-9 text-[13px]"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${analyticsLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Metric Cards: 4 Key Indicators from Real Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Today's Footfall Count */}
              <Card className="border-[#DADCE0] bg-white p-5 shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium uppercase tracking-wider text-[#5F6368]">
                      Today&apos;s Footfall
                    </span>
                    <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91]">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[26px] font-semibold text-[#202124] leading-tight">
                      {analyticsData?.footfall_today ??
                        todayBookings.filter((b) =>
                          ["checked_in", "in_queue", "completed"].includes(b.status)
                        ).length}
                    </div>
                    <p className="text-[12px] text-[#5F6368] mt-1">
                      Farmers entered Mandi gate today
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F3F4] text-[11px] text-[#5F6368] flex items-center justify-between">
                  <span>
                    Checked-in:{" "}
                    <strong className="text-[#202124]">
                      {analyticsData?.footfall_breakdown?.checked_in ??
                        todayBookings.filter((b) => b.status === "checked_in").length}
                    </strong>
                  </span>
                  <span>
                    In-queue:{" "}
                    <strong className="text-[#E37400]">
                      {analyticsData?.footfall_breakdown?.in_queue ?? queuedToday.length}
                    </strong>
                  </span>
                  <span>
                    Done:{" "}
                    <strong className="text-[#1E8E3E]">
                      {analyticsData?.footfall_breakdown?.completed ?? completedToday.length}
                    </strong>
                  </span>
                </div>
              </Card>

              {/* 2. Average Wait Time */}
              <Card className="border-[#DADCE0] bg-white p-5 shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium uppercase tracking-wider text-[#5F6368]">
                      Avg Intake Wait Time
                    </span>
                    <div className="w-8 h-8 rounded-[4px] bg-[#E6F4EA] flex items-center justify-center text-[#1E8E3E]">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[26px] font-semibold text-[#202124] leading-tight">
                      {analyticsData?.avg_wait_time_minutes ?? 20.0}{" "}
                      <span className="text-[14px] font-normal text-[#5F6368]">min</span>
                    </div>
                    <p className="text-[12px] text-[#5F6368] mt-1">
                      Gate verification to weighbridge clearance
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F3F4] text-[11px] text-[#1E8E3E] font-medium flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Target: &le; 30 mins per tractor delivery
                </div>
              </Card>

              {/* 3. No-Show Rate */}
              <Card className="border-[#DADCE0] bg-white p-5 shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium uppercase tracking-wider text-[#5F6368]">
                      No-Show Rate
                    </span>
                    <div className="w-8 h-8 rounded-[4px] bg-[#FEF7E0] flex items-center justify-center text-[#E37400]">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[26px] font-semibold text-[#202124] leading-tight">
                      {analyticsData?.no_show_rate_percent ??
                        (bookings.length
                          ? Number(
                              ((bookings.filter((b) => b.status === "no_show").length /
                                bookings.length) *
                                100).toFixed(1)
                            )
                          : 0)}
                      %
                    </div>
                    <p className="text-[12px] text-[#5F6368] mt-1">
                      Missed delivery appointments
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F3F4] text-[11px] text-[#5F6368]">
                  <span>
                    {analyticsData?.no_show_count ??
                      bookings.filter((b) => b.status === "no_show").length}{" "}
                    unattended of{" "}
                    {analyticsData?.total_bookings_evaluated ?? bookings.length} scheduled
                  </span>
                </div>
              </Card>

              {/* 4. Daily Capacity Reserved */}
              <Card className="border-[#DADCE0] bg-white p-5 shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium uppercase tracking-wider text-[#5F6368]">
                      Today&apos;s Slot Fill Rate
                    </span>
                    <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91]">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[26px] font-semibold text-[#202124] leading-tight">
                      {analyticsData?.total_booked_today ?? todayBookings.length}{" "}
                      <span className="text-[14px] font-normal text-[#5F6368]">
                        / {analyticsData?.total_capacity_today ?? 50}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#5F6368] mt-1">
                      Total capacity booked for today
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#F1F3F4] text-[11px] text-[#5F6368]">
                  <span>
                    {analyticsData?.total_capacity_today
                      ? Math.round(
                          ((analyticsData.total_booked_today || 0) /
                            analyticsData.total_capacity_today) *
                            100
                        )
                      : 0}
                    % daily throughput utilized
                  </span>
                </div>
              </Card>
            </div>

            {/* Time Slot Bookings Bar Chart (Real Data) */}
            <Card className="border-[#DADCE0] bg-white p-5 sm:p-6 shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-[16px] font-medium text-[#202124]">
                    Bookings per Time Slot
                  </h3>
                  <p className="text-[13px] text-[#5F6368] mt-0.5">
                    Real-time crop intake distribution across scheduled 2-hour intake windows for{" "}
                    <strong>
                      {centresList.find((c) => c.id === selectedCentreId)?.name ||
                        analyticsData?.centre_name ||
                        "Selected Mandi"}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[#5F6368]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-[2px] bg-[#0B3D91]" />
                    <span>Booked Capacity</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-[2px] bg-[#F1F3F4] border border-[#DADCE0]" />
                    <span>Available Capacity</span>
                  </div>
                </div>
              </div>

              {analyticsLoading && !analyticsData ? (
                <div className="py-12 flex items-center justify-center text-[#5F6368] text-[13px]">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading time slot distribution...
                </div>
              ) : analyticsData?.slots_distribution &&
                analyticsData.slots_distribution.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {analyticsData.slots_distribution.map((slot: any) => {
                    const isFull = slot.booked_count >= slot.capacity;
                    const fillPct = Math.min(100, Math.max(0, slot.fill_percentage || 0));
                    return (
                      <div key={slot.slot_id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[13px]">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-[#202124]">
                              {slot.label}
                            </span>
                            <span className="text-[11px] text-[#5F6368]">
                              ({slot.booked_count} of {slot.capacity} spots booked)
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-[#202124] text-[12px]">
                              {slot.fill_percentage}%
                            </span>
                            {isFull ? (
                              <Badge variant="error">Full</Badge>
                            ) : slot.booked_count > 0 ? (
                              <Badge variant="info">Active</Badge>
                            ) : (
                              <Badge variant="neutral">Open</Badge>
                            )}
                          </div>
                        </div>

                        {/* Bar Visualizer */}
                        <div className="w-full h-5 bg-[#F1F3F4] rounded-[4px] overflow-hidden border border-[#DADCE0]/60 flex items-center">
                          <div
                            className={`h-full transition-all duration-500 rounded-[3px] ${
                              isFull
                                ? "bg-[#D93025]"
                                : fillPct > 50
                                ? "bg-[#0B3D91]"
                                : "bg-[#1A73E8]"
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-[13px] text-[#5F6368]">
                  <Package className="w-8 h-8 text-[#DADCE0] mx-auto mb-2" />
                  No specific slot intake schedules recorded for today. Bookings will appear here as farmers reserve delivery slots.
                </div>
              )}
            </Card>

            {/* Secondary Insights: Overall Booking Lifecycle Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-[#DADCE0] bg-white p-5 shadow-none">
                <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91] mb-3">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-medium text-[#202124]">
                  All-Time Status Breakdown
                </h3>
                <div className="mt-4 space-y-2.5 text-[13px]">
                  {Object.entries(BOOKING_STATUS).map(([st, { label, variant }]) => {
                    const count = bookings.filter((b) => b.status === st).length;
                    return (
                      <div key={st} className="flex items-center justify-between">
                        <Badge variant={variant as any}>{label}</Badge>
                        <span className="font-medium text-[#202124]">
                          {count} booking{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="border-[#DADCE0] bg-white p-5 shadow-none">
                <div className="w-8 h-8 rounded-[4px] bg-[#E6F4EA] flex items-center justify-center text-[#1E8E3E] mb-3">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-[16px] font-medium text-[#202124]">
                  Gate & Queue Status Today
                </h3>
                <div className="mt-4 space-y-2.5 text-[13px] text-[#5F6368]">
                  <div className="flex justify-between">
                    <span>Total bookings scheduled today</span>
                    <span className="font-medium text-[#202124]">{todayBookings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>In queue / at weighbridge</span>
                    <span className="font-medium text-[#E37400]">{queuedToday.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Intake & procurement completed</span>
                    <span className="font-medium text-[#1E8E3E]">{completedToday.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending arrival at gate</span>
                    <span className="font-medium text-[#5F6368]">{pendingToday.length}</span>
                  </div>
                </div>
              </Card>
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