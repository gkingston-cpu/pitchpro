import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authEnabled, authOptions } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboardData";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const previewMode = !authEnabled();
  if (!previewMode) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/api/auth/signin");
  }

  const data = await getDashboardData();
  return <Dashboard data={data} previewMode={previewMode} />;
}
