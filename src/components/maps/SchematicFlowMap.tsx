'use client';

import React, { useMemo } from 'react';
import { StorageLocation, WarehouseMap, MapZone } from '@/lib/types';
import { ArrowRight, Compass, Info } from 'lucide-react';

interface SchematicFlowMapProps {
    warehouseMap: WarehouseMap;
    itemLocations: StorageLocation[];
    className?: string;
}

const translateDynamicName = (name: string) => {
    if (!name) return name;
    const nameLower = name.toLowerCase();
    if (nameLower.includes('ashley')) return 'کۆگایی سەرەکی ئاشڵی';
    if (nameLower.includes('huana')) return 'کۆگایی هوانە';
    
    // Halls / levels
    if (nameLower.includes('level: h1') || name === 'H1') return 'کۆگای ١ هوانە';
    if (nameLower.includes('level: h2') || name === 'H2') return 'کۆگای ٢ هوانە';
    if (nameLower.includes('level: h3') || name === 'H3') return 'کۆگای ٣ هوانە';
    if (nameLower.includes('level: k1') || name === 'K1') return 'کۆگای ٤ هوانە';
    if (nameLower.includes('level: a3') || name === 'A3') return 'قاتی ٣ ئاشڵی';
    if (nameLower.includes('level: a4') || name === 'A4') return 'قاتی ٤ ئاشڵی';
    
    // General Level: mapping
    if (nameLower.startsWith('level:')) {
        const val = name.substring(6).trim();
        if (val === 'H1') return 'کۆگای ١ هوانە';
        if (val === 'H2') return 'کۆگای ٢ هوانە';
        if (val === 'H3') return 'کۆگای ٣ هوانە';
        if (val === 'K1') return 'کۆگای ٤ هوانە';
        if (val === 'A3') return 'قاتی ٣ ئاشڵی';
        if (val === 'A4') return 'قاتی ٤ ئاشڵی';
        return val;
    }
    
    // Area mapping
    if (nameLower.startsWith('area:')) {
        const val = name.substring(5).trim();
        if (val.startsWith('C')) {
            return `ناوچەی C${val.substring(1)}`;
        }
        if (val.startsWith('O')) {
            return `ئۆفیس ${val.substring(1)}`;
        }
        return `زۆنی ${val}`;
    }
    
    // Floors
    if (nameLower.includes('floor 1') || nameLower.includes('level 1') || nameLower.includes('area: 1') || nameLower === '1' || nameLower === 'f-1') return 'قاتی ١';
    if (nameLower.includes('floor 2') || nameLower.includes('level 2') || nameLower.includes('area: 2') || nameLower === '2' || nameLower === 'f-2') return 'قاتی ٢';
    if (nameLower.includes('floor 3') || nameLower.includes('level 3') || nameLower.includes('area: 3') || nameLower === '3' || nameLower === 'f-3') return 'قاتی ٣';
    if (nameLower.includes('floor 4') || nameLower.includes('level 4') || nameLower.includes('area: 4') || nameLower === '4' || nameLower === 'f-4') return 'قاتی ٤';
    
    // Fallback parsing for other numbers
    if (nameLower.startsWith('floor ') || nameLower.startsWith('level ')) {
        const num = name.split(' ').pop();
        if (num && !isNaN(Number(num))) {
            return `قاتی ${num}`;
        }
    }
    
    if (nameLower === 'showroom hall') return 'هۆڵی نمایشگا';
    if (nameLower === 'storage complex') return 'کۆمەڵگەی کۆگا';
    if (nameLower === 'first floor') return 'قاتی یەکەم';
    if (nameLower === 'ground floor') return 'قاتی زەوی';
    
    return name;
};

