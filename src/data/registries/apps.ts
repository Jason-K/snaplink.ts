import type { AppSpec } from "../primitives/apps";

// ---------------------------------------------------------
// Factory
// ---------------------------------------------------------

/** Create a registry entry for an application bundle or path.
 *  @param bundleId - bundle identifier (e.g. "com.apple.ActivityMonitor") or list of bundle IDs
 *  @param refDesc  - human label used in descriptions
 *  @param path     - optional file path or list of file paths
 */
const app = (bundleId: string | string[], refDesc: string, path?: string | string[]): AppSpec => ({
  type: "app",
  bundleId,
  ...(path ? { path } : {}),
  refDesc,
});

// ---------------------------------------------------------
// Registry
// ---------------------------------------------------------

export const APPS = {
  activityMonitor: app("com.apple.ActivityMonitor", "Activity Monitor"),
  antinote: app("com.chabomakers.Antinote", "Antinote"),
  brewUpdater: app("org.gpgtools.pinentry-mac", "Brew auto-updater"),
  browser: app("app.zen-browser.zen", "Zen"),
  brave: app("com.brave.Browser", "Brave"),
  calendar: app("com.busymac.busycal-setapp", "BusyCal"),
  claude: app("com.anthropic.claudefordesktop", "Claude"),
  code: app("com.microsoft.VSCode", "Code"),
  excel: app("com.microsoft.Excel", "Microsoft Excel"),
  FinderReplacement: app("com.jinghaoshe.qspace.pro", "QSpace"),
  helium: app("net.imput.helium", "Helium"),
  kitty: app("net.kovidgoyal.kitty", "Kitty"),
  messages: app("com.apple.MobileSMS", "Messages"),
  numi: app("com.nikolaeu.numi-setapp", "Numi"),
  onePiece: app("jp.fuji.1Piece", "1Piece"),
  onePiecePrefs: app("jp.fuji.1PiecePreferences", "1Piece Preferences"),
  outlook: app("com.microsoft.Outlook", "Microsoft Outlook"),
  processSpy: app("com.itone.ProcessSpy", "Process Spy"),
  protonMail: app("ch.protonmail.desktop", "Proton Mail"),
  qspace: app("com.jinghaoshe.qspace.pro", "QSpace"),
  raycast: app("com.raycast-x.macos", "Raycast"),
  ringCentral: app("com.ringcentral.glip", "RingCentral"),
  securityAgent: app("com.apple.SecurityAgent", "Security Agent"),
  settings: app("com.apple.systempreferences", "System Settings"),
  settingsPrivacy: app("com.apple.settings.PrivacySecurity", "System Settings, security"),
  sidenotes: app("com.apptorium.SideNotes-setapp", "Sidenotes"),
  skim: app("net.sourceforge.skim-app.skim", "Skim"),
  spotify: app("com.spotify.client", "Spotify"),
  systemSettings: app("com.apple.systempreferences", "System Settings"),
  taphouse: app("com.multimodalsolutions.taphouse", "Taphouse"),
  teams: app("com.microsoft.teams2", "Microsoft Teams"),
  todoist: app("com.todoist.mac.Todoist", "Todoist"),
  word: app("com.microsoft.Word", "Word"),
  zen: app("app.zen-browser.zen", "Zen"),
} as const;

export type { AppSpec };

export const PW_IDS: AppSpec[] = [
  APPS.securityAgent,
  APPS.settings,
  APPS.settingsPrivacy,
  APPS.brewUpdater,
  APPS.taphouse,
];
