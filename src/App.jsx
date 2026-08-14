import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
} from "react";
const InvoicesView = React.lazy(() => import("./components/InvoicesView"));
const AdminReports = React.lazy(() => import("./components/AdminReports"));
const PlatformManagement = React.lazy(() =>
  import("./components/PlatformManagement"),
);
const PaymentResult = React.lazy(() => import("./components/PaymentResult"));
const Login = React.lazy(() => import("./components/Login"));
const ProviderSchedule = React.lazy(() =>
  import("./components/ProviderSchedule"),
);
const ClientMarketplace = React.lazy(() =>
  import("./components/ClientMarketplace"),
);
const ProfileSettings = React.lazy(() =>
  import("./components/ProfileSettings"),
);
const AddOffering = React.lazy(() => import("./components/AddOffering"));
const CalendarView = React.lazy(() => import("./components/CalendarView"));
const UpdatePasswordModal = React.lazy(() =>
  import("./components/UpdatePasswordModal"),
);
const MoyasarPayment = React.lazy(() => import("./components/MoyasarPayment"));
import BookingTable from "./components/BookingTable";
import Footer from "./components/Footer";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useTranslation } from "react-i18next";
import { HelmetProvider } from "react-helmet-async";
import { Capacitor } from "@capacitor/core";
import { copyToClipboard } from "./lib/native";
import {
  padS,
  thS,
  tdS,
  admBtn,
  reportCard,
  addSkillBtn,
  cardS,
  modalOverlay,
  modalContent,
  smInput,
} from "./lib/uiConstants";
import {
  fetchSafe,
  fetchSettingsSafe,
  defaultLegalDocs,
  calculateFinancials,
  sumByCurrency,
} from "./lib/financials";

