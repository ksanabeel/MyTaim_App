import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function CustomerBookingCard({ booking }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(booking.status);

  // دالة الموافقة على السعر المقترح
  const handleApproveQuote = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "pending" })
        .eq("id", booking.id);

      if (!error) {
        setStatus("pending");
        alert("✅ تم قبول السعر بنجاح! تم إرسال الطلب للمزود للتأكيد النهائي.");
      }
    } finally {
      setLoading(false);
    }
  };

  // دالة رفض السعر أو إلغاء الطلب
  const handleRejectQuote = async () => {
    if (!window.confirm("هل أنت متأكد من رفض هذا العرض وإلغاء الطلب؟")) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", booking.id);

      if (!error) {
        setStatus("cancelled");
        alert("❌ تم رفض العرض وإلغاء الطلب.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (s) => {
    switch (s) {
      case "awaiting_pricing":
        return "⏳ بانتظار تسعير المزود";
      case "awaiting_client_approval":
        return "💰 وصلك عرض سعر - بانتظار موافقتك";
      case "pending":
        return "📨 تم الإرسال وبانتظار قبول المزود";
      case "confirmed":
        return "✅ تم التأكيد";
      case "cancelled":
        return "❌ ملغي";
      case "completed":
        return "🏁 مكتمل";
      default:
        return s;
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        padding: "15px",
        borderRadius: "12px",
        backgroundColor: "#fff",
        marginBottom: "15px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h4 style={{ margin: 0 }}>{booking.offerings?.title}</h4>
        <span style={{ fontWeight: "bold", color: "#1e293b" }}>
          {status === "awaiting_pricing"
            ? "قيد التسعير..."
            : `${booking.proposed_price || booking.offerings?.price} SAR`}
        </span>
      </div>

      <div style={{ margin: "10px 0", fontSize: "0.85em", color: "#64748b" }}>
        📅 الموعد:{" "}
        {new Date(booking.appointment_date).toLocaleDateString("ar-SA")}
      </div>

      {status === "awaiting_client_approval" && (
        <div
          style={{
            backgroundColor: "#f0f9ff",
            padding: "15px",
            borderRadius: "10px",
            margin: "10px 0",
            border: "1px solid #bae6fd",
          }}
        >
          <strong style={{ color: "#0369a1", fontSize: "0.9em" }}>
            🤝 عرض سعر جديد من المزود:
          </strong>
          <p
            style={{
              margin: "5px 0",
              fontSize: "1.2rem",
              fontWeight: "900",
              color: "#0c4a6e",
            }}
          >
            {booking.proposed_price} SAR
          </p>
          {booking.extra_details && (
            <p
              style={{ margin: "5px 0", fontSize: "0.85em", color: "#334155" }}
            >
              📝 ملاحظة: {booking.extra_details}
            </p>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button
              onClick={handleApproveQuote}
              disabled={loading}
              style={{
                flex: 2,
                backgroundColor: "#10b981",
                color: "white",
                padding: "10px",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {loading ? "جاري..." : "قبول السعر ✅"}
            </button>
            <button
              onClick={handleRejectQuote}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: "#fff",
                color: "#ef4444",
                padding: "10px",
                border: "1px solid #ef4444",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              رفض ✖
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "10px",
          paddingTop: "10px",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            padding: "4px 12px",
            borderRadius: "20px",
            backgroundColor:
              status === "awaiting_client_approval" ? "#fff7ed" : "#f1f5f9",
            color:
              status === "awaiting_client_approval" ? "#ea580c" : "#475569",
            fontWeight: "bold",
          }}
        >
          {getStatusLabel(status)}
        </span>
      </div>
    </div>
  );
}

export default function CustomerBookings({ session }) {
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, offerings!inner(*)")
        .eq("customer_id", session.user.id)
        .order("created_at", { ascending: false });
      if (data) setMyBookings(data);
      setLoading(false);
    };
    fetchBookings();
  }, [session.user.id]);

  if (loading)
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        ⏳ جاري تحميل طلباتك...
      </div>
    );

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h2
        style={{ fontSize: "1.4rem", marginBottom: "20px", fontWeight: "900" }}
      >
        📦 سجل طلباتي
      </h2>
      {myBookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
          لا توجد طلبات حالياً..
        </div>
      ) : (
        myBookings.map((b) => <CustomerBookingCard key={b.id} booking={b} />)
      )}
    </div>
  );
}
