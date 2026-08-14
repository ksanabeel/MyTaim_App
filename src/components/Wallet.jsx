import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Wallet({ session }) {
  const [wallet, setWallet] = useState({
    total_earnings: 0,
    commission_owed: 0,
  });
  const [commissionRate, setCommissionRate] = useState(0.1); // الافتراضي 10%
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletData = async () => {
      // 1. جلب بيانات المحفظة
      const { data: profileData } = await supabase
        .from("profiles")
        .select("total_earnings, commission_owed")
        .eq("id", session.user.id)
        .single();

      // 2. جلب نسبة العمولة الحقيقية من إعدادات النظام
      const { data: settings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "commission_rate")
        .single();

      if (profileData) setWallet(profileData);
      if (settings) setCommissionRate(parseFloat(settings.value));

      setLoading(false);
    };

    fetchWalletData();
  }, [session.user.id]);

  if (loading)
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        جاري تحميل المحفظة... ⏳
      </div>
    );

  // ✨ الحسبة الذكية للعرض ✨
  // لنفرض أن total_earnings في القاعدة هو المبلغ الإجمالي قبل الخصم
  const rawTotal = wallet.total_earnings || 0;
  const liveCommission = rawTotal * commissionRate; // المربع الأحمر
  const netProfit = rawTotal - liveCommission; // المربع الأخضر

  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid #cbd5e1",
        marginBottom: "20px",
        fontFamily: "system-ui",
        direction: "rtl",
      }}
    >
      <h3 style={{ margin: "0 0 15px 0", color: "#0f172a" }}>
        💰 محفظتي التقنية
      </h3>

      <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
        {/* المربع الأخضر: صافي أرباح المزود */}
        <div
          style={{
            flex: 1,
            minWidth: "150px",
            backgroundColor: "#ecfdf5",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #a7f3d0",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9em", color: "#065f46" }}>
            إجمالي الأرباح الصافية (لك)
          </p>
          <strong style={{ fontSize: "1.5em", color: "#059669" }}>
            {netProfit.toFixed(2)} ريال
          </strong>
        </div>

        {/* المربع الأحمر: مستحقات المنصة (العمولة) */}
        <div
          style={{
            flex: 1,
            minWidth: "150px",
            backgroundColor: "#fef2f2",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #fecaca",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9em", color: "#991b1b" }}>
            مستحقات المنصة (معلقة)
          </p>
          <strong style={{ fontSize: "1.5em", color: "#dc2626" }}>
            {liveCommission.toFixed(2)} ريال
          </strong>
        </div>
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "0.8rem",
          color: "#64748b",
          textAlign: "center",
        }}
      >
        * يتم احتساب عمولة المنصة بنسبة {(commissionRate * 100).toFixed(0)}% من
        إجمالي مبالغ الحجوزات.
      </div>
    </div>
  );
}
