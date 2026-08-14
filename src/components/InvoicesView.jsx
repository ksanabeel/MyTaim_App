import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export default function InvoicesView({
  bookings = [],
  userId,
  commissionRate = 0.1,
  platName = "المنصة",
  platLogo = "📍",
}) {
  const { t, i18n } = useTranslation();

  // ✨ حالات الفلترة والبحث ✨
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  // ✨ حالة النافذة المنبثقة للفاتورة (Modal) ✨
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // 💰 دالة حساب المبالغ المالية للفاتورة المحدثة لدعم الحجوزات الخاصة
  const calculateFinancials = (b) => {
    const finalTotal =
      b.proposed_price && Number(b.proposed_price) > 0
        ? Number(b.proposed_price)
        : (Number(b.offerings?.price) || 0) * (b.quantity || 1);

    // ✨ التحديث: إذا كان حجزاً يدوياً/خاصاً، فإن العمولة تساوي صفر
    const isManual = b.is_manual_booking === true;
    const platformCommission = isManual ? 0 : finalTotal * commissionRate;

    const providerNet = finalTotal - platformCommission;

    return {
      baseTotal: finalTotal,
      additional: 0,
      totalClientPrice: finalTotal,
      platformCommission,
      providerNet,
      qty: b.quantity || 1,
      isManual,
    };
  };

  let processedBookings = bookings.filter((b) => b.status === "completed");

  if (roleFilter === "provider") {
    processedBookings = processedBookings.filter(
      (b) => b.offerings?.provider_id === userId,
    );
  } else if (roleFilter === "client") {
    processedBookings = processedBookings.filter(
      (b) => b.customer_id === userId,
    );
  }

  if (searchTerm.trim() !== "") {
    const query = searchTerm.toLowerCase();
    processedBookings = processedBookings.filter((b) => {
      const shortId = b.id.split("-")[0].toLowerCase();
      const providerName = (
        b.offerings?.profiles?.full_name ||
        b.offerings?.profiles?.username ||
        ""
      ).toLowerCase();
      const clientName = (
        b.profiles?.full_name ||
        b.profiles?.username ||
        ""
      ).toLowerCase();
      return (
        shortId.includes(query) ||
        providerName.includes(query) ||
        clientName.includes(query)
      );
    });
  }

  processedBookings.sort((a, b) => {
    const dateA = new Date(a.appointment_date || 0);
    const dateB = new Date(b.appointment_date || 0);
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  const inputStyle = {
    padding: "12px 15px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    color: "#1e293b",
    backgroundColor: "#fff",
  };

  const isRTL = i18n?.language === "ar";
  const dateLocale = isRTL ? "ar-SA" : "en-US";

  const getFullFormattedDate = (dateObj) => {
    if (!dateObj) return null;
    try {
      const dayName = new Intl.DateTimeFormat(dateLocale, {
        weekday: "long",
      }).format(dateObj);
      const gregDate = new Intl.DateTimeFormat(dateLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(dateObj);
      const hijriDate = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(dateObj);
      return { dayName, gregDate, hijriDate };
    } catch (e) {
      return null;
    }
  };

  const openInvoiceModal = (b) => {
    const startObj = b.appointment_date ? new Date(b.appointment_date) : null;
    const endObj = b.end_time ? new Date(b.end_time) : null;

    const startTimeStr = startObj
      ? startObj.toLocaleTimeString(dateLocale, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const endTimeStr = endObj
      ? endObj.toLocaleTimeString(dateLocale, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    setSelectedInvoice({
      booking: b,
      fin: calculateFinancials(b),
      isProvider: b.offerings?.provider_id === userId,
      currency: b.offerings?.currency || "SAR",
      startFormatted: getFullFormattedDate(startObj),
      endFormatted: getFullFormattedDate(endObj),
      startTimeStr,
      endTimeStr,
    });
  };

  return (
    <>
      <style>{`
        @media print {
          html, body {
            height: 100vh !important;
            overflow: hidden !important;
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .hide-on-print {
            display: none !important;
          }
          .invoice-modal-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: #fff !important;
            z-index: 999999 !important;
            padding: 20px !important;
            display: block !important;
          }
          #printable-invoice {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* 1. الواجهة الرئيسية */}
      {/* ========================================================= */}
      <div
        className={selectedInvoice ? "hide-on-print" : ""}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "25px",
          direction: isRTL ? "rtl" : "ltr",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <h2
            style={{
              fontSize: "1.8rem",
              color: "#1e293b",
              margin: "0 0 10px 0",
              fontWeight: "900",
            }}
          >
            {t("financial_history_title", "السجل المالي والفواتير")}
          </h2>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem" }}>
            {t(
              "financial_history_desc",
              "استعرض كافة فواتير حجوزاتك كعميل أو إيراداتك كمزود خدمة.",
            )}
          </p>
        </div>

        {/* 🔍 شريط البحث والفلترة الذكي 🔍 */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "15px",
            backgroundColor: "#f8fafc",
            padding: "20px",
            borderRadius: "20px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{
              flex: "1 1 250px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: "bold",
                color: "#475569",
              }}
            >
              {t("comprehensive_search", "البحث الشامل:")}
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  right: isRTL ? "12px" : "auto",
                  left: isRTL ? "auto" : "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "1.1rem",
                }}
              >
                🔍
              </span>
              <input
                type="text"
                placeholder={t(
                  "search_invoices_placeholder",
                  "رقم الفاتورة، اسم المستخدم...",
                )}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  ...inputStyle,
                  width: "100%",
                  paddingRight: isRTL ? "40px" : "15px",
                  paddingLeft: isRTL ? "15px" : "40px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
          <div
            style={{
              flex: "1 1 150px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: "bold",
                color: "#475569",
              }}
            >
              {t("categorize_invoices", "تصنيف الفواتير:")}
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ ...inputStyle, width: "100%", cursor: "pointer" }}
            >
              <option value="all">
                {t("filter_all_invoices", "📁 عرض جميع الفواتير")}
              </option>
              <option value="provider">
                {t("filter_provider_revenues", "💼 إيراداتي (كمزود)")}
              </option>
              <option value="client">
                {t("filter_client_purchases", "🛍️ مشترياتي (كعميل)")}
              </option>
            </select>
          </div>
          <div
            style={{
              flex: "1 1 150px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: "bold",
                color: "#475569",
              }}
            >
              {t("sort_by", "ترتيب حسب:")}
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ ...inputStyle, width: "100%", cursor: "pointer" }}
            >
              <option value="newest">
                {t("sort_newest", "🔽 الأحدث تاريخاً")}
              </option>
              <option value="oldest">
                {t("sort_oldest", "🔼 الأقدم تاريخاً")}
              </option>
            </select>
          </div>
        </div>

        {processedBookings.length > 0 && (
          <div
            style={{ fontSize: "0.9rem", color: "#10b981", fontWeight: "bold" }}
          >
            {t("invoices_found_match", "✅ تم العثور على")} (
            {processedBookings.length}){" "}
            {t("invoices_matched_end", "فاتورة مطابقة.")}
          </div>
        )}

        {/* 🧾 شبكة عرض الفواتير المبسطة 🧾 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "25px",
          }}
        >
          {processedBookings.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "60px 20px",
                backgroundColor: "#f8fafc",
                borderRadius: "20px",
                border: "2px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📭</div>
              <h3
                style={{ margin: "0", fontSize: "1.2rem", fontWeight: "bold" }}
              >
                {t("no_matching_invoices", "لا توجد فواتير مطابقة لبحثك")}
              </h3>
            </div>
          ) : (
            processedBookings.map((b) => {
              const shortId = b.id.split("-")[0].toUpperCase();
              const isProvider = b.offerings?.provider_id === userId;
              const currency = b.offerings?.currency || "SAR";
              const fin = calculateFinancials(b);

              return (
                <div
                  key={b.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: "20px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#f8fafc",
                      padding: "15px 20px",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "#64748b",
                        fontWeight: "bold",
                      }}
                    >
                      {t("invoice_summary_prefix", "ملخص فاتورة #")}
                      {shortId}
                    </span>
                    {/* ✨ تمييز كرت الحجز الخاص ✨ */}
                    {b.is_manual_booking ? (
                      <span
                        style={{
                          backgroundColor: "#f0fdf4",
                          color: "#166534",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        {t("private_booking_badge", "📞 حجز خاص")}
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: isProvider ? "#ecfdf5" : "#eff6ff",
                          color: isProvider ? "#059669" : "#2563eb",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                        }}
                      >
                        {isProvider
                          ? t("revenue_badge", "إيراد 💼")
                          : t("purchases_badge", "مشترياتي 🛍️")}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      flex: 1,
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.1rem",
                        color: "#1e293b",
                        fontWeight: "900",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{b.offerings?.title}</span>
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                        ({t("quantity_text", "العدد: ")}
                        {b.quantity || 1})
                      </span>
                    </h3>
                    <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                      <strong>
                        {isProvider
                          ? t("client_label_inv", "العميل:")
                          : t("provider_label_inv", "المزود:")}
                      </strong>{" "}
                      {isProvider
                        ? b.profiles?.full_name
                        : b.offerings?.profiles?.full_name}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#f1f5f9",
                      padding: "20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ textAlign: isRTL ? "right" : "left" }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          color: "#64748b",
                          fontWeight: "bold",
                        }}
                      >
                        {isProvider
                          ? t("net_profit_label", "صافي الربح")
                          : t("paid_amount_label", "المبلغ المدفوع")}
                      </span>
                      <strong
                        style={{
                          fontSize: "1.2rem",
                          color: "#1e293b",
                          fontWeight: "900",
                          direction: "ltr",
                        }}
                      >
                        {(isProvider
                          ? fin.providerNet
                          : fin.totalClientPrice
                        ).toFixed(2)}{" "}
                        {currency}
                      </strong>
                    </div>
                    <button
                      onClick={() => openInvoiceModal(b)}
                      style={{
                        backgroundColor: "#1e293b",
                        color: "#fff",
                        border: "none",
                        padding: "10px 15px",
                        borderRadius: "10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        transition: "0.2s",
                      }}
                    >
                      {t("view_invoice_btn", "📄 عرض الفاتورة")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. نافذة الفاتورة المستقلة (هذا ما سيتم طباعته فقط) */}
      {/* ========================================================= */}
      {selectedInvoice && (
        <div
          className="invoice-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(5px)",
            zIndex: 9999,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            id="printable-invoice"
            style={{
              backgroundColor: "#fff",
              width: "100%",
              maxWidth: "800px",
              minHeight: "fit-content",
              margin: "auto",
              padding: "40px",
              borderRadius: "24px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
              direction: isRTL ? "rtl" : "ltr",
            }}
          >
            {/* أزرار التحكم العلوية (تختفي في الطباعة بفضل الكلاس no-print) */}
            <div
              className="no-print"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "30px",
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: "20px",
              }}
            >
              <button
                onClick={() => window.print()}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  padding: "10px 25px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "1rem",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                🖨️ {t("print_invoice_btn", "طباعة الفاتورة")}
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#ef4444",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                ✖ {t("close_modal_btn", "إغلاق")}
              </button>
            </div>

            {/* --- هيدر الفاتورة --- */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "40px",
                borderBottom: "2px solid #1e293b",
                paddingBottom: "20px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "15px" }}
              >
                {platLogo?.includes("http") ||
                platLogo?.startsWith("data:image") ? (
                  <img
                    src={platLogo}
                    alt="Logo"
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "12px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: "3rem" }}>{platLogo}</div>
                )}
                <div>
                  <h1
                    style={{
                      margin: 0,
                      color: "#1e293b",
                      fontSize: "1.8rem",
                      fontWeight: "900",
                    }}
                  >
                    {platName}
                  </h1>
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                    }}
                  >
                    {t("trusted_services_platform", "منصة الخدمات الموثوقة")}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: isRTL ? "left" : "right" }}>
                <h2
                  style={{
                    margin: 0,
                    color: "#1e293b",
                    fontSize: "1.5rem",
                    fontWeight: "900",
                  }}
                >
                  {t("service_invoice_title", "فاتورة خدمة")}{" "}
                  {selectedInvoice.booking.is_manual_booking
                    ? t("private_tag", "(خاصة)")
                    : ""}
                </h2>
                <div
                  style={{
                    color: "#475569",
                    fontSize: "0.9rem",
                    marginTop: "5px",
                  }}
                >
                  <strong>{t("invoice_num_label", "رقم الفاتورة:")}</strong> #
                  {selectedInvoice.booking.id.split("-")[0].toUpperCase()}
                </div>
                <div
                  style={{
                    color: "#475569",
                    fontSize: "0.9rem",
                    marginTop: "5px",
                  }}
                >
                  <strong>{t("issue_date_label", "تاريخ الإصدار:")}</strong>{" "}
                  {new Date().toLocaleDateString(dateLocale)}
                </div>
              </div>
            </div>

            {/* ✨ بانر توضيحي للحجوزات الخاصة ✨ */}
            {selectedInvoice.booking.is_manual_booking && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px dashed #bbf7d0",
                  padding: "15px",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  textAlign: "center",
                  color: "#166534",
                  fontWeight: "bold",
                }}
              >
                {t(
                  "manual_invoice_banner",
                  "📞 هذا الحجز تم إدخاله يدوياً كحجز خارجي (معفى من عمولة المنصة)",
                )}
              </div>
            )}

            {/* --- بيانات الأطراف --- */}
            <div style={{ display: "flex", gap: "30px", marginBottom: "20px" }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f8fafc",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 10px 0",
                    color: "#64748b",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("provider_data_title", "🏢 بيانات المزود:")}
                </h3>
                <strong
                  style={{
                    display: "block",
                    color: "#1e293b",
                    fontSize: "1.1rem",
                    marginBottom: "5px",
                  }}
                >
                  {selectedInvoice.booking.offerings?.profiles?.full_name ||
                    t("service_provider_default", "مزود الخدمة")}
                </strong>
                {selectedInvoice.booking.offerings?.profiles?.username && (
                  <div style={{ color: "#475569", fontSize: "0.9rem" }}>
                    @{selectedInvoice.booking.offerings?.profiles?.username}
                  </div>
                )}
              </div>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f8fafc",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 10px 0",
                    color: "#64748b",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("client_data_title", "👤 بيانات العميل:")}
                </h3>
                <strong
                  style={{
                    display: "block",
                    color: "#1e293b",
                    fontSize: "1.1rem",
                    marginBottom: "5px",
                  }}
                >
                  {selectedInvoice.booking.profiles?.full_name ||
                    t("client_default", "العميل")}
                </strong>
                {selectedInvoice.booking.profiles?.username && (
                  <div style={{ color: "#475569", fontSize: "0.9rem" }}>
                    @{selectedInvoice.booking.profiles?.username}
                  </div>
                )}
              </div>
            </div>

            {/* ✨ قسم تفاصيل الموعد والموقع ✨ */}
            <div
              style={{
                backgroundColor: "#eff6ff",
                border: "1px dashed #bfdbfe",
                padding: "20px",
                borderRadius: "16px",
                marginBottom: "30px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              {/* تاريخ البدء */}
              <div>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    color: "#64748b",
                    fontSize: "0.85rem",
                  }}
                >
                  {t("start_date_time_label", "تاريخ ووقت البدء:")}
                </h4>
                {selectedInvoice.startFormatted ? (
                  <div
                    style={{
                      color: "#1e293b",
                      fontWeight: "bold",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                    }}
                  >
                    📅 {selectedInvoice.startFormatted.dayName}،{" "}
                    {selectedInvoice.startFormatted.gregDate}
                    <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                      🌙 {selectedInvoice.startFormatted.hijriDate}
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      ⏰ {selectedInvoice.startTimeStr}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#64748b" }}>
                    {t("not_specified", "غير محدد")}
                  </div>
                )}
              </div>

              {/* تاريخ الانتهاء */}
              <div>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    color: "#64748b",
                    fontSize: "0.85rem",
                  }}
                >
                  {t("end_date_time_label", "تاريخ ووقت الانتهاء:")}
                </h4>
                <div
                  style={{
                    color: "#1e293b",
                    fontWeight: "bold",
                    fontSize: "0.95rem",
                    lineHeight: "1.6",
                  }}
                >
                  {selectedInvoice.endFormatted ? (
                    <>
                      🏁 {selectedInvoice.endFormatted.dayName}،{" "}
                      {selectedInvoice.endFormatted.gregDate}
                      <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                        🌙 {selectedInvoice.endFormatted.hijriDate}
                      </div>
                    </>
                  ) : (
                    <>🏁 {t("same_start_date", "نفس تاريخ البدء")}</>
                  )}
                  <div style={{ marginTop: "4px" }}>
                    ⌛{" "}
                    {selectedInvoice.endTimeStr ||
                      t("not_specified", "غير محدد")}
                  </div>
                </div>
              </div>

              {/* الموقع (إن وجد) يأخذ المساحة الكاملة بالأسفل */}
              {selectedInvoice.booking.location && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    borderTop: "1px solid #bfdbfe",
                    paddingTop: "15px",
                    marginTop: "5px",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      color: "#64748b",
                      fontSize: "0.85rem",
                    }}
                  >
                    📍 {t("service_location_label", "موقع تقديم الخدمة:")}
                  </h4>
                  <div
                    style={{
                      color: "#1e293b",
                      fontWeight: "bold",
                      fontSize: "0.95rem",
                      wordBreak: "break-all",
                    }}
                  >
                    {selectedInvoice.booking.location.startsWith("http") ? (
                      <a
                        href={selectedInvoice.booking.location}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#2563eb",
                          textDecoration: "underline",
                        }}
                      >
                        {t(
                          "map_link_text",
                          "رابط الموقع على الخريطة (اضغط للفتح)",
                        )}
                      </a>
                    ) : (
                      selectedInvoice.booking.location
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* --- تفاصيل الخدمة (الجدول) --- */}
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#1e293b",
                fontSize: "1.1rem",
              }}
            >
              {t("financial_details_title", "التفاصيل المالية للخدمة المنفذة:")}
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "40px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#1e293b", color: "#fff" }}>
                  <th
                    style={{
                      padding: "12px 15px",
                      textAlign: isRTL ? "right" : "left",
                      borderRadius: isRTL ? "0 10px 10px 0" : "10px 0 0 10px",
                    }}
                  >
                    {t("table_service", "الخدمة")}
                  </th>
                  <th style={{ padding: "12px 15px", textAlign: "center" }}>
                    {t("table_quantity", "العدد")}
                  </th>
                  <th
                    style={{
                      padding: "12px 15px",
                      textAlign: isRTL ? "left" : "right",
                      borderRadius: isRTL ? "10px 0 0 10px" : "0 10px 10px 0",
                    }}
                  >
                    {t("table_total", "الإجمالي")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "15px",
                      borderBottom: "1px solid #e2e8f0",
                      color: "#334155",
                      fontWeight: "bold",
                    }}
                  >
                    {selectedInvoice.booking.offerings?.title}
                  </td>
                  <td
                    style={{
                      padding: "15px",
                      borderBottom: "1px solid #e2e8f0",
                      color: "#334155",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {selectedInvoice.fin.qty}
                  </td>
                  <td
                    style={{
                      padding: "15px",
                      borderBottom: "1px solid #e2e8f0",
                      color: "#334155",
                      textAlign: isRTL ? "left" : "right",
                      fontWeight: "bold",
                      direction: "ltr",
                    }}
                  >
                    {selectedInvoice.fin.baseTotal.toFixed(2)}{" "}
                    {selectedInvoice.currency}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* --- الملخص المالي --- */}
            <div
              style={{
                display: "flex",
                justifyContent: isRTL ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  width: "350px",
                  backgroundColor: "#f8fafc",
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                    color: "#475569",
                    fontSize: "0.95rem",
                  }}
                >
                  <span>{t("base_amount_label", "المبلغ الأساسي:")}</span>
                  <span style={{ direction: "ltr", fontWeight: "bold" }}>
                    {selectedInvoice.fin.baseTotal.toFixed(2)}{" "}
                    {selectedInvoice.currency}
                  </span>
                </div>

                {selectedInvoice.fin.additional > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      color: "#475569",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span>{t("additions_label", "إضافات ومصاريف أخرى:")}</span>
                    <span style={{ direction: "ltr", fontWeight: "bold" }}>
                      {selectedInvoice.fin.additional.toFixed(2)}{" "}
                      {selectedInvoice.currency}
                    </span>
                  </div>
                )}

                {/* ✨ عرض العمولة بشكل ذكي بناءً على نوع الحجز ✨ */}
                {selectedInvoice.isProvider &&
                  !selectedInvoice.booking.is_manual_booking && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "15px",
                        color: "#ef4444",
                        fontSize: "0.95rem",
                        paddingBottom: "15px",
                        borderBottom: "1px dashed #cbd5e1",
                      }}
                    >
                      <span>
                        {t("platform_fees_label", "رسوم المنصة")} (
                        {commissionRate * 100}%):
                      </span>
                      <span style={{ direction: "ltr", fontWeight: "bold" }}>
                        - {selectedInvoice.fin.platformCommission.toFixed(2)}{" "}
                        {selectedInvoice.currency}
                      </span>
                    </div>
                  )}

                {selectedInvoice.isProvider &&
                  selectedInvoice.booking.is_manual_booking && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "15px",
                        color: "#10b981",
                        fontSize: "0.95rem",
                        paddingBottom: "15px",
                        borderBottom: "1px dashed #cbd5e1",
                      }}
                    >
                      <span>
                        {t("platform_fees_exempt", "رسوم المنصة (معفى):")}
                      </span>
                      <span style={{ direction: "ltr", fontWeight: "bold" }}>
                        0.00 {selectedInvoice.currency}
                      </span>
                    </div>
                  )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: selectedInvoice.isProvider ? "#059669" : "#1d4ed8",
                    fontSize: "1.2rem",
                    paddingTop: selectedInvoice.isProvider ? "0" : "15px",
                    borderTop: selectedInvoice.isProvider
                      ? "none"
                      : "1px dashed #cbd5e1",
                    marginTop: selectedInvoice.isProvider ? "0" : "10px",
                  }}
                >
                  <strong style={{ fontWeight: "900" }}>
                    {selectedInvoice.isProvider
                      ? t("net_payable_provider", "صافي المستحق للمزود:")
                      : t("total_paid_client", "إجمالي المدفوع:")}
                  </strong>
                  <strong style={{ direction: "ltr", fontWeight: "900" }}>
                    {(selectedInvoice.isProvider
                      ? selectedInvoice.fin.providerNet
                      : selectedInvoice.fin.totalClientPrice
                    ).toFixed(2)}{" "}
                    {selectedInvoice.currency}
                  </strong>
                </div>
              </div>
            </div>

            {/* --- الفوتر --- */}
            <div
              style={{
                marginTop: "50px",
                textAlign: "center",
                color: "#94a3b8",
                fontSize: "0.9rem",
                borderTop: "1px solid #f1f5f9",
                paddingTop: "20px",
              }}
            >
              {t(
                "invoice_footer_text_1",
                "تم إصدار هذه الفاتورة إلكترونياً من نظام",
              )}{" "}
              <strong>{platName}</strong>.<br />
              {t("invoice_footer_text_2", "شكراً لثقتكم وتعاملكم معنا.")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
