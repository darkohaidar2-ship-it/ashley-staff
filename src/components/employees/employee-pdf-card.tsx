
'use client';

import { User } from "lucide-react";
import { format, parseISO } from 'date-fns';
import Image from 'next/image';
import type { Employee, PdfSettings } from "@/lib/types";
import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppContext } from "@/context/app-provider";

type EmployeePdfCardProps = {
  employee: Employee;
  settings: PdfSettings;
};

export function EmployeePdfCard({ employee, settings }: EmployeePdfCardProps) {
  const { t, language } = useTranslation();
  const { settings: globalSettings } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const useKurdish = language === 'ku';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formattedDob = isMounted && employee.dateOfBirth ? format(parseISO(employee.dateOfBirth), 'dd/MM/yyyy') : t('na');
  const formattedJoinedDate = isMounted && employee.employmentStartDate ? format(parseISO(employee.employmentStartDate), 'dd/MM/yyyy') : t('na');
  const displayName = useKurdish && employee.kurdishName ? employee.kurdishName : employee.name;


  return (
    <div className="bg-white text-gray-800 w-[600px] h-[360px] font-sans rounded-lg shadow-lg overflow-hidden border border-gray-200 flex" style={{ fontFamily: globalSettings.fontFamily || 'Arial, sans-serif' }}>
      
      {/* Left Side: Gradient Background */}
      <div 
        className="w-1/3 text-white flex flex-col items-center justify-between p-4"
        style={{ backgroundColor: settings.themeColor || '#3b82f6' }}
      >
        <div className="w-full">
            {settings.logo && (
              <div className="relative w-16 h-8 mb-4">
                  <Image src={settings.logo} alt="Company Logo" fill className="object-contain" unoptimized />
              </div>
            )}
            <p className="text-xs opacity-80">{settings.headerText || "Employee ID Card"}</p>
        </div>
        
        <div className="text-center">
            <Avatar className="w-24 h-24 border-4 border-white/50 shadow-lg rounded-md bg-white/20 mb-2">
                <AvatarImage src={employee.photoUrl || undefined} alt={displayName} className="rounded-md" />
                <AvatarFallback className="text-4xl bg-transparent text-white/80 rounded-md"><User /></AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-bold" dir={useKurdish ? 'rtl' : 'ltr'}>{displayName}</h2>
            <p className="text-sm opacity-90" dir={useKurdish ? 'rtl' : 'ltr'}>{employee.role || t('employee')}</p>
        </div>
        
         <div className="text-center w-full">
         </div>
      </div>
      
      {/* Right Side: White Background */}
      <div className="w-2/3 flex flex-col bg-white p-6 justify-between">
          <div className="space-y-3 text-sm">
            <h3 className="font-bold text-lg border-b pb-1 mb-2" style={{borderColor: settings.themeColor}}>{t('contact_information')}</h3>
            <div><p className="text-gray-500 text-xs">{t('email_optional')}</p><p className="font-semibold">{employee.email || t('na')}</p></div>
            <div><p className="text-gray-500 text-xs">{t('phone_optional')}</p><p className="font-semibold">{employee.phone || t('na')}</p></div>
          </div>

          <div className="space-y-3 text-sm">
             <h3 className="font-bold text-lg border-b pb-1 mb-2" style={{borderColor: settings.themeColor}}>{t('employment_details')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500 text-xs">{t('id_no')}</p><p className="font-semibold">{employee.employeeId || t('na')}</p></div>
              <div><p className="text-gray-500 text-xs">{t('joined_date')}</p><p className="font-semibold">{formattedJoinedDate}</p></div>
              <div><p className="text-gray-500 text-xs">{t('dob')}</p><p className="font-semibold">{formattedDob}</p></div>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 text-center border-t pt-2">
            {settings.footerText || "Official Company Document"}
          </div>
      </div>
    </div>
  );
};
