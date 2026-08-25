# Graph Report - src  (2026-08-25)

## Corpus Check
- 169 files · ~153,170 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2781 nodes · 4638 edges · 42 communities (36 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_سیستەمی بەڕێوەبردنی دەوام (Attendance System)|سیستەمی بەڕێوەبردنی دەوام (Attendance System)]]
- [[_COMMUNITY_نەخشە و لۆکەیشنی جوگرافی (Maps & Geofence)|نەخشە و لۆکەیشنی جوگرافی (Maps & Geofence)]]
- [[_COMMUNITY_بەیەکەوەبەستنی گۆگڵ شیت و هەناردەکردن (Google Sheets Integration)|بەیەکەوەبەستنی گۆگڵ شیت و هەناردەکردن (Google Sheets Integration)]]
- [[_COMMUNITY_کۆنتڕۆڵ پانێڵی بەڕێوەبەر (Admin Dashboard & Settings)|کۆنتڕۆڵ پانێڵی بەڕێوەبەر (Admin Dashboard & Settings)]]
- [[_COMMUNITY_سیستەمی کۆگا و کاڵاکان (Warehouse & Inventory)|سیستەمی کۆگا و کاڵاکان (Warehouse & Inventory)]]
- [[_COMMUNITY_هەژماری کارمەندان و ناسینەوە (Employees & Users)|هەژماری کارمەندان و ناسینەوە (Employees & Users)]]
- [[_COMMUNITY_ڕاپۆرت و دۆکیۆمێنت (Reports & Documents)|ڕاپۆرت و دۆکیۆمێنت (Reports & Documents)]]
- [[_COMMUNITY_مۆدیوولی سیستەم 7|مۆدیوولی سیستەم 7]]
- [[_COMMUNITY_مۆدیوولی سیستەم 8|مۆدیوولی سیستەم 8]]
- [[_COMMUNITY_مۆدیوولی سیستەم 9|مۆدیوولی سیستەم 9]]
- [[_COMMUNITY_مۆدیوولی سیستەم 10|مۆدیوولی سیستەم 10]]
- [[_COMMUNITY_مۆدیوولی سیستەم 11|مۆدیوولی سیستەم 11]]
- [[_COMMUNITY_مۆدیوولی سیستەم 12|مۆدیوولی سیستەم 12]]
- [[_COMMUNITY_مۆدیوولی سیستەم 13|مۆدیوولی سیستەم 13]]
- [[_COMMUNITY_مۆدیوولی سیستەم 14|مۆدیوولی سیستەم 14]]
- [[_COMMUNITY_مۆدیوولی سیستەم 15|مۆدیوولی سیستەم 15]]
- [[_COMMUNITY_مۆدیوولی سیستەم 16|مۆدیوولی سیستەم 16]]
- [[_COMMUNITY_مۆدیوولی سیستەم 17|مۆدیوولی سیستەم 17]]
- [[_COMMUNITY_مۆدیوولی سیستەم 18|مۆدیوولی سیستەم 18]]
- [[_COMMUNITY_مۆدیوولی سیستەم 19|مۆدیوولی سیستەم 19]]
- [[_COMMUNITY_مۆدیوولی سیستەم 20|مۆدیوولی سیستەم 20]]
- [[_COMMUNITY_مۆدیوولی سیستەم 21|مۆدیوولی سیستەم 21]]
- [[_COMMUNITY_مۆدیوولی سیستەم 22|مۆدیوولی سیستەم 22]]
- [[_COMMUNITY_مۆدیوولی سیستەم 23|مۆدیوولی سیستەم 23]]
- [[_COMMUNITY_مۆدیوولی سیستەم 24|مۆدیوولی سیستەم 24]]
- [[_COMMUNITY_مۆدیوولی سیستەم 25|مۆدیوولی سیستەم 25]]
- [[_COMMUNITY_مۆدیوولی سیستەم 26|مۆدیوولی سیستەم 26]]
- [[_COMMUNITY_مۆدیوولی سیستەم 27|مۆدیوولی سیستەم 27]]
- [[_COMMUNITY_مۆدیوولی سیستەم 28|مۆدیوولی سیستەم 28]]
- [[_COMMUNITY_مۆدیوولی سیستەم 29|مۆدیوولی سیستەم 29]]
- [[_COMMUNITY_مۆدیوولی سیستەم 30|مۆدیوولی سیستەم 30]]
- [[_COMMUNITY_مۆدیوولی سیستەم 31|مۆدیوولی سیستەم 31]]
- [[_COMMUNITY_مۆدیوولی سیستەم 32|مۆدیوولی سیستەم 32]]
- [[_COMMUNITY_مۆدیوولی سیستەم 33|مۆدیوولی سیستەم 33]]
- [[_COMMUNITY_مۆدیوولی سیستەم 35|مۆدیوولی سیستەم 35]]
- [[_COMMUNITY_مۆدیوولی سیستەم 36|مۆدیوولی سیستەم 36]]
- [[_COMMUNITY_مۆدیوولی سیستەم 37|مۆدیوولی سیستەم 37]]

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 124 edges
2. `cn()` - 110 edges
3. `useAppContext()` - 93 edges
4. `Employee` - 38 edges
5. `Button` - 36 edges
6. `useToast()` - 36 edges
7. `Card` - 32 edges
8. `CardContent` - 30 edges
9. `CardHeader` - 29 edges
10. `CardTitle` - 29 edges

