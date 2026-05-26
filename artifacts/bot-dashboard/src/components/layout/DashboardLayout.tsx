import { Link, useLocation } from "wouter";
import { LayoutDashboard, TerminalSquare, ShieldAlert, Bot } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/commands", label: "Commands", icon: TerminalSquare },
    { href: "/dashboard/automod", label: "Auto-Moderation", icon: ShieldAlert },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="w-64 border-r border-border bg-sidebar shrink-0 hidden md:block">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
          <Bot className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">Apex Dashboard</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}