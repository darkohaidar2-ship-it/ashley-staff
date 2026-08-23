# Graph Report - src  (2026-08-23)

## Corpus Check
- 165 files · ~145,856 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2758 nodes · 4623 edges · 46 communities (39 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_👥 HR & Staff Management (501 items)|👥 HR & Staff Management (501 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (501 items)|👥 HR & Staff Management (501 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (500 items)|📅 Attendance & Check-In (500 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (500 items)|📅 Attendance & Check-In (500 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (78 items)|👥 HR & Staff Management (78 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (70 items)|👥 HR & Staff Management (70 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (57 items)|👥 HR & Staff Management (57 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (45 items)|📅 Attendance & Check-In (45 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (43 items)|👥 HR & Staff Management (43 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (42 items)|⚙️ Core Providers & State (42 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (41 items)|📅 Attendance & Check-In (41 items)]]
- [[_COMMUNITY_⚡ Overtime & Shift Logic (38 items)|⚡ Overtime & Shift Logic (38 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (29 items)|👥 HR & Staff Management (29 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (27 items)|📅 Attendance & Check-In (27 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (25 items)|⚙️ Core Providers & State (25 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (21 items)|👥 HR & Staff Management (21 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (18 items)|⚙️ Core Providers & State (18 items)]]
- [[_COMMUNITY_🧩 components_ui_menubar_tsx (17 items)|🧩 components_ui_menubar_tsx (17 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (16 items)|📅 Attendance & Check-In (16 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (14 items)|⚙️ Core Providers & State (14 items)]]
- [[_COMMUNITY_🔒 Security & Auth (13 items)|🔒 Security & Auth (13 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (13 items)|👥 HR & Staff Management (13 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (13 items)|⚙️ Core Providers & State (13 items)]]
- [[_COMMUNITY_🧩 components_ui_toast_tsx (12 items)|🧩 components_ui_toast_tsx (12 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (12 items)|⚙️ Core Providers & State (12 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (12 items)|📅 Attendance & Check-In (12 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (11 items)|⚙️ Core Providers & State (11 items)]]
- [[_COMMUNITY_⚡ Overtime & Shift Logic (10 items)|⚡ Overtime & Shift Logic (10 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (9 items)|👥 HR & Staff Management (9 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (8 items)|📅 Attendance & Check-In (8 items)]]
- [[_COMMUNITY_🧩 components_card_card (7 items)|🧩 components_card_card (7 items)]]
- [[_COMMUNITY_👥 HR & Staff Management (6 items)|👥 HR & Staff Management (6 items)]]
- [[_COMMUNITY_👤 AI Face Recognition (6 items)|👤 AI Face Recognition (6 items)]]
- [[_COMMUNITY_📅 Attendance & Check-In (5 items)|📅 Attendance & Check-In (5 items)]]
- [[_COMMUNITY_⚙️ Core Providers & State (5 items)|⚙️ Core Providers & State (5 items)]]
- [[_COMMUNITY_🔒 Security & Auth (4 items)|🔒 Security & Auth (4 items)]]
- [[_COMMUNITY_🗺️ Maps & Logistics (4 items)|🗺️ Maps & Logistics (4 items)]]
- [[_COMMUNITY_🧩 components_ui_alert_tsx (4 items)|🧩 components_ui_alert_tsx (4 items)]]
- [[_COMMUNITY_🧩 lib_placeholder_images_im (4 items)|🧩 lib_placeholder_images_im (4 items)]]
- [[_COMMUNITY_🧩 components_ui_scroll_area (3 items)|🧩 components_ui_scroll_area (3 items)]]
- [[_COMMUNITY_🧩 components_ui_radio_group (3 items)|🧩 components_ui_radio_group (3 items)]]
- [[_COMMUNITY_🧩 admin_adminpasswordchange (3 items)|🧩 admin_adminpasswordchange (3 items)]]

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
- `AdminPanelPortalPage()` --calls--> `useTranslation()`  [EXTRACTED]
  app/adminpanel/page.tsx → hooks/use-translation.ts
- `AdminFaceEnrollModalProps` --references--> `Employee`  [EXTRACTED]
  components/attendance/AdminFaceEnrollModal.tsx → lib/types.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/dropdown-menu.tsx → lib/utils.ts
- `MenubarShortcut()` --calls--> `cn()`  [EXTRACTED]
  components/ui/menubar.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (46 total, 7 thin omitted)

### Community 0 - "👥 HR & Staff Management (501 items)"
Cohesion: 0.00
Nodes (500): account_details, account_details_desc, actions, add_bonus, add_bonus_record, add_bonus_record_desc, add_bonus_validation_error, add_daily_bonus (+492 more)

### Community 1 - "👥 HR & Staff Management (501 items)"
Cohesion: 0.00
Nodes (500): account_details, account_details_desc, actions, add_bonus, add_bonus_record, add_bonus_record_desc, add_bonus_validation_error, add_daily_bonus (+492 more)

### Community 2 - "📅 Attendance & Check-In (500 items)"
Cohesion: 0.00
Nodes (499): admin_attendance, attendance, inputs, account_details, account_details_desc, actions, add_bonus, add_bonus_record (+491 more)

### Community 3 - "📅 Attendance & Check-In (500 items)"
Cohesion: 0.00
Nodes (499): admin_attendance, attendance, inputs, account_details, account_details_desc, actions, add_bonus, add_bonus_record (+491 more)

### Community 4 - "👥 HR & Staff Management (78 items)"
Cohesion: 0.08
Nodes (47): employeeRoles, employeeRoles, SortableKeys, classifications, ImportedItem, ImportPage(), sources, sources (+39 more)

### Community 5 - "👥 HR & Staff Management (70 items)"
Cohesion: 0.06
Nodes (63): AccountPage(), AdminPage(), PdfViewPage(), PdfViewPage(), FilePdfCard(), ArchivePage(), ExcelFileCard(), AshleyExpensesDashboard() (+55 more)

### Community 6 - "👥 HR & Staff Management (57 items)"
Cohesion: 0.13
Nodes (37): FileReportPdfProps, FinancialTablePdf(), formatCurrency(), OvertimeTablePdf(), DailyExpenseReportPdf(), DailyExpenseReportPdfProps, formatCurrency(), ExpenseReportPdf() (+29 more)

### Community 7 - "📅 Attendance & Check-In (45 items)"
Cohesion: 0.14
Nodes (34): AdminDailyAttendanceTable(), AdminDailyAttendanceTableProps, KURDISH_DAY_NAMES, AdminEmployeeDetailsModal(), AdminEmployeeDetailsModalProps, formatMinutesHuman(), AdminExpensesModule(), AdminExpensesModuleProps (+26 more)

### Community 8 - "👥 HR & Staff Management (43 items)"
Cohesion: 0.15
Nodes (20): DashboardCard(), DashboardCardProps, COLORS, STATUS_NAMES, StatusKey, ActivityData, Item, StorageLocation (+12 more)

### Community 9 - "⚙️ Core Providers & State (42 items)"
Cohesion: 0.06
Nodes (37): useIsMobile(), AppSidebar(), SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+29 more)

### Community 10 - "📅 Attendance & Check-In (41 items)"
Cohesion: 0.12
Nodes (23): AttendanceRecord, AttendanceRecord, Holiday, User, Warehouse, SearchResult, MapFloor, MapHall (+15 more)

### Community 11 - "⚡ Overtime & Shift Logic (38 items)"
Cohesion: 0.10
Nodes (33): AppContext, AppState, ViewMode, ActivityLog, AppConfig, Bonus, BonusData, CashWithdrawal (+25 more)

### Community 12 - "👥 HR & Staff Management (29 items)"
Cohesion: 0.09
Nodes (27): defaultAnswers, defaultBranchColors, defaultCardSettings, defaultDarkColors, defaultDatasheetSettings, defaultInvoiceSettings, defaultLightColors, defaultPdfSettings (+19 more)

### Community 13 - "📅 Attendance & Check-In (27 items)"
Cohesion: 0.10
Nodes (22): ai, ExtractedItem, ExtractedItemSchema, parsePdfInventory(), parsePdfInventoryFlow, ParsePdfInventoryInputSchema, ParsePdfInventoryOutputSchema, parsePrompt (+14 more)

### Community 14 - "⚙️ Core Providers & State (25 items)"
Cohesion: 0.11
Nodes (18): ClientLayout(), DynamicFontInjector(), metadata, viewport, LanguageContext, LanguageContextType, LanguageProvider(), ERP_THEMES (+10 more)

### Community 15 - "👥 HR & Staff Management (21 items)"
Cohesion: 0.14
Nodes (16): AppHeader(), EmployeePdfCard(), EmployeePdfCardProps, useTheme(), Avatar, AvatarFallback, AvatarImage, DropdownMenuCheckboxItem (+8 more)

### Community 16 - "⚙️ Core Providers & State (18 items)"
Cohesion: 0.14
Nodes (16): useCollection(), UseCollectionResult, WithId, Action, ActionType, actionTypes, addToRemoveQueue(), dispatch() (+8 more)

### Community 17 - "🧩 components_ui_menubar_tsx (17 items)"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 18 - "📅 Attendance & Check-In (16 items)"
Cohesion: 0.24
Nodes (14): generateAugust2026AttendanceRecords(), supabase, DELETE(), GET(), getAddressFromCoords(), getBaghdadDateTime(), getDailyToken(), getDistance() (+6 more)

### Community 19 - "⚙️ Core Providers & State (14 items)"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 20 - "🔒 Security & Auth (13 items)"
Cohesion: 0.18
Nodes (6): firebaseConfig, getSdks(), initializeFirebase(), useDoc(), UseDocResult, WithId

### Community 21 - "👥 HR & Staff Management (13 items)"
Cohesion: 0.22
Nodes (12): FirebaseContextState, FirebaseProviderProps, FirebaseServicesAndUser, MemoFirebase, useAuth(), useFirebase(), useFirebaseApp(), useFirestore() (+4 more)

### Community 22 - "⚙️ Core Providers & State (13 items)"
Cohesion: 0.22
Nodes (10): AppProvider(), useFirestoreCollection(), deleteDocumentNonBlocking(), setDocumentNonBlocking(), updateDocumentNonBlocking(), useMemoFirebase(), Theme, ThemeProvider() (+2 more)

### Community 23 - "🧩 components_ui_toast_tsx (12 items)"
Cohesion: 0.24
Nodes (10): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+2 more)

### Community 24 - "⚙️ Core Providers & State (12 items)"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 25 - "📅 Attendance & Check-In (12 items)"
Cohesion: 0.27
Nodes (7): CompanyLocation, AdminFaceEnrollModal(), AdminFaceEnrollModalProps, extractFaceDescriptor(), getFaceApi(), loadFaceModels(), matchFaceDescriptors()

### Community 26 - "⚙️ Core Providers & State (11 items)"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 27 - "⚡ Overtime & Shift Logic (10 items)"
Cohesion: 0.27
Nodes (6): FinancialDetailTable(), formatCurrency(), OvertimeDetailTable(), PageContent(), AdminPanelPortalPage(), useAuth()

### Community 29 - "📅 Attendance & Check-In (8 items)"
Cohesion: 0.29
Nodes (5): initialData, EMPLOYEE_NAME_ALIASES, matchEmployeeByName(), normalizeKurdishText(), SheetOvertimeEntry

### Community 30 - "🧩 components_card_card (7 items)"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 31 - "👥 HR & Staff Management (6 items)"
Cohesion: 0.40
Nodes (4): AuthContext, AuthState, defaultAdminUser, User

### Community 32 - "👤 AI Face Recognition (6 items)"
Cohesion: 0.60
Nodes (5): base64ToBuffer(), bufferToBase64(), isBiometricSupported(), registerBiometric(), verifyBiometric()

### Community 34 - "⚙️ Core Providers & State (5 items)"
Cohesion: 0.40
Nodes (3): FirebaseClientProviderProps, FirebaseServices, FirebaseProvider()

### Community 36 - "🗺️ Maps & Logistics (4 items)"
Cohesion: 0.50
Nodes (3): CompanyLocation, FactoryMapPicker(), FactoryMapPickerProps

### Community 37 - "🧩 components_ui_alert_tsx (4 items)"
Cohesion: 0.50
Nodes (3): AlertDescription, AlertTitle, alertVariants

## Knowledge Gaps
- **2203 isolated node(s):** `ExtractedItemSchema`, `ParsePdfInventoryInputSchema`, `ParsePdfInventoryOutputSchema`, `parsePrompt`, `RealityCheckInputSchema` (+2198 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `👥 HR & Staff Management (70 items)` to `👥 HR & Staff Management (78 items)`, `🧩 components_ui_alert_tsx (4 items)`, `👥 HR & Staff Management (57 items)`, `👥 HR & Staff Management (43 items)`, `⚙️ Core Providers & State (42 items)`, `📅 Attendance & Check-In (41 items)`, `🧩 components_ui_radio_group (3 items)`, `🧩 components_ui_scroll_area (3 items)`, `👥 HR & Staff Management (21 items)`, `🧩 components_ui_menubar_tsx (17 items)`, `⚙️ Core Providers & State (14 items)`, `🧩 components_ui_toast_tsx (12 items)`, `⚙️ Core Providers & State (12 items)`, `⚙️ Core Providers & State (11 items)`, `⚡ Overtime & Shift Logic (10 items)`, `🧩 components_card_card (7 items)`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `useTranslation()` connect `👥 HR & Staff Management (70 items)` to `👥 HR & Staff Management (78 items)`, `👥 HR & Staff Management (57 items)`, `👥 HR & Staff Management (43 items)`, `⚙️ Core Providers & State (42 items)`, `📅 Attendance & Check-In (41 items)`, `👥 HR & Staff Management (21 items)`, `⚡ Overtime & Shift Logic (10 items)`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `useAppContext()` connect `👥 HR & Staff Management (70 items)` to `👥 HR & Staff Management (78 items)`, `👥 HR & Staff Management (57 items)`, `📅 Attendance & Check-In (45 items)`, `👥 HR & Staff Management (43 items)`, `⚙️ Core Providers & State (42 items)`, `📅 Attendance & Check-In (41 items)`, `⚡ Overtime & Shift Logic (38 items)`, `⚙️ Core Providers & State (25 items)`, `👥 HR & Staff Management (21 items)`, `⚙️ Core Providers & State (13 items)`, `⚡ Overtime & Shift Logic (10 items)`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `ExtractedItemSchema`, `ParsePdfInventoryInputSchema`, `ParsePdfInventoryOutputSchema` to the rest of the system?**
  _2203 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `👥 HR & Staff Management (501 items)` be split into smaller, more focused modules?**
  _Cohesion score 0.003992015968063872 - nodes in this community are weakly interconnected._
- **Should `👥 HR & Staff Management (501 items)` be split into smaller, more focused modules?**
  _Cohesion score 0.003992015968063872 - nodes in this community are weakly interconnected._
- **Should `📅 Attendance & Check-In (500 items)` be split into smaller, more focused modules?**
  _Cohesion score 0.004 - nodes in this community are weakly interconnected._