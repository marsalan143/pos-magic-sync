import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Monitor, GitBranch, Loader2, ShieldCheck } from 'lucide-react';

export default function LicenseActivation() {
  const { activateLicense } = useAuth();
  const isOnline = useOnlineStatus();
  const [licenseKey, setLicenseKey] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim() || !deviceName.trim()) {
      setError('License key and device name are required');
      return;
    }
    if (!isOnline) {
      setError('Internet connection required for activation');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await activateLicense(licenseKey.trim(), deviceName.trim(), branchCode.trim() || undefined);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activate Terminal</h1>
          <p className="text-sm text-muted-foreground">Enter your license key to activate this POS terminal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="licenseKey" className="text-sm font-medium text-foreground">License Key</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="licenseKey"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="pl-10 bg-card border-border font-mono text-sm tracking-wider"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deviceName" className="text-sm font-medium text-foreground">Device Name</Label>
            <div className="relative">
              <Monitor className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="deviceName"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="Counter-1"
                className="pl-10 bg-card border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branchCode" className="text-sm font-medium text-foreground">
              Branch Code <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="branchCode"
                value={branchCode}
                onChange={e => setBranchCode(e.target.value)}
                placeholder="BR-001"
                className="pl-10 bg-card border-border"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !isOnline}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              'Activate Terminal'
            )}
          </Button>

          {!isOnline && (
            <p className="text-center text-sm text-pos-warning">
              Internet connection required for activation
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
