import { CaregiverProfileDashboard } from "@/components/caregiver-profile-dashboard";

export default async function CaregiverProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaregiverProfileDashboard id={id} />;
}
