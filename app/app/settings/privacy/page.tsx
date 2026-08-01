'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Database, Check, Lock, ShieldCheck,
  RefreshCw, AlertCircle, FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PrivacySettingsPage() {
  // Storage preference: 'platform' | 'drive'
  const [storagePref, setStoragePref] = useState<'platform' | 'drive'>('platform');
  const [driveConnected, setDriveConnected] = useState<boolean>(false);
  const [driveEmail, setDriveEmail] = useState<string>('');
  
  // Toggles
  const [clientRedaction, setClientRedaction] = useState<boolean>(false);
  const [ephemeralProcessing, setEphemeralProcessing] = useState<boolean>(false);

  // UI state
  const [isSimulatingOAuth, setIsSimulatingOAuth] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load settings on mount
  useEffect(() => {
    const savedStorage = localStorage.getItem('pv_storage_pref') as 'platform' | 'drive';
    if (savedStorage) setStoragePref(savedStorage);

    const savedDriveConn = localStorage.getItem('pv_drive_connected') === 'true';
    setDriveConnected(savedDriveConn);

    const savedDriveEmail = localStorage.getItem('pv_drive_email') || '';
    setDriveEmail(savedDriveEmail);

    const savedRedaction = localStorage.getItem('pv_client_redaction') === 'true';
    setClientRedaction(savedRedaction);

    const savedEphemeral = localStorage.getItem('pv_ephemeral_processing') === 'true';
    setEphemeralProcessing(savedEphemeral);
  }, []);

  // Save settings
  const updateStoragePref = (pref: 'platform' | 'drive') => {
    if (pref === 'drive' && !driveConnected) {
      toast.warning('Please connect your Google Drive first.');
      return;
    }
    setStoragePref(pref);
    localStorage.setItem('pv_storage_pref', pref);
    toast.success(`Storage preference set to ${pref === 'platform' ? 'Platform Storage' : 'Google Drive'}.`);
  };

  const toggleRedaction = () => {
    const newVal = !clientRedaction;
    setClientRedaction(newVal);
    localStorage.setItem('pv_client_redaction', String(newVal));
    toast.success(newVal ? 'Client-side redaction enabled.' : 'Client-side redaction disabled.');
  };

  const toggleEphemeral = () => {
    const newVal = !ephemeralProcessing;
    setEphemeralProcessing(newVal);
    localStorage.setItem('pv_ephemeral_processing', String(newVal));
    toast.success(newVal ? 'Ephemeral file processing enabled.' : 'Ephemeral file processing disabled.');
  };

  // Google Drive Connection Simulator
  const handleConnectDrive = () => {
    setIsSimulatingOAuth(true);
  };

  const handleDisconnectDrive = () => {
    setDriveConnected(false);
    setDriveEmail('');
    setStoragePref('platform');
    localStorage.setItem('pv_drive_connected', 'false');
    localStorage.removeItem('pv_drive_email');
    localStorage.setItem('pv_storage_pref', 'platform');
    toast.info('Google Drive disconnected.');
  };

  const completeOAuthMock = (allowed: boolean) => {
    setIsSimulatingOAuth(false);
    if (allowed) {
      setIsConnecting(true);
      setTimeout(() => {
        setDriveConnected(true);
        const mockEmail = 'builder.user@gmail.com';
        setDriveEmail(mockEmail);
        setStoragePref('drive');
        localStorage.setItem('pv_drive_connected', 'true');
        localStorage.setItem('pv_drive_email', mockEmail);
        localStorage.setItem('pv_storage_pref', 'drive');
        setIsConnecting(false);
        toast.success('Successfully linked Google Drive and set as default storage!');
      }, 1200);
    } else {
      toast.error('Authentication cancelled by user.');
    }
  };

  const handleExportData = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      
      // Mock CSV generation for testing
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
        policies: [
          { id: '1', number: 'POL-100234', insurer: 'HDFC Ergo', start: '2026-01-01', expiry: '2027-01-01' },
          { id: '2', number: 'POL-592831', insurer: 'ICICI Lombard', start: '2026-05-10', expiry: '2027-05-10' }
        ],
        settings: { storagePreference: storagePref, driveConnected, clientRedaction }
      }));
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'policyvault_backup.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Backup exported successfully.');
    }, 2000);
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-background pb-32">
      <div className="max-w-4xl mx-auto">
        
        {/* Back navigation */}
        <Link href="/app/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to settings
        </Link>

        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              Privacy & Cloud Storage
            </h1>
            <p className="font-medium text-muted-foreground mt-1">
              Configure secure vaults, Google Drive storage integration, and client-side redaction settings.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 font-bold text-xs rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Secure
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Storage Destination & Connection */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Storage Selection Card */}
            <div className="bg-card transition-colors rounded-[28px] p-6 border border-border/80 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950 mb-1">Select Policy Storage Location</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose where your physical policy documents (PDFs, images) are stored.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Platform Storage Option */}
                <div 
                  onClick={() => updateStoragePref('platform')}
                  className={`border rounded-2xl p-5 cursor-pointer transition-all ${
                    storagePref === 'platform' 
                      ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600/30' 
                      : 'border-border bg-card transition-colors hover:border-border/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Database className="w-5 h-5" />
                    </div>
                    {storagePref === 'platform' && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-foreground mt-4">Platform Storage</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Policies are securely uploaded to PolicyVault Backblaze cloud storage. Fast, redundant, and zero setup.
                  </p>
                </div>

                {/* Google Drive Option */}
                <div 
                  onClick={() => updateStoragePref('drive')}
                  className={`border rounded-2xl p-5 cursor-pointer transition-all ${
                    storagePref === 'drive' 
                      ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600/30' 
                      : 'border-border bg-card transition-colors hover:border-border/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.38 12.01L14.77 4H9.23l4.62 8.01h5.53zM9.77 12.99L6.54 18.6h9.08l3.23-5.61H9.77zm-.92-1.98L4.23 11l4.62 8 4.62-8H8.85z" />
                      </svg>
                    </div>
                    {storagePref === 'drive' && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-foreground mt-4 flex items-center gap-1.5">
                    Google Drive
                    {!driveConnected && (
                      <span className="text-[10px] bg-muted transition-colors text-foreground/90 font-bold px-1.5 py-0.5 rounded">Not Connected</span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Policies are stored in your personal Google Drive account. We only process text in-memory for AI OCR extraction.
                  </p>
                </div>

              </div>
            </div>

            {/* Google Drive Account Setup Card */}
            <div className="bg-card transition-colors rounded-[28px] p-6 border border-border/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-950">Google Drive Integration</h2>
                {driveConnected ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connected
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground font-bold bg-muted transition-colors px-2 py-0.5 rounded-full">
                    Disconnected
                  </span>
                )}
              </div>

              {driveConnected ? (
                <div className="space-y-4">
                  <div className="bg-muted transition-colors rounded-2xl p-4 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Authorized Account</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{driveEmail}</p>
                      <p className="text-xs text-indigo-600 font-semibold mt-1">App Folder: Google Drive/PolicyVault/</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleDisconnectDrive} 
                      className="border-red-200 text-red-600 hover:bg-red-50/50 hover:text-red-700 font-bold text-xs h-9 rounded-lg"
                    >
                      Disconnect
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>PolicyVault has restricted access. We cannot read or edit other files on your Google Drive.</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-foreground/90 max-w-md mx-auto mb-6 leading-relaxed">
                    Connect your personal Google account. We will create a folder named <strong>"PolicyVault"</strong> to host your uploaded insurance certificates securely.
                  </p>
                  
                  <Button 
                    onClick={handleConnectDrive} 
                    disabled={isConnecting}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-6 h-11 inline-flex items-center gap-2 shadow-md shadow-orange-600/10"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.38 12.01L14.77 4H9.23l4.62 8.01h5.53zM9.77 12.99L6.54 18.6h9.08l3.23-5.61H9.77zm-.92-1.98L4.23 11l4.62 8 4.62-8H8.85z" />
                        </svg>
                        Link Google Account
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Privacy Toggles & Data Portability */}
          <div className="space-y-6">
            
            {/* Extra Privacy Features */}
            <div className="bg-card transition-colors rounded-[28px] p-6 border border-border/80 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-950">Privacy Options</h2>
              
              {/* Client-Side Redaction Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-sm">Client-Side Redaction</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Scan documents in your browser and automatically scrub SSNs, Credit Cards, and Tax IDs before they reach the server.
                  </p>
                </div>
                <button 
                  onClick={toggleRedaction}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 focus:outline-none ${
                    clientRedaction ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 bg-card transition-colors rounded-full absolute top-1 transition-transform ${
                    clientRedaction ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <hr className="border-border" />

              {/* Ephemeral File Processing */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground text-sm">Ephemeral Processing</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Immediately delete all uploaded policy files from cache after metadata is extracted by AI. No storage footprint remains.
                  </p>
                </div>
                <button 
                  onClick={toggleEphemeral}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 focus:outline-none ${
                    ephemeralProcessing ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 bg-card transition-colors rounded-full absolute top-1 transition-transform ${
                    ephemeralProcessing ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Data Portability (Download Data) */}
            <div className="bg-card transition-colors rounded-[28px] p-6 border border-border/80 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-950">Data Portability</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Download your complete history, user data, and extracted insurance policy metadata in an open JSON format at any time.
              </p>
              
              <Button 
                onClick={handleExportData} 
                disabled={isExporting}
                variant="outline"
                className="w-full border-border hover:bg-muted transition-colors text-foreground hover:text-foreground font-bold rounded-xl h-10 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating Archive...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Export Policies JSON
                  </>
                )}
              </Button>
            </div>

          </div>

        </div>

      </div>

      {/* MOCK GOOGLE OAUTH CONSENT MODAL */}
      {isSimulatingOAuth && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all duration-300">
          <div className="bg-card transition-colors w-full max-w-[450px] rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-border flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted transition-colors flex items-center justify-center mb-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-black text-foreground tracking-tight">Sign in with Google</h3>
              <p className="text-xs text-muted-foreground mt-1">to continue to <strong className="text-foreground">PolicyVault</strong></p>
            </div>

            {/* Permission Requests */}
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-foreground">PolicyVault wants to access your Google Account:</p>
              
              <div className="bg-muted transition-colors rounded-2xl p-4 border border-border flex items-start gap-3">
                <div className="w-5 h-5 text-orange-600 mt-0.5 shrink-0">
                  <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.38 12.01L14.77 4H9.23l4.62 8.01h5.53zM9.77 12.99L6.54 18.6h9.08l3.23-5.61H9.77zm-.92-1.98L4.23 11l4.62 8 4.62-8H8.85z" />
                  </svg>
                </div>
                <div className="text-xs text-foreground/90 leading-relaxed">
                  <strong className="text-foreground block mb-0.5">Google Drive App Access</strong>
                  See, edit, create, and delete only the specific Google Drive files you upload or create with this app.
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Make sure you trust PolicyVault. You can revoke access at any time in your Google Settings.</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-border bg-background flex items-center justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => completeOAuthMock(false)}
                className="rounded-xl border-border text-foreground hover:bg-muted transition-colors font-bold text-sm h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => completeOAuthMock(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm h-10 px-6"
              >
                Allow & Link
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
