import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import BookingRow from "./BookingRow"; // التأكد من استدعاء البطاقة المحدثة
import { useTranslation } from "react-i18next"; // ✨ استيراد أداة الترجمة

// ✨ المكون الرئيسي (نظام التبويبات) ✨
export default function ProviderSchedule({
  bookings,
  session,
  fetchBookings,
  isProviderView = true,
}) {
  const { t } = useTranslation(); // ✨ تفعيل الترجمة
  const [activeTab, setActiveTab] = useState("new");

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel("realtime_bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchBookings();
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, fetchBookings]);

  // 🚀 تصفية وعزل الأرشفة بذكاء لكل طرف
  const visibleBookings =
    bookings?.filter((b) => {
      if (isProviderView) return b.is_archived_by_provider !== true;
      return b.is_archived_by_client !== true;
    }) || [];

  const newBookings = visibleBookings.filter((b) =>
    ["pending", "awaiting_pricing", "negotiating"].includes(b.status),
  );
  const activeBookings = visibleBookings.filter((b) =>
    ["confirmed", "awaiting_client_approval"].includes(b.status),
  );
  const historyBookings = visibleBookings.filter((b) =>
    ["completed", "cancelled"].includes(b.status),
  );

  let displayedBookings = [];
  if (activeTab === "new") displayedBookings = newBookings;
  if (activeTab === "active") displayedBookings = activeBookings;
  if (activeTab === "history") displayedBookings = historyBookings;

  const tabBtnStyle = (tabName, color) => ({
    flex: 1,
    padding: "12px 10px",
    backgroundColor: activeTab === tabName ? color : "#fff",
    color: activeTab === tabName ? "#fff" : "#475569",
    border: `1px solid ${activeTab === tabName ? color : "#e2e8f0"}`,
    borderRadius: "12px",
    fontWeight: "bold",
    fontSize: "0.9rem",
    cursor: "pointer",
    transition: "0.2s",
    boxShadow: activeTab === tabName ? "0 4px 10px rgba(0,0,0,0.1)" : "none",
  });

  return (
    <div
      style={{
        marginTop: "20px",
        backgroundColor: "#f8fafc",
        borderRadius: "16px",
        padding: "20px",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", fontWeight: "900" }}>
        {isProviderView
          ? t("provider_schedule_title", "لوحة تحكم أعمالي 💼")
          : t("client_schedule_title", "طلباتي وحجوزاتي 🛒")}
      </h3>
      <p
        style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}
      >
        {isProviderView
          ? t(
              "provider_schedule_desc",
              "إدارة ومتابعة الطلبات، مع إمكانية أرشفة الطلبات المنتهية لتنظيف الشاشة.",
            )
          : t(
              "client_schedule_desc",
              "متابعة حالة طلباتك وتقييم الخدمات بعد الإنجاز، مع إمكانية أرشفة الطلب المنتهي.",
            )}
      </p>

      {/* 🔘 شريط التبويبات */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "5px",
        }}
      >
        <button
          onClick={() => setActiveTab("new")}
          style={tabBtnStyle("new", "#3b82f6")}
        >
          {t("tab_new_bookings", "🆕 طلبات جديدة")} ({newBookings.length})
        </button>
        <button
          onClick={() => setActiveTab("active")}
          style={tabBtnStyle("active", "#10b981")}
        >
          {t("tab_active_bookings", "⏳ قيد التنفيذ")} ({activeBookings.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={tabBtnStyle("history", "#64748b")}
        >
          {t("tab_history_bookings", "📂 السجل المكتمل")} (
          {historyBookings.length})
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        {displayedBookings.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#94a3b8",
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "2px dashed #e2e8f0",
              fontWeight: "bold",
            }}
          >
            {t("no_bookings_in_section", "لا توجد طلبات في هذا القسم..")}
          </div>
        ) : (
          displayedBookings.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              onRefresh={fetchBookings}
              isProviderView={isProviderView}
            />
          ))
        )}
      </div>
    </div>
  );
}