## Surprising Connections (you probably didn't know these)
- `DynamicFontInjector()` --calls--> `useAppContext()`  [EXTRACTED]
  app/client-layout.tsx → context/app-provider.tsx
- `AdminPage()` --calls--> `useAppContext()`  [EXTRACTED]
  app/admin/page.tsx → context/app-provider.tsx
- `AdminPanelPortalPage()` --calls--> `useTranslation()`  [EXTRACTED]
  app/adminpanel/page.tsx → hooks/use-translation.ts
- `InventoryDashboard()` --calls--> `useTranslation()`  [EXTRACTED]
  app/archive/[id]/page.tsx → hooks/use-translation.ts
- `DashboardSettingsSuite()` --calls--> `useTranslation()`  [EXTRACTED]
  app/settings/page.tsx → hooks/use-translation.ts

## Import Cycles
- None detected.

## Communities (42 total, 6 thin omitted)

### Community 0 - "سیستەمی بەڕێوەبردنی دەوام (Attendance System)"
Cohesion: 0.00
Nodes (500): account_details, account_details_desc, actions, add_bonus, add_bonus_record, add_bonus_record_desc, add_bonus_validation_error, add_daily_bonus (+492 more)

### Community 1 - "نەخشە و لۆکەیشنی جوگرافی (Maps & Geofence)"
Cohesion: 0.00
Nodes (500): account_details, account_details_desc, actions, add_bonus, add_bonus_record, add_bonus_record_desc, add_bonus_validation_error, add_daily_bonus (+492 more)

### Community 2 - "بەیەکەوەبەستنی گۆگڵ شیت و هەناردەکردن (Google Sheets Integration)"
Cohesion: 0.00
Nodes (499): admin_attendance, attendance, inputs, account_details, account_details_desc, actions, add_bonus, add_bonus_record (+491 more)

### Community 3 - "کۆنتڕۆڵ پانێڵی بەڕێوەبەر (Admin Dashboard & Settings)"
Cohesion: 0.00
Nodes (499): admin_attendance, attendance, inputs, account_details, account_details_desc, actions, add_bonus, add_bonus_record (+491 more)

### Community 4 - "سیستەمی کۆگا و کاڵاکان (Warehouse & Inventory)"
Cohesion: 0.07
Nodes (48): AdminDailyAttendanceTable(), AdminDailyAttendanceTableProps, KURDISH_DAY_NAMES, AdminEmployeeDetailsModal(), AdminEmployeeDetailsModalProps, formatMinutesHuman(), AdminExpensesModule(), AdminExpensesModuleProps (+40 more)

### Community 5 - "هەژماری کارمەندان و ناسینەوە (Employees & Users)"
Cohesion: 0.11
Nodes (44): FinancialDetailTable(), formatCurrency(), OvertimeDetailTable(), FileReportPdfProps, EmployeePdfCardProps, FinancialTablePdf(), formatCurrency(), OvertimeTablePdf() (+36 more)

### Community 6 - "ڕاپۆرت و دۆکیۆمێنت (Reports & Documents)"
Cohesion: 0.08
Nodes (55): AccountPage(), PageContent(), AppHeader(), PdfViewPage(), PdfViewPage(), FilePdfCard(), ArchivePage(), ExcelFileCard() (+47 more)

