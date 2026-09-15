/**
 * @module Settings
 * @description Full-screen settings dialog with a sectioned sidebar nav.
 * Each section is rendered by its own component:
 * AppearanceSection, FileSourcesSection (the "Storage Sources" tab),
 * AIRewriteModesSection, KeyboardShortcutsSection, and AboutSection.
 */
import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Paintbrush, Database, Wand2, Info, Keyboard } from 'lucide-react';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '../../app-ui/breadcrumb';
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '../../app-ui/dialog';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
} from '../../app-ui/sidebar';
import { AppearanceSection } from './sections/AppearanceSection';
import { FileSourcesSection } from './sections/FileSourcesSection';
import { AIRewriteModesSection } from './sections/AIRewriteModesSection';
import { KeyboardShortcutsSection } from './sections/KeyboardShortcutsSection';
import { AboutSection } from './sections/AboutSection';

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: string;
  defaultSidebarView?: 'tree' | 'outline' | 'split' | 'last-used';
  onDefaultSidebarViewChange?: (view: 'tree' | 'outline' | 'split' | 'last-used') => void;
  enableDatabaseSync?: boolean;
  onEnableDatabaseSyncChange?: (enabled: boolean) => void;
}

const NAV = [
  { name: 'Appearance', icon: Paintbrush },
  { name: 'Storage Sources', icon: Database },
  { name: 'AI Rewrite Modes', icon: Wand2 },
  { name: 'Keyboard Shortcuts', icon: Keyboard },
  { name: 'About', icon: Info },
];

/**
 * The "Storage" and "File Sources" tabs were merged into a single "Storage
 * Sources" tab; map either legacy name so an older deep link or a stored
 * section still opens the right panel instead of falling back to Appearance.
 */
const LEGACY_SECTIONS: Record<string, string> = {
  Storage: 'Storage Sources',
  'File Sources': 'Storage Sources',
};

const resolveSection = (section?: string) =>
  (section && (LEGACY_SECTIONS[section] ?? section)) || 'Appearance';

export const Settings = ({
  open, onOpenChange, initialSection,
  defaultSidebarView = 'last-used', onDefaultSidebarViewChange,
  enableDatabaseSync = false, onEnableDatabaseSyncChange,
}: SettingsProps) => {
  const [activeSection, setActiveSection] = useState(() => resolveSection(initialSection));

  useEffect(() => {
    if (open) setActiveSection(resolveSection(initialSection));
  }, [open, initialSection]);

  const renderContent = () => {
    switch (activeSection) {
      case 'Appearance':
        return <AppearanceSection defaultSidebarView={defaultSidebarView} onDefaultSidebarViewChange={onDefaultSidebarViewChange} />;
      case 'Storage Sources':
        return (
          <FileSourcesSection
            open={open}
            enableDatabaseSync={enableDatabaseSync}
            onEnableDatabaseSyncChange={onEnableDatabaseSyncChange}
          />
        );
      case 'AI Rewrite Modes':
        return <AIRewriteModesSection open={open} />;
      case 'Keyboard Shortcuts':
        return <KeyboardShortcutsSection />;
      case 'About':
        return <AboutSection />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Customize your settings here.</DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={item.name === activeSection} onClick={() => setActiveSection(item.name)}>
                          <a href="#">
                            <item.icon />
                            <span>{item.name}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[480px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">
                        <SettingsIcon className="h-4 w-4 inline mr-1" />
                        Settings
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeSection}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              {renderContent()}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
};
