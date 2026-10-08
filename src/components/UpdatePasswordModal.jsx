import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function UpdatePasswordModal({ onClose }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("");

  const handleUpdate = async () => {
    setNotice("");
    setNoticeType("");

    if (newPassword.length < 6) {
      setNotice("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      setNoticeType("error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setNotice("كلمتا المرور غير متطابقتين. يرجى التأكد من إدخال نفس كلمة المرور في الحقلين.");
      setNoticeType("error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setNotice("تم تحديث كلمة المرور بنجاح! ✅");
      setNoticeType("success");

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setNotice("حدث خطأ أثناء التحديث: " + err.message);
      setNoticeType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "30px",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
          direction: "rtl",
          boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "10px" }}>🔐</div>
        <h2 style={{ color: "#1e293b", margin: "0 0 10px 0" }}>
          تعيين كلمة مرور جديدة
        </h2>
        <p
          style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "20px" }}
        >
          الرجاء إدخال كلمة المرور الجديدة لحسابك.
        </p>

        {notice && (
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              border:
                noticeType === "success"
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
              backgroundColor:
                noticeType === "success" ? "#f0fdf4" : "#fef2f2",
              color: noticeType === "success" ? "#166534" : "#b91c1c",
              fontSize: "13px",
              lineHeight: "1.6",
              marginBottom: "16px",
            }}
          >
            {notice}
          </div>
        )}

        <input
          type="password"
          placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            marginBottom: "12px",
            fontSize: "1rem",
            outline: "none",
            boxSizing: "border-box",
          }}
          dir="ltr"
        />

        <input
          type="password"
          placeholder="تأكيد كلمة المرور الجديدة"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            marginBottom: "20px",
            fontSize: "1rem",
            outline: "none",
            boxSizing: "border-box",
          }}
          dir="ltr"
        />

        <button
          onClick={handleUpdate}
          disabled={loading}
          style={{
            width: "100%",
            backgroundColor: "#3b82f6",
            color: "#fff",
            border: "none",
            padding: "15px",
            borderRadius: "12px",
            fontWeight: "bold",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "0.2s",
          }}
        >
          {loading ? "جاري الحفظ..." : "حفظ كلمة المرور ✅"}
        </button>
      </div>
    </div>
  );
}
