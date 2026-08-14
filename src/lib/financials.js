import { supabase } from "./supabase";

export const fetchSafe = async (tableName) => {
  try {
    const { data, error } = await supabase.from(tableName).select("*");
    return error ? [] : data || [];
  } catch (err) {
    return [];
  }
};

export const fetchSettingsSafe = async () => {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return error ? null : data;
  } catch (err) {
    return null;
  }
};

export const defaultLegalDocs = {
  terms: {
    title: "الشروط والأحكام والإقرار القانوني",
    content:
      "مرحباً بك في منصتنا.\n\n1. طبيعة عمل المنصة: المنصة عبارة عن وسيط تقني.\n2. المسؤولية تقع على مقدم الخدمة.",
  },
  privacy: {
    title: "سياسة الخصوصية وحماية البيانات",
    content:
      "نحن نأخذ خصوصيتك على محمل الجد.\n\n1. يتم حفظ بياناتك بسرية تامة.",
  },
  refund: {
    title: "سياسة الاسترجاع والإلغاء",
    content: "المنصة لا تتدخل في النزاعات المالية المباشرة بين الأطراف.",
  },
};

export const calculateFinancials = (b, commissionRate) => {
  const finalTotal =
    b.proposed_price && Number(b.proposed_price) > 0
      ? Number(b.proposed_price)
      : (Number(b.offerings?.price) || 0) * (b.quantity || 1);

  const isManual = b.is_manual_booking === true;
  const platformCommission = isManual ? 0 : finalTotal * commissionRate;
  const providerNet = finalTotal - platformCommission;

  return {
    baseTotal: finalTotal,
    qty: b.quantity || 1,
    additional: 0,
    totalClientPrice: finalTotal,
    platformCommission,
    providerNet,
  };
};

export const sumByCurrency = (
  bookingsArr,
  commissionRate,
  fieldName = "platformCommission",
) => {
  const totals = bookingsArr.reduce((acc, b) => {
    const c = b.offerings?.currency || "USD";
    const financials = calculateFinancials(b, commissionRate);
    acc[c] = (acc[c] || 0) + financials[fieldName];
    return acc;
  }, {});
  const entries = Object.entries(totals);
  if (entries.length === 0) return "0.00";
  return entries.map(([c, v]) => `${v.toFixed(2)} ${c}`).join(" | ");
};
