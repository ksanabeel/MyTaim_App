import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const PROCESSING = "processing";
const SUCCESS = "success";
const FAILED = "failed";

export default function PaymentResult() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialStatus = useRef(searchParams.get("status")).current;
  const paymentId = useRef(searchParams.get("id")).current;
  const message = useRef(searchParams.get("message")).current;
  const bookingId = useRef(searchParams.get("booking_id")).current;

  const [paymentState, setPaymentState] = useState(
    initialStatus === "failed" ? FAILED : PROCESSING,
  );
  const [updateMessage, setUpdateMessage] = useState("");

  const refreshAppData = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("app:refresh-data"));
    } catch (_e) {
      // ignore — main app will still refresh on next navigation
    }
  }, []);

  useEffect(() => {
    if (initialStatus !== "paid") {
      return;
    }

    if (!bookingId) {
      setUpdateState(FAILED);
      setUpdateMessage("لم يتم العثور على معرف الحجز في الرابط");
      return;
    }

    const bookingIds = bookingId
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (bookingIds.length === 0) {
      setUpdateState(FAILED);
      setUpdateMessage("لم يتم العثور على معرف الحجز في الرابط");
      return;
    }

    let cancelled = false;

    const updateCommissionStatus = async () => {
      try {
        const { error } = await supabase.rpc("mark_commission_paid", {
          p_booking_ids: bookingIds.join(","),
        });

        if (cancelled) return;

        if (error) throw error;

        setPaymentState(SUCCESS);
        refreshAppData();

        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, "", cleanUrl);
        setSearchParams({}, { replace: true });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to mark commission as paid:", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
        setPaymentState(FAILED);
        setUpdateMessage("تعذّر تحديث حالة العمولة تلقائياً. يرجى التواصل مع الدعم.");
      }
    };

    updateCommissionStatus();

    return () => {
      cancelled = true;
    };
  }, [initialStatus, bookingId, refreshAppData, setSearchParams]);

  const renderUpdateStatus = () => {
    if (initialStatus !== "paid") return null;

    if (paymentState === PROCESSING) {
      return (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 20px",
            backgroundColor: "#eff6ff",
            borderRadius: "10px",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "0.95rem",
          }}
        >
          جاري تحديث حالة العمولة...
        </div>
      );
    }

    if (paymentState === SUCCESS) {
      return (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 20px",
            backgroundColor: "#f0fdf4",
            borderRadius: "10px",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "0.95rem",
          }}
        >
          تم تحديث حالة العمولة إلى مدفوعة بنجاح
        </div>
      );
    }

    if (paymentState === FAILED) {
      return (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 20px",
            backgroundColor: "#fef2f2",
            borderRadius: "10px",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "0.95rem",
          }}
        >
          {updateMessage || "تعذّر تحديث حالة العمولة"}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        direction: "rtl",
      }}
    >
      {initialStatus === "paid" ? (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "20px" }}>✅</div>
          <h2 style={{ color: "#16a34a", marginBottom: "10px" }}>
            تم الدفع بنجاح!
          </h2>
          <p style={{ color: "#475569", fontSize: "1.1rem" }}>
            شكراً لك، تم تأكيد سداد العمولة وتحديث بياناتك بنجاح.
          </p>
          {paymentId && (
            <div
              style={{
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "10px",
                marginTop: "20px",
                border: "1px solid #e2e8f0",
                direction: "ltr",
              }}
            >
              <strong>رقم العملية:</strong> {paymentId}
            </div>
          )}
          {renderUpdateStatus()}
        </>
      ) : initialStatus === "failed" ? (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "20px" }}>❌</div>
          <h2 style={{ color: "#dc2626", marginBottom: "10px" }}>
            عذراً، فشلت عملية الدفع
          </h2>
          <p style={{ color: "#475569", fontSize: "1.1rem" }}>
            السبب: {message || "تم رفض العملية من قبل البنك"}
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "20px" }}>⏳</div>
          <h2 style={{ color: "#1e40af", marginBottom: "10px" }}>
            جارٍ التحقق من عملية الدفع
          </h2>
        </>
      )}

      <button
        onClick={() => navigate("/")}
        style={{
          marginTop: "40px",
          padding: "12px 30px",
          backgroundColor: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "1.1rem",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        العودة للرئيسية
      </button>
    </div>
  );
}
