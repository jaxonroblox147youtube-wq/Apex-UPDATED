import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import ServerPicker from "@/pages/ServerPicker";
import GuildDashboard from "@/pages/GuildDashboard";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={ServerPicker} />
      <Route path="/dashboard/:guildId">
        {(params) => <GuildDashboard tab="overview" />}
      </Route>
      <Route path="/dashboard/:guildId/commands">
        {(params) => <GuildDashboard tab="commands" />}
      </Route>
      <Route path="/dashboard/:guildId/automod">
        {(params) => <GuildDashboard tab="automod" />}
      </Route>
      <Route path="/dashboard/:guildId/applications">
        {(params) => <GuildDashboard tab="applications" />}
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
