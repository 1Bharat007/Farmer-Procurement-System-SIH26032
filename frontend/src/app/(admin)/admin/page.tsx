"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient, authStorage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, BarChart3, Building2, LogOut, Users,
  Loader2, RefreshCw, AlertCircle, CheckCircle2, QrCode,
  Clock, Package, Check, Clipboard
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

  const loadBookings = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.bookings.list();
      setBookings(Array.isArray(res) ? res : res?.results || res?.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Handle direct QR check-in
  const handleQrCheckIn = async (tokenToUse?: string) => {
    const token = (tokenToUse || qrTokenInput).trim();
    if (!token) return;

    setQrLoading(true);
    setQrResult(null);
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
      const errMsg =
        err?.data?.error ||
        err?.data?.detail ||
        err?.message ||
        "Invalid or already-used QR code.";
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
    try {
      await apiClient.bookings.checkIn(bookingId);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || "Check-in failed.");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (bookingId: number) => {
    setActionId(bookingId);
    try {
      await apiClient.bookings.cancel(bookingId);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || "Cancel failed.");
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
                : "Stats"}
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

        {/* TAB 4: STATS */}
        {activeTab === "stats" && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-[#DADCE0] bg-white p-5 shadow-none">
              <div className="w-8 h-8 rounded-[4px] bg-[#E8F0FE] flex items-center justify-center text-[#0B3D91] mb-3">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-[16px] font-medium text-[#202124]">Procurement Summary</h2>
              <div className="mt-4 space-y-3 text-[13px]">
                {Object.entries(BOOKING_STATUS).map(([status, { label, variant }]) => {
                  const count = bookings.filter((b) => b.status === status).length;
                  return (
                    <div key={status} className="flex items-center justify-between">
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
              <h2 className="text-[16px] font-medium text-[#202124]">Today at a Glance</h2>
              <div className="mt-4 space-y-2 text-[13px] text-[#5F6368]">
                <div className="flex justify-between">
                  <span>Total bookings today</span>
                  <span className="font-medium text-[#202124]">{todayBookings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>In queue / processing</span>
                  <span className="font-medium text-[#E37400]">{queuedToday.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span className="font-medium text-[#1E8E3E]">{completedToday.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending check-in</span>
                  <span className="font-medium text-[#5F6368]">{pendingToday.length}</span>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      <footer className="border-t border-[#DADCE0] bg-white py-3 text-center text-[11px] text-[#5F6368]">
        Ministry of Consumer Affairs, Food & Public Distribution - SIH 2026
      </footer>
    </div>
  );
}