export function SchematicFlowMap({ warehouseMap, itemLocations, className }: SchematicFlowMapProps) {
    const shape = warehouseMap.layoutShape || 'U';

    // Identify active sectors
    const activeSectors = useMemo(() => {
        const sectors = new Set<'receiving' | 'dynamic' | 'static' | 'shipping'>();
        
        itemLocations.forEach(loc => {
            // Find matching zone in the warehouse map
            let matchedZone: MapZone | undefined;
            for (const hall of warehouseMap.halls) {
                for (const floor of hall.floors) {
                    const zone = floor.zones.find(z => z.name === loc.name);
                    if (zone) {
                        matchedZone = zone;
                        break;
                    }
                }
                if (matchedZone) break;
            }

            const nameLower = loc.name.toLowerCase();
            const type = matchedZone?.type || '';

            if (type === 'Bin' || nameLower.includes('bin') || nameLower.includes('receiving') || nameLower.includes('bay')) {
                sectors.add('receiving');
            } else if (type === 'Rack' || nameLower.includes('rack') || nameLower.includes('-r-') || nameLower.includes('-l-')) {
                sectors.add('dynamic');
            } else if (type === 'Zone' || type === 'Room' || type === 'Office' || nameLower.includes('zone') || nameLower.includes('office')) {
                sectors.add('static');
            } else if (type === 'General' || nameLower.includes('shipping') || nameLower.includes('general')) {
                sectors.add('shipping');
            } else {
                sectors.add('static'); // fallback
            }
        });

        return sectors;
    }, [warehouseMap, itemLocations]);

    // Sector Styling Helper
    const getSectorStyle = (sector: 'receiving' | 'dynamic' | 'static' | 'shipping') => {
        const isActive = activeSectors.has(sector);
        if (isActive) {
            switch (sector) {
                case 'receiving':
                    return {
                        fill: 'rgba(59, 130, 246, 0.15)', // Blue
                        stroke: '#3b82f6',
                        strokeWidth: '2.5px',
                        textColor: '#1d4ed8',
                        glow: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.35))'
                    };
                case 'dynamic':
                    return {
                        fill: 'rgba(245, 158, 11, 0.15)', // Amber
                        stroke: '#f59e0b',
                        strokeWidth: '2.5px',
                        textColor: '#b45309',
                        glow: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.35))'
                    };
                case 'static':
                    return {
                        fill: 'rgba(16, 185, 129, 0.15)', // Emerald
                        stroke: '#10b981',
                        strokeWidth: '2.5px',
                        textColor: '#047857',
                        glow: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.35))'
                    };
                case 'shipping':
                    return {
                        fill: 'rgba(168, 85, 247, 0.15)', // Purple
                        stroke: '#a855f7',
                        strokeWidth: '2.5px',
                        textColor: '#7e22ce',
                        glow: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.35))'
                    };
            }
        }
        return {
            fill: '#f8fafc',
            stroke: '#e2e8f0',
            strokeWidth: '1.5px',
            textColor: '#64748b',
            glow: 'none'
        };
    };

    return (
        <div className={`flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-900 border border-slate-200/50 rounded-2xl ${className}`} dir="rtl">
            <div className="flex items-center justify-between w-full mb-6 border-b pb-3 border-slate-100">
                <div className="flex items-center gap-2">
                    <Compass className="w-5 h-5 text-primary" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-800">هێڵکاری کۆگا: {translateDynamicName(warehouseMap.name)}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            شێوازی ڕۆیشتنی کاڵاکان: {shape === 'U' ? 'شێوەی U' : shape === 'I' ? 'شێوەی I' : 'شێوەی L'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {Array.from(activeSectors).map(sec => (
                        <span key={sec} className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/10">
                            {sec === 'receiving' ? 'وەرگرتن' : sec === 'dynamic' ? 'ڕەفە (جوڵاو)' : sec === 'static' ? 'زۆن (جێگیر)' : 'ناردن'}
                        </span>
                    ))}
                </div>
            </div>

            {/* SVG Visual Layouts */}
            <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-4 border border-dashed">
                {shape === 'U' && (
                    <svg viewBox="0 0 500 350" className="w-full h-full">
                        <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                            </marker>
                        </defs>
                        {/* Sector: Receiving */}
                        <g style={{ filter: getSectorStyle('receiving').glow }}>
                            <rect x="40" y="40" width="90" height="180" rx="16" 
                                fill={getSectorStyle('receiving').fill} 
                                stroke={getSectorStyle('receiving').stroke} 
                                strokeWidth={getSectorStyle('receiving').strokeWidth} 
                            />
                            <text x="85" y="120" textAnchor="middle" fill={getSectorStyle('receiving').textColor} className="text-xs font-black">وەرگرتن</text>
                            <text x="85" y="140" textAnchor="middle" fill={getSectorStyle('receiving').textColor} className="text-[9px] opacity-60">وەرگرتنی کاڵاکان</text>
                        </g>

                        {/* Sector: Dynamic Storage */}
                        <g style={{ filter: getSectorStyle('dynamic').glow }}>
                            <rect x="150" y="150" width="200" height="150" rx="16" 
                                fill={getSectorStyle('dynamic').fill} 
                                stroke={getSectorStyle('dynamic').stroke} 
                                strokeWidth={getSectorStyle('dynamic').strokeWidth} 
                            />
                            <text x="250" y="220" textAnchor="middle" fill={getSectorStyle('dynamic').textColor} className="text-xs font-black">ڕەفەکان (جوڵاو)</text>
                            <text x="250" y="240" textAnchor="middle" fill={getSectorStyle('dynamic').textColor} className="text-[9px] opacity-60">ڕەفەی داینامیکی</text>
                        </g>

                        {/* Sector: Static Storage */}
                        <g style={{ filter: getSectorStyle('static').glow }}>
                            <rect x="150" y="40" width="200" height="90" rx="16" 
                                fill={getSectorStyle('static').fill} 
                                stroke={getSectorStyle('static').stroke} 
                                strokeWidth={getSectorStyle('static').strokeWidth} 
                            />
                            <text x="250" y="80" textAnchor="middle" fill={getSectorStyle('static').textColor} className="text-xs font-black">زۆنەکان (جێگیر)</text>
                            <text x="250" y="100" textAnchor="middle" fill={getSectorStyle('static').textColor} className="text-[9px] opacity-60">ناوچەی جێگیر</text>
                        </g>

                        {/* Sector: Shipping */}
                        <g style={{ filter: getSectorStyle('shipping').glow }}>
                            <rect x="370" y="40" width="90" height="180" rx="16" 
                                fill={getSectorStyle('shipping').fill} 
                                stroke={getSectorStyle('shipping').stroke} 
                                strokeWidth={getSectorStyle('shipping').strokeWidth} 
                            />
                            <text x="415" y="120" textAnchor="middle" fill={getSectorStyle('shipping').textColor} className="text-xs font-black">ناردن</text>
                            <text x="415" y="140" textAnchor="middle" fill={getSectorStyle('shipping').textColor} className="text-[9px] opacity-60">ناردنی کاڵاکان</text>
                        </g>

                        {/* Flow Arrow (U-Shape) */}
                        <path 
                            d="M 85,250 L 85,280 Q 85,325 130,325 L 370,325 Q 415,325 415,280 L 415,250" 
                            fill="none" 
                            stroke="#cbd5e1" 
                            strokeWidth="3" 
                            strokeDasharray="6,6"
                            markerEnd="url(#arrow)"
                        />
                    </svg>
                )}

                {shape === 'I' && (
                    <svg viewBox="0 0 350 500" className="w-full h-full">
                        <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                            </marker>
                        </defs>
                        {/* Sector: Receiving */}
                        <g style={{ filter: getSectorStyle('receiving').glow }}>
                            <rect x="40" y="40" width="270" height="90" rx="16" 
                                fill={getSectorStyle('receiving').fill} 
                                stroke={getSectorStyle('receiving').stroke} 
                                strokeWidth={getSectorStyle('receiving').strokeWidth} 
                            />
                            <text x="175" y="80" textAnchor="middle" fill={getSectorStyle('receiving').textColor} className="text-xs font-black">وەرگرتنی کاڵاکان (وەرگرتن)</text>
                        </g>

                        {/* Sector: Dynamic Storage */}
                        <g style={{ filter: getSectorStyle('dynamic').glow }}>
                            <rect x="40" y="150" width="125" height="200" rx="16" 
                                fill={getSectorStyle('dynamic').fill} 
                                stroke={getSectorStyle('dynamic').stroke} 
                                strokeWidth={getSectorStyle('dynamic').strokeWidth} 
                            />
                            <text x="102" y="240" textAnchor="middle" fill={getSectorStyle('dynamic').textColor} className="text-xs font-black">ڕەفە (جوڵاو)</text>
                            <text x="102" y="260" textAnchor="middle" fill={getSectorStyle('dynamic').textColor} className="text-[9px] opacity-60">ڕەفەی داینامیکی</text>
                        </g>

                        {/* Sector: Static Storage */}
                        <g style={{ filter: getSectorStyle('static').glow }}>
                            <rect x="185" y="150" width="125" height="200" rx="16" 
                                fill={getSectorStyle('static').fill} 
                                stroke={getSectorStyle('static').stroke} 
                                strokeWidth={getSectorStyle('static').strokeWidth} 
                            />
                            <text x="247" y="240" textAnchor="middle" fill={getSectorStyle('static').textColor} className="text-xs font-black">زۆن (جێگیر)</text>
                            <text x="247" y="260" textAnchor="middle" fill={getSectorStyle('static').textColor} className="text-[9px] opacity-60">ناوچەی جێگیر</text>
                        </g>

                        {/* Sector: Shipping */}
                        <g style={{ filter: getSectorStyle('shipping').glow }}>
                            <rect x="40" y="370" width="270" height="90" rx="16" 
                                fill={getSectorStyle('shipping').fill} 
                                stroke={getSectorStyle('shipping').stroke} 
                                strokeWidth={getSectorStyle('shipping').strokeWidth} 
                            />
                            <text x="175" y="415" textAnchor="middle" fill={getSectorStyle('shipping').textColor} className="text-xs font-black">ناردنی کاڵاکان (ناردن)</text>
                        </g>

                        {/* Flow Arrow (I-Shape) */}
                        <path 
                            d="M 175,135 L 175,360" 
                            fill="none" 
                            stroke="#cbd5e1" 
                            strokeWidth="3" 
                            strokeDasharray="6,6"
                            markerEnd="url(#arrow)"
                        />
                    </svg>
                )}

                {shape === 'L' && (
                    <svg viewBox="0 0 500 500" className="w-full h-full">
                        <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                            </marker>
                        </defs>
                        {/* Sector: Receiving */}
                        <g style={{ filter: getSectorStyle('receiving').glow }}>
                            <rect x="40" y="40" width="130" height="120" rx="16" 
                                fill={getSectorStyle('receiving').fill} 
                                stroke={getSectorStyle('receiving').stroke} 
                                strokeWidth={getSectorStyle('receiving').strokeWidth} 
                            />
                            <text x="105" y="90" textAnchor="middle" fill={getSectorStyle('receiving').textColor} className="text-xs font-black">وەرگرتن</text>
                            <text x="105" y="110" textAnchor="middle" fill={getSectorStyle('receiving').textColor} className="text-[9px] opacity-60">وەرگرتنی کاڵاکان</text>
                        </g>

                        {/* Sector: Dynamic Storage */}
                        <g style={{ filter: getSectorStyle('dynamic').glow }}>
                            <rect x="40" y="180" width="130" height="160" rx="16" 
                                fill={getSectorStyle('dynamic').fill} 
                                stroke={getSectorStyle('dynamic').stroke} 
                                strokeWidth={getSectorStyle('dynamic').strokeWidth} 
                            />
                            <text x="105" y="250" textAnchor="middle" fill={getSectorStyle('dynamic').textColor} className="text-xs font-black">ڕەفە (جوڵاو)</text>
                            <text x="105" y="270" textAnchor="middle" fill={getSectorStyle('dynamic').textColor} className="text-[9px] opacity-60">ڕەفەی داینامیکی</text>
                        </g>

                        {/* Sector: Static Storage */}
                        <g style={{ filter: getSectorStyle('static').glow }}>
                            <rect x="190" y="180" width="150" height="160" rx="16" 
                                fill={getSectorStyle('static').fill} 
                                stroke={getSectorStyle('static').stroke} 
                                strokeWidth={getSectorStyle('static').strokeWidth} 
                            />
                            <text x="265" y="250" textAnchor="middle" fill={getSectorStyle('static').textColor} className="text-xs font-black">زۆن (جێگیر)</text>
                            <text x="265" y="270" textAnchor="middle" fill={getSectorStyle('static').textColor} className="text-[9px] opacity-60">ناوچەی جێگیر</text>
                        </g>

                        {/* Sector: Shipping */}
                        <g style={{ filter: getSectorStyle('shipping').glow }}>
                            <rect x="190" y="360" width="270" height="100" rx="16" 
                                fill={getSectorStyle('shipping').fill} 
                                stroke={getSectorStyle('shipping').stroke} 
                                strokeWidth={getSectorStyle('shipping').strokeWidth} 
                            />
                            <text x="325" y="405" textAnchor="middle" fill={getSectorStyle('shipping').textColor} className="text-xs font-black">ناردن و بارکردن</text>
                            <text x="325" y="425" textAnchor="middle" fill={getSectorStyle('shipping').textColor} className="text-[9px] opacity-60">بارکردنی کاڵاکان</text>
                        </g>

                        {/* Flow Arrow (L-Shape) */}
                        <path 
                            d="M 105,165 L 105,290 Q 105,390 190,390 L 320,390" 
                            fill="none" 
                            stroke="#cbd5e1" 
                            strokeWidth="3" 
                            strokeDasharray="6,6"
                            markerEnd="url(#arrow)"
                        />
                    </svg>
                )}
            </div>
            
            {/* Guide Info */}
            <div className="flex items-start gap-2 mt-4 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border w-full text-[10px] text-slate-500 leading-relaxed">
                <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p>
                    ئەم هێڵکارییە نیشاندەری ڕێڕەوی ڕۆیشتنی کەلوپەلەکانە لە کۆگادا (وەرگرتن ← خەزنکردن ← ناردن). بەشە ڕەنگاوڕەنگە گەشەکان نیشاندەری لۆکەیشنی ئێستای کاڵاکەن.
                </p>
            </div>
        </div>
    );
}
