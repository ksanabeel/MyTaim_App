import React, { useEffect, useRef } from "react";

// 1️⃣ أضفنا booking هنا لكي يستطيع الكود قراءة رقم الحجز
export default function MoyasarPayment({ amount, onSuccess, booking }) {
  // القفل السحري لمنع تكرار التحميل
  const formCreated = useRef(false);

  useEffect(() => {
    // التأكد من وجود بيانات الحجز قبل البدء
    if (!booking || !booking.id) {
      console.error(
        "خطأ: لم يتم العثور على بيانات الحجز (booking object is missing)",
      );
      return;
    }

    if (formCreated.current) return;

    const initMoyasar = () => {
      const container = document.querySelector(".mysr-form");

      if (window.Moyasar && container && !formCreated.current) {
        formCreated.current = true; // إغلاق القفل
        container.innerHTML = ""; // تنظيف الصندوق

        try {
          window.Moyasar.init({
            element: ".mysr-form",
            amount: Math.round(amount * 100),
            currency: "SAR",
            description: `سداد عمولة الحجز رقم: ${booking.id}`,

            // ✅ تم استبدال المفتاح المكشوف بمتغير بيئة آمن
            publishable_api_key: import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY,

            // ✅ التعديل الجوهري: الآن سيتم إرسال رقم الحجز الفعلي في الرابط
            callback_url: `https://www.bookonmap.com/payment-result?booking_id=${booking.id}`,

            language: "ar",
            methods: ["creditcard", "mada", "stcpay"],
            on_completed: function (payment) {
              if (payment.status === "paid" && onSuccess) {
                onSuccess(payment);
              }
            },
          });
        } catch (error) {
          console.error("خطأ أثناء تشغيل ميسر:", error);
          formCreated.current = false;
        }
      }
    };

    // حقن ملف تصميم ميسر (CSS)
    if (!document.getElementById("moyasar-css")) {
      const link = document.createElement("link");
      link.id = "moyasar-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.css";
      document.head.appendChild(link);
    }

    // حقن سكربت ميسر (JS)
    if (!document.getElementById("moyasar-js")) {
      const script = document.createElement("script");
      script.id = "moyasar-js";
      script.src = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.js";
      script.onload = initMoyasar;
      document.head.appendChild(script);
    } else {
      setTimeout(initMoyasar, 300);
    }

    // أضفنا booking هنا لضمان تحديث الكود إذا تغير الحجز
  }, [amount, onSuccess, booking]);

  return (
    <div
      style={{
        width: "100%",
        padding: "15px",
        backgroundColor: "#f8fafc",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        marginTop: "20px",
        minHeight: "350px",
      }}
    >
      <h3
        style={{ textAlign: "center", color: "#1e293b", marginBottom: "15px" }}
      >
        الدفع الإلكتروني الآمن 🔒
      </h3>
      <div className="mysr-form" style={{ direction: "ltr" }}></div>
    </div>
  );
}
