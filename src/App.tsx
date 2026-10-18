import { BrowserRouter, Route, Routes } from "react-router";
import { ConsoleLayout, PublicLayout, RequireAdmin, RequireAuth } from "@/components/layouts";
import Landing from "@/pages/public/Landing";
import Docs from "@/pages/public/Docs";
import { ForgotPassword, Login, NotFound, Register, ResetPassword, VerifyEmail } from "@/pages/public/Auth";
import Projects from "@/pages/app/Projects";
import ProjectLayout from "@/pages/app/ProjectLayout";
import ProjectOverview from "@/pages/app/ProjectOverview";
import Channels from "@/pages/app/Channels";
import ChannelDetail from "@/pages/app/ChannelDetail";
import Tokens from "@/pages/app/Tokens";
import Usage from "@/pages/app/Usage";
import Webhooks from "@/pages/app/Webhooks";
import Events from "@/pages/app/Events";
import Account from "@/pages/app/Account";
import { AdminOverview, MediaNodes } from "@/pages/admin/Admin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public site */}
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="docs" element={<Docs />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Developer / subscriber console */}
        <Route
          path="app"
          element={
            <RequireAuth>
              <ConsoleLayout area="app" />
            </RequireAuth>
          }
        >
          <Route index element={<Projects />} />
          <Route path="account" element={<Account />} />
          <Route path="projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<ProjectOverview />} />
            <Route path="channels" element={<Channels />} />
            <Route path="channels/:channelId" element={<ChannelDetail />} />
            <Route path="tokens" element={<Tokens />} />
            <Route path="usage" element={<Usage />} />
            <Route path="webhooks" element={<Webhooks />} />
            <Route path="events" element={<Events />} />
          </Route>
        </Route>

        {/* Platform admin (master realm) */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <ConsoleLayout area="admin" />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="nodes" element={<MediaNodes />} />
          <Route path="projects" element={<Projects adminView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
