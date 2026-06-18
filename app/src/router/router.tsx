import { createBrowserRouter, Navigate } from "react-router-dom";

import { APP_AUTH_MODE } from "@/appConfig";
import { AppInitialization } from "@/AppInitialization";
import { AppStatus } from "@/views/AppStatus/AppStatus";
import { Banned } from "@/views/Banned/Banned";
import { OnboardingProvider } from "@/contexts/OnboardingContext/OnboardingProvider";
import { Dashboard } from "@/views/CoreLayouts/Dashboard";
import { Flash } from "@/views/Flash/Flash";
import { Health } from "@/views/Health/Health";
import { Home } from "@/views/Home/Home";
import { Login } from "@/views/Auth/Login";
import { Register } from "@/views/Auth/Register";
import { ResetPassword } from "@/views/Auth/ResetPassword";
import { ROUTER_PATHS } from "@/router/routerPaths";

const authRoutes =
  APP_AUTH_MODE === "partner"
    ? [
        { path: ROUTER_PATHS.AUTH_LOGIN, element: <Login /> },
        { path: ROUTER_PATHS.AUTH_REGISTER, element: <Register /> },
        { path: ROUTER_PATHS.AUTH_RESET_PASSWORD, element: <ResetPassword /> },
      ]
    : [];

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppInitialization>
        <OnboardingProvider>
          <Dashboard />
        </OnboardingProvider>
      </AppInitialization>
    ),
    errorElement: <>Something went wrong</>,
    children: [
      { path: "", element: <Navigate to={ROUTER_PATHS.FLASH} /> },
      { path: ROUTER_PATHS.APP_STATUS, element: <AppStatus /> },
      { path: ROUTER_PATHS.HOME, element: <Home /> },
      { path: ROUTER_PATHS.FLASH, element: <Flash /> },
    ],
  },
  ...authRoutes,
  { path: ROUTER_PATHS.HEALTH, element: <Health /> },
  { path: ROUTER_PATHS.BANNED, element: <Banned /> },
]);
