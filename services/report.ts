// services/report.ts
import api from "./apiClient";

export type ReportCategory = 
  | "stage_queue" 
  | "accident" 
  | "police_check" 
  | "flooded_route" 
  | "fare_hike";

export interface TransitReport {
  id: string;
  type: ReportCategory;
  lat: number;
  lng: number;
  upvotes: number;
  expires_at: string;
}

export const ReportService = {
  /**
   * Fetches active crowdsourced reports within the user's visible map boundaries.
   */
  async getReportsInViewport(
    north: number,
    south: number,
    east: number,
    west: number
  ): Promise<TransitReport[]> {
    const { data } = await api.get<{ data: TransitReport[] }>("/reports/viewport", {
      params: { north, south, east, west },
    });
    return data.data;
  },

  /**
   * Submits a new crowdsourced report at a specific location.
   */
  async createReport(
    lat: number,
    lng: number,
    type: ReportCategory
  ): Promise<void> {
    await api.post("/reports", { lat, lng, type });
  },
};