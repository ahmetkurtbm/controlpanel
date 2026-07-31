import { auth, signOut } from "@/auth";
import { isGrafanaConfigured } from "@/lib/grafana";
import { listServices } from "@/lib/services";
import { Sidebar } from "@/components/sidebar";
import { TimeRangeProvider } from "@/components/time-range";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // A misconfigured or unreachable Grafana shouldn't blank the whole shell —
  // the sidebar still renders and the page below explains what's wrong.
  let services: string[] = [];
  if (isGrafanaConfigured()) {
    try {
      services = await listServices();
    } catch {
      services = [];
    }
  }

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  return (
    <TimeRangeProvider>
      <div className="flex min-h-screen">
        <Sidebar
          services={services}
          userEmail={session?.user?.email}
          signOutAction={handleSignOut}
        />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </TimeRangeProvider>
  );
}
