import { supabase } from "../lib/supabase";

// Reads live services from Supabase (service_categories + services). Returns
// null (not an empty array) on any failure or misconfiguration so callers can
// fall back to the existing static catalogue instead of showing "no services".
export async function listServices() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, description, image, base_price, active")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) return null;
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || "",
      price: Number(row.base_price) || 0,
      image: row.image || null,
      active: true,
    }));
  } catch (error) {
    console.warn("[HOMEFIX] Dynamic service catalogue unavailable, using built-in list:", error.message);
    return null;
  }
}