// ✨ المكون الفرعي الذي يحتوي على محتوى التطبيق بالكامل ✨
function MainAppContent() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementLink, setAnnouncementLink] = useState("");
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);
  const [appleStoreLink, setAppleStoreLink] = useState("");
  const [playStoreLink, setPlayStoreLink] = useState("");

  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("market");
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  const [isSuspended, setIsSuspended] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [showUpdatePassword, setShowUpdatePassword] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editOfferingData, setEditOfferingData] = useState(null);

  const [myOfferings, setMyOfferings] = useState([]);
  const [providerBookings, setProviderBookings] = useState([]);
  const [clientBookings, setClientBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const [commissionRate, setCommissionRate] = useState(0.1);
  const [affiliateRate, setAffiliateRate] = useState(0.2);

  const [myAffiliateStats, setMyAffiliateStats] = useState({
    total: 0,
    unpaid: 0,
    clients: 0,
  });

  const [platformName, setPlatformName] = useState("BookOnMap");
  const [platformLogo, setPlatformLogo] = useState("📍");
  const [bankAccounts, setBankAccounts] = useState("");
  const [welcomeMsgAr, setWelcomeMsgAr] = useState("مرحباً بك في المنصة ✨");
  const [welcomeMsgEn, setWelcomeMsgEn] = useState(
    "Welcome to the platform ✨",
  );
  const [subtitleAr, setSubtitleAr] = useState("اكتشف أفضل الخدمات");
  const [subtitleEn, setSubtitleEn] = useState("Discover the best services");
  const [licenseName, setLicenseName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseLink, setLicenseLink] = useState("");

  // النصوص القانونية المستقلة (عربي وإنجليزي)
  const [termsTextAr, setTermsTextAr] = useState("");
  const [termsTextEn, setTermsTextEn] = useState("");
  const [privacyTextAr, setPrivacyTextAr] = useState("");
  const [privacyTextEn, setPrivacyTextEn] = useState("");
  const [refundTextAr, setRefundTextAr] = useState("");
  const [refundTextEn, setRefundTextEn] = useState("");

  const [activeLegalDoc, setActiveLegalDoc] = useState(null);
  const [mustAcceptTerms, setMustAcceptTerms] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bank");
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    type: "complaint",
    subject: "",
    message: "",
  });

  const [bookingRef, setBookingRef] = useState("");
  const [receiptFile, setReceiptFile] = useState(null);

  const [isSendingContact, setIsSendingContact] = useState(false);

  const dynamicLegalDocs = {
    terms: {
      title: t("terms_doc_title", defaultLegalDocs.terms.title),
      contentAr: termsTextAr || defaultLegalDocs.terms.content,
      contentEn: termsTextEn || "",
    },
    privacy: {
      title: t("privacy_doc_title", defaultLegalDocs.privacy.title),
      contentAr: privacyTextAr || defaultLegalDocs.privacy.content,
      contentEn: privacyTextEn || "",
    },
    refund: {
      title: t("refund_doc_title", defaultLegalDocs.refund.title),
      contentAr: refundTextAr || defaultLegalDocs.refund.content,
      contentEn: refundTextEn || "",
    },
  };

  const fetchAllData = useCallback(async (userId) => {
    try {
      const settingsData = await fetchSettingsSafe();
      let currentCommRate = 0.1;
      let currentAffRate = 0.2;

      if (settingsData) {
        if (settingsData.announcement_text !== undefined)
          setAnnouncementText(settingsData.announcement_text);
        if (settingsData.announcement_link !== undefined)
          setAnnouncementLink(settingsData.announcement_link);
        if (settingsData.is_announcement_active !== undefined)
          setIsAnnouncementActive(settingsData.is_announcement_active);
        if (settingsData.apple_store_link !== undefined)
          setAppleStoreLink(settingsData.apple_store_link);
        if (settingsData.play_store_link !== undefined)
          setPlayStoreLink(settingsData.play_store_link);
        if (settingsData.commission_rate !== undefined) {
          setCommissionRate(settingsData.commission_rate);
          currentCommRate = settingsData.commission_rate;
        }
        if (settingsData.affiliate_rate !== undefined) {
          setAffiliateRate(settingsData.affiliate_rate);
          currentAffRate = settingsData.affiliate_rate;
        }
        if (settingsData.platform_name)
          setPlatformName(settingsData.platform_name);
        if (settingsData.platform_logo)
          setPlatformLogo(settingsData.platform_logo);
        if (settingsData.bank_accounts)
          setBankAccounts(settingsData.bank_accounts);
        if (settingsData.welcome_msg_ar)
          setWelcomeMsgAr(settingsData.welcome_msg_ar);
        if (settingsData.welcome_msg_en)
          setWelcomeMsgEn(settingsData.welcome_msg_en);
        if (settingsData.hero_subtitle_ar)
          setSubtitleAr(settingsData.hero_subtitle_ar);
        if (settingsData.hero_subtitle_en)
          setSubtitleEn(settingsData.hero_subtitle_en);
        if (settingsData.license_name)
          setLicenseName(settingsData.license_name);
        if (settingsData.license_number)
          setLicenseNumber(settingsData.license_number);
        if (settingsData.license_link)
          setLicenseLink(settingsData.license_link);

        // جلب النصوص القانونية المنفصلة
        if (settingsData.terms_text_ar)
          setTermsTextAr(settingsData.terms_text_ar);
        else if (settingsData.terms_text)
          setTermsTextAr(settingsData.terms_text);

        if (settingsData.terms_text_en)
          setTermsTextEn(settingsData.terms_text_en);

        if (settingsData.privacy_text_ar)
          setPrivacyTextAr(settingsData.privacy_text_ar);
        else if (settingsData.privacy_text)
          setPrivacyTextAr(settingsData.privacy_text);

        if (settingsData.privacy_text_en)
          setPrivacyTextEn(settingsData.privacy_text_en);

        if (settingsData.refund_text_ar)
          setRefundTextAr(settingsData.refund_text_ar);
        else if (settingsData.refund_text)
          setRefundTextAr(settingsData.refund_text);

        if (settingsData.refund_text_en)
          setRefundTextEn(settingsData.refund_text_en);
      }

      if (!userId) {
        setLoading(false);
        return;
      }

      let currentUserData = null;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        currentUserData = data;
        if (currentUserData) {
          if (currentUserData.is_active === false) {
            setIsSuspended(true);
            setLoading(false);
            return;
          }
          setUserProfile(currentUserData);
          if (currentUserData.terms_accepted === false)
            setMustAcceptTerms(true);
        }
      } catch (e) {}

      const [allProfiles, allOfferings, allBookings, rawNotifs] =
        await Promise.all([
          fetchSafe("profiles"),
          fetchSafe("offerings"),
          fetchSafe("bookings"),
          fetchSafe("notifications"),
        ]);

      const myNotifs = rawNotifs.filter((n) => n.user_id === userId);
      setNotifications(
        myNotifs.sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
        ),
      );

      let safeProfilesList = allProfiles;
      if (currentUserData && !allProfiles.find((p) => p.id === userId)) {
        safeProfilesList = [...allProfiles, currentUserData];
      }

      const enrichedOfferings = allOfferings.map((o) => ({
        ...o,
        profiles: safeProfilesList.find((p) => p.id === o.provider_id),
      }));
      const enrichedBookings = allBookings
        .map((b) => {
          const off = enrichedOfferings.find((o) => o.id === b.offering_id);
          const cust = safeProfilesList.find((p) => p.id === b.customer_id);
          return { ...b, offerings: off, profiles: cust };
        })
        .sort(
          (a, b) =>
            new Date(b.appointment_date || 0) -
            new Date(a.appointment_date || 0),
        );

      let affTotal = 0;
      let affUnpaid = 0;
      let affClients = 0;
      if (currentUserData && currentUserData.username) {
        const myReferred = safeProfilesList.filter(
          (p) => p.referred_by === currentUserData.username,
        );
        affClients = myReferred.length;
        const myReferredIds = myReferred.map((u) => u.id);

        const myRefBookings = enrichedBookings.filter((b) => {
          if (b.status !== "completed" || !b.is_commission_paid) return false;
          const isCustomerReferred = myReferredIds.includes(b.customer_id);
          const isProviderReferred =
            b.offerings && myReferredIds.includes(b.offerings.provider_id);
          return isCustomerReferred || isProviderReferred;
        });

        myRefBookings.forEach((b) => {
          const { platformCommission } = calculateFinancials(
            b,
            currentCommRate,
          );
          const earnings = platformCommission * currentAffRate;
          affTotal += earnings;
          if (!b.is_affiliate_paid) affUnpaid += earnings;
        });
      }
      setMyAffiliateStats({
        total: affTotal,
        unpaid: affUnpaid,
        clients: affClients,
      });

      setMyOfferings(enrichedOfferings.filter((o) => o.provider_id === userId));

      setProviderBookings(
        enrichedBookings.filter(
          (b) =>
            b.offerings?.provider_id === userId && !b.is_archived_by_provider,
        ),
      );
      setClientBookings(
        enrichedBookings.filter(
          (b) => b.customer_id === userId && !b.is_archived_by_client,
        ),
      );
    } catch (err) {
      console.error("Error fetching app data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchAllData(session?.user?.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (_e === "PASSWORD_RECOVERY") {
        setShowUpdatePassword(true);
      }
      setSession(session);
      fetchAllData(session?.user?.id);
    });
    return () => subscription.unsubscribe();
  }, [fetchAllData]);

  useEffect(() => {
    if (!session?.user?.id) return;

    const globalRadar = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.new.user_id === session.user.id) {
            if (typeof fetchAllData === "function") {
              fetchAllData(session.user.id);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalRadar);
    };
  }, [session, fetchAllData]);

  useEffect(() => {
    if (session && showLoginModal) {
      setShowLoginModal(false);
    }
  }, [session, showLoginModal]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener;
    (async () => {
      const { App } = await import("@capacitor/app");
      listener = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    })();
    return () => {
      if (listener) listener.remove();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (isSuspended) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "100px 20px",
          fontFamily: "system-ui",
          direction: i18n.language === "ar" ? "rtl" : "ltr",
          backgroundColor: "#fef2f2",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "6rem", marginBottom: "20px" }}>🚫</span>
        <h1
          style={{ color: "#ef4444", margin: "0 0 10px 0", fontSize: "2.5rem" }}
        >
          {t("account_suspended", "حسابك موقوف")}
        </h1>
        <p
          style={{
            color: "#7f1d1d",
            fontSize: "1.2rem",
            maxWidth: "500px",
            margin: "0 0 30px 0",
            lineHeight: "1.8",
          }}
        >
          {t(
            "account_suspended_desc",
            "عذراً، تم إيقاف حسابك من قبل إدارة المنصة. يرجى التواصل مع الدعم الفني للاستفسار أو مراجعة الشروط والأحكام.",
          )}
        </p>
        <button
          onClick={handleLogout}
          style={{
            ...admBtn("#ef4444"),
            padding: "15px 40px",
            fontSize: "1.2rem",
            borderRadius: "16px",
            boxShadow: "0 4px 15px rgba(239,68,68,0.3)",
          }}
        >
          {t("logout", "تسجيل الخروج")}
        </button>
      </div>
    );
  }

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "100px",
          fontFamily: "system-ui",
          fontWeight: "bold",
          fontSize: "1.2rem",
          color: "#64748b",
        }}
      >
        {t("loading_platform", "⏳ جاري تحميل المنصة...")}
      </div>
    );

  const openEditModal = (offering) => {
    setEditOfferingData(offering);
    setShowAddModal(true);
  };
  const handleDeleteOffering = async (id) => {
    if (
      window.confirm(
        t("confirm_delete_service", "هل تريد حذف هذه الخدمة نهائياً؟"),
      )
    ) {
      await supabase.from("offerings").delete().eq("id", id);
      fetchAllData(session.user.id);
    }
  };

  const checkProfileCompletion = () => {
    if (!userProfile || !userProfile.phone || userProfile.phone.trim() === "") {
      alert(
        t(
          "phone_required_provider",
          "عذراً، يجب إضافة (رقم الجوال) في إعدادات حسابك لتتمكن من استخدام ميزات المزود.",
        ),
      );
      navigate("/");
      setActiveTab("profile");
      return false;
    }
    return true;
  };

  const handleAcceptTerms = async () => {
    setIsAccepting(true);
    try {
      await supabase
        .from("profiles")
        .update({ terms_accepted: true })
        .eq("id", session.user.id);
      setMustAcceptTerms(false);
      alert(
        t(
          "terms_accepted_success",
          "تم تسجيل إقرارك وموافقتك قانونياً بنجاح ✅",
        ),
      );
    } catch (err) {
      alert(t("registration_error", "حدث خطأ في التسجيل."));
    }
    setIsAccepting(false);
  };

  const handleSubmitContact = async () => {
    if (!contactForm.subject || !contactForm.message)
      return alert(t("fill_subject_message", "الرجاء تعبئة العنوان والرسالة."));

    let finalMessage = contactForm.message;

    if (contactForm.type === "receipt") {
      if (!bookingRef)
        return alert(
          t(
            "enter_booking_ref",
            "الرجاء إدخال رقم الحجز أو الخدمة المرتبطة بالعمولة.",
          ),
        );
      if (!receiptFile)
        return alert(
          t(
            "upload_receipt_required",
            "الرجاء رفع صورة الإيصال لإتمام المطابقة.",
          ),
        );

      setIsSendingContact(true);

      const fileExt = receiptFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, receiptFile);

      if (uploadError) {
        setIsSendingContact(false);
        return alert(
          t(
            "receipt_upload_error",
            "حدث خطأ في رفع الإيصال المالي! الرجاء المحاولة مرة أخرى.",
          ),
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(filePath);
      const receiptUrl = publicUrlData.publicUrl;

      finalMessage = `ℹ️ ${t("booking_ref_label")} ${bookingRef}\n\n📝 ${t(
        "message_body_label",
      )} ${contactForm.message}\n\n🔗 ${t(
        "receipt_link",
        "رابط الإيصال المرفق:",
      )}\n${receiptUrl}`;
    } else {
      setIsSendingContact(true);
    }

    try {
      await supabase.from("contact_messages").insert([
        {
          user_id: session?.user?.id || null,
          type: contactForm.type,
          subject: contactForm.subject,
          message: finalMessage,
        },
      ]);
      alert(
        t(
          "contact_success",
          "تم إرسال رسالتك للإدارة بنجاح، شكراً لتواصلك معنا! 📩 سنقوم بالرد عليك في أقرب وقت.",
        ),
      );
      setShowContactModal(false);
      setContactForm({ type: "complaint", subject: "", message: "" });
      setBookingRef("");
      setReceiptFile(null);
    } catch (err) {
      alert(t("unexpected_error", "حدث خطأ غير متوقع أثناء الإرسال."));
    }
    setIsSendingContact(false);
  };

  const hideProviderComment = async (bookingId) => {
    if (
      window.confirm(
        t(
          "confirm_hide_comment",
          "هل أنت متأكد من إخفاء هذا التعليق لكونه مسيئاً؟ (سيتم إخفاء النص فقط وستبقى النجوم لتجنب ظلم المزود)",
        ),
      )
    ) {
      const hiddenText = t(
        "comment_hidden_by_provider",
        "🚫 تم إخفاء التعليق بواسطة المزود.",
      );
      try {
        const { data: bData } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .maybeSingle();
        if (bData) {
          const payload = { is_comment_hidden: true };
          if ("review_text" in bData && bData.review_text)
            payload.review_text = hiddenText;
          if ("review_comment" in bData && bData.review_comment)
            payload.review_comment = hiddenText;
          if ("client_review" in bData && bData.client_review)
            payload.client_review = hiddenText;
          if ("review" in bData && bData.review) payload.review = hiddenText;
          if ("comment" in bData && bData.comment) payload.comment = hiddenText;
          if ("feedback" in bData && bData.feedback)
            payload.feedback = hiddenText;
          await supabase.from("bookings").update(payload).eq("id", bookingId);
          alert(t("comment_hidden_success", "تم إخفاء التعليق بنجاح ✅"));
          fetchAllData(session.user.id);
        }
      } catch (err) {
        alert(
          t("db_update_error", "حدث خطأ! تأكد من تحديث قاعدة البيانات أولاً."),
        );
      }
    }
  };

  const markAllNotifsRead = async () => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", session.user.id);
      fetchAllData(session.user.id);
      setShowNotifModal(false);
    } catch (err) {}
  };
  const handleReplyToAdmin = (n) => {
    setContactForm({
      type: "inquiry",
      subject: `${t("reply_to_admin", "رد على رسالة الإدارة: ")}${
        n.title || ""
      }`,
      message: "",
    });
    setShowNotifModal(false);
    setShowContactModal(true);
  };

  const isSuperAdmin = userProfile?.role === "admin";
  const isSupervisor = userProfile?.role === "supervisor";
  const isFinancialManager = userProfile?.role === "financial_manager";
  const canManagePlatform = isSuperAdmin || isSupervisor || isFinancialManager;
  const canViewReports = isSuperAdmin || isSupervisor || isFinancialManager;

  const allUserBookings = [
    ...providerBookings,
    ...clientBookings.filter(
      (cb) => !providerBookings.some((pb) => pb.id === cb.id),
    ),
  ];
  const defaultAvatar = `https://ui-avatars.com/api/?name=${
    userProfile?.full_name || "User"
  }&background=7c3aed&color=fff`;

  const myPaidCommissionText = sumByCurrency(
    providerBookings.filter(
      (b) =>
        b.status === "completed" &&
        b.is_commission_paid &&
        !b.is_manual_booking,
    ),
    commissionRate,
  );

  const myUnpaidCommissionText = sumByCurrency(
    providerBookings.filter(
      (b) =>
        b.status === "completed" &&
        !b.is_commission_paid &&
        !b.is_manual_booking,
    ),
    commissionRate,
  );

  const totalUnpaidNumeric = providerBookings
    .filter(
      (b) =>
        b.status === "completed" &&
        !b.is_commission_paid &&
        !b.is_manual_booking,
    )
    .reduce(
      (acc, b) =>
        acc + calculateFinancials(b, commissionRate).platformCommission,
      0,
    );

  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div
      className="app-shell"
      style={{
        padding: "15px",
        paddingTop: "40px",
        maxWidth: "100vw",
        width: "100%",
        boxSizing: "border-box",
        margin: "0 auto",
        fontFamily: "system-ui",
        direction: i18n.language === "ar" ? "rtl" : "ltr",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      <style>{`
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {showLoginModal && !session && (
        <div style={{ ...modalOverlay, zIndex: 99999 }}>
          <div
            style={{
              ...modalContent,
              padding: 0,
              overflow: "hidden",
              position: "relative",
              maxWidth: "480px",
            }}
          >
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                position: "absolute",
                top: "15px",
                left: "15px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                color: "#ef4444",
                fontWeight: "bold",
                cursor: "pointer",
                zIndex: 10,
                fontSize: "1.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "scale(1.1)")
              }
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              ✕
            </button>
            <div
              style={{
                padding: "30px",
                maxHeight: "90vh",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2
                style={{
                  color: "#1e293b",
                  margin: "0 0 10px 0",
                  textAlign: "center",
                }}
              >
                {t("welcome_to", "أهلاً بك في ")}
                {platformName} 👋
              </h2>
              <p
                style={{
                  color: "#64748b",
                  margin: "0 0 20px 0",
                  textAlign: "center",
                  fontSize: "0.9rem",
                }}
              >
                {t(
                  "login_prompt_desc",
                  "يرجى تسجيل الدخول أو إنشاء حساب جديد لإتمام الحجز والتواصل مع المزودين.",
                )}
              </p>
              <Suspense fallback={<div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}>
                <Login />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الموافقة الإجبارية على الشروط (محدثة بنظام الجدول ذي العمودين) */}
      {mustAcceptTerms && (
        <div style={{ ...modalOverlay, zIndex: 99999 }}>
          <div
            style={{
              backgroundColor: "#fff",
              padding: "30px",
              borderRadius: "24px",
              maxWidth: "950px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
              direction: i18n.language === "ar" ? "rtl" : "ltr",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <span style={{ fontSize: "2.5rem" }}>📜</span>
              <h2 style={{ color: "#1e293b", margin: "10px 0 5px 0" }}>
                {t("terms_update_title", "تحديث الشروط والأحكام")}
              </h2>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.9rem",
                  margin: 0,
                }}
              >
                {t(
                  "terms_update_desc",
                  "مرحباً بك! للاستمرار في استخدام المنصة، يرجى قراءة والموافقة على الشروط والأحكام أدناه:",
                )}
              </p>
            </div>

            <div
              style={{
                overflowY: "auto",
                flex: 1,
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                backgroundColor: "#fff",
                marginBottom: "20px",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f8fafc",
                      borderBottom: "2px solid #cbd5e1",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <th
                      style={{
                        padding: "14px 16px",
                        width: "50%",
                        color: "#1e293b",
                        textAlign: "right",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                      }}
                    >
                      الشروط والأحكام (العربية)
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        width: "50%",
                        color: "#1e293b",
                        textAlign: "left",
                        direction: "ltr",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      Terms & Conditions (English)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const arLines = (
                      termsTextAr || defaultLegalDocs.terms.content
                    )
                      .split("\n")
                      .filter((l) => l.trim() !== "");
                    const enLines = (termsTextEn || "")
                      .split("\n")
                      .filter((l) => l.trim() !== "");
                    const maxRows = Math.max(arLines.length, enLines.length, 1);

                    return Array.from({ length: maxRows }).map((_, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: idx % 2 === 0 ? "#fff" : "#f8fafc",
                        }}
                      >
                        <td
                          style={{
                            padding: "14px 16px",
                            verticalAlign: "top",
                            color: "#334155",
                            lineHeight: "1.7",
                            fontSize: "0.9rem",
                            textAlign: "right",
                          }}
                        >
                          {arLines[idx] || ""}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            verticalAlign: "top",
                            color: "#334155",
                            lineHeight: "1.7",
                            fontSize: "0.9rem",
                            direction: "ltr",
                            textAlign: "left",
                            borderRight: "1px solid #f1f5f9",
                          }}
                        >
                          {enLines[idx] || ""}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleAcceptTerms}
              disabled={isAccepting}
              style={{
                backgroundColor: isAccepting ? "#94a3b8" : "#10b981",
                color: "white",
                border: "none",
                padding: "15px 30px",
                borderRadius: "14px",
                fontWeight: "bold",
                fontSize: "1.1rem",
                cursor: isAccepting ? "not-allowed" : "pointer",
                width: "100%",
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
              }}
            >
              {isAccepting
                ? t("confirming", "جاري التأكيد...")
                : t("accept_terms_btn", "قرأت وأوافق على الشروط ✅")}
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ ...modalOverlay, zIndex: 99999 }}>
          <div style={modalContent}>
            <Suspense fallback={<div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}>
              <AddOffering
                session={session}
                editData={editOfferingData}
                onSuccess={() => {
                  setShowAddModal(false);
                  fetchAllData(session.user.id);
                }}
                onCancel={() => setShowAddModal(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div style={{ ...modalOverlay, zIndex: 99999 }}>
          <div style={{ ...modalContent, maxWidth: "550px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "15px",
              }}
            >
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "1.3rem" }}>
                {t("payment_methods_title", "طرق السداد المتاحة للمنصة 💳")}
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{
                  background: "#fef2f2",
                  border: "none",
                  width: "35px",
                  height: "35px",
                  borderRadius: "50%",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#ef4444",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setPaymentMethod("bank")}
                style={{
                  flex: 1,
                  padding: "15px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor:
                    paymentMethod === "bank" ? "#7c3aed" : "#f1f5f9",
                  color: paymentMethod === "bank" ? "#fff" : "#475569",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "0.3s",
                }}
              >
                {t("bank_transfer", "🏦 تحويل بنكي")}
              </button>
              <button
                onClick={() => setPaymentMethod("gateway")}
                style={{
                  flex: 1,
                  padding: "15px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor:
                    paymentMethod === "gateway" ? "#7c3aed" : "#f1f5f9",
                  color: paymentMethod === "gateway" ? "#fff" : "#475569",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "0.3s",
                }}
              >
                {t("online_payment", "🌐 دفع إلكتروني")}
              </button>
            </div>
            {paymentMethod === "bank" && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "25px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "16px",
                  border: "1px solid #cbd5e1",
                  textAlign: "right",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 15px 0",
                    color: "#334155",
                    fontSize: "1.1rem",
                  }}
                >
                  {t(
                    "approved_bank_accounts",
                    "الحسابات البنكية المعتمدة للمنصة:",
                  )}
                </h4>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    color: "#1e293b",
                    lineHeight: "1.8",
                    fontWeight: "bold",
                    fontSize: "1.15rem",
                    backgroundColor: "#fff",
                    padding: "15px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {bankAccounts ||
                    t(
                      "no_bank_accounts",
                      "لم تقم الإدارة بإضافة حسابات بنكية حتى الآن.",
                    )}
                </div>

                <div
                  style={{
                    marginTop: "20px",
                    padding: "15px",
                    backgroundColor: "#fef2f2",
                    borderRadius: "12px",
                    border: "1px dashed #fca5a5",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      marginTop: "0",
                      marginBottom: "15px",
                      fontSize: "0.95rem",
                      color: "#b91c1c",
                      fontWeight: "bold",
                      lineHeight: "1.6",
                    }}
                  >
                    {t(
                      "bank_transfer_instructions",
                      "* الرجاء تحويل المبلغ المستحق لأحد الحسابات أعلاه، ثم إرفاق الإيصال المالي بالزر أدناه ليقوم المدير المالي باعتماد رصيدك فوراً.",
                    )}
                    <br />
                    {t(
                      "finance_contact",
                      "📬 للتأكيد أو للاستفسارات المالية السريعة: ",
                    )}
                    <a
                      href="mailto:finance@bookonmap.com"
                      style={{ color: "#2563eb", textDecoration: "underline" }}
                    >
                      finance@bookonmap.com --- bookonmap@hotmail.com
                    </a>
                  </p>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setContactForm({ ...contactForm, type: "receipt" });
                      setShowContactModal(true);
                    }}
                    style={{
                      background: "#3b82f6",
                      color: "#fff",
                      border: "none",
                      padding: "12px 25px",
                      borderRadius: "10px",
                      fontWeight: "bold",
                      fontSize: "1rem",
                      cursor: "pointer",
                      width: "100%",
                      boxShadow: "0 4px 10px rgba(59, 130, 246, 0.3)",
                      transition: "0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = "#2563eb")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = "#3b82f6")
                    }
                  >
                    {t(
                      "attach_receipt_btn",
                      "📤 أرفق إيصال الحوالة البنكية الآن",
                    )}
                  </button>
                </div>
              </div>
            )}
            {paymentMethod === "gateway" && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "25px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "16px",
                  border: "1px dashed #cbd5e1",
                }}
              >
                <h3
                  style={{
                    color: "#3b82f6",
                    margin: "0 0 10px 0",
                    textAlign: "center",
                  }}
                >
                  {t("payment_gateway", "بوابة الدفع (ميسر / Stripe)")}
                </h3>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "0.9rem",
                    textAlign: "center",
                    marginBottom: "20px",
                  }}
                >
                  {t(
                    "total_commission_due",
                    "سيتم سداد إجمالي العمولات المستحقة: ",
                  )}
                  <strong
                    style={{
                      color: "#ef4444",
                      fontSize: "1.2rem",
                      display: "block",
                      marginTop: "5px",
                    }}
                    dir="ltr"
                  >
                    {myUnpaidCommissionText}
                  </strong>
                </p>

                {totalUnpaidNumeric > 0 ? (
                  <Suspense fallback={<div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}>
                    <MoyasarPayment
                      amount={totalUnpaidNumeric}
                      booking={{
                        id: providerBookings
                          .filter(
                            (b) =>
                              b.status === "completed" &&
                              !b.is_commission_paid &&
                              !b.is_manual_booking,
                          )
                          .map((b) => b.id)
                          .join(","),
                      }}
                    />
                  </Suspense>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#10b981",
                      fontWeight: "bold",
                      padding: "15px",
                    }}
                  >
                    {t(
                      "no_pending_dues",
                      "لا توجد مستحقات أو عمولات معلقة حالياً ✅",
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showContactModal && (
        <div style={{ ...modalOverlay, zIndex: 99999 }}>
          <div style={{ ...modalContent, maxWidth: "500px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "15px",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "1.3rem" }}>
                {t("contact_admin_title", "✉️ تواصل مع إدارة المنصة")}
              </h2>
              <button
                onClick={() => setShowContactModal(false)}
                style={{
                  background: "#fef2f2",
                  border: "none",
                  width: "35px",
                  height: "35px",
                  borderRadius: "50%",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#ef4444",
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <strong
                  style={{
                    color: "#334155",
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("message_type", "نوع الرسالة:")}
                </strong>
                <select
                  value={contactForm.type}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, type: e.target.value })
                  }
                  style={{ ...smInput, width: "100%", cursor: "pointer" }}
                >
                  <option value="complaint">
                    {t("type_complaint", "🚨 لدي مشكلة أو شكوى")}
                  </option>
                  <option value="suggestion">
                    {t("type_suggestion", "💡 لدي فكرة أو اقتراح")}
                  </option>
                  <option value="receipt">
                    {t("type_receipt", "🧾 إرفاق إيصال سداد عمولة")}
                  </option>
                  <option value="inquiry">
                    {t("type_inquiry", "❓ استفسار عام")}
                  </option>
                </select>
              </div>

              {contactForm.type === "receipt" && (
                <div
                  style={{
                    padding: "15px",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        color: "#166534",
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "0.9rem",
                      }}
                    >
                      {t("booking_ref_label", "رقم الحجز أو اسم الخدمة:")}
                    </strong>
                    <input
                      type="text"
                      placeholder={t(
                        "booking_ref_placeholder",
                        "مثال: حجز رقم 1234...",
                      )}
                      value={bookingRef}
                      onChange={(e) => setBookingRef(e.target.value)}
                      style={{
                        ...smInput,
                        width: "100%",
                        boxSizing: "border-box",
                        borderColor: "#86efac",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>
                  <div>
                    <strong
                      style={{
                        color: "#166534",
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "0.9rem",
                      }}
                    >
                      {t(
                        "receipt_image_label",
                        "صورة الإيصال البنكي (إلزامي):",
                      )}
                    </strong>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceiptFile(e.target.files[0])}
                      style={{
                        width: "100%",
                        fontSize: "0.85rem",
                        padding: "10px",
                        backgroundColor: "#fff",
                        borderRadius: "8px",
                        border: "1px dashed #10b981",
                        cursor: "pointer",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <strong
                  style={{
                    color: "#334155",
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("message_subject_label", "عنوان الرسالة:")}
                </strong>
                <input
                  type="text"
                  value={contactForm.subject}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, subject: e.target.value })
                  }
                  placeholder={
                    contactForm.type === "receipt"
                      ? t(
                          "subject_receipt_placeholder",
                          "مثال: إيصال سداد عمولة حجز",
                        )
                      : t(
                          "subject_general_placeholder",
                          "اكتب عنواناً مختصراً للرسالة...",
                        )
                  }
                  style={{ ...smInput, width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <strong
                  style={{
                    color: "#334155",
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  {t("message_body_label", "نص الرسالة التفصيلي:")}
                </strong>
                <textarea
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, message: e.target.value })
                  }
                  placeholder={
                    contactForm.type === "receipt"
                      ? t(
                          "body_receipt_placeholder",
                          "اكتب قيمة الحوالة وأي ملاحظات إضافية هنا لتسهيل المطابقة...",
                        )
                      : t(
                          "body_general_placeholder",
                          "اكتب تفاصيل رسالتك أو استفسارك هنا بوضوح...",
                        )
                  }
                  style={{
                    ...smInput,
                    width: "100%",
                    boxSizing: "border-box",
                    height: "140px",
                    resize: "vertical",
                  }}
                />
              </div>
              <button
                onClick={handleSubmitContact}
                disabled={isSendingContact}
                style={{
                  ...addSkillBtn,
                  width: "100%",
                  marginTop: "10px",
                  cursor: isSendingContact ? "not-allowed" : "pointer",
                  opacity: isSendingContact ? 0.7 : 1,
                }}
              >
                {isSendingContact
                  ? t(
                      "sending_securely",
                      "جاري الرفع والإرسال المشفر للمالية...",
                    )
                  : t("send_to_admin_btn", "إرسال الرسالة للإدارة 🚀")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة عرض الوثائق والشروط من أسفل الصفحة (محدثة باتجاهات صحيحة: عربي يمين، إنجليزي يسار) */}
      {activeLegalDoc && (
        <div style={{ ...modalOverlay, zIndex: 99999 }}>
          <div
            style={{
              backgroundColor: "#fff",
              padding: "30px",
              borderRadius: "20px",
              maxWidth: "950px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
              direction: i18n.language === "ar" ? "rtl" : "ltr",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                borderBottom: "2px solid #f1f5f9",
                paddingBottom: "15px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#1e293b",
                  fontSize: "1.3rem",
                  fontWeight: "900",
                }}
              >
                {dynamicLegalDocs[activeLegalDoc].title}
              </h3>
              <button
                onClick={() => setActiveLegalDoc(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  width: "35px",
                  height: "35px",
                  borderRadius: "50%",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#64748b",
                  fontWeight: "bold",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                overflowY: "auto",
                flex: 1,
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                backgroundColor: "#fff",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f8fafc",
                      borderBottom: "2px solid #cbd5e1",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <th
                      style={{
                        padding: "14px 16px",
                        width: "50%",
                        color: "#1e293b",
                        textAlign: "right",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                      }}
                    >
                      العربية (Arabic)
                    </th>
                    <th
                      style={{
                        padding: "14px 16px",
                        width: "50%",
                        color: "#1e293b",
                        textAlign: "left",
                        direction: "ltr",
                        fontSize: "0.95rem",
                        fontWeight: "900",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      English (الإنجليزية)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const docKey = activeLegalDoc;
                    const arText =
                      docKey === "terms"
                        ? termsTextAr || defaultLegalDocs.terms.content
                        : docKey === "privacy"
                        ? privacyTextAr || defaultLegalDocs.privacy.content
                        : refundTextAr || defaultLegalDocs.refund.content;
                    const enText =
                      docKey === "terms"
                        ? termsTextEn
                        : docKey === "privacy"
                        ? privacyTextEn
                        : refundTextEn;

                    const arLines = (arText || "")
                      .split("\n")
                      .filter((l) => l.trim() !== "");
                    const enLines = (enText || "")
                      .split("\n")
                      .filter((l) => l.trim() !== "");
                    const maxRows = Math.max(arLines.length, enLines.length, 1);

                    return Array.from({ length: maxRows }).map((_, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: idx % 2 === 0 ? "#fff" : "#f8fafc",
                        }}
                      >
                        <td
                          style={{
                            padding: "14px 16px",
                            verticalAlign: "top",
                            color: "#334155",
                            lineHeight: "1.7",
                            fontSize: "0.9rem",
                            textAlign: "right",
                          }}
                        >
                          {arLines[idx] || ""}
                        </td>
                        <td
                          style={{
                            padding: "14px 16px",
                            verticalAlign: "top",
                            color: "#334155",
                            lineHeight: "1.7",
                            fontSize: "0.9rem",
                            direction: "ltr",
                            textAlign: "left",
                            borderRight: "1px solid #f1f5f9",
                          }}
                        >
                          {enLines[idx] || ""}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                onClick={() => setActiveLegalDoc(null)}
                style={{
                  backgroundColor: "#1e293b",
                  color: "#fff",
                  border: "none",
                  padding: "12px 30px",
                  borderRadius: "12px",
                  fontWeight: "900",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                {t("close_window", "إغلاق النافذة")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifModal && (
        <div
          style={{
            ...modalOverlay,
            zIndex: 99999,
            alignItems: "flex-start",
            paddingTop: "80px",
          }}
        >
          <div
            style={{ ...modalContent, maxWidth: "480px", maxHeight: "75vh" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "2px solid #e2e8f0",
                paddingBottom: "15px",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: "#1e293b",
                  fontSize: "1.3rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>🔔</span>{" "}
                {t("notifications_title", "الإشعارات والتنبيهات")}
              </h2>
              <button
                onClick={() => setShowNotifModal(false)}
                style={{
                  background: "#fef2f2",
                  border: "none",
                  width: "35px",
                  height: "35px",
                  borderRadius: "50%",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#ef4444",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, paddingRight: "5px" }}>
              {notifications.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#94a3b8",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    backgroundColor: "#f8fafc",
                    borderRadius: "16px",
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  {t("no_new_notifications", "لا توجد إشعارات جديدة حالياً 📭")}
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "20px",
                      backgroundColor: n.is_read ? "#f8fafc" : "#eff6ff",
                      border: n.is_read
                        ? "1px solid #e2e8f0"
                        : "1px solid #bfdbfe",
                      borderRadius: "16px",
                      marginBottom: "12px",
                      boxShadow: n.is_read
                        ? "none"
                        : "0 4px 10px rgba(59, 130, 246, 0.05)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "900",
                        color: n.is_read ? "#475569" : "#1d4ed8",
                        marginBottom: "8px",
                        fontSize: "1.05rem",
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        color: "#334155",
                        fontSize: "0.95rem",
                        lineHeight: "1.6",
                      }}
                    >
                      {n.message}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "15px",
                        borderTop: "1px dashed #cbd5e1",
                        paddingTop: "10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#94a3b8",
                          fontWeight: "bold",
                        }}
                      >
                        {new Date(n.created_at || new Date()).toLocaleString(
                          i18n.language === "ar" ? "ar-SA" : "en-US",
                        )}
                      </div>
                      <button
                        onClick={() => handleReplyToAdmin(n)}
                        style={{
                          background: "#e0e7ff",
                          color: "#3b82f6",
                          border: "none",
                          padding: "8px 15px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          transition: "0.2s",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background = "#c7d2fe")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background = "#e0e7ff")
                        }
                      >
                        {t("reply_to_admin_btn", "↩️ للتواصل مع الإدارة")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={markAllNotifsRead}
                style={{
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  border: "none",
                  marginTop: "20px",
                  padding: "15px",
                  borderRadius: "14px",
                  width: "100%",
                  fontSize: "1.05rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(16,185,129,0.2)",
                }}
              >
                {t("mark_all_read", "تحديد الكل كمقروء ✅")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ✨ شريط التنقل (Navbar) العائم الرئيسي ✨ */}
      <div
        className="app-navbar"
        style={{
          position: "sticky",
          top: "10px",
          zIndex: 2000,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          padding: "15px",
          borderRadius: "24px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
          marginBottom: "30px",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <style>{`
          .mobile-user-row { display: none !important; }
          @media (max-width: 768px) {
            .desktop-user-group { display: none !important; }
            .mobile-user-row { 
              display: flex !important; 
              justify-content: space-between; 
              align-items: center; 
              background-color: #f8fafc; 
              padding: 8px 12px; 
              border-radius: 18px; 
              border: 1px solid #e2e8f0; 
              gap: 10px;
            }
            .mobile-user-row .add-btn {
              padding: 8px 15px !important;
              font-size: 0.95rem !important;
            }
          }
        `}</style>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div
            onClick={() => {
              navigate("/");
              setActiveTab("market");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
              padding: "5px",
              borderRadius: "16px",
              transition: "0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(241,245,249,0.5)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            {platformLogo?.includes("http") ||
            platformLogo?.startsWith("data:image") ? (
              <img
                src={platformLogo}
                style={{
                  height: "45px",
                  width: "45px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
                alt="logo"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 100 100"
                width="45"
                height="45"
                style={{
                  filter: "drop-shadow(0px 4px 10px rgba(124, 58, 237, 0.3))",
                  transition: "transform 0.3s ease",
                  flexShrink: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="pinGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                  <linearGradient
                    id="checkGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <path
                  d="M50 5 C30.67 5 15 20.67 15 40 C15 70 50 95 50 95 C50 95 85 70 85 40 C85 20.67 69.33 5 50 5 Z"
                  fill="url(#pinGradient)"
                />
                <circle cx="50" cy="38" r="22" fill="#ffffff" />
                <path
                  d="M38 40 L46 48 L62 28"
                  stroke="url(#checkGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
            <h1
              style={{
                fontSize: "1.5rem",
                margin: 0,
                color: "#1e293b",
                fontWeight: "900",
                letterSpacing: "-0.5px",
                background: "linear-gradient(90deg, #1e293b, #475569)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {platformName}
            </h1>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {session ? (
              <>
                <div
                  className="desktop-user-group"
                  style={{ display: "flex", alignItems: "center", gap: "15px" }}
                >
                  <button
                    onClick={() => {
                      if (checkProfileCompletion()) {
                        setEditOfferingData(null);
                        setShowAddModal(true);
                      }
                    }}
                    style={addSkillBtn}
                  >
                    <span style={{ fontSize: "1.2rem" }}>✨</span>{" "}
                    {t("add_service_btn", "إضافة خدمة")}
                  </button>

                  <div
                    style={{
                      width: "2px",
                      height: "35px",
                      background: "#e2e8f0",
                      margin: "0 5px",
                    }}
                  ></div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      backgroundColor: "#f8fafc",
                      padding: "6px 20px 6px 6px",
                      borderRadius: "30px",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer",
                      transition: "0.2s",
                    }}
                    onClick={() => setActiveTab("profile")}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f1f5f9")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f8fafc")
                    }
                  >
                    <div
                      style={{
                        textAlign: i18n.language === "ar" ? "left" : "right",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "900",
                          color: "#1e293b",
                          fontSize: "0.95rem",
                        }}
                      >
                        {userProfile?.full_name ||
                          t("default_user", "المستخدم")}
                      </div>
                      {(isSuperAdmin || isSupervisor || isFinancialManager) && (
                        <div style={{ marginTop: "4px" }}>
                          {isSuperAdmin && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                color: "#fff",
                                backgroundColor: "#ef4444",
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontWeight: "bold",
                              }}
                            >
                              {t("role_super_admin", "👑 مدير المنصة")}
                            </span>
                          )}
                          {isSupervisor && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                color: "#fff",
                                backgroundColor: "#3b82f6",
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontWeight: "bold",
                              }}
                            >
                              {t("role_supervisor", "🛡️ مشرف عام")}
                            </span>
                          )}
                          {isFinancialManager && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                color: "#fff",
                                backgroundColor: "#10b981",
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontWeight: "bold",
                              }}
                            >
                              {t("role_financial_manager", "💰 مدير مالي")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <img
                      src={userProfile?.avatar_url || defaultAvatar}
                      style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "50%",
                        border: "2px solid #fff",
                        objectFit: "cover",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                      }}
                      alt="avatar"
                    />
                  </div>
                </div>

                <div
                  style={{
                    position: "relative",
                    cursor: "pointer",
                    backgroundColor: "#f8fafc",
                    padding: "10px",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => setShowNotifModal(true)}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f1f5f9")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f8fafc")
                  }
                >
                  <span style={{ fontSize: "1.3rem" }}>🔔</span>
                  {unreadNotifsCount > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        background: "#ef4444",
                        color: "white",
                        borderRadius: "50%",
                        minWidth: "20px",
                        height: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        border: "2px solid #fff",
                        boxShadow: "0 2px 5px rgba(239,68,68,0.4)",
                      }}
                    >
                      {unreadNotifsCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  title={t("secure_logout", "تسجيل الخروج المأمون")}
                  style={{
                    backgroundColor: "#fef2f2",
                    color: "#ef4444",
                    border: "1px solid #fca5a5",
                    width: "42px",
                    height: "42px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "1.3rem",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#fee2e2";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#fef2f2";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  🚪
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  fontWeight: "900",
                  fontSize: "1rem",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.25)",
                }}
              >
                {t("login_account_btn", "دخول / حساب 🚀")}
              </button>
            )}
          </div>
        </div>

        {session && (
          <div className="mobile-user-row">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                flex: 1,
              }}
              onClick={() => setActiveTab("profile")}
            >
              <img
                src={userProfile?.avatar_url || defaultAvatar}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  objectFit: "cover",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
                alt="avatar"
              />
              <div
                style={{ textAlign: i18n.language === "ar" ? "left" : "right" }}
              >
                <div
                  style={{
                    fontWeight: "900",
                    color: "#1e293b",
                    fontSize: "0.9rem",
                  }}
                >
                  {userProfile?.full_name || t("default_user", "المستخدم")}
                </div>
                {(isSuperAdmin || isSupervisor || isFinancialManager) && (
                  <div style={{ marginTop: "2px" }}>
                    {isSuperAdmin && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "#fff",
                          backgroundColor: "#ef4444",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                        }}
                      >
                        {t("role_super_admin_short", "👑 مدير")}
                      </span>
                    )}
                    {isSupervisor && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "#fff",
                          backgroundColor: "#3b82f6",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                        }}
                      >
                        {t("role_supervisor_short", "🛡️ مشرف")}
                      </span>
                    )}
                    {isFinancialManager && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          color: "#fff",
                          backgroundColor: "#10b981",
                          padding: "2px 6px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                        }}
                      >
                        {t("role_financial_manager_short", "💰 مالي")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              className="add-btn"
              onClick={() => {
                if (checkProfileCompletion()) {
                  setEditOfferingData(null);
                  setShowAddModal(true);
                }
              }}
              style={{
                ...addSkillBtn,
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)",
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>✨</span>{" "}
              {t("add_service_btn", "إضافة خدمة")}
            </button>
          </div>
        )}

        <div
          className="hide-scrollbar"
          style={{
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            paddingBottom: "10px",
            WebkitOverflowScrolling: "touch",
            justifyContent: "flex-start",
            flexWrap: "nowrap",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .nav-tab { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; } .nav-tab:hover { transform: translateY(-2px); opacity: 0.9; }`}</style>
          {[
            {
              id: "market",
              label: t("tab_market", "دليل الخدمات"),
              icon: "🔍",
              color: "#7c3aed",
            },
            ...(session
              ? [
                  {
                    id: "provider",
                    label: t("tab_provider", "أعمالي"),
                    icon: "💼",
                    color: "#059669",
                  },
                  {
                    id: "my_services",
                    label: t("tab_my_services", "خدماتي"),
                    icon: "⚙️",
                    color: "#f59e0b",
                  },
                  {
                    id: "calendar",
                    label: t("tab_calendar", "التقويم"),
                    icon: "📅",
                    color: "#3b82f6",
                  },
                  {
                    id: "invoices",
                    label: t("tab_invoices", "الفواتير"),
                    icon: "🧾",
                    color: "#8b5cf6",
                  },
                  ...(canViewReports
                    ? [
                        {
                          id: "reports",
                          label: t("tab_reports", "التقارير"),
                          icon: "📊",
                          color: "#d946ef",
                        },
                      ]
                    : []),
                  ...(canManagePlatform
                    ? [
                        {
                          id: "admin",
                          label: t("tab_admin", "الإدارة"),
                          icon: "⚙️",
                          color: "#ef4444",
                        },
                      ]
                    : []),
                  {
                    id: "profile",
                    label: t("tab_profile", "حسابي"),
                    icon: "👤",
                    color: "#1e293b",
                  },
                ]
              : []),
          ].map((tab) => (
            <button
              key={tab.id}
              className="nav-tab"
              onClick={() => {
                navigate("/");
                setActiveTab(tab.id);
              }}
              style={{
                padding: "8px 16px",
                border: activeTab === tab.id ? "none" : "1px solid #e2e8f0",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.95rem",
                backgroundColor: activeTab === tab.id ? tab.color : "#fff",
                color: activeTab === tab.id ? "white" : "#475569",
                boxShadow:
                  activeTab === tab.id
                    ? `0 4px 10px ${tab.color}40`
                    : "0 2px 4px rgba(0,0,0,0.02)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                transition: "0.2s",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "1.2rem",
                  filter: activeTab !== tab.id ? "grayscale(0.5)" : "none",
                }}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="app-content"
        style={{
          flex: 1,
          filter: mustAcceptTerms ? "blur(5px)" : "none",
          pointerEvents: mustAcceptTerms ? "none" : "auto",
          transition: "0.3s",
        }}
      >
        <Routes>
          <Route path="/payment-result" element={<Suspense fallback={<div style={{ textAlign: "center", padding: "80px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}><PaymentResult /></Suspense>} />
          <Route
            path="/:storeUsername"
            element={
              <Suspense fallback={<div style={{ textAlign: "center", padding: "80px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}>
                <ClientMarketplace
                  session={session}
                  onRequireLogin={() => setShowLoginModal(true)}
                  checkProfileCompletion={checkProfileCompletion}
                  welcomeMsg={
                    i18n.language === "ar" ? welcomeMsgAr : welcomeMsgEn
                  }
                  heroSubtitle={i18n.language === "ar" ? subtitleAr : subtitleEn}
                  announcementText={announcementText}
                  announcementLink={announcementLink}
                  isAnnouncementActive={isAnnouncementActive}
                  appleStoreLink={appleStoreLink}
                  playStoreLink={playStoreLink}
                />
              </Suspense>
            }
          />
          <Route
            path="/"
            element={
              <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
                <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                {activeTab === "market" && (
                  <Suspense fallback={<div style={{ textAlign: "center", padding: "80px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}>
                    <ClientMarketplace
                      session={session}
                      onRequireLogin={() => setShowLoginModal(true)}
                      checkProfileCompletion={checkProfileCompletion}
                      welcomeMsg={
                        i18n.language === "ar" ? welcomeMsgAr : welcomeMsgEn
                      }
                      heroSubtitle={
                        i18n.language === "ar" ? subtitleAr : subtitleEn
                      }
                      announcementText={announcementText}
                      announcementLink={announcementLink}
                      isAnnouncementActive={isAnnouncementActive}
                      appleStoreLink={appleStoreLink}
                      playStoreLink={playStoreLink}
                    />
                  </Suspense>
                )}

                {session && (
                  <>
                    {activeTab === "calendar" && (
                      <div style={cardS}>
                        <Suspense fallback={<div style={{ textAlign: "center", padding: "50px", color: "#64748b", fontWeight: "bold" }}>{t("loading", "جاري التحميل...")}</div>}>
                          <CalendarView
                            bookings={allUserBookings}
                            userId={session.user.id}
                            onRefresh={() => fetchAllData(session.user.id)}
                          />
                        </Suspense>
                      </div>
                    )}

                    {activeTab === "invoices" && (
                      <div style={cardS}>
                        <Suspense
                          fallback={
                            <div
                              style={{
                                textAlign: "center",
                                padding: "50px",
                                color: "#64748b",
                                fontWeight: "bold",
                              }}
                            >
                              {t("loading_invoices", "⏳ جاري جلب الفواتير...")}
                            </div>
                          }
                        >
                          <InvoicesView
                            bookings={allUserBookings}
                            userId={session.user.id}
                            commissionRate={commissionRate}
                            platName={platformName}
                            platLogo={platformLogo}
                          />
                        </Suspense>
                      </div>
                    )}

                    {activeTab === "profile" && (
                      <div style={cardS}>
                        <Suspense fallback={<div style={{ textAlign: "center", padding: "50px", color: "#64748b", fontWeight: "bold" }}>{t("loading", "جاري التحميل...")}</div>}>
                          <ProfileSettings
                            session={session}
                            onUpdate={() => fetchAllData(session.user.id)}
                          />
                        </Suspense>
                      </div>
                    )}

                    {activeTab === "reports" && canViewReports && (
                      <div style={cardS}>
                        <Suspense
                          fallback={
                            <div
                              style={{
                                textAlign: "center",
                                padding: "50px",
                                color: "#64748b",
                                fontWeight: "bold",
                              }}
                            >
                              {t(
                                "loading_reports",
                                "📊 جاري تجهيز التقارير والإحصائيات...",
                              )}
                            </div>
                          }
                        >
                          <AdminReports
                            commissionRate={commissionRate}
                            affiliateRate={affiliateRate}
                            platName={platformName}
                          />
                        </Suspense>
                      </div>
                    )}

                    {activeTab === "admin" && canManagePlatform && (
                      <Suspense
                        fallback={
                          <div
                            style={{
                              textAlign: "center",
                              padding: "80px",
                              color: "#ef4444",
                              fontWeight: "bold",
                              fontSize: "1.2rem",
                            }}
                          >
                            {t(
                              "loading_admin",
                              "👑 جاري فتح لوحة الإدارة العليا...",
                            )}
                          </div>
                        }
                      >
                        <PlatformManagement
                          userRole={userProfile?.role}
                          onRefresh={() => fetchAllData(session.user.id)}
                          commissionRate={commissionRate}
                          setCommissionRate={setCommissionRate}
                          affiliateRate={affiliateRate}
                          setAffiliateRate={setAffiliateRate}
                          platName={platformName}
                          setPlatName={setPlatformName}
                          platLogo={platformLogo}
                          setPlatLogo={setPlatformLogo}
                          bankAccounts={bankAccounts}
                          setBankAccounts={setBankAccounts}
                          welcomeAr={welcomeMsgAr}
                          setWelcomeAr={setWelcomeMsgAr}
                          welcomeEn={welcomeMsgEn}
                          setWelcomeEn={setWelcomeMsgEn}
                          subtitleAr={subtitleAr}
                          setSubtitleAr={setSubtitleAr}
                          subtitleEn={subtitleEn}
                          setSubtitleEn={setSubtitleEn}
                          licenseName={licenseName}
                          setLicenseName={setLicenseName}
                          licenseNumber={licenseNumber}
                          setLicenseNumber={setLicenseNumber}
                          licenseLink={licenseLink}
                          setLicenseLink={setLicenseLink}
                          announcementText={announcementText}
                          setAnnouncementText={setAnnouncementText}
                          announcementLink={announcementLink}
                          setAnnouncementLink={setAnnouncementLink}
                          isAnnouncementActive={isAnnouncementActive}
                          setIsAnnouncementActive={setIsAnnouncementActive}
                          appleStoreLink={appleStoreLink}
                          setAppleStoreLink={setAppleStoreLink}
                          playStoreLink={playStoreLink}
                          setPlayStoreLink={setPlayStoreLink}
                        />
                      </Suspense>
                    )}

                    {activeTab === "my_services" && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(320px, 1fr))",
                          gap: "25px",
                        }}
                      >
                        {myOfferings.length === 0 && (
                          <div
                            style={{
                              gridColumn: "1 / -1",
                              textAlign: "center",
                              padding: "60px 20px",
                              backgroundColor: "#f8fafc",
                              borderRadius: "24px",
                              border: "2px dashed #cbd5e1",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "4rem",
                                marginBottom: "15px",
                              }}
                            >
                              📭
                            </div>
                            <h3
                              style={{
                                color: "#475569",
                                margin: "0 0 20px 0",
                                fontSize: "1.3rem",
                              }}
                            >
                              {t(
                                "no_services_added",
                                "ليس لديك أي خدمات مضافة بعد",
                              )}
                            </h3>
                            <button
                              onClick={() => {
                                setEditOfferingData(null);
                                setShowAddModal(true);
                              }}
                              style={{
                                ...addSkillBtn,
                                padding: "15px 35px",
                                fontSize: "1.1rem",
                              }}
                            >
                              {t(
                                "add_first_service_btn",
                                "✨ أضف خدمتك الأولى والآن وانطلق",
                              )}
                            </button>
                          </div>
                        )}
                        {myOfferings.map((off, index) => {
                          const modelLabels = {
                            fixed: t("task", "مهمة"),
                            hourly: t("hour", "ساعة"),
                            period: t("period", "فترة"),
                            daily: t("day", "يوم"),
                            monthly: t("month", "شهر"),
                            yearly: t("year", "سنة"),
                            free: t("volunteer", "تطوع"),
                          };
                          const curr = off.currency || "USD";

                          return (
                            <div
                              key={off.id}
                              style={{
                                backgroundColor: "#fff",
                                borderRadius: "24px",
                                border: "1px solid #e2e8f0",
                                overflow: "hidden",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
                                display: "flex",
                                flexDirection: "column",
                                position: "relative",
                                transition: "0.3s",
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.transform =
                                  "translateY(-5px)")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.transform =
                                  "translateY(0)")
                              }
                            >
                              <div
                                style={{
                                  height: "8px",
                                  background:
                                    off.pricing_model === "free"
                                      ? "linear-gradient(90deg, #10b981, #34d399)"
                                      : "linear-gradient(90deg, #7c3aed, #a855f7)",
                                }}
                              ></div>
                              <div
                                style={{
                                  padding: "25px",
                                  display: "flex",
                                  flexDirection: "column",
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "10px",
                                    marginBottom: "12px",
                                  }}
                                >
                                  <span
                                    style={{
                                      backgroundColor: "#f1f5f9",
                                      color: "#64748b",
                                      padding: "4px 10px",
                                      borderRadius: "8px",
                                      fontWeight: "900",
                                      fontSize: "1.1rem",
                                    }}
                                  >
                                    #{index + 1}
                                  </span>
                                  <h3
                                    style={{
                                      margin: 0,
                                      fontSize: "1.25rem",
                                      color: "#1e293b",
                                      fontWeight: "900",
                                      lineHeight: "1.5",
                                      flex: 1,
                                    }}
                                  >
                                    {off.title}
                                  </h3>
                                </div>
                                <p
                                  style={{
                                    fontSize: "0.9rem",
                                    color: "#64748b",
                                    marginBottom: "20px",
                                    lineHeight: "1.8",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    flex: 1,
                                  }}
                                  title={off.description}
                                >
                                  {off.description}
                                </p>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "10px",
                                    marginBottom: "25px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "0.8rem",
                                      backgroundColor: "#f8fafc",
                                      padding: "8px 15px",
                                      borderRadius: "10px",
                                      border: "1px solid #e2e8f0",
                                      color: "#475569",
                                      fontWeight: "bold",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {off.is_24_7
                                      ? t(
                                          "available_24_7_badge",
                                          "🟢 متاح 24 ساعة للعمل",
                                        )
                                      : `${t(
                                          "working_hours_badge",
                                          "🕒 دوام: ",
                                        )}${off.work_start_time?.substring(
                                          0,
                                          5,
                                        )} - ${off.work_end_time?.substring(
                                          0,
                                          5,
                                        )}`}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    borderTop: "2px dashed #f1f5f9",
                                    paddingTop: "20px",
                                    marginTop: "auto",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: "900",
                                        color:
                                          off.pricing_model === "free"
                                            ? "#10b981"
                                            : "#7c3aed",
                                        fontSize: "1.4rem",
                                      }}
                                    >
                                      {off.price_upon_agreement
                                        ? t("price_agreement", "حسب الاتفاق 🤝")
                                        : off.pricing_model === "free"
                                        ? t("volunteer_work", "💚 عمل تطوعي")
                                        : `${off.price} ${curr}`}
                                    </span>
                                    {!off.price_upon_agreement && (
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#94a3b8",
                                          marginTop: "4px",
                                          fontWeight: "bold",
                                        }}
                                      >
                                        {t("price_per", "السعر محدد لكل ")}
                                        {modelLabels[off.pricing_model] ||
                                          t("task", "مهمة")}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      alignItems: "center",
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        navigate(
                                          `/@${userProfile?.username || ""}`,
                                        );
                                      }}
                                      style={{
                                        border: "1px solid #a7f3d0",
                                        background: "#f0fdf4",
                                        color: "#059669",
                                        padding: "10px 12px",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        fontWeight: "bold",
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                        height: "45px",
                                        transition: "0.2s",
                                      }}
                                      title={t(
                                        "view_share_service",
                                        "عرض الخدمة في المتجر أو مشاركتها",
                                      )}
                                    >
                                      {t("view_btn", "🔗 عرض")}
                                    </button>
                                    <button
                                      onClick={() => openEditModal(off)}
                                      style={{
                                        border: "none",
                                        background: "#eff6ff",
                                        color: "#2563eb",
                                        padding: "10px",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        fontSize: "1.1rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "45px",
                                        height: "45px",
                                        transition: "0.2s",
                                      }}
                                      title={t(
                                        "edit_service_tooltip",
                                        "تعديل الخدمة",
                                      )}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteOffering(off.id)
                                      }
                                      style={{
                                        border: "none",
                                        background: "#fef2f2",
                                        color: "#ef4444",
                                        padding: "10px",
                                        borderRadius: "12px",
                                        cursor: "pointer",
                                        fontWeight: "bold",
                                        fontSize: "1.1rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: "45px",
                                        height: "45px",
                                        transition: "0.2s",
                                      }}
                                      title={t(
                                        "delete_service_tooltip",
                                        "حذف الخدمة",
                                      )}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {activeTab === "provider" && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "35px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            backgroundColor: "#fff",
                            padding: "25px",
                            borderRadius: "24px",
                            border: "1px solid #e2e8f0",
                            flexWrap: "wrap",
                            gap: "20px",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "15px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "2.5rem",
                                background: "#f8fafc",
                                padding: "10px",
                                borderRadius: "16px",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              🔗
                            </div>
                            <div>
                              <h3
                                style={{
                                  margin: 0,
                                  color: "#1e293b",
                                  fontSize: "1.3rem",
                                  fontWeight: "900",
                                }}
                              >
                                {t(
                                  "store_link_title",
                                  "رابط متجرك الخاص المباشر",
                                )}
                              </h3>
                              <p
                                style={{
                                  margin: "6px 0 0 0",
                                  color: "#64748b",
                                  fontSize: "0.95rem",
                                  lineHeight: "1.6",
                                }}
                              >
                                {t(
                                  "store_link_desc",
                                  "انسخ هذا الرابط وشاركه في حساباتك (تويتر، واتساب، انستقرام) ليتمكن العملاء من الدخول لملفك وحجز خدماتك مباشرة فوراً بضغطة واحدة.",
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (!userProfile?.username) {
                                alert(
                                  t(
                                    "store_link_error",
                                    "عذراً! لا يمكننا إنشاء رابط لمتجرك حتى تقوم باختيار (يوزر نيم / Username) خاص بك.\n\nيرجى الذهاب إلى تبويب 👤 [حسابي] وكتابة اليوزر نيم الخاص بك أولاً ⚠️",
                                  ),
                                );
                                return;
                              }

                              const platformDomain =
                                "https://www.bookonmap.com";
                              const storeUrl = `${platformDomain}/@${userProfile.username}`;

                              copyToClipboard(storeUrl).then(() => {
                                alert(
                                  t(
                                    "store_link_copied",
                                    "رائع! تم نسخ رابط متجرك بنجاح 📋✨\nالرابط هو:\n",
                                  ) + storeUrl,
                                );
                              });
                            }}
                            style={{
                              background:
                                "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                              color: "white",
                              border: "none",
                              padding: "15px 30px",
                              borderRadius: "14px",
                              fontWeight: "900",
                              fontSize: "1.1rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              boxShadow: "0 8px 20px rgba(124, 58, 237, 0.3)",
                              transition:
                                "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(-3px)")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(0)")
                            }
                          >
                            <span style={{ fontSize: "1.3rem" }}>📋</span>{" "}
                            {t("copy_link_btn", "نسخ الرابط الآن")}
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "25px",
                          }}
                        >
                          {/* كرت أرباح المنصة الصافية */}
                          <div
                            style={{
                              background:
                                "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              padding: "30px",
                              borderRadius: "24px",
                              color: "white",
                              boxShadow: "0 15px 35px rgba(16, 185, 129, 0.25)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              transition: "0.3s",
                              position: "relative",
                              overflow: "hidden",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(-5px)")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(0)")
                            }
                          >
                            <div
                              style={{
                                position: "absolute",
                                right: "-20px",
                                top: "-20px",
                                fontSize: "8rem",
                                opacity: 0.1,
                              }}
                            >
                              💰
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                marginBottom: "15px",
                                opacity: 0.9,
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              <span style={{ fontSize: "1.8rem" }}>💰</span>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: "1.2rem",
                                  fontWeight: "bold",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                {t(
                                  "net_platform_profits",
                                  "أرباح المنصة الصافية",
                                )}
                              </h3>
                            </div>
                            <div
                              style={{
                                fontSize: "1.8rem",
                                fontWeight: "900",
                                direction: "ltr",
                                textAlign: "right",
                                textShadow: "0 4px 10px rgba(0,0,0,0.15)",
                                position: "relative",
                                zIndex: 1,
                                wordBreak: "break-word",
                              }}
                            >
                              {sumByCurrency(
                                providerBookings.filter(
                                  (b) =>
                                    b.status === "completed" &&
                                    !b.is_manual_booking,
                                ),
                                commissionRate,
                                "providerNet",
                              )}
                            </div>
                          </div>

                          {/* ✨ كرت أرباح الحجوزات الخاصة (خارج المنصة) ✨ */}
                          <div
                            style={{
                              background:
                                "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
                              padding: "30px",
                              borderRadius: "24px",
                              color: "white",
                              boxShadow: "0 15px 35px rgba(99, 102, 241, 0.25)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              transition: "0.3s",
                              position: "relative",
                              overflow: "hidden",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(-5px)")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(0)")
                            }
                          >
                            <div
                              style={{
                                position: "absolute",
                                right: "-20px",
                                top: "-20px",
                                fontSize: "8rem",
                                opacity: 0.1,
                              }}
                            >
                              📞
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                marginBottom: "15px",
                                opacity: 0.9,
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              <span style={{ fontSize: "1.8rem" }}>📞</span>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: "1.2rem",
                                  fontWeight: "bold",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                {t(
                                  "private_bookings_profits",
                                  "أرباح الحجوزات الخاصة",
                                )}
                              </h3>
                            </div>
                            <div
                              style={{
                                fontSize: "1.8rem",
                                fontWeight: "900",
                                direction: "ltr",
                                textAlign: "right",
                                textShadow: "0 4px 10px rgba(0,0,0,0.15)",
                                position: "relative",
                                zIndex: 1,
                                wordBreak: "break-word",
                              }}
                            >
                              {sumByCurrency(
                                providerBookings.filter(
                                  (b) =>
                                    b.status === "completed" &&
                                    b.is_manual_booking,
                                ),
                                commissionRate,
                                "providerNet",
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              background:
                                "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                              padding: "30px",
                              borderRadius: "24px",
                              color: "white",
                              boxShadow: "0 15px 35px rgba(245, 158, 11, 0.25)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              transition: "0.3s",
                              position: "relative",
                              overflow: "hidden",
                            }}
                            onMouseOver={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(-5px)")
                            }
                            onMouseOut={(e) =>
                              (e.currentTarget.style.transform =
                                "translateY(0)")
                            }
                          >
                            <div
                              style={{
                                position: "absolute",
                                right: "-20px",
                                top: "-20px",
                                fontSize: "8rem",
                                opacity: 0.1,
                              }}
                            >
                              🤝
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                marginBottom: "15px",
                                opacity: 0.9,
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              <span style={{ fontSize: "1.8rem" }}>🤝</span>
                              <h3
                                style={{
                                  margin: 0,
                                  fontSize: "1.2rem",
                                  fontWeight: "bold",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                {t(
                                  "affiliate_profits",
                                  "أرباح التسويق بالعمولة",
                                )}
                              </h3>
                            </div>
                            <div
                              style={{
                                fontSize: "1.8rem",
                                fontWeight: "900",
                                direction: "ltr",
                                textAlign: "right",
                                textShadow: "0 4px 10px rgba(0,0,0,0.15)",
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              {myAffiliateStats.total.toFixed(2)} SAR
                            </div>
                            <div
                              style={{
                                fontSize: "0.95rem",
                                marginTop: "15px",
                                opacity: 0.9,
                                display: "flex",
                                justifyContent: "space-between",
                                position: "relative",
                                zIndex: 1,
                                fontWeight: "bold",
                              }}
                            >
                              <span>
                                {t("affiliate_clients", "العملاء: ")}
                                {myAffiliateStats.clients}
                              </span>
                              <span>
                                {t("affiliate_due", "المستحق: ")}
                                {myAffiliateStats.unpaid.toFixed(2)} SAR
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                marginTop: "15px",
                                color: "#fef3c7",
                                textAlign: "center",
                                position: "relative",
                                zIndex: 1,
                                borderTop: "1px dashed rgba(255,255,255,0.3)",
                                paddingTop: "10px",
                                fontWeight: "bold",
                              }}
                            >
                              {t(
                                "affiliate_note",
                                "* تضاف الأرباح لرصيدك فور سداد المزود لعمولة المنصة.",
                              )}
                            </div>
                          </div>
                        </div>

                        {myUnpaidCommissionText !== "0.00" && (
                          <div
                            style={{
                              backgroundColor: "#fef2f2",
                              border: "2px dashed #fca5a5",
                              padding: "25px 30px",
                              borderRadius: "24px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "20px",
                              boxShadow: "0 10px 25px rgba(239, 68, 68, 0.08)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "18px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "2.5rem",
                                  animation: "pulse 2s infinite",
                                }}
                              >
                                <style>{`@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }`}</style>
                                🔔
                              </span>
                              <div>
                                <h3
                                  style={{
                                    margin: 0,
                                    color: "#ef4444",
                                    fontSize: "1.3rem",
                                    fontWeight: "900",
                                  }}
                                >
                                  {t(
                                    "platform_dues_pending",
                                    "مستحقات المنصة معلقة",
                                  )}
                                </h3>
                                <p
                                  style={{
                                    margin: "8px 0 0 0",
                                    color: "#7f1d1d",
                                    fontWeight: "900",
                                    fontSize: "1.3rem",
                                    direction: "ltr",
                                    textAlign: "right",
                                  }}
                                >
                                  {myUnpaidCommissionText}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowPaymentModal(true)}
                              style={{
                                background:
                                  "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                                color: "white",
                                border: "none",
                                borderRadius: "14px",
                                fontWeight: "900",
                                cursor: "pointer",
                                padding: "15px 30px",
                                fontSize: "1.1rem",
                                transition:
                                  "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: "0 8px 20px rgba(239, 68, 68, 0.3)",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                              onMouseOver={(e) =>
                                (e.currentTarget.style.transform =
                                  "translateY(-3px)")
                              }
                              onMouseOut={(e) =>
                                (e.currentTarget.style.transform =
                                  "translateY(0)")
                              }
                            >
                              <span style={{ fontSize: "1.3rem" }}>💳</span>{" "}
                              {t(
                                "pay_commissions_btn",
                                "المبادرة بسداد العمولات الآن",
                              )}
                            </button>
                          </div>
                        )}

                        <section style={cardS}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "15px",
                              backgroundColor: "#f8fafc",
                              padding: "20px 25px",
                              borderRadius: "20px",
                              borderRight:
                                i18n.language === "ar"
                                  ? "6px solid #7c3aed"
                                  : "none",
                              borderLeft:
                                i18n.language === "en"
                                  ? "6px solid #7c3aed"
                                  : "none",
                              marginBottom: "35px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 4px 10px rgba(0,0,0,0.02)",
                            }}
                          >
                            <span style={{ fontSize: "2.2rem" }}>💼</span>
                            <div>
                              <h2
                                style={{
                                  fontSize: "1.5rem",
                                  margin: 0,
                                  color: "#1e293b",
                                  fontWeight: "900",
                                }}
                              >
                                {t(
                                  "provider_dashboard_title",
                                  "لوحة تحكم حجوزاتي كمزود خدمه",
                                )}
                              </h2>
                              <p
                                style={{
                                  margin: "6px 0 0 0",
                                  color: "#64748b",
                                  fontSize: "0.95rem",
                                }}
                              >
                                {t(
                                  "provider_dashboard_desc",
                                  "إدارة ومتابعة جميع الطلبات الواردة لخدماتك من العملاء لتسعيرها أو تنفيذها.",
                                )}
                              </p>
                            </div>
                          </div>
                          {[
                            "pending",
                            "awaiting_pricing",
                            "awaiting_client_approval",
                            "negotiating",
                            "confirmed",
                            "completed",
                            "cancelled",
                          ].map((s) => (
                            <BookingTable
                              key={s}
                              bookings={providerBookings}
                              status={s}
                              isProvider={true}
                              commissionRate={commissionRate}
                              onRefresh={() => fetchAllData(session.user.id)}
                              onHideComment={hideProviderComment}
                            />
                          ))}
                        </section>

                        <section style={cardS}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "15px",
                              backgroundColor: "#f8fafc",
                              padding: "20px 25px",
                              borderRadius: "20px",
                              borderRight:
                                i18n.language === "ar"
                                  ? "6px solid #059669"
                                  : "none",
                              borderLeft:
                                i18n.language === "en"
                                  ? "6px solid #059669"
                                  : "none",
                              marginBottom: "35px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 4px 10px rgba(0,0,0,0.02)",
                            }}
                          >
                            <span style={{ fontSize: "2.2rem" }}>🛍️</span>
                            <div>
                              <h2
                                style={{
                                  fontSize: "1.5rem",
                                  margin: 0,
                                  color: "#1e293b",
                                  fontWeight: "900",
                                }}
                              >
                                {t(
                                  "client_dashboard_title",
                                  "حجوزاتي وطلباتي كعميل",
                                )}
                              </h2>
                              <p
                                style={{
                                  margin: "6px 0 0 0",
                                  color: "#64748b",
                                  fontSize: "0.95rem",
                                }}
                              >
                                {t(
                                  "client_dashboard_desc",
                                  "تتبع حالات الخدمات التي قمت بطلبها أنت من مزودين آخرين في المنصة.",
                                )}
                              </p>
                            </div>
                          </div>
                          <Suspense fallback={<div style={{ textAlign: "center", padding: "50px", color: "#64748b", fontWeight: "bold" }}>{t("loading", "جاري التحميل...")}</div>}>
                            <ProviderSchedule
                              bookings={clientBookings}
                              session={session}
                              fetchBookings={() => fetchAllData(session.user.id)}
                              isProviderView={false}
                            />
                          </Suspense>
                        </section>
                      </div>
                    )}
                  </>
                )}
              </div>
            }
          />
        </Routes>
      </div>

      <div className="app-footer-wrap">
        <Footer
        platformName={platformName}
        licenseNumber={licenseNumber}
        licenseName={licenseName}
        licenseLink={licenseLink}
        onShowLegalDoc={setActiveLegalDoc}
        onContactAdmin={() => {
          setContactForm({ ...contactForm, type: "general" });
          setShowContactModal(true);
        }}
        />
      </div>

      {/* ✨ نافذة استعادة كلمة المرور الجديدة ✨ */}
      {showUpdatePassword && (
        <Suspense fallback={<div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>{t("loading", "جاري التحميل...")}</div>}>
          <UpdatePasswordModal onClose={() => setShowUpdatePassword(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default function AppWrapper() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        {/* <BetaGate> */}
        <MainAppContent />
        {/* </BetaGate> */}
      </BrowserRouter>
    </HelmetProvider>
  );
}
