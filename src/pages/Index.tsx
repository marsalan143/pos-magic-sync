import { useAuth } from '@/hooks/useAuth';
import LicenseActivation from './LicenseActivation';
import Login from './Login';
import POS from './POS';

const Index = () => {
  const { isLicensed, isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isLicensed) return <LicenseActivation />;
  if (!isLoggedIn) return <Login />;
  return <POS />;
};

export default Index;
