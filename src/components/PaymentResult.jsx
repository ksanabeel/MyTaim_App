import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase"; // تأكد من المسار الصحيح

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // قراءة البيانات من الرابط
  const paymentId = searchParams.get("id");
  const status = searchParams.get("status");
  const message = searchParams.get("message");

  // غيرنا الاسم ليكون booking_id ليتناسب مع جدول الحجوزات
  const bookingId = searchParams.get("booking_id");

  useEffect(() => {
    // تحديث قاعدة البيانات فقط إذا كان الدفع ناجحاً وهناك معرف للحجز
    if (status === "paid" && bookingId) {
      const updateCommissionStatus = async () => {
        try {
          const { error } = await supabase
            .from("bookings") // ⬅️ اسم الجدول الصحيح من صورك
            .update({
              is_commission_paid: true, // ⬅️ اسم العمود الصحيح، وتغيير قيمته إلى مدفوع
              // ملاحظة: إذا أردت حفظ رقم عملية الدفع (paymentId)، يجب عليك إنشاء عمود جديد في جدول bookings وتسميته payment_id
            })
            .in("id", bookingId.split(",")); // 👈 التعديل هنا: يقرأ كل الأرقام ويحولها لمدفوعة دفعة واحدة

          if (error) throw error;
          console.log("تم تحديث حالة العمولة بنجاح إلى TRUE!");
        } catch (error) {
          console.error("خطأ أثناء تحديث البيانات:", error.message);
        }
      };

      updateCommissionStatus();
    }
  }, [status, bookingId, paymentId]);

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
      {status === "paid" ? (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "20px" }}>✅</div>
          <h2 style={{ color: "#16a34a", marginBottom: "10px" }}>
            تم الدفع بنجاح!
          </h2>
          <p style={{ color: "#475569", fontSize: "1.1rem" }}>
            شكراً لك، تم تأكيد سداد العمولة وتحديث بياناتك بنجاح.
          </p>
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
        </>
      ) : (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "20px" }}>❌</div>
          <h2 style={{ color: "#dc2626", marginBottom: "10px" }}>
            عذراً، فشلت عملية الدفع
          </h2>
          <p style={{ color: "#475569", fontSize: "1.1rem" }}>
            السبب: {message || "تم رفض العملية من قبل البنك"}
          </p>
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
