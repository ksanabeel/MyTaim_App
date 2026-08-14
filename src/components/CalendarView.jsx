import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import BookingRow from "./BookingRow";
import { getStoredValue, setStoredValue } from "../lib/native";

export default function CalendarView({
  bookings = [],
  onRefresh,
  userId,
  allowTextReviews = true,
}) {
  const { t, i18n } = useTranslation();
  const [curr, setCurr] = useState(new Date());

  const [localUserId, setLocalUserId] = useState(userId);
  useEffect(() => {
    if (!localUserId) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) setLocalUserId(data.session.user.id);
      });
    }
  }, [localUserId]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [dayBookings, setDayBookings] = useState([]);
  const [managingBookingId, setManagingBookingId] = useState(null);

  const [roleFilter, setRoleFilter] = useState("all");

  // ✨ ميزة تبديل التقويم (هجري / ميلادي) ✨
  const [calendarType, setCalendarType] = useState("gregory");

  useEffect(() => {
    getStoredValue("preferredCalendar").then((pref) => {
      if (pref) setCalendarType(pref);
    });
  }, []);

  useEffect(() => {
    setStoredValue("preferredCalendar", calendarType);
  }, [calendarType]);

  const toggleCalendar = () => {
    setCalendarType((prev) =>
      prev === "gregory" ? "islamic-umalqura" : "gregory",
    );
  };

  const formatDate = (dateObj, options) => {
    if (!dateObj) return "";
    return dateObj.toLocaleDateString(
      i18n.language === "ar" ? "ar-SA" : "en-US",
      {
        calendar: calendarType,
        ...options,
      },
    );
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDay = new Date(curr.getFullYear(), curr.getMonth(), 1).getDay();

  const today = new Date();
  const isCurrentMonth =
    today.getMonth() === curr.getMonth() &&
    today.getFullYear() === curr.getFullYear();
  const todayDate = today.getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth(curr.getFullYear(), curr.getMonth()); d++)
    days.push(d);

  const getDateString = (day) => {
    if (!day) return null;
    return `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(day).padStart(2, "0")}`;
  };

  const getLocalDateString = (utcDateString) => {
    if (!utcDateString) return null;
    const localDate = new Date(utcDateString);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const filteredBookings = bookings.filter((b) => {
    const isProvider = localUserId === b.offerings?.provider_id;
    const isClient = localUserId === b.customer_id;
    if (roleFilter === "provider") return isProvider;
    if (roleFilter === "client") return isClient;
    return true;
  });

  const getStatus = (day) => {
    const dStr = getDateString(day);
    if (!dStr) return "free";

    const dayB = filteredBookings.filter(
      (b) => getLocalDateString(b.appointment_date) === dStr,
    );

    if (dayB.length === 0) return "free";
    if (dayB.some((b) => b.status === "confirmed" || b.status === "completed"))
      return "ok";
    if (
      dayB.some(
        (b) =>
          b.status === "pending" ||
          b.status === "negotiating" ||
          b.status === "awaiting_pricing" ||
          b.status === "awaiting_client_approval",
      )
    )
      return "wait";
    return "free";
  };

  const getDayRoles = (day) => {
    const dStr = getDateString(day);
    if (!dStr) return { isProv: false, isCli: false };
    const dayB = filteredBookings.filter(
      (b) => getLocalDateString(b.appointment_date) === dStr,
    );
    const isProv = dayB.some((b) => b.offerings?.provider_id === localUserId);
    const isCli = dayB.some((b) => b.customer_id === localUserId);
    return { isProv, isCli };
  };

  const handleDayClick = (day) => {
    const dStr = getDateString(day);
    if (!dStr) return;

    const bks = filteredBookings.filter(
      (b) => getLocalDateString(b.appointment_date) === dStr,
    );

    if (bks.length > 0) {
      setDayBookings(bks);
      setSelectedDate(dStr);
      setManagingBookingId(null);
    }
  };

  const handlePrintInvoice = (b) => {
    const isRTL = i18n.language === "ar";
    const statusText =
      b.status === "confirmed"
        ? isRTL
          ? "مؤكد"
          : "Confirmed"
        : b.status === "completed"
          ? isRTL
            ? "مكتمل"
            : "Completed"
          : b.status === "cancelled"
            ? isRTL
              ? "ملغى"
              : "Cancelled"
            : isRTL
              ? "قيد المعالجة"
              : "Pending";

    const qty = b.quantity || 1;
    const price = Number(b.offerings?.price) || 0;
    const addCosts = Number(b.additional_costs) || 0;
    const total = price * qty + addCosts;

    const printDate = new Date(b.appointment_date);
    const dateStr = formatDate(printDate);
    const timeStr = printDate.toLocaleTimeString(isRTL ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const printWindow = window.open("", "_blank", "width=800,height=800");
    printWindow.document.write(`
      <html dir="${isRTL ? "rtl" : "ltr"}">
      <head>
        <title>فاتورة حجز #${b.id.substring(0, 6)}</title>
        <style>
          body { font-family: system-ui; padding: 40px; color: #1e293b; }
          .invoice-box { border: 2px dashed #cbd5e1; padding: 40px; border-radius: 15px; max-width: 600px; margin: 0 auto; background: #fff; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px; }
          h2, p { margin: 0 0 10px 0; }
        </style>
      </head>
      <body style="background: #f8fafc;">
        <div class="invoice-box">
          <div class="header">
            <h2>فاتورة حجز #${b.id.substring(0, 6)}</h2>
            <span style="background: #7c3aed; color: white; padding: 8px 15px; border-radius: 8px; font-weight: bold;">${statusText}</span>
          </div>
          <p><strong>الخدمة:</strong> ${b.offerings?.title || "غير متوفر"}</p>
          <p><strong>تاريخ ووقت البدء:</strong> ${dateStr} - ${timeStr}</p>
          <hr style="border: 1px solid #f1f5f9; margin: 20px 0;" />
          <div style="display: flex; justify-content: space-between;">
            <p><strong>التكلفة الأساسية:</strong></p> <p>${price * qty} ر.س</p>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <p><strong>التكاليف الإضافية:</strong></p> <p>+ ${addCosts} ر.س</p>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #cbd5e1;">
            <h3 style="margin:0; color: #1e293b;"><strong>الإجمالي:</strong></h3> 
            <h3 style="margin:0; color: #10b981;">${total} ر.س</h3>
          </div>
        </div>
        <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 500); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (status) => {
    if (status === "confirmed" || status === "completed")
      return {
        text:
          i18n.language === "ar"
            ? status === "completed"
              ? "مكتمل"
              : "مؤكد"
            : status,
        bg: "#ecfdf5",
        color: "#059669",
        border: "#10b981",
      };
    if (status === "cancelled")
      return {
        text: i18n.language === "ar" ? "ملغى" : "Cancelled",
        bg: "#fef2f2",
        color: "#ef4444",
        border: "#f87171",
      };
    return {
      text: i18n.language === "ar" ? "قيد المعالجة" : "Pending",
      bg: "#fffbeb",
      color: "#d97706",
      border: "#fcd34d",
    };
  };

  const isRTL = i18n.language === "ar";
  const dateLocale = isRTL ? "ar-SA" : "en-US";
  const weekDays = [
    t("sun"),
    t("mon"),
    t("tue"),
    t("wed"),
    t("thu"),
    t("fri"),
    t("sat"),
  ];

  return (
    <div
      className="calendar-container"
      style={{
        backgroundColor: "#fff",
        padding: "30px",
        borderRadius: "24px",
        direction: isRTL ? "rtl" : "ltr",
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
        position: "relative",
      }}
    >
      <style>{`
        /* ✨ حل مشكلة التمدد وإجبار الـ Grid على احتواء الخلايا ✨ */
        .calendar-grid {
          display: grid;
          /* التعديل السحري هنا: minmax(0, 1fr) يمنع الـ Grid من تجاوز حدود الشاشة */
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 10px;
        }
        .calendar-day-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .calendar-day-card:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 8px 20px rgba(0,0,0,0.08); z-index: 10; }
        .filter-group button { transition: all 0.2s; }
        .filter-group button:hover { opacity: 0.9; }
        .toggle-switch { width: 50px; height: 26px; background-color: #cbd5e1; border-radius: 20px; position: relative; cursor: pointer; transition: 0.3s; margin: 0 10px; }
        .toggle-switch.hijri { background-color: #7c3aed; }
        .toggle-circle { width: 22px; height: 22px; background-color: white; border-radius: 50%; position: absolute; top: 2px; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .toggle-switch.hijri .toggle-circle { transform: translateX(${
          isRTL ? "-24px" : "24px"
        }); }
        .toggle-switch:not(.hijri) .toggle-circle { transform: translateX(0); }

        /* ✨ التجاوب مع شاشات الجوال (Mobile Responsiveness) ✨ */
        @media (max-width: 600px) {
          .calendar-container { padding: 15px !important; border-radius: 16px !important; }
          .calendar-grid { gap: 4px !important; }
          .calendar-day-cell { min-height: 65px !important; padding: 4px !important; border-radius: 12px !important; }
          .day-header { font-size: 0.75rem !important; }
          .primary-day-txt { font-size: 1rem !important; margin-top: -2px !important; }
          .secondary-day-txt { font-size: 0.6rem !important; margin-right: 2px !important; }
          .booking-badges { padding: 2px 4px !important; flex-wrap: wrap !important; gap: 2px !important; }
          .booking-badges span { font-size: 0.7rem !important; }
          .calendar-title { font-size: 1.1rem !important; }
        }
      `}</style>

      {/* محول التقويم */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "20px",
          padding: "10px",
          backgroundColor: "#f8fafc",
          borderRadius: "16px",
          border: "1px dashed #cbd5e1",
        }}
      >
        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: "bold",
            color: calendarType === "gregory" ? "#0f172a" : "#94a3b8",
          }}
        >
          ميلادي
        </span>
        <div
          className={`toggle-switch ${
            calendarType === "islamic-umalqura" ? "hijri" : ""
          }`}
          onClick={toggleCalendar}
        >
          <div className="toggle-circle"></div>
        </div>
        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: "bold",
            color: calendarType === "islamic-umalqura" ? "#7c3aed" : "#94a3b8",
          }}
        >
          هجري
        </span>
      </div>

      {/* رأس التقويم */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "25px",
          paddingBottom: "20px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <button
          onClick={() => setCurr(new Date(curr.setMonth(curr.getMonth() - 1)))}
          style={navB}
        >
          {isRTL ? "▶" : "◀"}
        </button>

        <h3
          className="calendar-title"
          style={{
            fontSize: "1.4rem",
            margin: 0,
            color: "#1e293b",
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          {formatDate(curr, { month: "long", year: "numeric" })}
        </h3>

        <button
          onClick={() => setCurr(new Date(curr.setMonth(curr.getMonth() + 1)))}
          style={navB}
        >
          {isRTL ? "◀" : "▶"}
        </button>
      </div>

      {/* فلاتر العرض */}
      <div
        className="filter-group"
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: "#f1f5f9",
            padding: "5px",
            borderRadius: "15px",
            gap: "5px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => setRoleFilter("all")}
            style={filterBtn(roleFilter === "all", "#1e293b", "transparent")}
          >
            الكل
          </button>
          <button
            onClick={() => setRoleFilter("provider")}
            style={filterBtn(roleFilter === "provider", "#7c3aed", "#f3e8ff")}
          >
            💼 أعمالي
          </button>
          <button
            onClick={() => setRoleFilter("client")}
            style={filterBtn(roleFilter === "client", "#059669", "#ecfdf5")}
          >
            🛍️ طلباتي
          </button>
        </div>
      </div>

      {/* شبكة التقويم */}
      <div className="calendar-grid">
        {weekDays.map((d, index) => (
          <div
            key={index}
            className="day-header"
            style={{
              fontSize: "0.85rem",
              color: "#94a3b8",
              textAlign: "center",
              fontWeight: "900",
              marginBottom: "10px",
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}

        {days.map((d, i) => {
          const s = getStatus(d);
          const hasBookings = s !== "free";
          const roles = getDayRoles(d);
          const isThisDay = isCurrentMonth && d === todayDate;

          // ✨ حساب التاريخ المزدوج للخلية ✨
          let cellDate = null;
          let gregNum = "";
          let hijriNum = "";

          if (d) {
            cellDate = new Date(curr.getFullYear(), curr.getMonth(), d);
            gregNum = d;
            hijriNum = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
              day: "numeric",
            }).format(cellDate);
          }

          const primaryDay = calendarType === "gregory" ? gregNum : hijriNum;
          const secondaryDay = calendarType === "gregory" ? hijriNum : gregNum;

          return (
            <div
              key={i}
              onClick={() => handleDayClick(d)}
              className={`calendar-day-cell ${
                hasBookings ? "calendar-day-card" : ""
              }`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "75px",
                borderRadius: "16px",
                cursor: hasBookings ? "pointer" : "default",

                background:
                  s === "ok"
                    ? "linear-gradient(135deg, #10b981, #059669)"
                    : s === "wait"
                      ? "linear-gradient(135deg, #f59e0b, #d97706)"
                      : "#ffffff",

                color: hasBookings
                  ? "white"
                  : isThisDay
                    ? "#7c3aed"
                    : "#334155",

                border: d
                  ? isThisDay && !hasBookings
                    ? "2px solid #c4b5fd"
                    : hasBookings
                      ? "none"
                      : "1px solid #f1f5f9"
                  : "none",

                opacity: d ? 1 : 0,
                position: "relative",
                padding: "5px",
              }}
              title={hasBookings ? "اضغط لعرض وإدارة الحجوزات" : ""}
            >
              {/* الرقم الفرعي (صغير في الأعلى) */}
              {d && (
                <span
                  className="secondary-day-txt"
                  style={{
                    fontSize: "0.65rem",
                    opacity: hasBookings ? 0.8 : 0.5,
                    alignSelf: "flex-end",
                    marginRight: "5px",
                    fontWeight: "normal",
                  }}
                >
                  {secondaryDay}
                </span>
              )}

              {/* الرقم الأساسي (كبير في المنتصف) */}
              <span
                className="primary-day-txt"
                style={{
                  position: "relative",
                  zIndex: 2,
                  fontSize: "1.2rem",
                  fontWeight: "bold",
                  marginTop: "-5px",
                }}
              >
                {primaryDay}
              </span>

              {isThisDay && hasBookings && (
                <div
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#fff",
                    borderRadius: "50%",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                ></div>
              )}

              {d && hasBookings && (
                <div
                  className="booking-badges"
                  style={{
                    display: "flex",
                    gap: "5px",
                    marginTop: "4px",
                    fontSize: "0.8rem",
                    background: "rgba(255,255,255,0.2)",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    justifyContent: "center",
                  }}
                >
                  {roles.isProv && <span title="حجز لتقديم خدمة">💼</span>}
                  {roles.isCli && <span title="حجز كطالب خدمة">🛍️</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* النافذة المنبثقة لتفاصيل اليوم */}
      {selectedDate && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            {/* ✨ ترويسة النافذة المنبثقة غنية بالتفاصيل ✨ */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: "15px",
                marginBottom: "15px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: "0 0 10px 0",
                    color: "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "1.5rem" }}>📅</span>
                  يوم{" "}
                  {new Intl.DateTimeFormat("ar-SA", { weekday: "long" }).format(
                    new Date(selectedDate),
                  )}
                </h3>

                <div
                  style={{
                    display: "flex",
                    gap: "15px",
                    fontSize: "0.9rem",
                    color: "#475569",
                    fontWeight: "bold",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "#f1f5f9",
                      padding: "4px 10px",
                      borderRadius: "8px",
                    }}
                  >
                    🌍{" "}
                    {new Intl.DateTimeFormat("ar-SA", {
                      dateStyle: "long",
                      calendar: "gregory",
                    }).format(new Date(selectedDate))}
                  </span>
                  <span
                    style={{
                      backgroundColor: "#f3e8ff",
                      color: "#7c3aed",
                      padding: "4px 10px",
                      borderRadius: "8px",
                    }}
                  >
                    🌙{" "}
                    {new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
                      dateStyle: "long",
                    }).format(new Date(selectedDate))}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedDate(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                ✖
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                maxHeight: "65vh",
                overflowY: "auto",
                paddingRight: "5px",
                paddingLeft: "5px",
              }}
            >
              {dayBookings.map((b) => {
                const badge = getStatusBadge(b.status);
                const isProvider = localUserId === b.offerings?.provider_id;

                // ✨ استخراج تفاصيل الوقت والتاريخ بدقة ✨
                const startDateTime = new Date(b.appointment_date); // أو b.start_date إذا توفر
                const endDateTime = b.end_time ? new Date(b.end_time) : null; // بافتراض وجود هذا الحقل في المستقبل

                const startTimeStr = startDateTime.toLocaleTimeString(
                  dateLocale,
                  { hour: "2-digit", minute: "2-digit" },
                );
                const startDateStr = formatDate(startDateTime, {
                  month: "short",
                  day: "numeric",
                });

                const endTimeStr = endDateTime
                  ? endDateTime.toLocaleTimeString(dateLocale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "غير محدد";
                const endDateStr = endDateTime
                  ? formatDate(endDateTime, { month: "short", day: "numeric" })
                  : "";

                return (
                  <div
                    key={b.id}
                    style={{
                      backgroundColor: "#ffffff",
                      padding: "20px",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "15px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "250px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <h4
                            style={{
                              margin: 0,
                              color: "#1e293b",
                              fontSize: "1.05rem",
                              fontWeight: "900",
                            }}
                          >
                            {b.offerings?.title || "الخدمة"}
                          </h4>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              padding: "4px 8px",
                              borderRadius: "8px",
                              backgroundColor: isProvider
                                ? "#f3e8ff"
                                : "#ecfdf5",
                              color: isProvider ? "#7e22ce" : "#059669",
                              fontWeight: "bold",
                            }}
                          >
                            {isProvider ? "💼 أعمالي" : "🛍️ طلباتي"}
                          </span>
                        </div>

                        {/* ✨ شبكة تفاصيل الموعد ✨ */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px",
                            backgroundColor: "#f8fafc",
                            padding: "12px",
                            borderRadius: "12px",
                            border: "1px dashed #cbd5e1",
                            marginBottom: "10px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "#64748b",
                                marginBottom: "4px",
                              }}
                            >
                              تاريخ ووقت البدء
                            </div>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                                color: "#0f172a",
                              }}
                            >
                              📅 {startDateStr} <br /> ⏰ {startTimeStr}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "#64748b",
                                marginBottom: "4px",
                              }}
                            >
                              تاريخ ووقت الانتهاء
                            </div>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                                color: "#0f172a",
                              }}
                            >
                              🏁 {endDateStr || startDateStr} <br /> ⌛{" "}
                              {endTimeStr}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748b",
                            fontWeight: "bold",
                          }}
                        >
                          رقم الحجز:{" "}
                          <span
                            style={{
                              direction: "ltr",
                              display: "inline-block",
                            }}
                          >
                            #{b.id.substring(0, 6)}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.text}
                        </span>

                        <button
                          onClick={() =>
                            setManagingBookingId(
                              managingBookingId === b.id ? null : b.id,
                            )
                          }
                          style={{
                            backgroundColor:
                              managingBookingId === b.id
                                ? "#94a3b8"
                                : "#f59e0b",
                            color: "white",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "10px",
                            fontWeight: "bold",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            transition: "0.2s",
                          }}
                        >
                          {managingBookingId === b.id
                            ? "❌ إغلاق"
                            : "⚙️ إدارة الحجز"}
                        </button>

                        <button
                          onClick={() => handlePrintInvoice(b)}
                          style={{
                            backgroundColor: "#eff6ff",
                            color: "#3b82f6",
                            border: "1px solid #bfdbfe",
                            padding: "8px 14px",
                            borderRadius: "10px",
                            fontWeight: "bold",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          🖨️
                        </button>
                      </div>
                    </div>

                    {managingBookingId === b.id && (
                      <div
                        style={{
                          width: "100%",
                          marginTop: "20px",
                          borderTop: "1px solid #f1f5f9",
                          paddingTop: "20px",
                        }}
                      >
                        <BookingRow
                          booking={b}
                          onRefresh={() => {
                            if (onRefresh) onRefresh();
                            else window.location.reload();
                          }}
                          isProviderView={isProvider}
                          allowTextReviews={allowTextReviews}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// التنسيقات الثابتة
const navB = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "12px",
  padding: "8px 16px",
  cursor: "pointer",
  color: "#475569",
  fontWeight: "bold",
  transition: "0.2s",
  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
};

const filterBtn = (active, color, bgLight) => ({
  padding: "8px 16px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: active ? color : "transparent",
  color: active ? "#fff" : "#64748b",
  fontWeight: "bold",
  fontSize: "0.85rem",
  cursor: "pointer",
  transition: "all 0.3s ease",
  boxShadow: active ? `0 4px 10px ${color}40` : "none",
});

const modalOverlay = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(15, 23, 42, 0.7)",
  backdropFilter: "blur(4px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 4000,
  padding: "20px",
};

const modalContent = {
  backgroundColor: "#f8fafc",
  padding: "25px",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "850px",
  maxHeight: "85vh",
  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
};
