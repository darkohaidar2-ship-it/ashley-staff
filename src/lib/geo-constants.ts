export interface CompanyGeoLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export const ASHLEY_BASE_LOCATION: CompanyGeoLocation = {
  id: 'ashley-base-main',
  name: 'کۆمپانیای سەرەکی ئاشڵی',
  lat: Number(process.env.NEXT_PUBLIC_ASHLEY_BASE_LAT || 35.5571),
  lng: Number(process.env.NEXT_PUBLIC_ASHLEY_BASE_LNG || 45.4352),
  radiusMeters: 100,
};

export const HUANA_WAREHOUSE_LOCATION: CompanyGeoLocation = {
  id: 'huana-warehouse-main',
  name: 'کۆگای سەرەکی هوانە',
  lat: Number(process.env.NEXT_PUBLIC_HUANA_WAREHOUSE_LAT || 35.6012),
  lng: Number(process.env.NEXT_PUBLIC_HUANA_WAREHOUSE_LNG || 45.3850),
  radiusMeters: 120,
};

export const DEFAULT_COMPANY_LOCATIONS: CompanyGeoLocation[] = [
  ASHLEY_BASE_LOCATION,
  HUANA_WAREHOUSE_LOCATION,
];

export const DEFAULT_FACTORY_LOCATION = {
  name: ASHLEY_BASE_LOCATION.name,
  lat: ASHLEY_BASE_LOCATION.lat,
  lng: ASHLEY_BASE_LOCATION.lng,
  radiusMeters: 500,
};
