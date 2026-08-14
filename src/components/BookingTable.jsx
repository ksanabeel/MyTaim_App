import { useTranslation } from "react-i18next";
import BookingRow from "./BookingRow";
import { calculateFinancials } from "../lib/financials";

export default function BookingTable({
  bookings,
  status,
  isProvider,
  commissionRate,
  onRefresh,
  onHideComment,
}) {
  const { t } = useTranslation();
  const filtered = bookings.filter((b) => b.status === status);
  const titleMap = {
    awaiting_pricing: {
      text: t("status_awaiting_pricing", "طلبات بانتظار تسعيرك"),
      icon: "💰",
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
    },
    awaiting_client_approval: {
      text: t("status_awaiting_client", "بانتظار موافقة العميل على السعر"),
      icon: "⏳",
      color: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
    },
    pending: {
      text: t("status_pending", "طلبات قيد الانتظار"),
      icon: "🆕",
      color: "#d97706",
      bg: "#fef3c7",
      border: "#fde68a",
    },
    negotiating: {
      text: t("status_negotiating", "بانتظار الموافقه"),
      icon: "🤝",
      color: "#d97706",
      bg: "#fef3c7",
      border: "#fde68a",
    },
    confirmed: {
      text: t("status_confirmed", "حجوزات مؤكدة"),
      icon: "👍",
      color: "#059669",
      bg: "#ecfdf5",
      border: "#a7f3d0",
    },
    completed: {
      text: t("status_completed", "حجوزات منفذة"),
      icon: "✅",
      color: "#15803d",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    },
    cancelled: {
      text: t("status_cancelled", "ملغاة"),
      icon: "❌",
      color: "#ef4444",
      bg: "#fef2f2",
      border: "#fecaca",
    },
  };
  if (filtered.length === 0) return null;
  const currentTitle = titleMap[status] || {
    text: status,
    icon: "📌",
    color: "#475569",
    bg: "#f1f5f9",
    border: "#cbd5e1",
  };

  return (
    <div key={status} style={{ marginBottom: "35px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h4
          style={{
            fontSize: "1rem",
            color: currentTitle.color,
            backgroundColor: currentTitle.bg,
            border: `1px solid ${currentTitle.border}`,
            padding: "10px 20px",
            borderRadius: "30px",
            margin: "0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: "900",
            boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>{currentTitle.icon}</span>{" "}
          {currentTitle.text}
        </h4>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: currentTitle.border,
            margin: "0 20px",
            opacity: 0.5,
          }}
        ></div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          paddingBottom: "10px",
        }}
      >
        {filtered.map((b) => {
          const currency = b.offerings?.currency || "USD";
          const { platformCommission } = calculateFinancials(
            b,
            commissionRate,
          );
          const hasComment =
            b.review_text ||
            b.review_comment ||
            b.client_review ||
            b.review ||
            b.comment ||
            b.feedback;
          const isHidden =
            b.is_comment_hidden || (hasComment && hasComment.includes("🚫"));

          return (
            <div
              key={b.id}
              style={{ display: "flex", flexDirection: "column" }}
            >
              <BookingRow
                booking={b}
                onRefresh={onRefresh}
                isProviderView={isProvider}
              />

              {isProvider &&
                b.status === "completed" &&
                hasComment &&
                !isHidden && (
                  <div
                    style={{
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderTop: "none",
                      padding: "10px 20px",
                      borderBottomRightRadius: "16px",
                      borderBottomLeftRadius: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginTop: "-15px",
                      position: "relative",
                      zIndex: 0,
                    }}
                  >
                    <span
                      style={{
                        color: "#b45309",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                      }}
                    >
                      {t("client_comment", "💬 تعليق العميل: ")}"{hasComment}"
                    </span>
                    <button
                      onClick={() => onHideComment(b.id)}
                      style={{
                        background: "#fef2f2",
                        color: "#ef4444",
                        border: "1px solid #fca5a5",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "0.75rem",
                        transition: "0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.background = "#fee2e2")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.background = "#fef2f2")
                      }
                    >
                      {t("hide_comment_btn", "🗑️ إخفاء التعليق")}
                    </button>
                  </div>
                )}

              {isProvider && b.status === "completed" && isHidden && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderTop: "none",
                    padding: "12px 20px",
                    borderBottomRightRadius: "16px",
                    borderBottomLeftRadius: "16px",
                    color: "#64748b",
                    fontSize: "0.85rem",
                    fontStyle: "italic",
                    marginTop: "-15px",
                    position: "relative",
                    zIndex: 0,
                  }}
                >
                  {t("comment_hidden_badge", "🚫 تم إخفاء التعليق")}
                </div>
              )}

              {isProvider && b.status === "completed" && (
                <div
                  style={{
                    backgroundColor: b.is_manual_booking
                      ? "#f0fdf4"
                      : b.is_commission_paid
                        ? "#ecfdf5"
                        : "#fef2f2",
                    border: b.is_manual_booking
                      ? "1px solid #bbf7d0"
                      : b.is_commission_paid
                        ? "1px solid #a7f3d0"
                        : "1px solid #fca5a5",
                    borderTop: "none",
                    padding: "12px 20px",
                    borderBottomRightRadius: "16px",
                    borderBottomLeftRadius: "16px",
                    color: b.is_manual_booking
                      ? "#166534"
                      : b.is_commission_paid
                        ? "#047857"
                        : "#b91c1c",
                    fontWeight: "bold",
                    fontSize: "0.85rem",
                    marginTop: hasComment || isHidden ? "0px" : "-15px",
                    position: "relative",
                    zIndex: -1,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: b.is_manual_booking
                      ? "center"
                      : "space-between",
                  }}
                >
                  {b.is_manual_booking ? (
                    <span>
                      {t(
                        "manual_booking_notice",
                        "📞 حجز خاص (خارجي) - الإيرادات لك بالكامل ولا توجد عمولة للمنصة",
                      )}
                    </span>
                  ) : (
                    <>
                      <span>
                        {t(
                          "platform_commission_notice",
                          "💰 عمولة المنصة لهذا الحجز: ",
                        )}
                        <strong
                          style={{
                            direction: "ltr",
                            display: "inline-block",
                            fontSize: "1rem",
                          }}
                        >
                          {platformCommission.toFixed(2)} {currency}
                        </strong>
                      </span>
                      <span
                        style={{
                          backgroundColor: "#fff",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                        }}
                      >
                        {b.is_commission_paid
                          ? t("commission_paid", "✅ مسددة للمنصة")
                          : t("commission_unpaid", "❌ مستحقة ولم تسدد بعد")}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
