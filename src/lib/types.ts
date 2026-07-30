
export type Translations = Record<string, string>;

export type Language = 'en' | 'ku';

export type User = {
    id: string;
    username: string;
    fullName?: string;
    password?: string;
    roleId: string;
};

export type Role = {
    id: string;
    name: string;
    permissions: string[];
};

export type Permission = {
    id: string;
    description: string;
};

export type ActivityLog = {
  id: string;
  userId: string; 
  username: string; 
  action: 'create' | 'update' | 'delete' | 'login' | 'logout';
  entity: string; 
  entityId?: string;
  description: string;
  timestamp: string; 
};

export type Employee = {
  id: string;
  name: string;
  kurdishName?: string | null;
  employeeId?: string | null;
  role?: 'Super Manager' | 'Manager' | 'IT' | 'Employee Supervisor' | 'Transport Supervisor' | 'Employee' | 'Marketing' | null;
  employmentStartDate?: string | null;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
  password?: string;
  isActive?: boolean;
};

export type ExcelFile = {
  id: string;
  storekeeperId: string;
  storageName: string;
  categoryName:string;
  classification?: string;
  date: string;
  source: string;
  type: 'new' | 'imported' | 'google-sheet';
  externalLink?: string;
};

export type Item = {
  id:string;
  fileId: string;
  name?: string;
  model: string;
  quantity: number;
  classification?: string;
  notes?: string; // Locked notes from original file
  entryNote?: string; // New notes from data entry
  placementNote?: string;
  storageStatus?: 'Correct' | 'Less' | 'More' | 'Qty Changed' | '';
  newQty?: number; // Final adjusted quantity
  modelCondition?: 'Packaged' | 'Wrapped' | 'Damaged' | 'Need Wrapped' | '';
  conditionQty?: number; // Qty for non-packaged states
  quantityPerCondition?: number;
  locationIds?: string[];
  updateStatus?: 'NEW' | 'UPDATED' | 'DELETED' | '';
  locationHistory?: { locationNames: string; updatedAt: string }[];
};

export type SoldItemsListItem = {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  categoryId: string;
};

export type SoldItemsList = {
  id: string;
  name: string;
  date: string;
  items: SoldItemsListItem[];
};

export type StorageLocation = {
  id: string;
  name: string;
  warehouseType: string;
};

export type Expense = {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  notes?: string;
  expenseReportId: string;
  expenseType: string;
  expenseSubType?: string;
};

export type ExpenseReport = {
  id: string;
  reportName: string;
  reportDate: string;
  totalAmount: number;
};

export type Overtime = {
  id: string;
  employeeId: string;
  date: string;
  hours: number;
  rate: number;
  totalAmount: number;
  notes?: string;
};

export type Bonus = {
  id: string;
  employeeId: string;
  date: string;
  loadCount: number;
  rate: number;
  totalAmount: number;
  notes?: string;
};

export type BonusData = {
  totalLoads: number;
  totalAmount: number;
};

export type CashWithdrawal = {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  notes?: string;
};

export type ItemCategory = {
    id: string;
    name: string;
};

export type Transfer = {
  id: string;
  transferDate: string;
  cargoName: string;
  destinationCity: string;
  driverName: string;
  warehouseManagerName: string;
  itemIds: string[];
  invoiceNumber: number;
};

export type ItemForTransfer = {
  id: string;
  model: string;
  quantity: number;
  destination: string;
  notes?: string;
  transferId?: string | null;
  createdAt: string;
  invoiceNo?: string;
  storage?: string;
  requestDate?: string;
  status?: string;
};

export type OrderRequest = {
  id: string;
  requestedBy: string;
  requestDate?: string;
  model: string;
  quantity: number;
  destination: string;
  invoiceNo?: string;
  notes?: string;
  status: 'Pending' | 'Approved' | 'Completed';
  createdAt: string;
};

export type NewItem = Omit<Item, 'id' | 'fileId' | 'storageStatus' | 'modelCondition' | 'quantityPerCondition' | 'updateStatus'> & {
  tempId: number;
  locationIds: string[];
};

export type MarketingFeedback = {
    id: string;
    employeeId: string;
    totalScore: number;
    date: string;
    responses: { questionId: string; answer: number }[];
};

export type AnswerOption = {
    label: string;
    value: number;
};

export type EvaluationQuestion = {
    id: string;
    text: string;
    answers: [AnswerOption, AnswerOption, AnswerOption];
};

