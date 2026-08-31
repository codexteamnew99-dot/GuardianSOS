export type SosStatus = "ACTIVE" | "RESOLVED";
export type GuardianStatus = "PENDING" | "ACCEPTED" | "REMOVED";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
};

export type Guardian = {
  id: string;
  owner_id: string;
  guardian_user_id: string | null;
  invite_email: string | null;
  invite_phone: string | null;
  relationship: string | null;
  status: GuardianStatus;
  created_at: string;
  accepted_at: string | null;
  owner?: Profile | null;
  guardian?: Profile | null;
};

export type SosEvent = {
  id: string;
  user_id: string;
  status: SosStatus;
  started_at: string;
  resolved_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
};

export type LocationRow = {
  id: string;
  sos_event_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
};

export type EmergencyContact = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
};
