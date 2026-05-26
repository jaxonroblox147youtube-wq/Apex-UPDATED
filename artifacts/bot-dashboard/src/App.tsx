import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import DashboardOverview from "@/pages/DashboardOverview";
import DashboardCommands from "@/pages/DashboardCommands";
import DashboardAutomod from "@/pages/DashboardAutomod";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard">
        <DashboardLayout>
          <DashboardOverview />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/commands">
        <DashboardLayout>
          <DashboardCommands />
        </DashboardLayout>
      </Route>
      <Route path="/dashboard/automod">
        <DashboardLayout>
          <DashboardAutomod />
        </DashboardLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <div className="dark">
            <Router />
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;