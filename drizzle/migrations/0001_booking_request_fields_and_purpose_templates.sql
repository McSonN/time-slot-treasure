ALTER TABLE public.bookings ADD COLUMN organization_address text NOT NULL DEFAULT '', ADD COLUMN organization_leader text NOT NULL DEFAULT '', ADD COLUMN equipment text[] NOT NULL DEFAULT '{}', ADD COLUMN regulations_accepted boolean NOT NULL DEFAULT false, ADD COLUMN privacy_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD CONSTRAINT booking_organization_address_length CHECK (char_length(organization_address) <= 500), ADD CONSTRAINT booking_organization_leader_length CHECK (char_length(organization_leader) <= 150), ADD CONSTRAINT booking_equipment_count CHECK (cardinality(equipment) <= 10);
CREATE TABLE public.meeting_purpose_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100), purpose text NOT NULL CHECK (char_length(btrim(purpose)) BETWEEN 1 AND 5000), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, DELETE ON public.meeting_purpose_templates TO authenticated;
GRANT ALL ON public.meeting_purpose_templates TO service_role;
ALTER TABLE public.meeting_purpose_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own purpose templates" ON public.meeting_purpose_templates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert own purpose templates" ON public.meeting_purpose_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own purpose templates" ON public.meeting_purpose_templates FOR DELETE TO authenticated USING (user_id = auth.uid());