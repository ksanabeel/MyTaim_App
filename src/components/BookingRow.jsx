import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";

// ✨ مكون بطاقة الحجز المطور والشامل ✨
export default function BookingRow({ booking, onRefresh, isProviderView }) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);

  // ✨ الإخفاء الفوري اللحظي من الشاشة عند الضغط على أرشفة ✨
  const [hidden, setHidden] = useState(false);

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [extraCostAmount, setExtraCostAmount] = useState("");
  const [extraDetails, setExtraDetails] = useState("");
  const [isNegotiating, setIsNegotiating] = useState(false);

  // 💬 ✨ المراسلة الفورية ✨
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const status = booking.status;
  const currency = booking.offerings?.currency || "SAR";
  const serviceTitle =
    booking.offerings?.title || t("default_service", "الخدمة");

  // 💰 الحسبة المالية الذكية الأساسية
  const isFree = booking.offerings?.pricing_model === "free";
  const baseTotalPrice =
    (booking.offerings?.price || 0) * (booking.quantity || 1);
  const previewFinalPrice = baseTotalPrice + (parseFloat(extraCostAmount) || 0);

  let priceDisplay = "";
  if (status === "awaiting_pricing") {
    priceDisplay = t("awaiting_pricing_status", "بانتظار تحديد السعر ⏳");
  } else if (isFree) {
    priceDisplay = t("free_volunteer_status", "مجاني (تطوع) 💚");
  } else if (
    booking.offerings?.price_upon_agreement &&
    !booking.proposed_price
  ) {
    priceDisplay = t("upon_agreement_status", "حسب الاتفاق 🤝");
  } else {
    const finalPrice = booking.proposed_price || baseTotalPrice;
    priceDisplay = `${finalPrice} ${currency}`;
  }

  const currentTotal = booking.proposed_price || baseTotalPrice;

  // 🎨 الألوان الذكية للخلفية والإطار حسب حالة الطلب
  let cardStyle = {
    borderRadius: "16px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    transition: "0.3s",
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
  };

  if (["pending", "awaiting_pricing", "negotiating"].includes(status)) {
    cardStyle.border = "2px solid #93c5fd";
    cardStyle.backgroundColor = "#eff6ff";
  } else if (["confirmed", "awaiting_client_approval"].includes(status)) {
    cardStyle.border = "2px solid #6ee7b7";
    cardStyle.backgroundColor = "#f0fdf4";
  } else if (status === "completed") {
    cardStyle.border = "2px solid #cbd5e1";
    cardStyle.backgroundColor = "#f8fafc";
  } else if (status === "cancelled") {
    cardStyle.border = "2px solid #fca5a5";
    cardStyle.backgroundColor = "#fef2f2";
  } else {
    cardStyle.border = "1px solid #e2e8f0";
    cardStyle.backgroundColor = "#fff";
  }

  const notifyUser = async (userId, title, message) => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .insert([{ user_id: userId, title, message, is_read: false }]);
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data);
  };

  useEffect(() => {
    fetchMessages();
  }, [booking.id]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setSendingMessage(true);

    const providerId = booking.offerings?.provider_id || booking.provider_id;
    const customerId = booking.customer_id;
    const senderId = isProviderView ? providerId : customerId;
    const receiverId = isProviderView ? customerId : providerId;

    const { error } = await supabase.from("messages").insert([
      {
        booking_id: booking.id,
        sender_id: senderId,
        receiver_id: receiverId,
        text_content: messageText.trim(),
      },
    ]);

    setSendingMessage(false);
    if (!error) {
      setMessageText("");
      fetchMessages();
      await notifyUser(
        receiverId,
        t("new_message_title", "رسالة جديدة 💬"),
        t("new_message_body", `توجد رسالة جديدة بخصوص حجز "${serviceTitle}"`),
      );
    }
  };

  // 📂 دالة أرشفة وإخفاء الطلب الذكية للطرفين
  const handleArchive = async () => {
    setLoading(true);
    const columnToUpdate = isProviderView
      ? "is_archived_by_provider"
      : "is_archived_by_client";

    const { error } = await supabase
      .from("bookings")
      .update({ [columnToUpdate]: true })
      .eq("id", booking.id);

    setLoading(false);
    if (!error) {
      setHidden(true); // إخفاء فوري من الشاشة
      if (onRefresh) onRefresh();
    } else {
      alert(t("archive_error", "حدث خطأ أثناء أرشفة الطلب: ") + error.message);
    }
  };

  // ❌ دالة إلغاء الحجز المؤكد مع ذكر السبب ❌
  const handleCancelWithReason = async () => {
    const reason = window.prompt(
      t(
        "cancel_reason_prompt",
        "الرجاء كتابة سبب الإلغاء ليتم إشعار الطرف الآخر:",
      ),
    );

    if (reason === null) return;

    if (reason.trim() === "") {
      return alert(
        t(
          "cancel_reason_required",
          "لا يمكن إلغاء الحجز المؤكد بدون ذكر السبب!",
        ),
      );
    }

    setLoading(true);

    const providerId = booking.offerings?.provider_id || booking.provider_id;
    const customerId = booking.customer_id;
    const senderId = isProviderView ? providerId : customerId;
    const receiverId = isProviderView ? customerId : providerId;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (!error) {
      await supabase.from("messages").insert([
        {
          booking_id: booking.id,
          sender_id: senderId,
          receiver_id: receiverId,
          text_content: t(
            "cancel_msg_db",
            `⚠️ تم إلغاء الحجز المؤكد. السبب: ${reason.trim()}`,
          ),
        },
      ]);

      const actingUser = isProviderView
        ? t("provider", "المزود")
        : t("client", "العميل");
      await notifyUser(
        receiverId,
        t("cancel_notif_title", "تم إلغاء الحجز المؤكد ❌"),
        t(
          "cancel_notif_body",
          `قام ${actingUser} بإلغاء الحجز لخدمة "${serviceTitle}". السبب: ${reason.trim()}`,
        ),
      );

      alert(
        t("cancel_success", "تم إلغاء الحجز بنجاح وإرسال السبب للطرف الآخر."),
      );
      fetchMessages();
      if (onRefresh) onRefresh();
    } else {
      alert(t("cancel_error", "حدث خطأ أثناء الإلغاء: ") + error.message);
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking.id);
    setLoading(false);
    if (!error) {
      const customerId = booking.customer_id;
      await notifyUser(
        customerId,
        t("accept_notif_title", "تم قبول طلبك ✅"),
        t(
          "accept_notif_body",
          `قام المزود بقبول طلب الحجز لخدمة "${serviceTitle}".`,
        ),
      );
      alert(t("accept_success", "تم تأكيد الحجز! ✅"));
      if (onRefresh) onRefresh();
    }
  };

  const handleComplete = async () => {
    if (
      !window.confirm(
        t(
          "confirm_complete",
          "هل تأكدت من إنهاء الخدمة؟ سيتم تحويل الأرباح للمحفظة الآن.",
        ),
      )
    )
      return;
    setLoading(true);

    try {
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("commission_rate")
        .eq("id", 1)
        .single();
      const rate = settings?.commission_rate || 0.1;

      // ✨ التعديل: إذا كان الحجز يدوياً (خاصاً) تكون عمولة المنصة صفر
      const isManual = booking.is_manual_booking === true;
      const commissionAmount = isManual ? 0 : currentTotal * rate;
      const netProfit = currentTotal - commissionAmount;

      const providerId = booking.offerings?.provider_id || booking.provider_id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_earnings, commission_owed")
        .eq("id", providerId)
        .single();

      await supabase
        .from("profiles")
        .update({
          total_earnings: (profile?.total_earnings || 0) + netProfit,
          commission_owed: (profile?.commission_owed || 0) + commissionAmount,
        })
        .eq("id", providerId);

      await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", booking.id);

      const targetUserId = isProviderView ? booking.customer_id : providerId;
      await notifyUser(
        targetUserId,
        t("complete_notif_title", "تم إنجاز الخدمة بنجاح 🏁"),
        t(
          "complete_notif_body",
          `تم تأكيد إنهاء واستلام خدمة "${serviceTitle}".`,
        ),
      );

      alert(
        t(
          "complete_success_msg",
          `تم الإنجاز بنجاح! ✅ دخل جيبك الصافي: ${netProfit} ريال | عمولة المنصة: ${commissionAmount} ريال`,
        ),
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(
        t("wallet_error", "خطأ في العمليات الحسابية للمحفظة: ") + err.message,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendPrice = async () => {
    if (!previewFinalPrice || previewFinalPrice <= 0)
      return alert(t("invalid_price", "أدخل سعر صحيح"));
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "awaiting_client_approval",
        proposed_price: parseFloat(previewFinalPrice),
        extra_details: extraDetails,
        additional_costs: parseFloat(extraCostAmount) || 0,
      })
      .eq("id", booking.id);
    setLoading(false);
    if (!error) {
      const customerId = booking.customer_id;
      await notifyUser(
        customerId,
        t("extra_costs_notif_title", "تكاليف إضافية لطلبك 💰"),
        t(
          "extra_costs_notif_body",
          `أضاف المزود تكاليف لخدمة "${serviceTitle}". الإجمالي أصبح ${previewFinalPrice} ${currency}.`,
        ),
      );
      setIsNegotiating(false);
      onRefresh();
    }
  };

  const handleAction = async (newStatus, actionName = "") => {
    setLoading(true);
    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus })
      .eq("id", booking.id);
    setLoading(false);

    if (!error) {
      const providerId = booking.offerings?.provider_id || booking.provider_id;
      const targetUserId = isProviderView ? booking.customer_id : providerId;
      let notifTitle = "",
        notifMsg = "";

      if (isProviderView && newStatus === "cancelled") {
        notifTitle = t("reject_notif_title", "تم رفض/إلغاء طلبك ❌");
        notifMsg = t(
          "reject_notif_body",
          `نعتذر, قام المزود بإلغاء طلب الحجز لخدمة "${serviceTitle}".`,
        );
      } else if (!isProviderView) {
        if (newStatus === "confirmed") {
          notifTitle = t("client_approved_title", "العميل وافق على السعر 🎉");
          notifMsg = t(
            "client_approved_body",
            `وافق العميل على التسعير لخدمة "${serviceTitle}". الحجز مؤكد الآن!`,
          );
        } else if (newStatus === "cancelled") {
          notifTitle = t("client_rejected_title", "العميل رفض السعر/الطلب ❌");
          notifMsg = t(
            "client_rejected_body",
            `قام العميل بإلغاء الطلب لخدمة "${serviceTitle}".`,
          );
        } else if (newStatus === "negotiating") {
          notifTitle = t("client_negotiate_title", "العميل يطلب التفاوض 🤝");
          notifMsg = t(
            "client_negotiate_body",
            `طلب العميل التفاوض على السعر لخدمة "${serviceTitle}".`,
          );
        }
      }

      if (notifTitle && targetUserId)
        await notifyUser(targetUserId, notifTitle, notifMsg);
      alert(t("action_success_msg", `تم ${actionName} بنجاح! ✅`));
      if (onRefresh) onRefresh();
    }
  };

  // 🚀 ✨ دالة التقييم الذكية (تحسب المتوسط الحسابي للمزود وتحدث ملفه الشخصي) ✨ 🚀
  const submitReview = async () => {
    setIsSubmittingReview(true);

    try {
      // 1. حفظ التقييم في جدول الحجوزات نفسه (ليظهر في لوحة الإدارة وللعميل)
      const { error } = await supabase
        .from("bookings")
        .update({ rating: parseInt(rating), review: reviewText })
        .eq("id", booking.id);

      if (error) throw error;

      // 2. تحديث التقييم العام (المتوسط الحسابي) للمزود في جدول profiles لكي يظهر للجميع في المنصة
      const providerId = booking.offerings?.provider_id || booking.provider_id;

      // جلب جميع خدمات هذا المزود
      const { data: myOfferings } = await supabase
        .from("offerings")
        .select("id")
        .eq("provider_id", providerId);

      if (myOfferings && myOfferings.length > 0) {
        const offeringIds = myOfferings.map((o) => o.id);

        // جلب جميع التقييمات السابقة لخدمات هذا المزود
        const { data: ratedBookings } = await supabase
          .from("bookings")
          .select("rating")
          .in("offering_id", offeringIds)
          .not("rating", "is", null);

        if (ratedBookings && ratedBookings.length > 0) {
          // حساب المتوسط الحسابي
          const totalStars = ratedBookings.reduce(
            (sum, b) => sum + b.rating,
            0,
          );
          const avgRating = totalStars / ratedBookings.length;

          // تحديث ملف المزود بالمتوسط الجديد
          await supabase
            .from("profiles")
            .update({ rating: avgRating })
            .eq("id", providerId);
        } else {
          // إذا كان هذا هو التقييم الوحيد في حسابه
          await supabase
            .from("profiles")
            .update({ rating: parseInt(rating) })
            .eq("id", providerId);
        }
      }

      // 3. إشعار المزود بالتقييم
      await notifyUser(
        providerId,
        t("new_review_title", "تقييم جديد لخدمتك ⭐️"),
        t("new_review_body", `قام العميل بتقييم خدمتك بـ ${rating} نجوم.`),
      );

      alert(
        t(
          "review_success",
          "تم إرسال التقييم وتحديث ترتيب المزود بنجاح! شكراً لك. ✅",
        ),
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(t("review_error", "حدث خطأ أثناء إرسال التقييم: ") + err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case "confirmed":
        return {
          text: t("badge_confirmed", "مؤكد ✅"),
          bg: "#d1fae5",
          color: "#059669",
        };
      case "pending":
        return {
          text: t("badge_pending", "طلب جديد 🆕"),
          bg: "#dbeafe",
          color: "#2563eb",
        };
      case "awaiting_pricing":
        return {
          text: t("badge_awaiting_pricing", "يطلب تسعير 💰"),
          bg: "#fef3c7",
          color: "#d97706",
        };
      case "awaiting_client_approval":
        return {
          text: t("badge_awaiting_client", "بانتظار الموافقة ⏳"),
          bg: "#f3e8ff",
          color: "#7e22ce",
        };
      case "negotiating":
        return {
          text: t("badge_negotiating", "تفاوض 🤝"),
          bg: "#ffedd5",
          color: "#b45309",
        };
      case "cancelled":
        return {
          text: t("badge_cancelled", "ملغي ❌"),
          bg: "#fee2e2",
          color: "#dc2626",
        };
      case "completed":
        return {
          text: t("badge_completed", "مكتمل 🏁"),
          bg: "#e2e8f0",
          color: "#475569",
        };
      default:
        return { text: s, bg: "#f1f5f9", color: "#64748b" };
    }
  };

  const badge = getStatusBadge(status);

  const btnGreen = {
    background: "#10b981",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.85rem",
  };
  const btnRed = {
    background: "#fef2f2",
    color: "#ef4444",
    border: "1px solid #fca5a5",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.85rem",
  };
  const btnOrange = {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.85rem",
  };
  const btnBlue = {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.85rem",
  };
  const inputS = {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "0.9rem",
    fontFamily: "inherit",
  };

  // ✨ استخراج أوقات البدء والانتهاء ✨
  const isRTL = i18n.language === "ar";
  const dateLocale = isRTL ? "ar-SA" : "en-US";

  const getFullFormattedDate = (dateObj) => {
    if (!dateObj) return "";

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
  };

  const startDateTime = new Date(booking.appointment_date);
  const endDateTime = booking.end_time ? new Date(booking.end_time) : null;

  const startTimeStr = startDateTime.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeStr = endDateTime
    ? endDateTime.toLocaleTimeString(dateLocale, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : isRTL
    ? t("not_specified", "غير محدد")
    : t("na", "N/A");

  const startFormatted = getFullFormattedDate(startDateTime);
  const endFormatted = endDateTime ? getFullFormattedDate(endDateTime) : null;

  if (hidden) return null;
  if (isProviderView && booking.is_archived_by_provider) return null;
  if (!isProviderView && booking.is_archived_by_client) return null;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: "1.1em",
              color: "#1e293b",
              fontWeight: "900",
            }}
          >
            {serviceTitle}
          </h4>
          <div
            style={{
              marginTop: "8px",
              fontSize: "1.05rem",
              fontWeight: "900",
              color: "#10b981",
            }}
          >
            💰 {priceDisplay}
            {booking.quantity >= 1 && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#64748b",
                  margin: "0 5px",
                }}
              >
                {t("quantity_label", "(العدد: ")}
                {booking.quantity})
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "0.85em",
            backgroundColor: badge.bg,
            color: badge.color,
            fontWeight: "bold",
          }}
        >
          {badge.text}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "20px",
          color: "#64748b",
          fontSize: "0.9em",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontWeight: "bold",
            color: "#334155",
          }}
        >
          👤{" "}
          {isProviderView
            ? t("user_client", "العميل:")
            : t("user_provider", "المزود:")}{" "}
          {isProviderView
            ? booking.profiles?.full_name ||
              t("unknown_client", "عميل غير محدد")
            : booking.offerings?.profiles?.full_name ||
              t("unknown_provider", "مزود غير محدد")}
        </span>
      </div>

      {/* ✨ شبكة تفاصيل الموعد ✨ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "15px",
          backgroundColor: "#f8fafc",
          padding: "15px",
          borderRadius: "12px",
          border: "1px dashed #cbd5e1",
          margin: "10px 0",
          textAlign: isRTL ? "right" : "left",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#64748b",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            {t("start_date_time", "تاريخ ووقت البدء")}
          </div>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: "bold",
              color: "#0f172a",
              lineHeight: "1.8",
            }}
          >
            📅{" "}
            <span style={{ color: "#7c3aed" }}>{startFormatted.dayName}</span>،{" "}
            {startFormatted.gregDate}
            <div
              style={{
                fontSize: "0.8rem",
                color: "#64748b",
                paddingRight: isRTL ? "25px" : "0",
                paddingLeft: isRTL ? "0" : "25px",
                marginTop: "-2px",
              }}
            >
              🌙 {startFormatted.hijriDate}
            </div>
            <div style={{ marginTop: "4px" }}>⏰ {startTimeStr}</div>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#64748b",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            {t("end_date_time", "تاريخ ووقت الانتهاء")}
          </div>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: "bold",
              color: "#0f172a",
              lineHeight: "1.8",
            }}
          >
            {endFormatted ? (
              <>
                🏁{" "}
                <span style={{ color: "#7c3aed" }}>{endFormatted.dayName}</span>
                ، {endFormatted.gregDate}
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    paddingRight: isRTL ? "25px" : "0",
                    paddingLeft: isRTL ? "0" : "25px",
                    marginTop: "-2px",
                  }}
                >
                  🌙 {endFormatted.hijriDate}
                </div>
              </>
            ) : (
              <>
                🏁{" "}
                <span style={{ color: "#7c3aed" }}>
                  {startFormatted.dayName}
                </span>
                ، {startFormatted.gregDate}
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    paddingRight: isRTL ? "25px" : "0",
                    paddingLeft: isRTL ? "0" : "25px",
                    marginTop: "-2px",
                  }}
                >
                  🌙 {startFormatted.hijriDate}
                </div>
              </>
            )}
            <div style={{ marginTop: "4px" }}>⌛ {endTimeStr}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "20px",
          color: "#475569",
          fontSize: "0.85em",
          flexWrap: "wrap",
          backgroundColor: "#ffffffaa",
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
        }}
      >
        {booking.client_contact && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <strong>{t("contact_number", "📞 رقم التواصل:")}</strong>
            <a
              href={`tel:${booking.client_contact}`}
              style={{
                color: "#2563eb",
                textDecoration: "none",
                fontWeight: "bold",
                direction: "ltr",
              }}
            >
              {booking.client_contact}
            </a>
          </span>
        )}
        {booking.location && (
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <strong>{t("location", "📍 الموقع:")}</strong>
            {booking.location.startsWith("http") ? (
              <a
                href={booking.location}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#10b981",
                  textDecoration: "underline",
                  fontWeight: "bold",
                }}
              >
                {t("view_on_map", "عرض الموقع على الخريطة 🗺️")}
              </a>
            ) : (
              <span>{booking.location}</span>
            )}
          </span>
        )}
      </div>

      {/* 💬 المراسلات الفورية */}
      <div
        style={{
          borderTop: "1px solid #cbd5e1",
          paddingTop: "15px",
          marginTop: "5px",
        }}
      >
        <strong style={{ fontSize: "0.9rem", color: "#475569" }}>
          {t("messages_notes_title", "💬 الملاحظات والمراسلات الخاصة بالطلب:")}
        </strong>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "10px",
            maxHeight: "180px",
            overflowY: "auto",
            padding: "5px",
          }}
        >
          {messages.length === 0 ? (
            <span
              style={{
                fontSize: "0.85rem",
                color: "#94a3b8",
                fontStyle: "italic",
              }}
            >
              {t("no_messages", "لا توجد رسائل مسجلة حتى الآن..")}
            </span>
          ) : (
            messages.map((msg) => {
              const currentUserId = isProviderView
                ? booking.offerings?.provider_id || booking.provider_id
                : booking.customer_id;
              const isMe = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isMe ? "flex-start" : "flex-end",
                    backgroundColor: isMe ? "#f1f5f9" : "#f0fdf4",
                    color: isMe ? "#334155" : "#166534",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                    maxWidth: "85%",
                    border: isMe ? "1px solid #e2e8f0" : "1px solid #bbf7d0",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "0.75rem",
                      opacity: 0.7,
                    }}
                  >
                    {isMe
                      ? t("you", "أنت:")
                      : isProviderView
                      ? t("client", "العميل:")
                      : t("provider", "المزود:")}
                  </strong>
                  {msg.text_content}
                </div>
              );
            })
          )}
        </div>

        {status !== "completed" && status !== "cancelled" && (
          <form
            onSubmit={handleSendMessage}
            style={{ display: "flex", gap: "8px", marginTop: "12px" }}
          >
            <input
              type="text"
              placeholder={t("type_message_placeholder", "اكتب رسالتك هنا...")}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{ ...inputS, flex: 1, backgroundColor: "#fff" }}
            />
            <button
              type="submit"
              disabled={sendingMessage || !messageText.trim()}
              style={{
                ...btnBlue,
                backgroundColor: "#7c3aed",
                padding: "10px 20px",
                opacity: messageText.trim() ? 1 : 0.6,
              }}
            >
              {t("send_btn", "إرسال 🚀")}
            </button>
          </form>
        )}
      </div>

      {/* العمليات والإجراءات */}
      <div
        style={{
          borderTop: "1px dashed #cbd5e1",
          paddingTop: "15px",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {loading ? (
          <span
            style={{ color: "#94a3b8", fontWeight: "bold", fontSize: "0.9rem" }}
          >
            {t("processing", "⏳ جاري التنفيذ...")}
          </span>
        ) : isProviderView ? (
          /* واجهة التحكم للمزود */
          <div style={{ width: "100%" }}>
            {status === "pending" && !isNegotiating && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  width: "100%",
                }}
              >
                <button onClick={handleAccept} style={{ ...btnGreen, flex: 1 }}>
                  {t("accept_order_btn", "قبول الطلب ✅")}
                </button>
                <button
                  onClick={() => setIsNegotiating(true)}
                  style={{
                    ...btnBlue,
                    flex: 1,
                    backgroundColor: "#fff",
                    color: "#3b82f6",
                    border: "1px solid #3b82f6",
                  }}
                >
                  {t("add_costs_btn", "إضافة تكاليف / تفاوض 💬")}
                </button>
                <button
                  onClick={() => handleAction("cancelled", "refuse")}
                  style={{ ...btnRed, flex: 1 }}
                >
                  {t("reject_cancel_btn", "رفض وإلغاء ❌")}
                </button>
              </div>
            )}

            {(isNegotiating ||
              status === "awaiting_pricing" ||
              status === "negotiating") && (
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#ffffffaa",
                  padding: "15px",
                  borderRadius: "12px",
                  border: "1px dashed #3b82f6",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  boxSizing: "border-box",
                }}
              >
                {status === "negotiating" && (
                  <strong style={{ color: "#b45309", fontSize: "0.9rem" }}>
                    {t(
                      "client_negotiating_msg",
                      "🤝 العميل يطلب التفاوض على السعر..",
                    )}
                  </strong>
                )}
                <strong style={{ color: "#1e40af", fontSize: "0.95rem" }}>
                  {t(
                    "add_extra_costs_label",
                    "➕ إضافة تكاليف للمشوار والمعدات (إن وجدت):",
                  )}
                </strong>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "#475569",
                    backgroundColor: "#fff",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <span>
                    {t("base_price_label", "السعر الأساسي للطلب ")} (
                    {booking.quantity} × {booking.offerings?.price || 0}):
                  </span>
                  <strong style={{ color: "#1e293b", direction: "ltr" }}>
                    {baseTotalPrice} {currency}
                  </strong>
                </div>

                <input
                  type="number"
                  placeholder={t(
                    "extra_cost_placeholder",
                    "مبلغ التسعير او  التكلفة الإضافية (ريال)",
                  )}
                  value={extraCostAmount}
                  onChange={(e) => setExtraCostAmount(e.target.value)}
                  style={inputS}
                />
                <input
                  type="text"
                  placeholder={t(
                    "extra_cost_reason_placeholder",
                    "سبب التكلفة (مثال: تسعير جديد او رسوم سكن وتذاكر سفر)",
                  )}
                  value={extraDetails}
                  onChange={(e) => setExtraDetails(e.target.value)}
                  style={inputS}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "1.05rem",
                    color: "#059669",
                    backgroundColor: "#ecfdf5",
                    padding: "12px",
                    borderRadius: "8px",
                    fontWeight: "900",
                    border: "1px solid #a7f3d0",
                    marginTop: "5px",
                  }}
                >
                  <span>
                    {t("final_total_client", "الإجمالي النهائي للعميل:")}
                  </span>
                  <span style={{ direction: "ltr" }}>
                    {previewFinalPrice} {currency}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                  <button
                    onClick={handleSendPrice}
                    style={{ ...btnGreen, flex: 2, backgroundColor: "#2563eb" }}
                  >
                    {t("send_price_btn", "إرسال السعر للعميل 🚀")}
                  </button>
                  {status === "pending" && (
                    <button
                      onClick={() => setIsNegotiating(false)}
                      style={{
                        ...btnRed,
                        flex: 1,
                        backgroundColor: "#e2e8f0",
                        color: "#475569",
                        border: "none",
                      }}
                    >
                      {t("cancel_btn", "إلغاء")}
                    </button>
                  )}
                  {status === "negotiating" && (
                    <button
                      onClick={() => handleAction("cancelled", "refuse")}
                      style={{ ...btnRed, flex: 1 }}
                    >
                      {t("cancel_order_btn", "إلغاء الطلب ❌")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {status === "awaiting_client_approval" && (
              <span
                style={{
                  fontSize: "0.85em",
                  color: "#64748b",
                  fontWeight: "bold",
                }}
              >
                {t("price_sent_awaiting", "⏳ تم إرسال السعر الإجمالي (")}
                {booking.proposed_price} {currency}
                {t("awaiting_approval_end", ")، بانتظار موافقة العميل..")}
              </span>
            )}

            {status === "confirmed" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.85em",
                    color: "#059669",
                    fontWeight: "bold",
                  }}
                >
                  {t(
                    "booking_confirmed_provider_msg",
                    "👍 الحجز مؤكد، يرجى التنفيذ ثم الضغط على زر الإنجاز.",
                  )}
                </span>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    width: "100%",
                  }}
                >
                  <button
                    onClick={handleComplete}
                    style={{
                      ...btnBlue,
                      flex: 1,
                      boxShadow: "0 4px 10px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    {t("confirm_completion_btn", "تأكيد إنجاز الخدمة 🏁")}
                  </button>
                  <button
                    onClick={handleCancelWithReason}
                    style={{ ...btnRed, flex: 1 }}
                  >
                    {t("cancel_booking_btn", "إلغاء الحجز ❌")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* واجهة التحكم للعميل */
          <div style={{ width: "100%" }}>
            {(status === "pending" || status === "awaiting_pricing") && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    fontSize: "0.85em",
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  {t("awaiting_provider_reply", "⏳ بانتظار رد المزود..")}
                </span>
                <button
                  onClick={() => handleAction("cancelled", "cancel")}
                  style={btnRed}
                >
                  {t("cancel_order_btn", "إلغاء الطلب ❌")}
                </button>
              </div>
            )}

            {status === "awaiting_client_approval" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  width: "100%",
                }}
              >
                <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>
                  {t(
                    "total_requested_by_provider",
                    "💰 الإجمالي المطلوب من المزود: ",
                  )}{" "}
                  <span style={{ direction: "ltr", display: "inline-block" }}>
                    {booking.proposed_price} {currency}
                  </span>
                </strong>
                {booking.extra_details && (
                  <p
                    style={{
                      margin: "0 0 5px 0",
                      color: "#475569",
                      fontSize: "0.85rem",
                      backgroundColor: "#fffbeb",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #fde68a",
                    }}
                  >
                    📝{" "}
                    <strong>
                      {t("extra_costs_notes", "ملاحظات التكاليف الإضافية:")}
                    </strong>{" "}
                    {booking.extra_details}
                  </p>
                )}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleAction("confirmed", "approve")}
                    style={{ ...btnGreen, flex: 2 }}
                  >
                    {t("approve_confirm_btn", "موافقة وتأكيد الحجز ✅")}
                  </button>
                  <button
                    onClick={() => handleAction("negotiating", "negotiate")}
                    style={{ ...btnOrange, flex: 1 }}
                  >
                    {t("request_negotiation_btn", "طلب تفاوض 🤝")}
                  </button>
                  <button
                    onClick={() => handleAction("cancelled", "reject")}
                    style={{ ...btnRed, flex: 1 }}
                  >
                    {t("reject_btn", "رفض ❌")}
                  </button>
                </div>
              </div>
            )}

            {status === "negotiating" && (
              <span
                style={{
                  fontSize: "0.85em",
                  color: "#64748b",
                  fontWeight: "bold",
                }}
              >
                {t(
                  "awaiting_negotiation_reply",
                  "⏳ بانتظار رد المزود على طلب التفاوض..",
                )}
              </span>
            )}

            {status === "confirmed" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.85em",
                    color: "#059669",
                    fontWeight: "bold",
                  }}
                >
                  {t(
                    "booking_confirmed_executing",
                    "🎉 الحجز مؤكد وجاري التنفيذ!",
                  )}
                </span>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                    width: "100%",
                  }}
                >
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          t(
                            "confirm_receiving_service",
                            "تأكيد استلام الخدمة؟",
                          ),
                        )
                      )
                        handleAction("completed", "complete");
                    }}
                    style={{
                      ...btnBlue,
                      flex: 1,
                      boxShadow: "0 4px 10px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    {t("confirm_completion_btn", "تأكيد إنجاز الخدمة 🏁")}
                  </button>
                  <button
                    onClick={handleCancelWithReason}
                    style={{ ...btnRed, flex: 1 }}
                  >
                    {t("cancel_booking_btn", "إلغاء الحجز ❌")}
                  </button>
                </div>
              </div>
            )}

            {/* ✨ نظام التقييم للعميل عند اكتمال الخدمة ✨ */}
            {status === "completed" && !booking.rating && (
              <div
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "15px",
                  backgroundColor: "#fffbeb",
                  borderRadius: "12px",
                  border: "1px dashed #fde68a",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  boxSizing: "border-box",
                }}
              >
                <strong style={{ color: "#d97706", fontSize: "0.95rem" }}>
                  {t("how_was_experience", "⭐ كيف كانت تجربتك مع المزود؟")}
                </strong>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    fontSize: "1.8rem",
                    cursor: "pointer",
                    direction: "ltr",
                    justifyContent: isRTL ? "flex-end" : "flex-start",
                  }}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      onClick={() => setRating(star)}
                      style={{
                        color: star <= rating ? "#f59e0b" : "#d1d5db",
                        transition: "0.2s",
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <textarea
                  placeholder={t(
                    "review_placeholder",
                    "اكتب تعليقك لتساعد الآخرين في اختيار المزود (اختياري)...",
                  )}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  style={{
                    ...inputS,
                    resize: "vertical",
                    minHeight: "70px",
                    backgroundColor: "#fff",
                    borderColor: "#fde68a",
                  }}
                />
                <button
                  onClick={submitReview}
                  disabled={isSubmittingReview}
                  style={{
                    ...btnOrange,
                    width: "100%",
                    opacity: isSubmittingReview ? 0.7 : 1,
                  }}
                >
                  {isSubmittingReview
                    ? t("sending", "جاري الإرسال...")
                    : t("submit_review_btn", "إرسال التقييم 🚀")}
                </button>
              </div>
            )}

            {/* إظهار نتيجة التقييم إذا كان مقيماً مسبقاً */}
            {status === "completed" && booking.rating && (
              <div
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "12px",
                  backgroundColor: "#f0fdf4",
                  borderRadius: "12px",
                  border: "1px dashed #6ee7b7",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    color: "#059669",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("you_rated_this", "✅ لقد قمت بتقييم هذه الخدمة: ")}{" "}
                  {"⭐".repeat(booking.rating)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🚀 ✨ زر الأرشفة السحري (يظهر للجميع في الحالات المنتهية أسفل البطاقة) ✨ 🚀 */}
      {!loading && (status === "completed" || status === "cancelled") && (
        <button
          onClick={handleArchive}
          style={{
            width: "100%",
            backgroundColor: "#f8fafc",
            color: "#64748b",
            border: "2px dashed #cbd5e1",
            borderRadius: "8px",
            padding: "12px",
            cursor: "pointer",
            fontWeight: "bold",
            marginTop: "15px",
            transition: "0.2s",
          }}
        >
          {t("archive_order_btn", "📂 إخفاء الطلب وأرشفته من قائمتي")}
        </button>
      )}
    </div>
  );
}
