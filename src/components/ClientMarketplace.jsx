import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  getCurrentPositionNative,
  isNativePlatform,
  openExternalUrl,
} from "../lib/native";

import DatePicker from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_ar from "react-date-object/locales/gregorian_ar";
import "react-multi-date-picker/styles/layouts/mobile.css";

const SmartDatePicker = DatePicker.default || DatePicker;
const SmartTimePicker = TimePicker.default || TimePicker;

export default function ClientMarketplace({
  session,
  onRequireLogin,
  allowTextReviews = true,
  welcomeMsg = "",
  heroSubtitle = "",
  announcementText,
  announcementLink,
  isAnnouncementActive,
  appleStoreLink,
  playStoreLink,
}) {
  const { t, i18n } = useTranslation();
  const { storeUsername } = useParams();
  const username = storeUsername ? storeUsername.replace("@", "") : null;
  const isRTL = i18n.language === "ar";
  const userId = session?.user?.id;

  const [liveTime, setLiveTime] = useState(new Date());
  const [offerings, setOfferings] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const [isSpecialManualBooking, setIsSpecialManualBooking] = useState(false);
  const [availableCapacity, setAvailableCapacity] = useState(null);
  const [storeProfile, setStoreProfile] = useState(null);

  // ✨ متغير جديد لحفظ رابط لوجو المنصة ✨
  const [platformLogo, setPlatformLogo] = useState("");

  const [localSearch, setLocalSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterStartTime, setFilterStartTime] = useState("");
  const [filterEndTime, setFilterEndTime] = useState("");

  const [reviews, setReviews] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef();
  const ITEMS_PER_PAGE = 12;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingData, setBookingData] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    manualLocation: "",
    gpsLocation: "",
    manualQuantity: 1,
    clientContact: "",
    clientMessage: "",
  });

  const [calculatedData, setCalculatedData] = useState({
    price: 0,
    quantity: 1,
    timeMultiplier: 1,
    requestedCount: 1,
    text: "",
  });

  const dayLabels = {
    sun: "الأحد",
    mon: "الإثنين",
    tue: "الثلاثاء",
    wed: "الأربعاء",
    thu: "الخميس",
    fri: "الجمعة",
    sat: "السبت",
  };

  const fetchInitialData = async () => {
    setLoading(true);

    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .order("created_at");
    if (cats) setDbCategories(cats);

    // ✨ جلب لوجو المنصة ✨
    const { data: settingsData } = await supabase
      .from("platform_settings")
      .select("logo_url")
      .eq("id", 1)
      .single();
    if (settingsData && settingsData.logo_url) {
      setPlatformLogo(settingsData.logo_url);
    }

    if (username) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();
      if (prof) setStoreProfile(prof);
    }

    if (userId) {
      const { data: favs } = await supabase
        .from("favorites")
        .select("provider_id")
        .eq("user_id", userId);
      if (favs) setFavorites(favs.map((f) => f.provider_id));
    }

    let query = supabase
      .from("offerings")
      .select("*, profiles!inner(*)")
      .eq("profiles.is_active", true);

    if (username) query = query.eq("profiles.username", username);

    query = query.order("rating", {
      referencedTable: "profiles",
      ascending: false,
    });

    const { data: offs } = await query.range(0, ITEMS_PER_PAGE - 1);

    if (offs && offs.length > 0) {
      setOfferings(offs);
      if (offs.length < ITEMS_PER_PAGE) setHasMore(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchInitialData();
  }, [username, userId]);

  const fetchMoreData = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);

    const nextPage = page + 1;
    let query = supabase
      .from("offerings")
      .select("*, profiles!inner(*)")
      .eq("profiles.is_active", true);

    if (username) query = query.eq("profiles.username", username);
    query = query.order("rating", {
      referencedTable: "profiles",
      ascending: false,
    });

    const { data: newOffs } = await query.range(
      nextPage * ITEMS_PER_PAGE,
      (nextPage + 1) * ITEMS_PER_PAGE - 1,
    );

    if (newOffs && newOffs.length > 0) {
      setOfferings((prev) => [...prev, ...newOffs]);
      setPage(nextPage);
      if (newOffs.length < ITEMS_PER_PAGE) setHasMore(false);
    } else {
      setHasMore(false);
    }
    setIsFetchingMore(false);
  };

  const lastElementRef = useCallback(
    (node) => {
      if (loading || isFetchingMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchMoreData();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, isFetchingMore, hasMore],
  );

  const toggleFavorite = async (e, providerId) => {
    e.stopPropagation();
    if (!session)
      return alert(
        isRTL
          ? "يرجى تسجيل الدخول لاستخدام المفضلة 🔐"
          : "Please login first to use favorites 🔐",
      );

    if (favorites.includes(providerId)) {
      setFavorites(favorites.filter((id) => id !== providerId));
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("provider_id", providerId);
    } else {
      setFavorites([...favorites, providerId]);
      await supabase
        .from("favorites")
        .insert({ user_id: userId, provider_id: providerId });
    }
  };

  const renderTextWithLinks = (text) => {
    if (!text) return text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (isNativePlatform()) {
                e.preventDefault();
                openExternalUrl(part);
              }
            }}
            style={{
              color: "#fef08a",
              textDecoration: "underline",
              fontWeight: "bold",
              margin: "0 4px",
              direction: "ltr",
              display: "inline-block",
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const displayCategories = [
    { id: "all", label: t("cat_all", "الكل"), icon: "🌟" },
    ...dbCategories.map((c) => ({
      id: c.id,
      label: isRTL ? c.label_ar : c.label_en,
      icon: c.icon,
    })),
  ];

  const availableCountries = [
    ...new Set(offerings.map((item) => item.country).filter(Boolean)),
  ];
  const availableCities = [
    ...new Set(
      offerings
        .filter(
          (item) => filterCountry === "all" || item.country === filterCountry,
        )
        .map((item) => item.city)
        .filter(Boolean),
    ),
  ];

  const filtered = offerings.filter((item) => {
    const s = localSearch.toLowerCase();
    const matchesSearch =
      (item.title || "").toLowerCase().includes(s) ||
      (item.nickname || "").toLowerCase().includes(s) ||
      (item.provider_name || "").toLowerCase().includes(s) ||
      (item.provider_role || "").toLowerCase().includes(s) ||
      (item.profiles?.full_name || "").toLowerCase().includes(s) ||
      (item.profiles?.username || "").toLowerCase().includes(s) ||
      (item.description || "").toLowerCase().includes(s);
    const itemCat = item.category || "other";
    const matchesCategory =
      activeCategory === "all" ||
      activeCategory === "favorites" ||
      itemCat === activeCategory;
    const matchesCountry =
      filterCountry === "all" || item.country === filterCountry;
    const matchesCity = filterCity === "all" || item.city === filterCity;
    const matchesFavorites =
      activeCategory !== "favorites" || favorites.includes(item.provider_id);

    let matchesDate = true;
    if (filterDate) {
      const selectedDay = new Date(filterDate);
      const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayId = dayMap[selectedDay.getDay()];
      const activeDays =
        Array.isArray(item.available_days) && item.available_days.length > 0
          ? item.available_days
          : dayMap;
      if (!activeDays.includes(dayId)) matchesDate = false;
    }

    let matchesTime = true;
    if (
      (filterStartTime || filterEndTime) &&
      matchesDate &&
      !item.is_24_7 &&
      item.work_start_time &&
      item.work_end_time
    ) {
      const toMins = (tStr) => {
        const [h, m] = tStr.split(":").map(Number);
        return h * 60 + m;
      };
      const pStart = toMins(item.work_start_time.substring(0, 5));
      let pEnd = toMins(item.work_end_time.substring(0, 5));
      if (pEnd <= pStart) pEnd += 24 * 60;
      let fStart = filterStartTime ? toMins(filterStartTime) : pStart;
      let fEnd = filterEndTime ? toMins(filterEndTime) : pEnd;
      if (fEnd <= fStart && filterStartTime && filterEndTime) fEnd += 24 * 60;
      if (fStart < pStart && pEnd > 24 * 60) fStart += 24 * 60;
      if (fEnd < pStart && pEnd > 24 * 60) fEnd += 24 * 60;
      if (fStart < pStart || fEnd > pEnd) matchesTime = false;
    }

    return (
      matchesSearch &&
      matchesCategory &&
      matchesCountry &&
      matchesCity &&
      matchesDate &&
      matchesTime &&
      matchesFavorites
    );
  });

  useEffect(() => {
    if (!selected) {
      setReviews([]);
      setBookingData((prev) => ({
        ...prev,
        manualQuantity: 1,
        clientMessage: "",
      }));
      setAvailableCapacity(null);
      return;
    }
    const fetchReviews = async () => {
      const { data } = await supabase
        .from("bookings")
        .select(
          "rating, review, review_text, client_review, profiles(full_name)",
        )
        .eq("offering_id", selected.id)
        .eq("status", "completed")
        .not("rating", "is", null)
        .order("id", { ascending: false })
        .limit(10);
      setReviews(data || []);
    };
    fetchReviews();
    setAvailableCapacity(selected.max_capacity || 1);
  }, [selected]);

  useEffect(() => {
    const fetchRealTimeCapacity = async () => {
      if (!selected) return;
      const maxCap = selected.max_capacity || 1;

      if (!bookingData.startDate) {
        setAvailableCapacity(maxCap);
        return;
      }

      const requestedStart = new Date(
        `${bookingData.startDate}T${bookingData.startTime || "00:00"}:00`,
      );
      const requestedEnd = new Date(
        `${bookingData.endDate || bookingData.startDate}T${
          bookingData.endTime || "23:59"
        }:00`,
      );

      try {
        const { data: existing } = await supabase
          .from("bookings")
          .select("appointment_date, end_time, quantity, status")
          .eq("offering_id", selected.id)
          .in("status", ["confirmed", "completed"]);

        let usedCapacity = 0;

        existing?.forEach((b) => {
          const bStart = new Date(b.appointment_date);
          const bEnd = b.end_time
            ? new Date(b.end_time)
            : new Date(bStart.getTime() + 60 * 60 * 1000);

          if (requestedStart < bEnd && requestedEnd > bStart) {
            usedCapacity += b.quantity || 1;
          }
        });

        const available = Math.max(0, maxCap - usedCapacity);
        setAvailableCapacity(available);

        if (bookingData.manualQuantity > available) {
          setBookingData((prev) => ({
            ...prev,
            manualQuantity: available > 0 ? available : 1,
          }));
        }
      } catch (err) {
        console.error("Error fetching dynamic capacity:", err);
      }
    };

    fetchRealTimeCapacity();
  }, [
    selected,
    bookingData.startDate,
    bookingData.startTime,
    bookingData.endDate,
    bookingData.endTime,
  ]);

  useEffect(() => {
    if (!selected) return;
    const model = selected.pricing_model || "fixed";
    const basePrice = Number(selected.price) || 0;

    let timeMultiplier = 1;
    let label = t("task", "مهمة");

    if (
      model !== "fixed" &&
      model !== "free" &&
      bookingData.startDate &&
      bookingData.endDate &&
      bookingData.startTime &&
      bookingData.endTime
    ) {
      const startStr = `${bookingData.startDate}T${bookingData.startTime}:00`;
      const endStr = `${bookingData.endDate}T${bookingData.endTime}:00`;
      const start = new Date(startStr);
      const end = new Date(endStr);

      let diffHours = (end - start) / (1000 * 60 * 60);
      if (diffHours <= 0 && bookingData.startDate === bookingData.endDate)
        diffHours += 24;

      if (diffHours > 0) {
        if (model === "hourly") {
          timeMultiplier = Math.round(diffHours * 100) / 100;
          label = t("hour", "ساعة");
        } else if (model === "daily") {
          timeMultiplier = Math.max(1, Math.ceil(diffHours / 24));
          label = t("day", "يوم");
        } else if (model === "monthly") {
          timeMultiplier = Math.max(1, Math.ceil(diffHours / (24 * 30)));
          label = t("month", "شهر");
        } else if (model === "yearly") {
          timeMultiplier = Math.max(1, Math.ceil(diffHours / (24 * 365)));
          label = t("year", "سنة");
        } else if (model === "period") {
          let periodLengthInHours = 4;
          const durationText =
            selected.duration_details || selected.duration || "";
          if (durationText) {
            const extractedNumber = parseInt(
              String(durationText).replace(/\D/g, ""),
              10,
            );
            if (!isNaN(extractedNumber) && extractedNumber > 0) {
              periodLengthInHours = extractedNumber;
            }
          }

          timeMultiplier = Math.max(
            1,
            Math.ceil(diffHours / periodLengthInHours),
          );
          label = t("period", "فترة");
        }
      }
    } else {
      if (model === "period") {
        timeMultiplier = 1;
        label = t("period", "فترة");
      } else if (model === "fixed" || model === "free") {
        timeMultiplier = 1;
        label =
          model === "free"
            ? t("volunteer", "تطوع")
            : t("fixed_task", "مهمة ثابتة");
      }
    }

    const requestedCount = bookingData.manualQuantity || 1;
    const finalTotalPrice = basePrice * timeMultiplier * requestedCount;

    setCalculatedData({
      price: finalTotalPrice,
      quantity: timeMultiplier * requestedCount,
      timeMultiplier: timeMultiplier,
      requestedCount: requestedCount,
      text: label,
    });
  }, [bookingData, selected, t]);

  const handleGetLocation = async () => {
    try {
      if (isNativePlatform()) {
        const pos = await getCurrentPositionNative();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setBookingData({
          ...bookingData,
          gpsLocation: `https://maps.google.com/?q=${lat},${lng}`,
          manualLocation: "",
        });
      } else {
        if (!navigator.geolocation) {
          return alert(
            isRTL
              ? "جهازك لا يدعم تحديد الموقع."
              : "Your device doesn't support geolocation.",
          );
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setBookingData({
              ...bookingData,
              gpsLocation: `https://maps.google.com/?q=${lat},${lng}`,
              manualLocation: "",
            });
          },
          (err) => {
            alert(
              isRTL
                ? "يرجى السماح بالوصول للـ GPS من إعدادات الجهاز 📍"
                : "Please allow GPS access 📍",
            );
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      }
    } catch (err) {
      if (err.message === "PERMISSION_DENIED") {
        alert(
          isRTL
            ? "يرجى السماح بالوصول للـ GPS من إعدادات الجهاز 📍"
            : "Please allow GPS access 📍",
        );
      } else {
        alert(
          isRTL
            ? "تعذر تحديد الموقع، حاول مرة أخرى."
            : "Could not get location, try again.",
        );
      }
    }
  };

  const handleSuggestNextSlot = () => {
    if (!selected) return;
    const now = new Date();
    let proposedStart = new Date(now.getTime() + 60 * 60 * 1000);
    const mins = proposedStart.getMinutes();
    if (mins > 0 && mins <= 30) proposedStart.setMinutes(30, 0, 0);
    else if (mins > 30) {
      proposedStart.setHours(proposedStart.getHours() + 1);
      proposedStart.setMinutes(0, 0, 0);
    }

    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const activeDays =
      Array.isArray(selected.available_days) &&
      selected.available_days.length > 0
        ? selected.available_days
        : dayMap;
    let foundDate = null;

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(proposedStart);
      checkDate.setDate(checkDate.getDate() + i);
      const dayId = dayMap[checkDate.getDay()];
      if (activeDays.includes(dayId)) {
        if (selected.is_24_7) {
          if (i === 0) foundDate = checkDate;
          else {
            checkDate.setHours(8, 0, 0, 0);
            foundDate = checkDate;
          }
          break;
        } else {
          const startH = parseInt(
            (selected.work_start_time || "08:00").split(":")[0],
          );
          const startM = parseInt(
            (selected.work_start_time || "08:00").split(":")[1],
          );
          if (i === 0) {
            const currentMins =
              checkDate.getHours() * 60 + checkDate.getMinutes();
            const pStartMins = startH * 60 + startM;
            let pEndMins =
              parseInt((selected.work_end_time || "22:00").split(":")[0]) * 60 +
              parseInt((selected.work_end_time || "22:00").split(":")[1]);
            if (pEndMins <= pStartMins) pEndMins += 24 * 60;
            if (currentMins >= pStartMins && currentMins < pEndMins - 60) {
              foundDate = checkDate;
              break;
            } else if (currentMins < pStartMins) {
              checkDate.setHours(startH, startM, 0, 0);
              foundDate = checkDate;
              break;
            }
          } else {
            checkDate.setHours(startH, startM, 0, 0);
            foundDate = checkDate;
            break;
          }
        }
      }
    }

    if (foundDate) {
      const pad = (num) => String(num).padStart(2, "0");
      setBookingData({
        ...bookingData,
        startDate: `${foundDate.getFullYear()}-${pad(
          foundDate.getMonth() + 1,
        )}-${pad(foundDate.getDate())}`,
        startTime: `${pad(foundDate.getHours())}:${pad(
          foundDate.getMinutes(),
        )}`,
        endDate: `${new Date(
          foundDate.getTime() + 60 * 60 * 1000,
        ).getFullYear()}-${pad(
          new Date(foundDate.getTime() + 60 * 60 * 1000).getMonth() + 1,
        )}-${pad(new Date(foundDate.getTime() + 60 * 60 * 1000).getDate())}`,
        endTime: `${pad(
          new Date(foundDate.getTime() + 60 * 60 * 1000).getHours(),
        )}:${pad(new Date(foundDate.getTime() + 60 * 60 * 1000).getMinutes())}`,
      });
    } else {
      alert(
        isRTL
          ? "لا يمكن تحديد موعد تلقائي، يرجى الاختيار يدوياً."
          : "Cannot auto-suggest a slot.",
      );
    }
  };

  const handleBook = async () => {
    if (isSubmitting) return;

    if (!session) {
      if (typeof onRequireLogin === "function") onRequireLogin();
      else
        alert(
          isRTL
            ? "يرجى تسجيل الدخول أو إنشاء حساب أولاً 🔐"
            : "Please login first 🔐",
        );
      return;
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", session.user.id)
      .single();

    if (!userProfile?.full_name?.trim() || !userProfile?.phone?.trim()) {
      setIsSubmitting(false);
      return alert(
        isRTL
          ? "عذراً، يجب إكمال بياناتك الشخصية (الاسم ورقم الجوال) في قسم (حسابي) لتتمكن من إتمام الحجز ⚠️"
          : "Please complete your profile (Name and Phone) in 'My Account' to proceed with booking ⚠️",
      );
    }

    const isTimeOptional =
      ["fixed", "daily"].includes(selected?.pricing_model) ||
      selected?.price_upon_agreement;
    const finalLocation = bookingData.manualLocation || bookingData.gpsLocation;

    if (
      !bookingData.startDate ||
      !bookingData.endDate ||
      (!isTimeOptional && (!bookingData.startTime || !bookingData.endTime)) ||
      !finalLocation ||
      !bookingData.clientContact
    ) {
      return alert(
        isRTL
          ? "يرجى إكمال جميع التفاصيل المطلوبة (الموقع، التواريخ، ورقم التواصل) 📍📞"
          : "Please complete all details.",
      );
    }

    if (bookingData.manualQuantity < 1)
      return alert("الرجاء تحديد عدد صحيح للخدمة.");

    const requestedStart = new Date(
      `${bookingData.startDate}T${bookingData.startTime || "00:00"}:00`,
    );
    let requestedEnd = new Date(
      `${bookingData.endDate}T${bookingData.endTime || "23:59"}:00`,
    );
    const now = new Date();

    if (requestedStart < now && bookingData.startTime)
      return alert(
        isRTL ? "⛔ لا يمكن الحجز في الماضي." : "⛔ Cannot book in the past.",
      );
    if (requestedEnd <= requestedStart)
      return alert(
        isRTL
          ? "⛔ وقت الانتهاء يجب أن يكون بعد وقت البدء."
          : "⛔ End time must be after start time.",
      );

    if (
      selected.is_24_7 === false &&
      selected.work_start_time &&
      selected.work_end_time &&
      bookingData.startTime &&
      bookingData.endTime
    ) {
      const getMins = (dateObj) =>
        dateObj.getHours() * 60 + dateObj.getMinutes();
      const rStartMins = getMins(requestedStart);
      const pStartMins =
        parseInt(selected.work_start_time.split(":")[0]) * 60 +
        parseInt(selected.work_start_time.split(":")[1]);
      let pEndMins =
        parseInt(selected.work_end_time.split(":")[0]) * 60 +
        parseInt(selected.work_end_time.split(":")[1]);
      if (pEndMins <= pStartMins) pEndMins += 24 * 60;
      const normRStart =
        rStartMins < pStartMins && pEndMins > 24 * 60
          ? rStartMins + 24 * 60
          : rStartMins;
      if (normRStart < pStartMins || normRStart > pEndMins)
        return alert(
          isRTL
            ? `⛔ الوقت المحدد خارج أوقات الدوام! ساعات العمل من ${selected.work_start_time.substring(
                0,
                5,
              )} إلى ${selected.work_end_time.substring(0, 5)}.`
            : "⛔ Outside working hours.",
        );
    }

    setIsSubmitting(true);

    try {
      const { data: existing } = await supabase
        .from("bookings")
        .select("appointment_date, end_time, quantity, status")
        .eq("offering_id", selected.id)
        .in("status", ["confirmed", "completed"]);

      let overlappingUsedCapacity = 0;
      existing?.forEach((b) => {
        const bStart = new Date(b.appointment_date);
        const bEnd = b.end_time
          ? new Date(b.end_time)
          : new Date(bStart.getTime() + 60 * 60 * 1000);
        if (requestedStart < bEnd && requestedEnd > bStart)
          overlappingUsedCapacity += b.quantity || 1;
      });

      const maxCapacity = selected.max_capacity || 1;
      const finalAvailable = Math.max(0, maxCapacity - overlappingUsedCapacity);

      if (bookingData.manualQuantity > finalAvailable) {
        setIsSubmitting(false);
        setAvailableCapacity(finalAvailable);
        return alert(
          `⚠️ نعتذر، السعة المؤكدة المتاحة في هذا الوقت هي (${finalAvailable}) فقط من أصل (${maxCapacity}).\nالرجاء تقليل العدد المطلوب أو تغيير الوقت.`,
        );
      }

      const bookingStatus = selected.price_upon_agreement
        ? "awaiting_pricing"
        : "pending";

      const { data: bookingResult, error } = await supabase
        .from("bookings")
        .insert([
          {
            offering_id: selected.id,
            customer_id: session.user.id,
            appointment_date: requestedStart.toISOString(),
            end_time: requestedEnd.toISOString(),
            location: finalLocation,
            quantity: bookingData.manualQuantity,
            status: bookingStatus,
            client_contact: bookingData.clientContact,
            proposed_price: selected.price_upon_agreement
              ? null
              : calculatedData.price,
            is_commission_paid: isSpecialManualBooking ? true : false,
            is_manual_booking: isSpecialManualBooking ? true : false,
          },
        ])
        .select();

      if (!error && bookingResult) {
        const providerId = selected.provider_id || selected.profiles?.id;
        const newBookingId = bookingResult[0].id;

        if (providerId) {
          const msgText = isSpecialManualBooking
            ? `📞 [حجز خاص / خارجي]\n${
                bookingData.clientMessage.trim() ||
                "تم تسجيل الحجز يدوياً من قبل المزود."
              }`
            : bookingData.clientMessage.trim();

          if (msgText) {
            await supabase.from("messages").insert([
              {
                booking_id: newBookingId,
                sender_id: session.user.id,
                receiver_id: providerId,
                text_content: msgText,
              },
            ]);
          }
        }

        if (providerId && !isSpecialManualBooking) {
          await supabase.from("notifications").insert([
            {
              user_id: providerId,
              title: "طلب حجز جديد 🆕",
              message: `لديك طلب حجز جديد لخدمة "${selected.title}". يرجى مراجعته في لوحة أعمالك.`,
              is_read: false,
            },
          ]);
        }

        alert(
          isRTL
            ? isSpecialManualBooking
              ? "تم إرسال الحجز الخاص بنجاح وسيظهر في 'أعمالي' بانتظار التأكيد ✅"
              : selected.price_upon_agreement
                ? "تم إرسال طلب التسعير للمزود بنجاح 📨"
                : "تم إرسال الطلب للمزود بنجاح ✅"
            : "Request sent successfully ✅",
        );
        setSelected(null);
        setIsSpecialManualBooking(false);
      } else {
        alert("Error: " + error.message);
      }
    } catch (err) {
      alert("حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modelLabels = {
    fixed: "مهمة",
    hourly: "ساعة",
    period: "فترة",
    daily: "يوم",
    monthly: "شهر",
    yearly: "سنة",
    free: "تطوع",
  };

  const renderStars = (profileRating) => {
    return (
      "⭐ " + (profileRating ? parseFloat(profileRating).toFixed(1) : "5.0")
    );
  };

  // ✨ إجبار النظام على استخدام شعار المنصة المحلي كصورة افتراضية ✨
  const defaultAvatar = (name, hexColor = "#7c3aed") =>
    platformLogo ||
    "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wgARCATmBOYDASIAAhEBAxEB/8QAGgABAQADAQEAAAAAAAAAAAAAAAEEBQYCA//EABkBAQEAAwEAAAAAAAAAAAAAAAABAgMEBf/aAAwDAQACEAMQAAAC6oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACUAAAAAAAAAAAAAAAAAAACFAAAAAAAAAAAAAAAAASgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABKAAAAAAASgAAAAAlAAAAAAAEqFAAAAAIUAACUAAAAAAAAAAAAAAAAAAAAASgAAAAAAAAAAAABKAAAAAACUAAAAAAAAEoAIUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABKAAAAAAAAAAAAAAAAAAAAAAAJQAAAAlAAAEsoAAAAAAAIUAAAAAABBQAAAAAAAAAAAAAAAAAAAAAAAAAACFAAAAAAASgAAAAAAAAAAAAAAAAAAAAAAAAAAhQAAAAAAAAAAAJQAAAAAAAAASgAAAAAAAAAhQAAAAAAAAACFAlAhQAAAAAAAAAAACFIUAAAAAAAAAAAAAAAAAEoAAAAAAAAAASgAAAAAIUEoAAAAAAAAAEFAAAAIUAAAAAAAAAAAAAAAAAAABKACFAAAAAAlAAAAAAAAAAAAAAAAAAAAAAEoAAAAAAAAAJQAAAAAAAAAIUAAAAAAAAAABKAAAAAEoBKAAAAACUCFASgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACUAAAJQAAAAAAAAIUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhQAAAJQAAAAAAAAAAAAAAAAAAAlAAAAAAAAEUAAAAAAAAAAAAAAAAAACFAAASgEoAAAAAAAAAAAAAAAAAAAAAAACFlAAAAAABKAAAAJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhQAAAAAAAAAAJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlAAAAAAhUoAAAAAAAAAAAAAAAAAAABKAAAAAAAAAAAAAAAAAAEoCFAAAAAAAAAAAAAAAAAAAAIUAAAAAAAAAAAAACUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJQAAAAAAAAAAlCUAAAAAEoAAAAAIUAAAAAAAABKAAAAAAAAAAAAEoAAAAAAAAAAAAAAAAAeNfk2TncLe6nH5qbL0PjRM2998+OkyOTYuzchl6p0rU7HS+owAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEoAAAAAAAAAAAAk0ubbafVeey/T5m9UoAAAAA9eRstxyzS7Nz28459RrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACFAAAAAIUAAAAAAAAAAAAAAAAAAAAAAExcfnuh98eXuoACyhBUFQVKAAAX6fIdHseL3PHN2l5QAAAAAAAhQAAAAAAAASgAAAAAAAAAAAAAAAAAIUAAAABBQAAAAAAAJQAAAAAAAAAAAIXUeue6qHaWWAAAAAAAAKgqCoKg2u/4vb8rfDjgAAAAAAAAAAAAAAAAAAAAAAAAAAAhQAAAACFAAAAAAAAAAAAAAAAAAABKAAAAAADCyeS3vnDvoAAABkbbW0X36j66HNfXoZrnP/PpRyeN2njNxzodTvuINtESpQAg6DbcV1XFMscwAAAABKABCgAAAAAAAAAAASgAAACKAAAAAAAJQAAAAAAAAAAAAAAAAAAAAAAAAAS4lanVJ6dqXIAQWMyMbfZ/24opzhCgAASjX6Dr/AJ7nGthr+6hkAAZWLDtrqdt5cDEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAAAAAAAABKAAOZ33IdQl7aEAD7n16jz9fOgagAAAAAAE53o/ObimbhelQqoFg+3X8T0nM2g4oAAAAAAAAIUAAAAAACUAAAAAAAAAAAAAAAAAAAAAEoSgAAAAAAAAAAEoAAAAACGi0uRj+nQ2FiLAdVqui45RygAAAAAB5T0goX48l2el6GhHfaiKimdgsXb35fXyoAAAAAAlAAEUAAAAAAASgAAAAAAAAAAAAAAAAABKAAAAAAAAhZQAAABKAAAABKAMfI1Wbm7HqWoKgqZ2LosmXy4EAAAAAJdPMLqCeb73/OZbZ0iXL0Xj2OL+e31HqUMwQFdLs9Bv8AzYGpKAAAAAACUAAAAJRKAAAAAAAAAAAAAAAAAAAAAAAAAAAhQAAASgASgAAAAABKANBv+a3tWPQoADfaDq+dnjggABKAAJdXMJponnEMLmYvRN2VTL0QNdy/acV222OpRAGw6fkeu4ZRzgAAAACUAAAAAAJQAAAACUJQAAAAAAAAAAAAAAAAAAAAASgAAAAAAAAAAAAACcv1HLdDAS99AAnZ8X2/JPoOMBNP9dJOTLz9JJo7C6fcXvJgr40PrxPOsGFs6JsuaZegDICcV2vF9b5jstQAfbsuL7TilHKJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAAAAAAAJy3Vc1vaqx6FoCB2vE9fyswcUSjS6jqObx4PCGhuNMZ9JzqKQ1vXnoGz1sDL0AZAATiez4nrtS9gBLDI7Hk+s4ZRzAAAAAAAAAAAAEoAAAAAAAAlAACUAAAAAAAAAAACUAAAAAAAAAAAAAAAAAAAaHfava5kelbAAdJze10ulS+dJQYmXGPIeOn5zHh8IaqgWb1n72ZfQC5AAAYHKbvSehQ3rAA2nS6XdedKNJKAAAAAAAAAABCgAAAlABKAAAAAEoAAAAAAAAAAAAAAAAAAAAAAARQAlAJQASgB8ftDhpl4nrWigHrwO3+mk3flwMADDzIx4/z0+hx4sbz99uxm3W9wXMAABLrMmgx5fUoUAl9HU5/j35MCAAAAAAAAAAAAAAAAAAAJQAAAAAAAAAAJQAAAAAAAAAAAAAAAAAAlAAEoAASgDRaHtOM77B0KCUPp2HFbHQ6my+fAAEolABKAABCcfstJ3WjpAANrqer0s+nnQAAAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAAAAAAAAAAEoAAAAAAEKAAAAAAAlAJzHUYe1yA9K0AEobvfcNueSdCl4wAAAAAAg1PnnepUvbQAAMvrtZtPOgaQAAAAAAAAAEoAAAAAAAAAAAAAAAAAAAAAAAASgAAAAAAAAAAAAAAAAAAAAAAlHM6rtOP774L0JQiiLTN6Pj7odu57cccyUusAAIV8dTm2/P6/59lhehFEUQpMvF6vSzaedAAAJQAAAAAAAAAAAAAAEKAAAAAAAAAAAAAAAAAAAAAAAAAACUAAAAAAAACUAASgBpd1MnDs7C9OymQqIoigWsnN1DW6D6c2wdJ8+fRucPCbCVsQCURURVRfrGw6Lx9PNgawAAAhQAAAEoABLKAASgAAAAAAAAAAAAAAAAAAAAAAAAABKAAAAAAAAAAAAwazcTQ4/XdtutJvNMo0gAAEsMfk+z1nQ5yy92QqSgAAAABFEURRAJYAOpwN9xwOUAAAB8NTvOc6G5y+Ny8707Ey+WBEoJQASgAAAAAAAABKEoAAAAAAAAAAAAAAAAAAAAASgAAAAEqFAAB55ba6Ptt9eNpvbj7HlwAAABLCLDndZ2fJ91+FjoUKKAgAEURYAJYAIUzMfrdD6+jz4AAAAAw8yVx8z8D1Ll9Nx/QczYjjgAAAAAAAAAAAAAAAAAAAAAAAAAACUAAAAAAAAAAAAAAJQABPH00mbWeE9O3qtNv8AjlHKAAAAAksJj5DJxvnouc9G2y5gKhaEBQRLACAQBu8WZsDzIpEoAAAAAYfM9jzfXcL7fG9d6/1qtr5eIYgAAAAAAAAAAAEoAAAlAAAAAAAAAAAAAAAAAAAAAAAAAAAD48rsNb30Z+5usmXy4EAAAAJQlh5WU0G9ZuNZWJ6NqWqlKgqCwAVBEBH2MnqPl9fOlGooAAAEoAAwc6Vx7KxPUv16nkdvobscMAlAABKAAAJQAAAAAIKAAAAlAAAAAAAAAAAAAAAAAAAAAAAGNk81tYJPSyvT6TpuOUckAAAAlAACefUPMsr5cn2Ou6HOpe21KtQVCWAItgkIXqsDd8cWXmWywAAIUAAAAGBznY8x2XF9eXVer+/P9B5uIawAAAAAEqFlAAAAAAAhSFAAAAAAAAAAAAAAAAAAAAAAAAAIYfMZeH6NplbG7z5fLgRKAAAAAACWHnz7815qVoNX2XI9t+d83etgqCoCAQZuL1ul9hwS+pYoCUJQACUAAAGu2MycayMf1Leo5bN0umHnwAQpCgAAAAASgAAAlAAAAAAAACUEKAAABKAAAAACUAAAAAAa3YcnvY9jvt6PR9byqOOAEoBKAEoAJQB5nryeZZkmHmXJxd2Wr9C+kuSoLEKgRlxtdvHnS2XBasAAAAAAAAAAaznuz5Psvwsdbpc/lOq86UaQAAAAAAAAAAAAAAAABKAAAAACFAAAAAAIUAAAAAEoADwavQfT5enbH2zbvbefXlwMQAAAhQSgAABJ6h48+/NeZZk88h2Gp3tHfN7LUFQEHrrNP0PJJZeZfU9QpCKAAAAAAAAANVtfOTjL9Pl6ldBz331uvePfmwAAACUAAAAAJQJQAAAAAAAAAAAAAAgoAAAAAAAAAAAJpdrx/SkO2t9pOx53uzD4cHy51jyb+aEm+ugHQ++aL1P348y7S8ZkXPq3PZrZs78frc6FASjz59ea8+fUyebByPy32g9C0ZiC3zucW69nnS+pY9WXFQAEoT5p9Wsw5hvnLY7X1vw5azDo/HPmO+mjJvfWhh0XvmqdjcDOvZp9F2XI92fzsnS3u64vr+GfUc4CUAAAAAAAJQAEKAACUAAAAAAAAAJUKBKAAAAAAAAABjmn01nqUjJvd5g53my6/YNWOg8dCauY+PWxhyDqseYc63eK1a6ZHwYeJ9B830i+Mj4+V3Gz5Ty3ds5PcXo2rzbsefUXx59+cnnz68047sdLvaW+b2WoL2XPdLySVedfUuL1ZYELNbqZq6HW6KtGXiWzTHsx8vVSV9D5s7LZ6b10H3bOY+vUW7Oc+u/jLX7Ebmi3mFty5VL6du503rW7V8Pv5kAAAAAAAAAAASgAAAAAAAAAABKAAAAAAAAAAAAAHO9Fq9rmXv5+ja82vtnaxg3P10MwdHkcoxdn9uGuE7m8hl63STS5upm/H6esJrsLfpq5P59fhzTzc2uA0fCe4x+b35X1uNJG3tPXI769Od59+Mt3nz785PPy+triLl4fpWp9jpsv3582Wz1ivqeoMLn8dW60uNZyx6rXL6MZ69bFlrfXQZl3aDM2hv8Ah93m7fTDws7upzWPtdZ8eQ85uq+HOTZd989MybPB+VzSyZvUn1ja9Brtj50DUAAASgAAABKABCgAAAAAAAAAAAAASgAAAACUAAAAAJ4+kMf55urzfX5apvZ3z+HvJMfL+tum+PS/SuWdL8656brC2MfLwlb7P5GandOK2eidFMTM0NdrOkuOnj/HUaec2unuNPjz78stl0HGZV6Oq8efWfV48+/OV1fO9jxvZbudL1lZt8++GWvEn10mBiYc1ls53qVj6Zu5bNFttlb0+PTDy3Zjn9bvvT4Ghb7sMHx62vLNy4016L1rc79t98o1v3+/zj6fTE8ybP66fxi33vD2mh8/dYAAAAAAAAAAAAEoSgAAAAAABKAAAAAAAAAAAAAAAAAAJxnQcr2KOqgCxACn2ytexbbxrEZ3zxPpk8XJ8V8vv8YdBteKuh3Dnt3yz56Tppq1cZOi0c4/g9eWPrpuU9t3XTz72dl4js+b6bru45TrTx68znl5Z8dfJLU033N8ur3mbb1y/HS7N271Oj+fXczFTePfs9fXBkbP1qmLOxvkyJZQVYQFBGZ2HB9VzNmOOAAAAAAAAJQlAAAAAAAAAAAAAAAEoAAAAEoAAAABKAACWHK63ub1OK+/YI5X69LcXPe98xaNvBovO+pzvy6dXJ/Dsmbh53OPneOdPh7GkubibXgtSwbvd8T9Od23xwdnx48zgdpo8OXTT1Jo+/Ucfm3d0Gp3Ov6OzB3mt2tOWzdRzctss0esvJ6Bu+GRdbn1Z2l0/wAe3L6eDoCkM6MGb3M1OW9dl99bjvv1TXOb+nQsWh9byRpW7Gh8dCOa+XU3Jx/x7Vk4Pa9KPVOYlABKAAAAAAAJQAAASgAAAAAAAAAAAAAAAAAAAEoAAAAAJQAAAAAAABPH0Gs13STa4nz22t6LzUzsLoTaatHb/Tjen4Zic92ur0c/OT6eZy9Hk8z1uXZge8jm8ssGrr4rvZu70PHy5bd05mpjvtTNrD99Dtedze02V558/dagAAAAAAAAAAAAAAAAAAAAABKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATDzVcrru61/VeU9ZOL1Oq2HDdPxT48/2/Oc3Nqej5/Mmvc8vstbbd3h9SyuC5Pp6vXzmT23Hz91s+aYGfXICEoAASgAAAAAAQoAAAAAAAAAAJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJQAQoAAAACUAAAAJQADzpN7M3COs5nuvT5nH9ZyTk/h1+q0cunu22yfT4/bkd/X8PP26jsut3/q8EDAAAAAAAAAAAAAAAAAABKAAAAAAhQAAAAAEoAAAAlAABKAAAAAAAAAAAAAAJQAAAAAAAAAAAAAAAA+H3HFeOx0Xdfvmc18K6zE576HqbTexMg4YAAAASgAAAAAAAAAAhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAEoAAIVBUFQUAAAAAAhQASgAAAIVBUoAAAAAIUE8ex8/dpKAAAAAAAAAAAAAAAAABKAAAAAEoAAAAAAAAAAAAAAAAAAAABKCUAAarW5en77lsRtZkxBl+8Ebjbcj70uxYuVxQIAAAAAAAAAAanbaTawpiO+9l68+vLgAAAAA8J6+Gp105d38dXZo2eTox1H05Tb3p2qW9IAAAAAADAz9LsfP1p3beozOU6rklGkAIfHT/LX9t22Xz20roBwwAAAAAAAAAAAAAAAAAAAAAAAABKAAAAAANHptzpfRt2uo7LFpbvpzTRYnUK4q5GP35bLo+R63hxo5whXz+NZT4/WKAAAnk9sdWQlgBot7otzT3zfQvZ+vPryYIVIekoAIeeczNXOEmfOfA+3Rfa9XLfLrsJNB5+3xnLtd1yXQ3szBesQoAACUAabc6Xa0iX0rd9oPWt2V+X18yAMDN5Xcxano27XU7TU6IebBCvFPSUAEKgqeD6JQAAAAAAAAAAAAAAAAAAAAAAADRaXc6X0r67Li9pg6Nzl550U57Frx8Je653Ua7ZefEuBqe9FgT0LRuMrFYupz+H6Djm4S8x8rym1m6vy776kZvvt9F51u3vNdLwS6PeaHJpovo3tfXnD8mTmL49G+vbqY9ZB50AfP6a+YaKSTy8vo9fsr6AXeBi851nPTkws3B9zl63DytHfQyvtz33nL0ev0/m3afbSph1f05bo71fYXeA0m70m1pJJ6V9NjrcW63vFdZxzKT5czWaH38/TvpnYeTxtdTtsHQy89wT76vHvoWvN2Mnc861O2mq2vnzQYX2wfQu3arxH08S7X22WmYOz98x03BKNYAAAAAAAAAAAAAAAAAAAAADQ6TdaP0bUztjCZ9xa+53zrFz9fK7T7cb2HBLx3R8put9fPot6bDLefNVz/AGmDtcn78XuvafbS7jzJoNN78ejW4x+p0MLzsJyTlMHtuO7b46XmNhk6rQb7Q8k0l8vRvX8p7+Ok9zqq95cvnQIAanbaiatMknndTk42TfUC5ANJutLNOpsTz+p1W21F7talnD9Mzc/a9nOYfX87NeFs9XktXURcvTAaPeaPa0UX0r2HK9dqeGaHYa29l7nnPtpOaPXjddF23KdnxXNPO21G333o/j9XmzldtscHoZ/y130wabF3Gn7rl9ZxnZ8s5nAzcHqtz8brtbCZ7jnL4Pach2X5dFzezydKl86AASgAIUAAAAAAAAAAAAAAAAHP6PeaL0q7biu30vpTjkKaLQdbyPffXS8xvq+nPdNzI7PjOrxbFLwxLjnHeJfXu43+l3nnTh0no5dDu+c6PzsaNJyvU8f0sT74+Z2XsNDvtDwTRWT0b6n0+ceuw4zN1OwefXnQABrtj85hyT15nmb/AGXLdPe/0LvAnNbnm5yT34z5z9Dot9oL2azKxcqcfUWXL02k3elmrT/b4facHWWXL0wVot7otrQ3y9K9v68fXyZxmP1fK+jUNr69nq9vwRxPbcRm8bfT7jfek1ew4vkknnYd1wHSzU5xm4O19O24jt+WcvgZuB0XZ9NyPXcko5zmel5LoYmXhZ/ZersvlwAAAAAAAAAAAAACUAAAAAAAOf0O90XpV2vFDupwzTO5+fFLdnrDoXp+d7TneOJ7znNc0ubhXtvb/XhMvknW81rfGyjZb28zzypyOD1nJehfp1XIq71xvjnm657zeq3eanstL6c/0HPc80dj0b2mq3l8ycHc3B9K7zouC6vkmyHIAA0Wp6/mceLHzsKNHUZPGfS9PW4HPE+nzvmc/vpcLc3rmg3+gZ6zLw8ucfUDL0bpN1ppr031+X1nD1tly9MBot7odrQQ9K9x9vl9fJjlOr+ebhc3p/rvvu2ckcP3HDdbxuNNuOi7fke14rSvY8bnbHXNNh8k+mljuvvueG7nmnKYGdgdN9dHzUjvHGXmm75zy6b63mn7HU+w4YAlACUAAAAAAAAAAAAAAAAACHPaLs8TsvMTqZscu6gcu6ixy+X0+XrYuWcsk9I5vS97jdTinSY++6N0OxjQ9P7vHA1mp2zJwfjutZ2XmG9ubQ5PRbLUxcyOSXnuhw83GOovXdn7jgnw4zu8He4769Hei5/3xMvhgQlDx7Jz+s7L5Tn5J0HxmnTed7910G72Pu75Uu+8/v8AFmvlMzb/AFmjNpl1zSbvGmHJ5G7+k5s6mXYA0W9xc3F3qJ2XY/Xz64IABKE4XutXvctt9jk7rmc/0M5ZwTsMDsvPXfbGuaw+3wcHOdxrNnpnJ6/Ya7tuR5yup1OHdJ8cmh+vR7LWxM5OOUQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABKACUAAAAAAAAAAAAAAAAJYclr9hr/Uuw63kOv44pzgAAAAAAAJQAAAAAAAAAAAAAAAAAEKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABKOQ13a+Oy871+NlaIGoAAAAAAAAAAAAAAAAABKAAAAAAAAAAAAAA8J7azNmP2FzS4dfX1zn06HR3DzOcfH3HshWP8Acnzuqzbp8/eCgfH1yG12bGydQ+Xmvu8yPaeD6PPg+ryPU+fo+WRoNxsfcmtWP9yp8j7Pl9Cvh9T0ABLqcmy+nMdNkqfPW+r4/Ur5/QPHk+jQ77N8vtqtpFfP5xkPnI+p5PTHyAQqa+Y7FjZKhaAAAABKAAAAEoAAJQAAAAAIUAAEoSgAAAAAAAAAA1O2xZr5rP8AltJx7EZegwszEyaK5X067n/LG+mmYXz2OBtvRc/v+b1TLZ2tzu657oebky99z3Q4LLNLUfXU5PXfe85Xqdc5vMx+gyafP1m9wafE85m67jQdDptM8/TB+W65G+1+w0zmfX3y99z9TstTple/Wy7blup0uE2eJttBi8z39d13VmHyTNETndzzvQ2Gy1Fyu75fqdNjMffa3OjW7K8rk3Wd9Ptqcn1PPdHtaHf6DoMHL5PjbbWq+Ozwreh53oeU1zJz8fNybAcrB57qtBOPx02q2zYF6AAAAAAAAAAAAAAAAAAAAAAAACUAAAAAAAAllAAJQAfL6jVetmzebWDWffMZJ8vsxarY/Rk8Y+WjCyvYefSMLMqsX7fQYWX6GJlX4Gk3mFsti/L6tTE85rJ49Viw/eSyfL17YtRn5DJ5xcxDx7RqszJZppN5IUxY3v7KmHmjzjZYxvr9B8ue2uRtZFNLW5v1ZMLNIw/v9RjeMxTGyWLVbL2yJWIAAlAAABCkKAAAAAlAAAAAAAAAAEoAAAAAAAAEKAAAAAAAACUAAAAAAEoAAAAAAAAAAAAAAAAAAAAAAAAJQAAAAAAACUABCygAACUAAAAAAAAAAAAAAAAAAAAAACUAAAAAAASgAAAAAAAAAQoAAAAAAAAAAAAAAAAAAAAAAACUAAAAAlAAAAAAAAlAAAAAAAAAAAAAAAAAEoAAAAAAAAAAAAlAAACUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEoAAAAAEKBKAAAAAAAAAAAAAAAAAAAAAAAAABCglAAAAAAAAQoABCpQAAAAAAAQoACUSgAAAAAAACUAAACUAAAAAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlAAAAAAJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJQAAAAAAAAAACUACUAAAAAAlAAAAAAAAAAAAAAAAAAAAAAAAQoAAAAAAAAAAAABCygAAAAAAAAAAAlAAAAAAAAAAAACUAAAAAAAAAJQAQoAAAAAAAAAAAACUASgACWUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEKAABKAABCgAAAlAAAQoAAABCgAAAAAAAAAAAAASgAAAAAAAAAAAAAAAAAQoAAAAACUAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAlAABCgAAAAAAAlAAAAAAAAAAAAAAAAAAAAQoAAAAAAAEsKAAAAAAAAAAAAAAAAAlAAAJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlAAlAAAAAJQAAAAAAAASgAAAAAAAAAAAAAAAAAAAAAAAAAQoAAAAAAAAAEoAAAAAigAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQoAAAAAAAAAAABCgAAAlAAAAAAABKAAAAAAAAAAAAAAACCgAAAAAAAAJQAAAAAAAAAAAAAAAAAAAAAAlABCgJQAAAAQoAACUAAAAAAAAlAAABKAAAAAAAAAAAAAAAAJQAAAAEKAAAACUAAAEoAAAAAAAAAAlAAAAAAAAAAAAAAAQoAAAEoAAAAAAAAAAAAAJQlAAAAAAAAAACUAAAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAAAAAAQoAAAAAAAAAAAAJQAAAAAAAAAASgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACUAAAJQAAAAAAAAQKCUECgAAAAAAAAAAAQKAAAAAABAoAAAAAAAAAAAAECgAAAAAAAAAAAAAAAAAlAAAAAAAAAAAAAAAAD/2gAMAwEAAgADAAAAIQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAIAAAAAEAAAAAAAJAAAAABAAAEAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAIAAAAAAEAAAAAAAACABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAEAAAAEAAAKAAAAAAABAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAEAAAAAAAAACAAAAAAAAABAAAAAAAAAABAEBAAAAAAAAAAAABBAAAAAAAAAAAAAAAAAAIAAAAAAAAAAIAAAAABAIAAAAAAAAADAAAABAAAAAAAAAAAAAAAAAAAACABAAAAAAEAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAEAAAAAAAAABAAAAAAAAAAACAAAAACAIAAAAAEBACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAEAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAEAAAAAAAAAAAAAAAAAAAEAAAAAAAAMAAAAAAAAAAAAAAAAAABAAACAIAAAAAAAAAAAAAAAAAAAAAAABEAAAAAACAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAABCAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAIBAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAEEAAAAACAAAAABAAAAAAAAACAAAAAAAAAAAACAAAAAAAAAAAAAAAAACNZlJPFyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAEBHywww1/74iAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAABAAAAAAAAAAAAAAAAAAAAAAAI+X86TTT289/wA+sgAAAAAAAQAAAAAAAACAAAAAAAAAAAAAAAAAAQAAAAAwAAAAAAABAAAAAAAAAAAARLWsMPOMMPP88889oAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA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AAAAAAAAAAAAACAAAAAAAAIABEAAAIAAAAAAAAAAAAAAAAAAAAAACAAAAAAAEAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAACAAAAAIAAAAAAACAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAIAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAABAEAAAAAAAAAAAAAAAAAAAAAAAAABAIAAAAAAABAABCAAAAAAABAACEAAAAAAAAIAAACAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAIACAAAAAAIAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAABEAAAAAAAAAAACAAAAAAAAAAAACAAAAAAAAACABAAAAAAAAAAAAACAEAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAEAABAAAAIAABAAAABAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAABAAAAAACAAAAAAAAAAAAAAAIAAAAAAAAAAAAACAABAAAAAAAAIAAAAAAAAAAAAAAAAAAABAAAAAAAAFAAAAAAAAAAAAAAAAACAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIACAAAAAIAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAABAAAAIAAAAAAAEAAAAAAAAAAAAAAADAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAACABACAAAABAAACAAAAAAAAIAAAEAAAAAAAAAAAAAAAAIAAAABAAAAAIAAAEAAAAAAAAAAIAAAAAAAAAAAAAABAAAAEAAAAAAAAAAAAACCAAAAAAAAAACAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIAAAAAAAAHAIHAAAAAAAAAAAAHAAAAAAAHAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAP/2gAMAwEAAgADAAAAEACAIAAAAAAAEAEIAAABAIAAACAAAAAAAAIAEEAMAIAAAEAAAAAAACCAACACMAAAAMAAAAAAAAEKJAADAAAAAAAAEAFAEAAKABCFABAEAAAAAAIABAACAAEAAACABAAAAACAAABDAIAIAAAIBCAIBAAAAAAAAEMAMAAEAACBAACAAACACAACCAIAAACAEAAAAABEJAAAAABAAAEAAAAAAAAAAAAAAAAAAAAAIAAAAEAAIAAAAAIAAAEAAEAAAAAAAADCBAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAACMEAEAAAAEAAAKIAAAAAABAAAACAADAAAAAAIAAACAAAAAAAAAAAAAAAABAAAAAAACAAAAAAAAAAAIICAACABAAAAAAABAAAAAAAAAAAAEAAAAAAAAACIAAAAAAAABAAAAAAAAACBAEBAAAAAAAAAIIABBAAAAAAAAAAAAEAAAAAIEAAAAAAAABIAAAAABAIAABAAAAAADAAAABAAAAIAAAAAIAAAAAAAACCABAABAAAEADCAIAAAAAAAAAAAAAAAAAIAAAAAEAAAEAAAAAAAAABAAAAAAAAAAACEAAAACAIBAAAAEBACAAAAAAAAAAAAAAAAAAAAAAAAADADAAAAEAAAEAAAAAAAABAAAAABAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAEAAAABAAAAEAAAAAIAAAAAAABAAAAAEAAAAAAAAMAEAAAAAAABAAAAAAAABAAACAIAAAAAAAAIAAAMAAAAAACABABEAAAAAACAAAAEEEAAAAAAAAABAAAAAAIMAAAAAAAAAAAAAAAAAIAAAAAAAAAABAAIAADBAAAAAABAJAAAAAAAAAAAAAAAAAAACCAAAAAAABAAAACAAAAAAEAAAAAAAAAAABAAAAEAAAAAAAAAAAEAAAAAAAAAAACEAAAAABCAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAIBAAAAAAAAACAAAAAGMBAABAAAAAAAAAABAAAEAAAAAAAAAAAAAABECDAACEBAAAAAAAEAAAAAAAAAAEEAAAAACAAAAABBAACAAAAACAAEAAAAAAIAACAAAAAGAAAAAAAAAKAE4xsXQMZQCAAAAAAAAAAIAAAAAABAABAAAAABAIAAIEAAAAAAAAAAAAAAACAAAAACAAAAAAEACAEAF2nSwUfef7QR1CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEABAAACABAADAACAAAAAAAAABAAAEAACPyI3azzzaRWfzbxIAEAAAABAAAACAMEAIAAAAAAAAAAAAAAACEBAIAAADAAAAAAAAEAAAAAAAAAAABDCe8UQUcdzUSdf+6oAAAAAAAAAAAAAAEAAAAAAAAAAAABAAAAABAAAAAAAAAAAEAAAAAAAAIAADEIABF7yWbYlpUodFBec766AAAAAEABAAAAAAAAAAAAEAAAAMABBAAAAIAAAAAAABAAAAAAAAAAAAAAAAAEjOw2/rQDACCEJn2w34UwAAAIAAAAAAAAAAAAAAAAAAAAAAAADIAAAEAAAAAACAAAAAAAAAAAAAACAGC+V6yS0AAAIAKBA7+x4+IAAAAAAAABAAAAAAAEAAAAAAAACAMDADAAAAAAACCAAAAAAAAAAAIAAAAAEOGYl9wAAADAAAZQAeXzOfAAMAAAECAMAAAAAAAIAAAAAAAAACMJBEAAAAIAAAAAAABEAAAAIAAAACEHbzTHCAAAAIEFn6OEkBS6ScIAAAAAAEAAAAEIAAAAAAAABAAKFAAIAAAAAAAAAABAAAAIACAAAAAACAACjUHCIACEAFwIMuADpc4+gAAAAACAAAAAACAAAAAIIAAAAAEAAAEAAFAAAAAAAAEAAAAAAAAAAAAAAKO+MPyAJJYg88VgIACQQAXSCAAAAAAAAAAAAAACAAAAAAAAAAAMAAAAAAACAAAAAAAAAAAAAAAAAAAAN6wDKlMBw+yZagQAAMmbcaQAAAAAAAABAAAEAAAAAAAAIAAIBAAAIAIAAAACAAAAAAAAAAAAAAAAAAABGWaAaJJdLlyggAAAL+XaVAEAAAAAAAAAABAAAAICEAAAAAEAKDAAAAAAAAAAAAAAAAAAAAGACAIAEAAta/bYeANTUGgAAAETLTRagAAEIAIAAAAAAAAAAAAAIAAAAAAAMAACAAAAAAAAAAAABAAAAACAAEAAEAD9045YOAMEAEBEBLFqVDYAAAAAAAAAAAAAAAAACAAAAAAAAACAEAIACAAABAAAEBAAAAABAAAAAAACANP1cYdwBMAJACFLQ/UYewAAAAAAAAAAIEAAAAAAAAAAAAAAAAAABAAAAIAAAAAAAAAJAAAAAAAACAAAEF4acUbRyBKACaqk+aKYAAAIAAAAAAAAAAAAAABAAAAAAAAAAAAABBAEAAAAAAAAAAIAIAAAABACCAEAA19Q802ZLdiQHUc7RkQAAABBAAACAIKAAIAAAAAAAAAAAAAAMAAAAAEAAAAAIAAAAAAAAAACA8DgAAAAOTo+03//AOe8MN98MMAAAAD8IYCBAAgAAAAAAAAAggAAAACAAAAgAAAAABgAAAAgAAAASQAgQEkIAAABSgu+ZJfO/OPNONWOABABARfPgQAAAABAAAAACAAAAAAAAAAAAAQADAAAAAAAAAAAAAABAACXfcAAAAABzVhvsQfzsO/tMDKCAAACRBjYkAAAAAQAAAAAABAAACAAASAAAAAAgAAAAAAAAAAAgAABAjkPgAAAABBSx8380EFUwnPt9aAAAAhAD2F0QCAABAAACAAAAAAwAAAAhAAAAAAAAAAAAAAAAAAAARAQKBYAAAACAABzsV9BzlvwWdNAgAAQAAAADHakAAAAAACRAAABAAAQQAAAAAAAAAAAABABAAAAAAAgACDkOICAAAAAAAJVGcnuc+nWAyAAggACAiAS0F9QAQQAAAAABQAAAgAAAAAAAAgQgAABAAAAAAgAAAAACTcAAAgSACBBACavUTk8WGw3foAAAAAAAAgCb3AAAAAAAAAAAAAAAAAAAgAwAAAQAAQgAAQAAAAACAAYg0kAAQAQCgQADJ+++32AU0fCBgAAAAAggQAmt6ogAACAAAAACAgAAAABAQwAAAAQAwBAAAAAAAAABS1vyniSqBckywQhAanePCqt/AQAAggycbPQAm+s88xCAAAAAAACAAQAACAAgAAACAACQBgAAAAQAABCL5v8IZSaWjlTU1aGTcfuo51VQYBA20BwDabDeJbTIoABAAAAAAAABAAAAACAAwAABAAAAAAAAAAAAAAJElnT5UhssnZ62lKmAsljmHdCNZzY43QadZfRxbnOkBAABAAAABAAQAAABAAAAAAAAABAAAAACAAAAAARM+kx5PZ64rKlDUukClYhdF5ykzlPih/K8Qi2HkgAAAAAAAAAAABBAAAAQTABQAAAAAAAAQAAAAAAAADO139etMLlIYx1TSopoVNnzSkkf7RM0tff1viKQAAAAAAAABBAAAAAACAADAAA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";

  if (loading && offerings.length === 0)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "50px",
          color: "#7c3aed",
          fontWeight: "bold",
        }}
      >
        ⏳ {isRTL ? "جاري التحميل..." : "Loading..."}
      </div>
    );

  const isTimeOptional =
    selected &&
    (["fixed", "daily"].includes(selected.pricing_model) ||
      selected.price_upon_agreement);
  const isStoreMode = !!username;
  const storeTheme = storeProfile?.theme_color || "#7c3aed";

  const generateTimeOptions = () => {
    const options = [];
    const is24Hours = selected?.is_24_7;
    const startTimeStr = selected?.work_start_time;
    const endTimeStr = selected?.work_end_time;

    const addSlots = (start, end) => {
      for (let h = start; h < end; h++) {
        for (let m = 0; m < 60; m += 15) {
          options.push(
            `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          );
        }
      }
    };

    if (is24Hours) {
      addSlots(0, 24);
    } else if (startTimeStr && endTimeStr) {
      let startH = parseInt(startTimeStr.split(":")[0], 10);
      let endH = parseInt(endTimeStr.split(":")[0], 10);

      if (endH === 0) endH = 24;

      if (startH < endH) {
        addSlots(startH, endH);
      } else {
        addSlots(startH, 24);
        addSlots(0, endH);
      }
    } else {
      addSlots(0, 24);
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const disableOffDays = ({ date }) => {
    if (!selected) return;
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const activeDays =
      Array.isArray(selected.available_days) &&
      selected.available_days.length > 0
        ? selected.available_days
        : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const activeIndexes = activeDays.map((d) => dayMap[d]);

    if (!activeIndexes.includes(date.weekDay.index)) {
      return {
        disabled: true,
        style: {
          color: "#cbd5e1",
          textDecoration: "line-through",
          cursor: "not-allowed",
        },
      };
    }
  };

  return (
    <div style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (max-width: 768px) {
          .categories-mobile { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
        }
        .smart-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); top: 0; }
        .smart-card:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.08); }
        .search-container { position: relative; z-index: 10; margin-top: -35px; margin-bottom: 30px; }
        .rmdp-container { width: 100%; }
        .rmdp-input { width: 100% !important; padding: 12px !important; border-radius: 12px !important; border: 1px solid #cbd5e1 !important; font-family: inherit !important; font-size: 0.95rem !important; outline: none; box-sizing: border-box; background: #fff; cursor: pointer; color: #1e293b; font-weight: bold; }
        .rmdp-input::placeholder { color: #94a3b8; font-weight: normal; }
      `}</style>

      {isAnnouncementActive && announcementText && (
        <div
          style={{
            backgroundColor: "#f59e0b",
            color: "#fff",
            textAlign: "center",
            padding: "12px",
            fontSize: "1rem",
            fontWeight: "bold",
            position: "relative",
            zIndex: 100,
            borderRadius: "16px",
            marginBottom: "15px",
            boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)",
          }}
        >
          {announcementLink ? (
            <a
              href={announcementLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (isNativePlatform()) {
                  e.preventDefault();
                  openExternalUrl(announcementLink);
                }
              }}
              style={{ color: "#fff", textDecoration: "underline" }}
            >
              {announcementText} 🚀
            </a>
          ) : (
            <span>{announcementText}</span>
          )}
        </div>
      )}

      <div
        style={{
          ...heroSectionS,
          background: isStoreMode
            ? storeTheme
            : "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
          padding: isStoreMode ? "30px 20px 85px" : "40px 20px 85px",
        }}
      >
        <div
          style={{
            fontSize: "0.95rem",
            color: "rgba(255,255,255,0.9)",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
            fontWeight: "bold",
            backgroundColor: "rgba(0,0,0,0.15)",
            padding: "8px 20px",
            borderRadius: "20px",
            width: "fit-content",
            margin: "0 auto 20px auto",
            backdropFilter: "blur(5px)",
          }}
        >
          <span>🕒</span>
          <span dir="ltr">
            {liveTime.toLocaleTimeString(isRTL ? "ar-SA" : "en-US")}
          </span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span>
            {liveTime.toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {isStoreMode && storeProfile ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <img
              src={
                storeProfile.avatar_url ||
                defaultAvatar(storeProfile.full_name, storeTheme)
              }
              alt="Store Avatar"
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "50%",
                border: "4px solid white",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                objectFit: "cover",
              }}
            />
            <h1 style={{ ...heroTitleS, margin: "0" }}>
              {storeProfile.full_name || storeProfile.username}
            </h1>
            <span
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                padding: "4px 15px",
                borderRadius: "20px",
                fontSize: "1rem",
                fontWeight: "bold",
                letterSpacing: "1px",
              }}
            >
              @{storeProfile.username}
            </span>
            {storeProfile.provider_note && (
              <p
                style={{
                  maxWidth: "600px",
                  margin: "10px auto 0",
                  opacity: "0.9",
                  lineHeight: "1.5",
                }}
              >
                {storeProfile.provider_note}
              </p>
            )}
          </div>
        ) : (
          <>
            <h1 style={heroTitleS}>{welcomeMsg}</h1>
            <p style={heroSubTitleS}>{renderTextWithLinks(heroSubtitle)}</p>

            {(appleStoreLink || playStoreLink) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "15px",
                  marginTop: "25px",
                  flexWrap: "wrap",
                }}
              >
                {appleStoreLink && (
                  <a
                    href={appleStoreLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (isNativePlatform()) {
                        e.preventDefault();
                        openExternalUrl(appleStoreLink);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      backgroundColor: "#000",
                      color: "#fff",
                      padding: "10px 20px",
                      borderRadius: "14px",
                      textDecoration: "none",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                      transition: "0.2s",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>🍏</span> App Store
                  </a>
                )}
                {playStoreLink && (
                  <a
                    href={playStoreLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (isNativePlatform()) {
                        e.preventDefault();
                        openExternalUrl(playStoreLink);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      backgroundColor: "#fff",
                      color: "#000",
                      padding: "10px 20px",
                      borderRadius: "14px",
                      textDecoration: "none",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                      transition: "0.2s",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>▶️</span> Google Play
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="search-container" style={{ padding: "0 15px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            borderRadius: "20px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
            border: "1px solid #f1f5f9",
            overflow: "hidden",
          }}
        >
          {!isStoreMode && (
            <button
              onClick={() =>
                setActiveCategory(
                  activeCategory === "favorites" ? "all" : "favorites",
                )
              }
              style={{
                backgroundColor:
                  activeCategory === "favorites" ? "#fef2f2" : "transparent",
                color: activeCategory === "favorites" ? "#ef4444" : "#94a3b8",
                border: "none",
                padding: "0 20px",
                cursor: "pointer",
                fontSize: "1.4rem",
                transition: "0.2s",
                borderLeft: isRTL ? "1px solid #f1f5f9" : "none",
                borderRight: isRTL ? "none" : "1px solid #f1f5f9",
              }}
              title={isRTL ? "عرض مفضلتي" : "Show Favorites"}
            >
              {activeCategory === "favorites" ? "❤️" : "🤍"}
            </button>
          )}

          <div
            style={{
              flex: "2 1 200px",
              display: "flex",
              alignItems: "center",
              padding: "12px 20px",
              borderLeft: isRTL ? "1px solid #f1f5f9" : "none",
              borderRight: isRTL ? "none" : "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                fontSize: "1.2rem",
                margin: isRTL ? "0 0 0 10px" : "0 10px 0 0",
                color: isStoreMode ? storeTheme : "#7c3aed",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder={
                isStoreMode
                  ? `ابحث في خدمات ${storeProfile?.full_name || "المزود"}...`
                  : isRTL
                    ? "ابحث بالاسم، الخدمة، أو @يوزر المزود..."
                    : "Search..."
              }
              style={searchField}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
          </div>
          {!isStoreMode && (
            <div
              style={{
                flex: "1 1 120px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <select
                value={filterCountry}
                onChange={(e) => {
                  setFilterCountry(e.target.value);
                  setFilterCity("all");
                }}
                style={floatingSelectS(isRTL)}
              >
                <option value="all">
                  🌍 {t("filter_country", "كل الدول")}
                </option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isStoreMode && (
            <div
              style={{
                flex: "1 1 120px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                style={floatingSelectS(isRTL)}
              >
                <option value="all">🏙️ {t("filter_city", "كل المدن")}</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div
            style={{
              flex: "1.5 1 150px",
              display: "flex",
              alignItems: "center",
              padding: "8px 10px",
            }}
          >
            <SmartDatePicker
              calendar={gregorian}
              locale={isRTL ? gregorian_ar : undefined}
              value={filterDate}
              onChange={(date) => {
                if (!date) {
                  setFilterDate("");
                  return;
                }
                const jsDate = date.toDate();
                setFilterDate(
                  `${jsDate.getFullYear()}-${String(
                    jsDate.getMonth() + 1,
                  ).padStart(2, "0")}-${String(jsDate.getDate()).padStart(
                    2,
                    "0",
                  )}`,
                );
              }}
              minDate={new Date()}
              format="YYYY-MM-DD"
              placeholder={
                isRTL ? "تاريخ الحجز (اختياري) 📅" : "Date (Optional) 📅"
              }
              containerStyle={{ width: "100%" }}
              style={{
                border: "none",
                backgroundColor: "transparent",
                outline: "none",
                cursor: "pointer",
                color: "#475569",
                fontWeight: "bold",
                width: "100%",
              }}
            />
          </div>
          {(filterDate ||
            filterStartTime ||
            filterEndTime ||
            filterCountry !== "all" ||
            filterCity !== "all" ||
            localSearch ||
            activeCategory === "favorites") && (
            <button
              onClick={() => {
                setFilterDate("");
                setFilterStartTime("");
                setFilterEndTime("");
                setFilterCountry("all");
                setFilterCity("all");
                setLocalSearch("");
                setActiveCategory("all");
              }}
              style={{
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                border: "none",
                padding: "0 20px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "0.2s",
              }}
              title="مسح الفلاتر"
            >
              ✖ مسح
            </button>
          )}
        </div>
      </div>

      {!isStoreMode && (
        <div
          className="hide-scrollbar categories-mobile"
          style={categoryScrollWrapperS}
        >
          {displayCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  ...catBtnS,
                  backgroundColor: isActive ? "#1e293b" : "#f8fafc",
                  color: isActive ? "#fff" : "#475569",
                  border: isActive ? "1px solid #1e293b" : "1px solid #e2e8f0",
                  boxShadow: isActive
                    ? "0 4px 10px rgba(30, 41, 59, 0.2)"
                    : "none",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{cat.icon}</span>{" "}
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {(filterDate || filterStartTime || filterEndTime) && (
        <div style={searchAlertS}>
          ✅{" "}
          {isRTL
            ? `نعرض لك فقط الخدمات المتاحة ${
                filterDate ? `يوم (${filterDate})` : ""
              } ${filterStartTime ? `من (${filterStartTime})` : ""} ${
                filterEndTime ? `إلى (${filterEndTime})` : ""
              }`
            : "Showing available providers for selected date/time."}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "25px",
          alignItems: "stretch",
        }}
      >
        {filtered.length > 0 ? (
          filtered.map((item, index) => {
            const isFree = item.pricing_model === "free";
            const isAgreement = item.price_upon_agreement;
            const itemThemeColor = item.profiles?.theme_color || "#7c3aed";
            const isLastElement = filtered.length === index + 1;

            let durationText =
              item.duration ||
              item.duration_details ||
              item.work_duration ||
              item.period ||
              item.time_details;
            if (durationText) {
              durationText = durationText.replace("(دوام كامل)", "").trim();
            }

            return (
              <div
                ref={isLastElement ? lastElementRef : null}
                key={`${item.id}-${index}`}
                className="smart-card"
                style={smartCardS}
              >
                <div style={cardCoverS(isFree, itemThemeColor)}>
                  <button
                    onClick={(e) => toggleFavorite(e, item.provider_id)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: isRTL ? "auto" : "10px",
                      left: isRTL ? "10px" : "auto",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      border: "none",
                      borderRadius: "50%",
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      cursor: "pointer",
                      zIndex: 20,
                      boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                      transition: "0.2s",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1.2rem",
                        transform: favorites.includes(item.provider_id)
                          ? "scale(1.1)"
                          : "scale(1)",
                      }}
                    >
                      {favorites.includes(item.provider_id) ? "❤️" : "🤍"}
                    </span>
                  </button>

                  <div
                    style={{
                      display: "flex",
                      gap: "5px",
                      padding: "12px",
                      flexWrap: "wrap",
                      width: "80%",
                    }}
                  >
                    {item.profiles?.provider_type === "institution" && (
                      <span style={coverBadgeS("#1e293b", "#fff")}>
                        🏢 فريق عمل / مجموعة
                      </span>
                    )}
                    {(item.license_number || item.profiles?.license_info) && (
                      <span style={coverBadgeS("#ecfdf5", "#059669")}>
                        🛡️ {t("verified", "موثق")}
                      </span>
                    )}
                  </div>
                </div>

                <div style={cardBodyS}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginTop: "-45px",
                      marginBottom: "10px",
                      position: "relative",
                      zIndex: 10,
                    }}
                  >
                    <img
                      src={
                        item.profiles?.avatar_url ||
                        defaultAvatar(item.profiles?.full_name, itemThemeColor)
                      }
                      style={{ ...cardAvatarS, borderColor: itemThemeColor }}
                      alt="avatar"
                    />
                    <div
                      style={{
                        marginTop: "40px",
                        fontSize: "0.85rem",
                        color: "#f59e0b",
                        fontWeight: "900",
                        backgroundColor: "#fffbeb",
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      {renderStars(item.profiles?.rating)}
                    </div>
                  </div>

                  {!isStoreMode && (
                    <div
                      style={{
                        marginBottom: "12px",
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "#475569",
                          fontWeight: "bold",
                        }}
                      >
                        {item.nickname ||
                          item.provider_name ||
                          item.profiles?.full_name}
                      </span>
                      {item.profiles?.username && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: itemThemeColor,
                            backgroundColor: `${itemThemeColor}15`,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            direction: "ltr",
                            fontWeight: "bold",
                          }}
                        >
                          @{item.profiles.username}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      flex: 1,
                      width: "100%",
                    }}
                  >
                    {item.provider_role && (
                      <div
                        style={{
                          backgroundColor: "#f1f5f9",
                          color: "#3b82f6",
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          marginBottom: "10px",
                        }}
                      >
                        👨‍💼 {item.provider_role}
                      </div>
                    )}

                    <h3
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "1.1rem",
                        color: "#1e293b",
                        fontWeight: "900",
                        lineHeight: "1.4",
                        width: "100%",
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        ...cardDescriptionS,
                        textAlign: "center",
                        width: "100%",
                      }}
                      title={item.description}
                    >
                      {item.description}
                    </p>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#94a3b8",
                        marginTop: "auto",
                        marginBottom: "15px",
                        fontWeight: "bold",
                      }}
                    >
                      📍 {item.country || "-"}, {item.city || "-"}
                    </div>

                    {(item.whatsapp_number ||
                      item.instagram_url ||
                      item.twitter_url ||
                      item.tiktok_url ||
                      item.snapchat_url ||
                      item.youtube_url) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          justifyContent: "center",
                          marginBottom: "15px",
                          borderTop: "1px dashed #f1f5f9",
                          paddingTop: "12px",
                          width: "100%",
                        }}
                      >
                        {item.whatsapp_number && (
                          <a
                            href={`https://wa.me/${item.whatsapp_number.replace(
                              /\D/g,
                              "",
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={socialLinkS}
                            title="تواصل عبر الواتساب"
                          >
                            <img
                              src="https://cdn.simpleicons.org/whatsapp/25D366"
                              alt="WhatsApp"
                              width="20"
                              height="20"
                            />
                          </a>
                        )}
                        {item.instagram_url && (
                          <a
                            href={item.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={socialLinkS}
                            title="انستقرام"
                          >
                            <img
                              src="https://cdn.simpleicons.org/instagram/E1306C"
                              alt="Instagram"
                              width="20"
                              height="20"
                            />
                          </a>
                        )}
                        {item.snapchat_url && (
                          <a
                            href={item.snapchat_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={socialLinkS}
                            title="سناب شات"
                          >
                            <img
                              src="https://cdn.simpleicons.org/snapchat/eab308"
                              alt="Snapchat"
                              width="20"
                              height="20"
                            />
                          </a>
                        )}
                        {item.tiktok_url && (
                          <a
                            href={item.tiktok_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={socialLinkS}
                            title="تيك توك"
                          >
                            <img
                              src="https://cdn.simpleicons.org/tiktok/000000"
                              alt="TikTok"
                              width="18"
                              height="18"
                            />
                          </a>
                        )}
                        {item.twitter_url && (
                          <a
                            href={item.twitter_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={socialLinkS}
                            title="تويتر (X)"
                          >
                            <img
                              src="https://cdn.simpleicons.org/x/000000"
                              alt="X"
                              width="18"
                              height="18"
                            />
                          </a>
                        )}
                        {item.youtube_url && (
                          <a
                            href={item.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={socialLinkS}
                            title="يوتيوب"
                          >
                            <img
                              src="https://cdn.simpleicons.org/youtube/FF0000"
                              alt="YouTube"
                              width="22"
                              height="22"
                            />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={cardFooterS}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        maxWidth: "160px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "900",
                          fontSize: isAgreement ? "0.95rem" : "1.25rem",
                          color: isAgreement
                            ? "#3b82f6"
                            : isFree
                              ? "#10b981"
                              : itemThemeColor,
                          lineHeight: "1.1",
                        }}
                      >
                        {isAgreement
                          ? "حسب الاتفاق 🤝"
                          : isFree
                            ? "مجاني (تطوع) 💚"
                            : `${item.price} ${item.currency || "SAR"}`}
                      </span>

                      <div style={{ marginTop: "4px", lineHeight: "1.4" }}>
                        {!isAgreement && !isFree && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#475569",
                              fontWeight: "900",
                              display: "block",
                            }}
                          >
                            {item.provider_role ? `${item.provider_role} ` : ""}
                            {modelLabels[item.pricing_model || "fixed"]}
                          </span>
                        )}

                        {durationText && (
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: itemThemeColor,
                              fontWeight: "bold",
                              display: "block",
                              marginTop: "4px",
                            }}
                          >
                            {durationText}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      {session && session.user.id === item.provider_id && (
                        <button
                          onClick={() => {
                            setIsSpecialManualBooking(true);
                            setSelected(item);
                          }}
                          style={{
                            border: "1px solid #a7f3d0",
                            background: "#f0fdf4",
                            color: "#059669",
                            padding: "8px 12px",
                            borderRadius: "12px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.8rem",
                            transition: "0.2s",
                          }}
                          title="تسجيل حجز هاتفي أو خارجي بدون عمولة"
                        >
                          📞 حجز خاص
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsSpecialManualBooking(false);
                          setSelected(item);
                        }}
                        style={{
                          ...smartBookBtnS,
                          backgroundColor: itemThemeColor,
                        }}
                      >
                        {t("view_book", "احجز الآن")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={noResultsS}>
            <div style={{ fontSize: "3rem", marginBottom: "15px" }}>
              {isStoreMode ? "🛒" : "🕵️‍♂️"}
            </div>
            {isRTL
              ? isStoreMode
                ? "لا توجد خدمات متاحة حالياً في هذا المتجر.."
                : "لم نجد خدمات تطابق بحثك حالياً.."
              : "No services found.."}
          </div>
        )}
      </div>

      {isFetchingMore && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "#64748b",
            fontWeight: "bold",
            width: "100%",
            marginTop: "20px",
          }}
        >
          جاري تحميل المزيد... ⏳
        </div>
      )}

      {selected && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: "10px",
              }}
            >
              {isSpecialManualBooking && (
                <span
                  style={{
                    backgroundColor: "#ecfdf5",
                    color: "#059669",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                  }}
                >
                  📞 وضع الحجز الخاص (خارجي / هاتفي - بدون عمولة)
                </span>
              )}
              <button
                onClick={() => {
                  setSelected(null);
                  setIsSpecialManualBooking(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#94a3b8",
                  transition: "0.2s",
                }}
              >
                ✖
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: "15px",
                alignItems: "flex-start",
                marginBottom: "15px",
                borderBottom: "1px solid #f1f5f9",
                paddingBottom: "15px",
              }}
            >
              <img
                src={
                  selected.profiles?.avatar_url ||
                  defaultAvatar(
                    selected.profiles?.full_name,
                    selected.profiles?.theme_color || "#7c3aed",
                  )
                }
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid ${
                    selected.profiles?.theme_color || "#7c3aed"
                  }`,
                }}
                alt="avatar"
              />
              <div style={{ flex: 1, textAlign: isRTL ? "right" : "left" }}>
                <h3
                  style={{
                    margin: "0 0 5px 0",
                    color: "#1e293b",
                    fontSize: "1.2rem",
                    fontWeight: "900",
                  }}
                >
                  {selected.nickname ||
                    selected.provider_name ||
                    selected.profiles?.full_name}
                </h3>
                {selected.profiles?.username && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: selected.profiles?.theme_color || "#7c3aed",
                      fontWeight: "bold",
                      direction: "ltr",
                      display: "inline-block",
                      backgroundColor: `${
                        selected.profiles?.theme_color || "#7c3aed"
                      }15`,
                      padding: "2px 8px",
                      borderRadius: "10px",
                      marginBottom: "8px",
                    }}
                  >
                    @{selected.profiles.username}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#f59e0b",
                    fontWeight: "bold",
                  }}
                >
                  {renderStars(selected.profiles?.rating)}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                marginBottom: "20px",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {selected.provider_role && (
                <div
                  style={{
                    marginBottom: "15px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "#1e293b",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "10px",
                      fontSize: "0.9rem",
                      fontWeight: "bold",
                    }}
                  >
                    💼 مقدم الخدمة: {selected.provider_role}
                  </span>
                </div>
              )}
              <h4
                style={{
                  margin: "0 0 8px 0",
                  color: selected.profiles?.theme_color || "#7c3aed",
                  fontSize: "1.1rem",
                  fontWeight: "900",
                }}
              >
                📌 {selected.title}
              </h4>
              <p
                style={{
                  margin: "0 0 15px 0",
                  fontSize: "0.9rem",
                  color: "#475569",
                  lineHeight: "1.6",
                }}
              >
                {selected.description}
              </p>
              <div
                style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "12px" }}
              >
                <strong
                  style={{
                    fontSize: "0.85rem",
                    color: "#1e293b",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  🕒 أوقات الدوام المتاحة:
                </strong>
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                    marginBottom: "10px",
                  }}
                >
                  {(Array.isArray(selected.available_days) &&
                  selected.available_days.length > 0
                    ? selected.available_days
                    : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
                  ).map((dayId) => (
                    <span
                      key={dayId}
                      style={{
                        backgroundColor: "#e0e7ff",
                        color: "#4338ca",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                      }}
                    >
                      {dayLabels[dayId] || dayId}
                    </span>
                  ))}
                </div>
                {selected.is_24_7 ? (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#059669",
                      backgroundColor: "#ecfdf5",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontWeight: "bold",
                    }}
                  >
                    متاح 24 ساعة 🟢
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "#d97706",
                      backgroundColor: "#fffbeb",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontWeight: "bold",
                    }}
                  >
                    من {selected.work_start_time?.substring(0, 5)} إلى{" "}
                    {selected.work_end_time?.substring(0, 5)}
                  </span>
                )}
              </div>
            </div>

            {(selected.whatsapp_number ||
              selected.instagram_url ||
              selected.twitter_url ||
              selected.tiktok_url ||
              selected.snapchat_url ||
              selected.youtube_url) && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "20px",
                  justifyContent: isRTL ? "flex-start" : "flex-end",
                }}
              >
                {selected.whatsapp_number && (
                  <a
                    href={`https://wa.me/${selected.whatsapp_number.replace(
                      /\D/g,
                      "",
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={socialLinkS}
                    title="تواصل عبر الواتساب"
                  >
                    <img
                      src="https://cdn.simpleicons.org/whatsapp/25D366"
                      alt="WhatsApp"
                      width="20"
                      height="20"
                    />
                  </a>
                )}
                {selected.instagram_url && (
                  <a
                    href={selected.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={socialLinkS}
                    title="انستقرام"
                  >
                    <img
                      src="https://cdn.simpleicons.org/instagram/E1306C"
                      alt="Instagram"
                      width="20"
                      height="20"
                    />
                  </a>
                )}
                {selected.snapchat_url && (
                  <a
                    href={selected.snapchat_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={socialLinkS}
                    title="سناب شات"
                  >
                    <img
                      src="https://cdn.simpleicons.org/snapchat/eab308"
                      alt="Snapchat"
                      width="20"
                      height="20"
                    />
                  </a>
                )}
                {selected.tiktok_url && (
                  <a
                    href={selected.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={socialLinkS}
                    title="تيك توك"
                  >
                    <img
                      src="https://cdn.simpleicons.org/tiktok/000000"
                      alt="TikTok"
                      width="18"
                      height="18"
                    />
                  </a>
                )}
                {selected.twitter_url && (
                  <a
                    href={selected.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={socialLinkS}
                    title="تويتر (X)"
                  >
                    <img
                      src="https://cdn.simpleicons.org/x/000000"
                      alt="X"
                      width="18"
                      height="18"
                    />
                  </a>
                )}
                {selected.youtube_url && (
                  <a
                    href={selected.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={socialLinkS}
                    title="يوتيوب"
                  >
                    <img
                      src="https://cdn.simpleicons.org/youtube/FF0000"
                      alt="YouTube"
                      width="22"
                      height="22"
                    />
                  </a>
                )}
              </div>
            )}

            <h4
              style={{
                color: "#1e293b",
                marginBottom: "15px",
                fontSize: "1.1rem",
                textAlign: isRTL ? "right" : "left",
                fontWeight: "900",
              }}
            >
              📝 نموذج الحجز المباشر:
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                marginBottom: "20px",
              }}
            >
              <div style={{ textAlign: isRTL ? "right" : "left" }}>
                <label style={labelS}>
                  {isRTL ? "رقم الجوال للتواصل:" : "Contact Number:"}
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                  style={{
                    ...inputS,
                    textAlign: "left",
                    border: "2px solid #bfdbfe",
                    backgroundColor: "#eff6ff",
                  }}
                  value={bookingData.clientContact}
                  onChange={(e) =>
                    setBookingData({
                      ...bookingData,
                      clientContact: e.target.value,
                    })
                  }
                />
              </div>
              <div style={{ textAlign: isRTL ? "right" : "left" }}>
                <label style={labelS}>
                  {isRTL ? "الموقع (كتابة أو GPS):" : "Location:"}
                </label>
                <input
                  type="text"
                  placeholder={
                    isRTL ? "اسم الحي، القاعة، أو رابط.." : "Location details.."
                  }
                  style={{ ...inputS, marginBottom: "8px" }}
                  value={bookingData.manualLocation}
                  onChange={(e) =>
                    setBookingData({
                      ...bookingData,
                      manualLocation: e.target.value,
                      gpsLocation: "",
                    })
                  }
                />
                {bookingData.gpsLocation ? (
                  <div style={locOk}>
                    {isRTL
                      ? "تم التقاط الموقع بنجاح ✅"
                      : "Location captured ✅"}
                  </div>
                ) : (
                  <button onClick={handleGetLocation} style={gpsBtn}>
                    📍 {isRTL ? "استخدام موقعي الحالي" : "Use current location"}
                  </button>
                )}
              </div>

              <div style={{ textAlign: isRTL ? "right" : "left" }}>
                <label style={labelS}>
                  {isRTL
                    ? "رسالة أو ملاحظة لمزود الخدمة (اختياري):"
                    : "Message to Provider (Optional):"}
                </label>
                <textarea
                  placeholder={
                    isRTL
                      ? "اكتب استفسارك أو تفاصيل إضافية لطلبك هنا..."
                      : "Write your inquiry or extra details..."
                  }
                  style={{
                    ...inputS,
                    resize: "vertical",
                    minHeight: "80px",
                    backgroundColor: "#f8fafc",
                  }}
                  value={bookingData.clientMessage}
                  onChange={(e) =>
                    setBookingData({
                      ...bookingData,
                      clientMessage: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                marginBottom: "25px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <label
                  style={{
                    ...labelS,
                    color: "#1e293b",
                    fontSize: "1rem",
                    margin: 0,
                  }}
                >
                  🗓️ فترة الحجز:
                </label>
                <button
                  type="button"
                  onClick={handleSuggestNextSlot}
                  style={{
                    backgroundColor:
                      selected.profiles?.theme_color || "#7c3aed",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "10px",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  ✨ اقتراح موعد
                </button>
              </div>

              <div
                style={{
                  marginBottom: "15px",
                  backgroundColor: "#fff",
                  padding: "15px",
                  borderRadius: "12px",
                  border: "1px dashed #3b82f6",
                }}
              >
                <label
                  style={{ ...labelS, color: "#1d4ed8", fontSize: "0.95rem" }}
                >
                  👥 العدد المطلوب من (
                  {selected.provider_role || "مقدمي الخدمة"}):
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginTop: "8px",
                  }}
                >
                  <input
                    type="number"
                    min="1"
                    max={
                      availableCapacity !== null
                        ? availableCapacity
                        : selected.max_capacity || 1
                    }
                    disabled={availableCapacity === 0}
                    value={bookingData.manualQuantity}
                    onChange={(e) => {
                      let val = parseInt(e.target.value) || 1;
                      const currentMax =
                        availableCapacity !== null
                          ? availableCapacity
                          : selected.max_capacity || 1;
                      if (val > currentMax) val = currentMax;
                      setBookingData({ ...bookingData, manualQuantity: val });
                    }}
                    style={{
                      ...inputS,
                      flex: 1,
                      borderColor:
                        availableCapacity === 0 ? "#fca5a5" : "#bfdbfe",
                      backgroundColor:
                        availableCapacity === 0 ? "#fef2f2" : "#fff",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: availableCapacity === 0 ? "#ef4444" : "#059669",
                      fontWeight: "bold",
                    }}
                  >
                    (المتاح مؤكداً:{" "}
                    {availableCapacity !== null
                      ? availableCapacity
                      : selected.max_capacity || 1}
                    )
                  </span>
                </div>
                {availableCapacity === 0 && (
                  <div
                    style={{
                      color: "#ef4444",
                      fontSize: "0.8rem",
                      marginTop: "8px",
                      fontWeight: "bold",
                    }}
                  >
                    ⚠️ نعتذر، السعة محجوزة بالكامل ومؤكدة في هذا الوقت. يرجى
                    اختيار تاريخ أو وقت آخر.
                  </div>
                )}
              </div>

              <div
                style={{ display: "flex", gap: "12px", marginBottom: "15px" }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{ ...labelS, color: "#64748b", fontSize: "0.8rem" }}
                  >
                    تاريخ (البدء):
                  </label>
                  <SmartDatePicker
                    calendar={gregorian}
                    locale={isRTL ? gregorian_ar : undefined}
                    value={bookingData.startDate}
                    onChange={(date) => {
                      if (!date) {
                        setBookingData({ ...bookingData, startDate: "" });
                        return;
                      }
                      const jsDate = date.toDate();
                      const start = `${jsDate.getFullYear()}-${String(
                        jsDate.getMonth() + 1,
                      ).padStart(2, "0")}-${String(jsDate.getDate()).padStart(
                        2,
                        "0",
                      )}`;
                      setBookingData({ ...bookingData, startDate: start });
                    }}
                    minDate={new Date()}
                    mapDays={disableOffDays}
                    placeholder="اختر تاريخ البدء 📅"
                    containerStyle={{ width: "100%" }}
                    inputClass="rmdp-input"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{ ...labelS, color: "#64748b", fontSize: "0.8rem" }}
                  >
                    تاريخ (الانتهاء):
                  </label>
                  <SmartDatePicker
                    calendar={gregorian}
                    locale={isRTL ? gregorian_ar : undefined}
                    value={bookingData.endDate}
                    onChange={(date) => {
                      if (!date) {
                        setBookingData({ ...bookingData, endDate: "" });
                        return;
                      }
                      const jsDate = date.toDate();
                      const end = `${jsDate.getFullYear()}-${String(
                        jsDate.getMonth() + 1,
                      ).padStart(2, "0")}-${String(jsDate.getDate()).padStart(
                        2,
                        "0",
                      )}`;
                      setBookingData({ ...bookingData, endDate: end });
                    }}
                    minDate={
                      bookingData.startDate
                        ? new Date(bookingData.startDate)
                        : new Date()
                    }
                    mapDays={disableOffDays}
                    placeholder="اختر تاريخ الانتهاء 📅"
                    containerStyle={{ width: "100%" }}
                    inputClass="rmdp-input"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{ ...labelS, color: "#64748b", fontSize: "0.8rem" }}
                  >
                    الوقت (البدء) {isTimeOptional && "(اختياري)"}:
                  </label>
                  <select
                    required={!isTimeOptional}
                    value={bookingData.startTime || ""}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        startTime: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      textAlign: "center",
                      direction: "ltr",
                      outline: "none",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    <option value="" disabled={!isTimeOptional}>
                      {isTimeOptional
                        ? isRTL
                          ? "-- وقت غير محدد --"
                          : "-- No Specific Time --"
                        : isRTL
                          ? "اختر وقت البدء"
                          : "Select Start Time"}
                    </option>
                    {timeOptions.map((time) => (
                      <option key={`start-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{ ...labelS, color: "#64748b", fontSize: "0.8rem" }}
                  >
                    الوقت (الانتهاء) {isTimeOptional && "(اختياري)"}:
                  </label>
                  <select
                    required={!isTimeOptional}
                    value={bookingData.endTime || ""}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        endTime: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      textAlign: "center",
                      direction: "ltr",
                      outline: "none",
                      backgroundColor: "white",
                      cursor: "pointer",
                    }}
                  >
                    <option value="" disabled={!isTimeOptional}>
                      {isTimeOptional
                        ? isRTL
                          ? "-- وقت غير محدد --"
                          : "-- No Specific Time --"
                        : isRTL
                          ? "اختر وقت الانتهاء"
                          : "Select End Time"}
                    </option>
                    {timeOptions.map((time) => (
                      <option key={`end-${time}`} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: selected.price_upon_agreement
                  ? "#f0fdf4"
                  : "#f8fafc",
                padding: "18px",
                borderRadius: "16px",
                border: `1px dashed ${
                  selected.price_upon_agreement
                    ? "#10b981"
                    : selected.profiles?.theme_color || "#7c3aed"
                }`,
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              {selected.price_upon_agreement ? (
                <span
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "900",
                    color: "#059669",
                  }}
                >
                  🤝 سيتم تحديد السعر لاحقاً من قبل المزود (حسب الاتفاق)
                </span>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      color: "#475569",
                      fontWeight: "bold",
                      marginBottom: "10px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                      direction: "rtl",
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: "#e2e8f0",
                        padding: "4px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {selected.price} {selected.currency || "SAR"}
                    </span>{" "}
                    ×
                    <span
                      style={{
                        backgroundColor: "#e2e8f0",
                        padding: "4px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {calculatedData.timeMultiplier} ({calculatedData.text})
                    </span>{" "}
                    ×
                    <span
                      style={{
                        backgroundColor: "#e2e8f0",
                        padding: "4px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {calculatedData.requestedCount} (مطلوب)
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "900",
                      color:
                        selected.pricing_model === "free"
                          ? "#10b981"
                          : selected.profiles?.theme_color || "#7c3aed",
                    }}
                  >
                    {selected.pricing_model === "free"
                      ? `${t("free")} 💚`
                      : `الإجمالي = ${calculatedData.price} SAR`}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={handleBook}
              disabled={isSubmitting || availableCapacity === 0}
              style={{
                ...confirmBtn,
                backgroundColor:
                  isSubmitting || availableCapacity === 0
                    ? "#94a3b8"
                    : selected.profiles?.theme_color || "#7c3aed",
                cursor:
                  isSubmitting || availableCapacity === 0
                    ? "not-allowed"
                    : "pointer",
                boxShadow: `0 4px 15px ${
                  selected.profiles?.theme_color || "#7c3aed"
                }40`,
                opacity: isSubmitting || availableCapacity === 0 ? 0.8 : 1,
              }}
            >
              {isSubmitting
                ? "⏳ جاري إرسال الطلب..."
                : availableCapacity === 0
                  ? "عذراً، محجوز بالكامل في هذا الوقت ⛔"
                  : isSpecialManualBooking
                    ? "تأكيد وإضافة الحجز الخاص فوراً ✅"
                    : selected.price_upon_agreement
                      ? "إرسال طلب تسعير للمزود 📨"
                      : isRTL
                        ? "تأكيد وإرسال الطلب ✅"
                        : "Confirm Booking ✅"}
            </button>

            {reviews && reviews.length > 0 && (
              <div
                style={{
                  marginTop: "30px",
                  borderTop: "2px dashed #e2e8f0",
                  paddingTop: "20px",
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                <h4
                  style={{
                    color: "#1e293b",
                    marginBottom: "15px",
                    fontSize: "1.1rem",
                    fontWeight: "900",
                  }}
                >
                  ⭐️ آراء العملاء السابقين:
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {reviews.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "#f8fafc",
                        padding: "15px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                          alignItems: "center",
                        }}
                      >
                        <strong
                          style={{ color: "#334155", fontSize: "0.9rem" }}
                        >
                          👤 {r.profiles?.full_name || "عميل"}
                        </strong>
                        <span
                          style={{
                            color: "#f59e0b",
                            fontWeight: "bold",
                            fontSize: "0.85rem",
                          }}
                        >
                          {"⭐".repeat(r.rating || 5)}
                        </span>
                      </div>
                      {(r.review || r.review_text || r.client_review) && (
                        <p
                          style={{
                            margin: 0,
                            color: "#64748b",
                            fontSize: "0.85rem",
                            lineHeight: "1.6",
                          }}
                        >
                          💬 {r.review || r.review_text || r.client_review}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const heroSectionS = {
  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  padding: "55px 20px 85px",
  borderRadius: "24px",
  textAlign: "center",
  color: "#ffffff",
  boxShadow: "0 10px 30px rgba(109, 40, 217, 0.25)",
  marginTop: "25px",
};
const heroTitleS = {
  fontSize: "2.4rem",
  color: "#ffffff",
  margin: "0 0 18px 0",
  fontWeight: "900",
  lineHeight: "1.4",
  textShadow: "0 2px 10px rgba(0,0,0,0.15)",
};
const heroSubTitleS = {
  fontSize: "1.15rem",
  color: "#f1f5f9",
  opacity: "0.95",
  margin: 0,
  lineHeight: "1.6",
  fontWeight: "500",
};
const searchField = {
  border: "none",
  outline: "none",
  width: "100%",
  background: "transparent",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  fontWeight: "bold",
  color: "#1e293b",
};
const floatingSelectS = (isRTL) => ({
  width: "100%",
  padding: "12px",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  color: "#475569",
  fontWeight: "bold",
  fontSize: "0.85rem",
  borderRight: isRTL ? "none" : "1px solid #f1f5f9",
  borderLeft: isRTL ? "1px solid #f1f5f9" : "none",
  cursor: "pointer",
});
const categoryScrollWrapperS = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-start",
  gap: "12px",
  padding: "10px 5px 15px",
  marginBottom: "20px",
};
const catBtnS = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 20px",
  borderRadius: "25px",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "0.9rem",
  whiteSpace: "nowrap",
  transition: "all 0.2s ease",
};
const smartCardS = {
  display: "flex",
  flexDirection: "column",
  borderRadius: "20px",
  overflow: "hidden",
  boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
  backgroundColor: "#fff",
  border: "1px solid #f1f5f9",
};
const cardCoverS = (isFree, themeColor) => ({
  height: "90px",
  background: isFree
    ? "linear-gradient(135deg, #a7f3d0, #10b981)"
    : `linear-gradient(135deg, ${themeColor}, ${themeColor})`,
  position: "relative",
});
const coverBadgeS = (bg, color) => ({
  backgroundColor: bg,
  color: color,
  padding: "4px 10px",
  borderRadius: "12px",
  fontSize: "0.7rem",
  fontWeight: "bold",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
});
const cardBodyS = {
  padding: "0 20px 20px",
  display: "flex",
  flexDirection: "column",
  flex: 1,
};
const cardAvatarS = {
  width: "70px",
  height: "70px",
  borderRadius: "50%",
  border: "4px solid #fff",
  backgroundColor: "#fff",
  objectFit: "cover",
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
};
const cardDescriptionS = {
  margin: "0 0 15px 0",
  fontSize: "0.85rem",
  color: "#64748b",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  lineHeight: "1.6",
};
const cardFooterS = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  borderTop: "1px solid #f1f5f9",
  paddingTop: "15px",
};
const smartBookBtnS = {
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: "12px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "bold",
  transition: "0.2s",
};
const searchAlertS = {
  marginBottom: "20px",
  fontSize: "0.9rem",
  color: "#059669",
  backgroundColor: "#ecfdf5",
  padding: "12px 20px",
  borderRadius: "12px",
  border: "1px dashed #10b981",
  fontWeight: "bold",
};
const noResultsS = {
  gridColumn: "1 / -1",
  textAlign: "center",
  padding: "60px 20px",
  color: "#64748b",
  backgroundColor: "#f8fafc",
  borderRadius: "20px",
  border: "2px dashed #cbd5e1",
  fontWeight: "bold",
};
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
  backgroundColor: "#fff",
  padding: "30px",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "500px",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
};
const labelS = {
  display: "block",
  fontSize: "0.85rem",
  color: "#475569",
  marginBottom: "8px",
  fontWeight: "bold",
};
const inputS = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  outline: "none",
  boxSizing: "border-box",
  fontSize: "0.95rem",
  fontFamily: "inherit",
};
const confirmBtn = {
  width: "100%",
  color: "white",
  border: "none",
  padding: "16px",
  borderRadius: "16px",
  fontWeight: "900",
  fontSize: "1.1rem",
  transition: "0.3s",
};
const gpsBtn = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px dashed #3b82f6",
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "0.9rem",
};
const locOk = {
  padding: "12px",
  backgroundColor: "#ecfdf5",
  border: "1px solid #10b981",
  borderRadius: "12px",
  textAlign: "center",
  color: "#059669",
  fontWeight: "bold",
  fontSize: "0.9rem",
};

const socialLinkS = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  backgroundColor: "#fff",
  textDecoration: "none",
  transition: "0.2s",
  border: "1px solid #e2e8f0",
  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
};
