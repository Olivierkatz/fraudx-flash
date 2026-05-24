export interface AppLogoConfig {
  src: string;
  alt: string;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface AppDesignOverrides {
  colors: {
    navy: string;
    green: string;
    cyan: string;
    tint: string;
    coral: string;
    bodyText: string;
    gray: string;
    white: string;
    border: string;
    errorRed: string;
    lighterRed: string;
    blue: string;
    darkGrey: string;
    eyebrowOnLight: string;
    eyebrowOnDark: string;
    bodyOnLight: string;
    bodyOnDark: string;
    mutedOnLight: string;
    mutedOnDark: string;
    inputBorder: string;
    focusRing: string;
  };
  typography: {
    fontFamily: string;
    marketingFontFamily: string;
    fontFeatureSettings: string;
    weights: Record<"body" | "label" | "headline" | "display", number>;
    letterSpacing: Record<"label" | "button" | "chip" | "displayTight" | "headingTight" | "pill" | "displayLabel", string>;
    lineHeight: Record<"display" | "heading" | "section" | "subsection" | "cardHeading" | "cardSubhead" | "tightBody" | "body", number>;
    fontSize: Record<"displayLg" | "displayMd" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body" | "bodySm" | "caption" | "label" | "labelDense", string>;
  };
  radii: Record<"sm" | "md" | "lg" | "card" | "pill", string>;
  spacing: Record<"padding" | "mainContentPadding" | "mainContentTopMargin", number>;
  breakpoints: Record<"xs" | "sm" | "md" | "lg" | "xl", number>;
  durations: {
    messageBar: number;
  };
  chrome: {
    premiumGradientFrom: string;
    premiumGradientTo: string;
  };
}

export interface AppApiConfig {
  basePath: string;
  defaultPageSize: number;
}

export interface AppLegalConfig {
  termsUrl: string;
}

export interface AppOnboardingStepConfig {
  id: string;
  title: string;
  body: string;
  primaryActionLabel?: string;
  routeHint?: string;
  educationLabel?: string;
}

export interface AppOnboardingConfig {
  enabled: boolean;
  steps: AppOnboardingStepConfig[];
}

export type AppAuthMode = "partner" | "customer";

export type AppPrimarySurface = "dashboard" | "chat-driven-viewer" | "single-workflow";

export type AppCapability = "chat" | "extraction" | "reports" | "ingest" | "document-viewer";

export interface AppScaffoldIntakeConfig {
  primarySurface: AppPrimarySurface;
  capabilities: AppCapability[];
  authMode: AppAuthMode;
}

export interface AppConfig {
  appName: string;
  logos: {
    auth: AppLogoConfig;
    dark: AppLogoConfig;
    passwordReset: AppLogoConfig;
  };
  legal: AppLegalConfig;
  api: AppApiConfig;
  onboarding: AppOnboardingConfig;
  scaffold: AppScaffoldIntakeConfig;
  design: DeepPartial<AppDesignOverrides>;
}

export type AppConfigOverrides = Partial<
  Pick<AppConfig, "appName"> & {
    logos: {
      [K in keyof AppConfig["logos"]]?: Partial<AppConfig["logos"][K]>;
    };
    api: Partial<AppApiConfig>;
    legal: Partial<AppLegalConfig>;
    onboarding: Partial<AppOnboardingConfig>;
    scaffold: Partial<AppScaffoldIntakeConfig>;
    design: DeepPartial<AppDesignOverrides>;
  }
>;

const trimTrailingSlash = (value: string | undefined, fallback = ""): string => {
  const resolved = value?.trim() || fallback;
  return resolved.replace(/\/+$/, "");
};

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const booleanFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizedIntakeValue = (value: string | undefined): string => value?.trim().toLowerCase().replace(/[\s_]+/g, "-") ?? "";

const authModeFromEnv = (value: string | undefined): AppAuthMode => (normalizedIntakeValue(value) === "partner" ? "partner" : "customer");

const primarySurfaceFromEnv = (value: string | undefined): AppPrimarySurface => {
  const normalized = normalizedIntakeValue(value);
  if (normalized === "chat-driven-viewer" || normalized === "chat-driven" || normalized === "chat-first") return "chat-driven-viewer";
  if (normalized === "single-workflow" || normalized === "workflow") return "single-workflow";
  return "dashboard";
};

const capabilityFromValue = (value: string): AppCapability | null => {
  const normalized = normalizedIntakeValue(value);
  if (normalized === "chat") return "chat";
  if (normalized === "extraction" || normalized === "extract") return "extraction";
  if (normalized === "reports" || normalized === "report" || normalized === "smart-reports") return "reports";
  if (normalized === "ingest" || normalized === "upload") return "ingest";
  if (normalized === "document-viewer" || normalized === "documents" || normalized === "viewer") return "document-viewer";
  return null;
};

const capabilitiesFromEnv = (value: string | undefined): AppCapability[] => {
  const seen = new Set<AppCapability>();
  for (const part of value?.split(",") ?? []) {
    const capability = capabilityFromValue(part);
    if (capability) seen.add(capability);
  }
  return [...seen];
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: "GroundX Studio",
  logos: {
    auth: {
      src: "/assets/logos/groundx-studio-color.png",
      alt: "GroundX Studio",
    },
    dark: {
      src: "/assets/logos/groundx-studio-white.png",
      alt: "GroundX Studio",
    },
    passwordReset: {
      src: "/assets/logos/groundx-studio-color.png",
      alt: "GroundX Studio",
    },
  },
  api: {
    basePath: "/api",
    defaultPageSize: numberFromEnv(import.meta.env.VITE_SDK_DEFAULT_PAGE_SIZE, 20),
  },
  legal: {
    termsUrl: "https://www.eyelevel.ai/product/terms-conditions",
  },
  onboarding: {
    enabled: booleanFromEnv(import.meta.env.VITE_APP_ONBOARDING_ENABLED, false),
    steps: [
      {
        id: "app-shell",
        title: "Start with the app shell",
        body: "The header, side rail, page title, and protected content area give every product workflow the same foundation.",
        primaryActionLabel: "Explore navigation",
        educationLabel: "About the app shell",
      },
      {
        id: "navigation",
        title: "Use navigation from any screen",
        body: "Desktop users get a side rail. Tablet and phone users get the same menu through the hamburger button.",
        routeHint: "Home is the first protected route.",
        educationLabel: "About responsive navigation",
      },
      {
        id: "account-menu",
        title: "Manage the account from the header",
        body: "The profile menu shows account details and keeps logout in one predictable place.",
        educationLabel: "About the account menu",
      },
      {
        id: "education",
        title: "Look for info bubbles",
        body: "Educational tooltips explain widgets, metrics, empty states, and unfamiliar actions without turning the page into documentation.",
        educationLabel: "About info bubbles",
      },
      {
        id: "first-widget",
        title: "Add the first product widget",
        body: "Replace the starter Home page with the first dashboard, workflow, or product widget for this app.",
        routeHint: "Agents should add new product routes through the scaffold router and navigation config.",
        educationLabel: "About the starter page",
      },
    ],
  },
  scaffold: {
    primarySurface: primarySurfaceFromEnv(import.meta.env.VITE_APP_PRIMARY_SURFACE),
    capabilities: capabilitiesFromEnv(import.meta.env.VITE_APP_CAPABILITIES),
    authMode: authModeFromEnv(import.meta.env.VITE_APP_AUTH_MODE),
  },
  design: {},
};

export const createAppConfig = (overrides: AppConfigOverrides = {}): AppConfig => ({
  appName: overrides.appName?.trim() || DEFAULT_APP_CONFIG.appName,
  logos: {
    auth: {
      ...DEFAULT_APP_CONFIG.logos.auth,
      ...overrides.logos?.auth,
    },
    dark: {
      ...DEFAULT_APP_CONFIG.logos.dark,
      ...overrides.logos?.dark,
    },
    passwordReset: {
      ...DEFAULT_APP_CONFIG.logos.passwordReset,
      ...overrides.logos?.passwordReset,
    },
  },
  api: {
    ...DEFAULT_APP_CONFIG.api,
    ...overrides.api,
    basePath: trimTrailingSlash(overrides.api?.basePath, DEFAULT_APP_CONFIG.api.basePath),
  },
  legal: {
    ...DEFAULT_APP_CONFIG.legal,
    ...overrides.legal,
  },
  onboarding: {
    ...DEFAULT_APP_CONFIG.onboarding,
    ...overrides.onboarding,
    steps: overrides.onboarding?.steps ?? DEFAULT_APP_CONFIG.onboarding.steps,
  },
  scaffold: {
    ...DEFAULT_APP_CONFIG.scaffold,
    ...overrides.scaffold,
    capabilities: overrides.scaffold?.capabilities ?? DEFAULT_APP_CONFIG.scaffold.capabilities,
  },
  design: {
    ...DEFAULT_APP_CONFIG.design,
    ...overrides.design,
  },
});

export const APP_CONFIG = createAppConfig();

export const APP_NAME = APP_CONFIG.appName;

export const APP_LOGOS = APP_CONFIG.logos;

export const APP_SCAFFOLD = APP_CONFIG.scaffold;

export const APP_AUTH_MODE: AppAuthMode = APP_CONFIG.scaffold.authMode;

export const getPageTitle = (pageTitle: string, appName = APP_NAME) => `${pageTitle} | ${appName}`;