export type ReportColors = {
  general: string;
  expense: string;
  overtime: string;
  bonus: string;
  withdrawal: string;
}

export type BranchColors = {
  Erbil?: string;
  Baghdad?: string;
  Dohuk?: string;
  Diwan?: string;
}

export type PdfSettings = {
    logo?: string | null;
    themeColor?: string;
    secondaryColor?: string;
    reportColors?: ReportColors;
    branchColors?: BranchColors;
    tableTheme?: 'striped' | 'grid';
    headerText?: string;
    footerText?: string;
    titleTemplate?: string;
    loginCardColor?: string;
    hideLoginBg?: boolean;
    scale?: number;
    width?: number;
    fontSize?: number;
}

export type AllPdfSettings = {
    report: PdfSettings;
    invoice: PdfSettings;
    card: PdfSettings;
    datasheet: PdfSettings;
};

export type ThemeColors = {
  background: string;
  foreground: string;
  primary: string;
  accent: string;
  card: string;
  titleBar: string;
  tabActiveBackground: string;
  tabActiveForeground: string;
  tableRowPrimary: string;
  tableRowSecondary: string;
  huanaHighlight: string;
  locationOccupiedBorder: string;
  locationOccupiedBg: string;
}

export type ReportHeaderColors = {
    ashleyExpenses: string;
    transmitCargo: string;
    placementStorage: string;
    marketingFeedback: string;
    employees: string;
}

export type SalarySettings = {
    overtimeRate: number;
    bonusRate: number;
}

export type TextTransform = 'none' | 'uppercase' | 'capitalize';

export type DashboardSettings = {
  fontSize: number;
  cardRadius: number;
  titleColor: string;
  textColor: string;
  accentColor: string;
  textTransform: TextTransform;
  activeCardBackground: string;
  activeCardBorder: string;
  buttonColor: string;
  buttonTextColor: string;
};

export type SidebarSettings = {
  fontSize: number;
  textTransform: TextTransform;
  activeTabBackground: string;
  activeTabTextColor: string;
  activeTabBorder: string;
};

export type AppSettings = {
  appLogo: string | null;
  mainBackground: string | null;
  loginBackground: string | null;
  loginBackgroundVideo: string | null;
  loginBackgroundEmbed: string | null;
  loginVideoLaptop: string | null;
  loginVideoTablet: string | null;
  loginVideoPhone: string | null;
  loginCardUpperImage: string | null;
  loginButtonColor: string | null;
  dashboardBanner: string | null;
  dashboardBannerHeight: number;
  newsTickerText: string;
  fontFamily: string;
  customFont: string | null;
  printHeaderImage: string | null;
  printFooterImage: string | null;
  translations: {
      en: Translations;
      ku: Translations;
  };
  pdfSettings: AllPdfSettings;
  lightThemeColors: ThemeColors;
  darkThemeColors: ThemeColors;
  salarySettings: SalarySettings;
  reportHeaderColors: ReportHeaderColors;
  dashboard: DashboardSettings;
  sidebar: SidebarSettings;
  theme: 'light' | 'dark';
  selectedTheme: string;
  language: Language;
  globalTextSize: number;
  branchTextSize: number;
  customColors?: Record<string, string>;
  factoryLocation?: {
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  };
};

export type MapZone = {
    id: string;
    name: string;
    type: 'Rack' | 'Office' | 'Room' | 'Bin' | 'Zone' | 'General';
    itemCount: number;
    capacity?: number;
    color?: string; // Hex color for the card background
};

export type MapFloor = {
    id: string;
    name: string;
    zones: MapZone[];
};

export type MapHall = {
    id: string;
    name: string;
    floors: MapFloor[];
    zones?: MapZone[];
};

export type WarehouseMap = {
    id: string;
    name: string;
    warehouseType?: string;
    layoutShape?: 'U' | 'I' | 'L';
    halls: MapHall[];
    zones?: MapZone[];
};

export type Transaction = {
  id: string;
  employeeName: string;
  date: string;
  amount: number;
  note: string;
  description?: string;
  createdAt: number;
};

export type OvertimeRecord = {
  id: string;
  employeeName: string;
  date: string;
  hours: number;
  pay: number;
  note: string;
  createdAt: number;
};

export type AppConfig = {
  appName: string;
  overtimeRate: number;
  loadRate: number;
  logo: string;
  font: string;
  colors: {
    brand: string;
    sidebar: string;
  };
};