### Community 7 - "مۆدیوولی سیستەم 7"
Cohesion: 0.10
Nodes (26): classifications, ImportedItem, sources, MapFloor, MapHall, MapZone, TextTransform, WAREHOUSE_COLORS (+18 more)

### Community 8 - "مۆدیوولی سیستەم 8"
Cohesion: 0.11
Nodes (34): EmployeeReportPdf(), employeeRoles, formatCurrency(), InventoryDashboard(), SortableKeys, sources, FloorBuilder, SearchResult (+26 more)

### Community 9 - "مۆدیوولی سیستەم 9"
Cohesion: 0.11
Nodes (24): AttendanceRecord, Holiday, User, Warehouse, DashboardCard(), DashboardCardProps, COLORS, STATUS_NAMES (+16 more)

### Community 10 - "مۆدیوولی سیستەم 10"
Cohesion: 0.10
Nodes (36): AppContext, AppState, ViewMode, ActivityLog, AppConfig, Bonus, BonusData, CashWithdrawal (+28 more)

### Community 11 - "مۆدیوولی سیستەم 11"
Cohesion: 0.06
Nodes (37): useIsMobile(), AppSidebar(), SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+29 more)

### Community 12 - "مۆدیوولی سیستەم 12"
Cohesion: 0.06
Nodes (33): defaultAnswers, defaultBranchColors, defaultCardSettings, defaultDarkColors, defaultDatasheetSettings, defaultInvoiceSettings, defaultLightColors, defaultPdfSettings (+25 more)

### Community 13 - "مۆدیوولی سیستەم 13"
Cohesion: 0.10
Nodes (22): ai, ExtractedItem, ExtractedItemSchema, parsePdfInventory(), parsePdfInventoryFlow, ParsePdfInventoryInputSchema, ParsePdfInventoryOutputSchema, parsePrompt (+14 more)

### Community 14 - "مۆدیوولی سیستەم 14"
Cohesion: 0.11
Nodes (18): ClientLayout(), DynamicFontInjector(), metadata, viewport, LanguageContext, LanguageContextType, LanguageProvider(), ERP_THEMES (+10 more)

### Community 15 - "مۆدیوولی سیستەم 15"
Cohesion: 0.12
Nodes (19): useCollection(), UseCollectionResult, WithId, useDoc(), UseDocResult, WithId, Action, ActionType (+11 more)

### Community 16 - "مۆدیوولی سیستەم 16"
Cohesion: 0.19
Nodes (9): AutonomousGeofenceManager, GeofenceConfig, GeofenceRegion, getDistanceMeters(), sendLocalNotification(), MobileAttendanceMapModal(), MobileAttendanceMapModalProps, ASHLEY_DEFAULT_EMPLOYEES (+1 more)

### Community 17 - "مۆدیوولی سیستەم 17"
Cohesion: 0.27
Nodes (10): AttendanceRecord, EmployeeDashboardPrintView(), employeeRoles, DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay (+2 more)

### Community 18 - "مۆدیوولی سیستەم 18"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 19 - "مۆدیوولی سیستەم 19"
Cohesion: 0.23
Nodes (14): supabase, DELETE(), GET(), getAddressFromCoords(), getBaghdadDateTime(), getDailyToken(), getDistance(), getShiftForDate() (+6 more)

### Community 20 - "مۆدیوولی سیستەم 20"
Cohesion: 0.18
Nodes (9): AdminPanelPortalPage(), AuthContext, AuthState, defaultAdminUser, useAuth(), SearchResult, AccordionContent, AccordionItem (+1 more)

### Community 21 - "مۆدیوولی سیستەم 21"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 22 - "مۆدیوولی سیستەم 22"
Cohesion: 0.20
Nodes (11): AppProvider(), useFirestoreCollection(), deleteDocumentNonBlocking(), setDocumentNonBlocking(), updateDocumentNonBlocking(), useMemoFirebase(), Theme, ThemeProvider() (+3 more)

### Community 23 - "مۆدیوولی سیستەم 23"
Cohesion: 0.18
Nodes (6): FirebaseClientProviderProps, FirebaseServices, firebaseConfig, getSdks(), initializeFirebase(), FirebaseProvider()

