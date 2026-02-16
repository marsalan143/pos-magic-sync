// App state types - using React context (see useAuth.tsx)
export interface AppState {
  isLicensed: boolean;
  isLoggedIn: boolean;
  userName: string;
  userRole: string;
  permissions: string[];
  companyName: string;
}
