import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isNative = Capacitor.isNativePlatform();

const storageAdapter = isNative
  ? {
      async getItem(key) {
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key });
        return value;
      },
      async setItem(key, value) {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.set({ key, value });
      },
      async removeItem(key) {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.remove({ key });
      },
    }
  : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: !isNative,
    ...(storageAdapter ? { storage: storageAdapter } : {}),
  },
});
