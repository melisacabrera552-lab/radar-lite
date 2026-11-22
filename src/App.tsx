import { useState, useEffect } from 'react';
import { Sidebar, ActiveScreen } from './components/Sidebar';
import { SearchScreen } from './components/SearchScreen';
import { BusinessDetailModal } from './components/BusinessDetailModal';
import { NicheRadarScreen } from './components/NicheRadarScreen';
import { MyLeadsScreen } from './components/MyLeadsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { PrintableDossier } from './components/PrintableDossier';
import { BusinessItem, UserSettings } from './types';
import { getSettings, getSavedLeads } from './services/storage';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('buscar');
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [savedLeads, setSavedLeads] = useState<BusinessItem[]>(getSavedLeads());
  const [activeBusiness, setActiveBusiness] = useState<BusinessItem | null>(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);

  // Refresh saved leads from localStorage
  const refreshLeads = () => {
    setSavedLeads(getSavedLeads());
    setSettings(getSettings());
  };

  // Sync settings when updated
  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
  };

  // When a business is selected from any screen
  const handleSelectBusiness = (business: BusinessItem) => {
    setActiveBusiness(business);
    setCurrentScreen('ficha');
  };

  // When business details or notes/audit change
  const handleUpdateActiveBusiness = (updated: BusinessItem) => {
    setActiveBusiness(updated);
    refreshLeads();
  };

  const [searchCategory, setSearchCategory] = useState<string | undefined>(undefined);
  const [searchZone, setSearchZone] = useState<string | undefined>(undefined);

  // Launch search from Niche Radar
  const handleLaunchSearchFromRadar = (category: string, zone: string) => {
    setSearchCategory(category);
    setSearchZone(zone);
    setCurrentScreen('buscar');
  };

  useEffect(() => {
    refreshLeads();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#000000] text-slate-100 font-sans antialiased relative">
      {/* Background ambient violet glow */}
      <div
        className="absolute top-0 right-1/4 w-[700px] h-[700px] rounded-full pointer-events-none opacity-15 blur-[140px]"
        style={{
          background: 'radial-gradient(circle, #7d39eb 0%, #5a4be0 50%, transparent 70%)',
        }}
      />

      {/* Fixed Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={(screen) => {
          setIsPrintViewOpen(false);
          setCurrentScreen(screen);
        }}
        hasActiveBusiness={!!activeBusiness}
        savedLeadsCount={savedLeads.length}
        quota={settings.quota}
        sellerProfile={settings.sellerProfile}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentScreen === 'buscar' ? '' : 'hidden'}`}>
          <SearchScreen
            settings={settings}
            onSelectBusiness={handleSelectBusiness}
            onRefreshLeads={refreshLeads}
            onNavigateToSettings={() => setCurrentScreen('ajustes')}
            initialCategory={searchCategory}
            initialZone={searchZone}
          />
        </div>

        <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentScreen === 'radar' ? '' : 'hidden'}`}>
          <NicheRadarScreen
            settings={settings}
            onLaunchSearch={handleLaunchSearchFromRadar}
            onNavigateToSettings={() => setCurrentScreen('ajustes')}
          />
        </div>

        <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentScreen === 'leads' ? '' : 'hidden'}`}>
          <MyLeadsScreen
            leads={savedLeads}
            onSelectBusiness={handleSelectBusiness}
            onRefreshLeads={refreshLeads}
          />
        </div>

        <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentScreen === 'ajustes' ? '' : 'hidden'}`}>
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        </div>

        {currentScreen === 'ficha' && activeBusiness && (
          <BusinessDetailModal
            business={activeBusiness}
            settings={settings}
            onUpdateBusiness={handleUpdateActiveBusiness}
            onClose={() => setCurrentScreen('buscar')}
            onOpenPrintView={() => setIsPrintViewOpen(true)}
          />
        )}
      </main>

      {/* Fullscreen Printable Dossier Overlay (Triggered by 'Exportar ficha') */}
      {isPrintViewOpen && activeBusiness && (
        <PrintableDossier
          business={activeBusiness}
          settings={settings}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}
    </div>
  );
}
