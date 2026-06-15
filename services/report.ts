// services/report.ts
import api from "./apiClient";

export type ReportCategory =
  | "stage_queue"
  | "accident"
  | "police_check"
  | "flooded_route"
  | "fare_hike"
  | "traffic_jam"
  | "road_blocked"
  | "breakdown"
  | "security";

export interface TransitReport {
  id:         string;
  type:       ReportCategory;
  lat:        number;
  lng:        number;
  upvotes:    number;
  downvotes:  number;
  created_at: string;
  expires_at: string;
  reporter:   { name: string; level: string } | null;
}

export const ReportService = {
  async getReportsInViewport(
    north: number,
    south: number,
    east: number,
    west: number
  ): Promise<TransitReport[]> {
    const { data } = await api.get<{ data: TransitReport[] }>("/reports/viewport", {
      params: { north, south, east, west },
    });
    console.info(`Fetched ${data.data.length} reports in viewport`);
    return data.data;
  },

  async createReport(lat: number, lng: number, type: ReportCategory): Promise<void> {
    await api.post("/reports", { lat, lng, type });
  },

  async voteReport(
    id: string,
    vote: "up" | "down"
  ): Promise<{ upvotes: number; downvotes: number }> {
    const { data } = await api.post<{ data: { upvotes: number; downvotes: number } }>(
      `/reports/${id}/vote`,
      { vote }
    );
    return data.data;
  },
};
