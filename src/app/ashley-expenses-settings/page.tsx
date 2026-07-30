
"use client"
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/hooks/use-translation';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/context/app-provider';
import { useState, useEffect } from 'react';
import withAuth from '@/hooks/withAuth';
import { SalarySettings } from '@/lib/types';


function AshleyExpensesSettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { settings: globalSettings, setSettings: setGlobalSettings } = useAppContext();
  
  const [settings, setSettings] = useState<SalarySettings>({ overtimeRate: 5000, bonusRate: 5000 });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (globalSettings?.salarySettings) {
      setSettings(globalSettings.salarySettings);
    }
  }, [globalSettings]);

  const handleSave = () => {
    setIsSaving(true);
    setGlobalSettings({ ...globalSettings, salarySettings: settings });
    toast({
        title: "Settings Saved",
        description: "Your salary settings have been updated.",
    });
    setIsSaving(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b p-4">
        <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/ashley-expenses">
                <ArrowLeft />
                <span className="sr-only">{t('back_to_ashley_management')}</span>
                </Link>
            </Button>
            <h1 className="text-xl">{t('ashley_employees_management_settings')}</h1>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                {t('save_changes')}
            </Button>
        </div>
      </header>
      <main className="w-full p-4 md:p-8">
         <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>{t('salary_rates')}</CardTitle>
                
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="overtime-rate">{t('overtime_rate_per_hour')}</Label>
                    <Input 
                        id="overtime-rate" 
                        type="number" 
                        value={settings.overtimeRate}
                        onChange={(e) => setSettings(prev => ({...prev, overtimeRate: e.target.valueAsNumber || 0}))}
                        placeholder="e.g., 5000"
                    />
                     
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="bonus-rate">{t('bonus_rate_per_load')}</Label>
                    <Input 
                        id="bonus-rate" 
                        type="number"
                        value={settings.bonusRate}
                        onChange={(e) => setSettings(prev => ({...prev, bonusRate: e.target.valueAsNumber || 0}))}
                        placeholder="e.g., 5000"
                    />
                    
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default withAuth(AshleyExpensesSettingsPage);