### Community 24 - "مۆدیوولی سیستەم 24"
Cohesion: 0.22
Nodes (12): FirebaseContextState, FirebaseProviderProps, FirebaseServicesAndUser, MemoFirebase, useAuth(), useFirebase(), useFirebaseApp(), useFirestore() (+4 more)

### Community 25 - "مۆدیوولی سیستەم 25"
Cohesion: 0.24
Nodes (10): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+2 more)

### Community 26 - "مۆدیوولی سیستەم 26"
Cohesion: 0.21
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 27 - "مۆدیوولی سیستەم 27"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 28 - "مۆدیوولی سیستەم 28"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 30 - "مۆدیوولی سیستەم 30"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 31 - "مۆدیوولی سیستەم 31"
Cohesion: 0.60
Nodes (5): base64ToBuffer(), bufferToBase64(), isBiometricSupported(), registerBiometric(), verifyBiometric()

## Knowledge Gaps
- **2209 isolated node(s):** `ExtractedItemSchema`, `ParsePdfInventoryInputSchema`, `ParsePdfInventoryOutputSchema`, `parsePrompt`, `RealityCheckInputSchema` (+2204 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `ڕاپۆرت و دۆکیۆمێنت (Reports & Documents)` to `سیستەمی کۆگا و کاڵاکان (Warehouse & Inventory)`, `هەژماری کارمەندان و ناسینەوە (Employees & Users)`, `مۆدیوولی سیستەم 36`, `مۆدیوولی سیستەم 7`, `مۆدیوولی سیستەم 8`, `مۆدیوولی سیستەم 9`, `مۆدیوولی سیستەم 10`, `مۆدیوولی سیستەم 11`, `مۆدیوولی سیستەم 37`, `مۆدیوولی سیستەم 17`, `مۆدیوولی سیستەم 18`, `مۆدیوولی سیستەم 20`, `مۆدیوولی سیستەم 21`, `مۆدیوولی سیستەم 25`, `مۆدیوولی سیستەم 26`, `مۆدیوولی سیستەم 27`, `مۆدیوولی سیستەم 28`, `مۆدیوولی سیستەم 30`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `useAppContext()` connect `ڕاپۆرت و دۆکیۆمێنت (Reports & Documents)` to `سیستەمی کۆگا و کاڵاکان (Warehouse & Inventory)`, `هەژماری کارمەندان و ناسینەوە (Employees & Users)`, `مۆدیوولی سیستەم 7`, `مۆدیوولی سیستەم 8`, `مۆدیوولی سیستەم 9`, `مۆدیوولی سیستەم 10`, `مۆدیوولی سیستەم 11`, `مۆدیوولی سیستەم 14`, `مۆدیوولی سیستەم 17`, `مۆدیوولی سیستەم 20`, `مۆدیوولی سیستەم 22`, `مۆدیوولی سیستەم 26`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `useTranslation()` connect `ڕاپۆرت و دۆکیۆمێنت (Reports & Documents)` to `هەژماری کارمەندان و ناسینەوە (Employees & Users)`, `مۆدیوولی سیستەم 7`, `مۆدیوولی سیستەم 8`, `مۆدیوولی سیستەم 9`, `مۆدیوولی سیستەم 10`, `مۆدیوولی سیستەم 11`, `مۆدیوولی سیستەم 17`, `مۆدیوولی سیستەم 20`, `مۆدیوولی سیستەم 26`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `ExtractedItemSchema`, `ParsePdfInventoryInputSchema`, `ParsePdfInventoryOutputSchema` to the rest of the system?**
  _2209 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `سیستەمی بەڕێوەبردنی دەوام (Attendance System)` be split into smaller, more focused modules?**
  _Cohesion score 0.003992015968063872 - nodes in this community are weakly interconnected._
- **Should `نەخشە و لۆکەیشنی جوگرافی (Maps & Geofence)` be split into smaller, more focused modules?**
  _Cohesion score 0.003992015968063872 - nodes in this community are weakly interconnected._
- **Should `بەیەکەوەبەستنی گۆگڵ شیت و هەناردەکردن (Google Sheets Integration)` be split into smaller, more focused modules?**
  _Cohesion score 0.004 - nodes in this community are weakly interconnected._