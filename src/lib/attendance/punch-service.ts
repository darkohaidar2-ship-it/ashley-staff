import { supabase } from '@/lib/supabase/client';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { DEFAULT_COMPANY_LOCATIONS } from '@/lib/geo-constants';
import { logger } from '@/lib/logger';
import { getBaghdadNow, getDistanceMeters } from '@/lib/telegram/telegram-service';
import { getEmployeeShiftConfig, calculateNetWorkedAndOvertime } from '@/lib/attendance/shift-service';

export interface PunchRequest {
  source: 'telegram' | 'whatsapp' | 'web' | 'mobile_app';
  employeeId: string;
  employeeName?: string;
  punchType?: 'check_in' | 'check_out' | 'auto';
  lat?: number;
  lng?: number;
  forceBypassLocation?: boolean;
  isManager?: boolean;
}

export interface PunchResponse {
  success: boolean;
  reason?: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'ALREADY_CHECKED_OUT' | 'OUTSIDE_GEOFENCE' | 'LOCATION_REQUIRED' | 'DATABASE_ERROR' | 'UNKNOWN';
  punchType?: 'check_in' | 'check_out';
  dateStr?: string;
  timeStr?: string;
  locationName?: string;
  distanceMeters?: number;
  message: string;
  hasOvertime?: boolean;
  overtimeMinutes?: number;
  netWorkedMinutes?: number;
  breakDeductedMinutes?: number;
}

/**
 * 🏛️ CENTRALIZED PUNCH DECISION & ATTENDANCE RECORDING ENGINE
 * Evaluates geofence, shifts, duplicates, and writes synchronously to:
 * 1. attendance (Supabase table)
 * 2. attendance_logs (Supabase table)
 * 3. ashley_manual_attendance_records (Authoritative overrides store for instant website rendering)
 */
export async function evaluateAndRecordAttendance(req: PunchRequest): Promise<PunchResponse> {
  const { dateStr, timeStr } = getBaghdadNow();
  const nowIso = new Date().toISOString();

  // 1. Resolve Employee Info
  let empName = req.employeeName?.trim();
  if (!empName) {
    const found = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === req.employeeId);
    empName = found?.name || req.employeeId;
  }

  const isManager = Boolean(
    req.isManager || 
    req.employeeId === 'emp-02' || 
    (empName && empName.includes('دارکۆ'))
  );

  try {
    // 2. Query today's attendance record
    const { data: existing, error: fetchErr } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', req.employeeId)
      .eq('date', dateStr)
      .maybeSingle();

    if (fetchErr) {
      logger.error('[PunchService] Error fetching existing attendance:', fetchErr);
    }

    // 3. Determine Punch Type (check_in vs check_out)
    let targetPunch: 'check_in' | 'check_out';
    if (!req.punchType || req.punchType === 'auto') {
      if (!existing?.check_in_time) {
        targetPunch = 'check_in';
      } else if (!existing?.check_out_time) {
        targetPunch = 'check_out';
      } else {
        // Both check-in and check-out are already recorded for today
        if (!isManager) {
          return {
            success: false,
            reason: 'ALREADY_CHECKED_OUT',
            message: `⚠️ بەڕێز <b>${empName}</b>، ئەمڕۆ دەوامی هاتن (<b>${existing.check_in_time}</b>) و دەرچوون (<b>${existing.check_out_time}</b>) بە تەواوی تۆمارکراوە!\n\nڕۆژانە تەنها یەک جار دەوام تۆمار دەکرێت.`
          };
        }
        targetPunch = 'check_out'; // Manager testing overwrite
      }
    } else {
      targetPunch = req.punchType;
    }

    // 4. Duplicate Check
    if (targetPunch === 'check_in' && existing?.check_in_time && !isManager) {
      return {
        success: false,
        reason: 'ALREADY_CHECKED_IN',
        punchType: 'check_in',
        dateStr,
        timeStr: existing.check_in_time,
        message: `⚠️ بەڕێز <b>${empName}</b>، تۆ پێشتر ئەمڕۆ لە کاتژمێر <b>${existing.check_in_time}</b> دەوامی هاتنت تۆمار کردووە!\n\nڕۆژانە تەنها یەک جار هاتن تۆمار دەکرێت. کاتێک دەوامت تەواو بوو، تکایە دەرچوون تۆمار بکە.`
      };
    }

    if (targetPunch === 'check_out' && existing?.check_out_time && !isManager) {
      return {
        success: false,
        reason: 'ALREADY_CHECKED_OUT',
        punchType: 'check_out',
        dateStr,
        timeStr: existing.check_out_time,
        message: `⚠️ بەڕێز <b>${empName}</b>، تۆ پێشتر ئەمڕۆ لە کاتژمێر <b>${existing.check_out_time}</b> دەوامی دەرچوونت تۆمار کردووە!\n\nڕۆژانە تەنها یەک جار دەرچوون تۆمار دەکرێت.`
      };
    }

    // 5. Geofence & Location Evaluation
    let locationName = 'کۆمپانیای سەرەکی ئاشڵی';
    let distanceMeters = 0;

    if (req.forceBypassLocation) {
      if (!isManager) {
        return {
          success: false,
          reason: 'LOCATION_REQUIRED',
          message: `⛔ <b>نەخێر، تۆمار نەکرا!</b>\n\nناردنی لۆکەیشنی GPS بۆ هەموو کارمەندان ئیجبارییە. تکایە لۆکەیشنی خۆت بنێرە لە شوێنی دەوام.`
        };
      }
      locationName = 'کۆمپانیای سەرەکی ئاشڵی (تۆماری خێرای بەڕێوەبەر)';
    } else if (typeof req.lat === 'number' && typeof req.lng === 'number') {
      let closestLoc = DEFAULT_COMPANY_LOCATIONS[0];
      let minDistance = getDistanceMeters(req.lat, req.lng, closestLoc.lat, closestLoc.lng);

      for (const loc of DEFAULT_COMPANY_LOCATIONS) {
        const dist = getDistanceMeters(req.lat, req.lng, loc.lat, loc.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestLoc = loc;
        }
      }

      distanceMeters = minDistance;
      const isInside = minDistance <= closestLoc.radiusMeters;

      if (!isInside && !isManager) {
        return {
          success: false,
          reason: 'OUTSIDE_GEOFENCE',
          distanceMeters: minDistance,
          locationName: closestLoc.name,
          message: `⛔ <b>نەخێر، تۆمار نەکرا!</b>\n\nتۆ لە دەرەوەی سنوری ڕێگەپێدراوی دەوامیت.\n🏢 نزیکترین شوێن: <b>${closestLoc.name}</b>\n📍 مەودای ئێستات: <b>${minDistance} مەتر</b>\n📏 مەودای ڕێگەپێدراو: <b>${closestLoc.radiusMeters} مەتر</b>\n\nتکایە کاتێک گەیشتیتە ناو کۆمپانیا دووبارە تاقی بکەرەوە.`
        };
      }

      locationName = isInside ? closestLoc.name : `${closestLoc.name} (بەڕێوەبەر - دەرەوەی سنور)`;
    } else {
      // No coordinates provided
      if (!isManager) {
        return {
          success: false,
          reason: 'LOCATION_REQUIRED',
          message: `📍 تکایە دوگمەی [ 📍 ناردنی لۆکەیشنی دەوام (GPS) ] دابگرە تا شوێنەکەت بسەلمێنرێت.`
        };
      }
      locationName = 'کۆمپانیای سەرەکی ئاشڵی (بەڕێوەبەر)';
    }

    // 6. Record to Database (attendance & attendance_logs)
    const logTypeStr = targetPunch === 'check_in' ? 'Check In' : 'Check Out';
    const logId = `${req.source}-${req.employeeId}-${dateStr}-${targetPunch === 'check_in' ? 'in' : 'out'}-${Date.now()}`;
    const rowId = `${req.employeeId}-${dateStr}`;

    // 6a. Insert into attendance_logs
    const { error: logErr } = await supabase.from('attendance_logs').insert({
      id: logId,
      employee_id: req.employeeId,
      employee_name: empName,
      log_type: logTypeStr,
      log_date: dateStr,
      log_time_str: timeStr,
      location_address: `${locationName} (${req.source})`,
      created_at: nowIso,
      edit_note: `لەڕێگەی ${req.source === 'whatsapp' ? 'واتس ئەپ' : req.source === 'telegram' ? 'تەلەگرام' : 'سیستەم'}`,
    });
    if (logErr) {
      logger.error('[PunchService] Error inserting attendance_logs:', logErr);
    }

    // 6b. Upsert into attendance table
    const attPayload = {
      id: existing?.id || rowId,
      user_id: req.employeeId,
      user_name: empName,
      date: dateStr,
      status: 'Present',
      check_in: targetPunch === 'check_in' ? nowIso : (existing?.check_in || null),
      check_in_time: targetPunch === 'check_in' ? timeStr : (existing?.check_in_time || null),
      check_in_address: targetPunch === 'check_in' ? locationName : (existing?.check_in_address || null),
      check_out: targetPunch === 'check_out' ? nowIso : (existing?.check_out || null),
      check_out_time: targetPunch === 'check_out' ? timeStr : (existing?.check_out_time || null),
      check_out_address: targetPunch === 'check_out' ? locationName : (existing?.check_out_address || null),
      warehouse_name: locationName,
    };

    const { error: attErr } = await supabase.from('attendance').upsert(attPayload, { onConflict: 'id' });
    if (attErr) {
      logger.error('[PunchService] Error upserting attendance:', attErr);
      return {
        success: false,
        reason: 'DATABASE_ERROR',
        message: `❌ هەڵەیەک لە بنکەدراوەدا ڕوویدا: ${attErr.message}`
      };
    }

    let finalIn: string | null = targetPunch === 'check_in' ? timeStr : (existing?.check_in_time || null);
    let finalOut: string | null = targetPunch === 'check_out' ? timeStr : (existing?.check_out_time || null);

    // 6c. Authoritative Overrides Store Sync (ashley_manual_attendance_records)
    try {
      const { data: setRow } = await supabase
        .from('warehouses')
        .select('qr_code')
        .eq('id', 'ashley_manual_attendance_records')
        .maybeSingle();

      let currentOverrides: Record<string, any> = {};
      if (setRow?.qr_code) {
        currentOverrides = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      }

      const cleanId = req.employeeId.toString().replace(/^emp-0*/i, '') || req.employeeId.replace('emp-', '');
      const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;
      const allKeyVars = [
        `${cleanId}_${dateStr}`,
        `${cleanPadded}_${dateStr}`,
        `emp-${cleanId}_${dateStr}`,
        `emp-${cleanPadded}_${dateStr}`,
        `${req.employeeId}_${dateStr}`,
      ];
      if (empName) {
        allKeyVars.push(`${empName}_${dateStr}`);
        allKeyVars.push(`${empName.trim().toLowerCase()}_${dateStr}`);
      }

      const existingOv = currentOverrides[`${req.employeeId}_${dateStr}`] || currentOverrides[`${cleanPadded}_${dateStr}`] || {};
      if (!finalIn && existingOv?.checkInTime) finalIn = existingOv.checkInTime;
      if (!finalOut && existingOv?.checkOutTime) finalOut = existingOv.checkOutTime;

      const liveOverride = {
        userId: req.employeeId,
        userName: empName,
        date: dateStr,
        status: 'Present',
        checkInTime: finalIn,
        checkOutTime: finalOut,
        rawCheckIn: finalIn,
        rawCheckOut: finalOut,
        note: `لەڕێگەی ${req.source === 'whatsapp' ? 'واتس ئەپ' : req.source === 'telegram' ? 'تەلەگرام' : 'سیستەم'}`,
        adminNote: existingOv?.adminNote || '',
        warehouseName: locationName,
        updatedAt: nowIso,
        action: 'update',
      };

      for (const k of allKeyVars) {
        currentOverrides[k] = liveOverride;
      }

      await supabase.from('warehouses').upsert({
        id: 'ashley_manual_attendance_records',
        name: 'MANUAL_ATTENDANCE_OVERRIDES',
        qr_code: JSON.stringify(currentOverrides),
      }, { onConflict: 'id' });
    } catch (whErr) {
      logger.warn('[PunchService] Error updating manual overrides store:', whErr);
    }

    // 7. Success Output Message & Net Work / Overtime Evaluation
    let hasOvertime = false;
    let overtimeMinutes = 0;
    let netWorkedMinutes = 0;
    let breakDeductedMinutes = 0;
    let workStatsSummary = '';

    if (targetPunch === 'check_out' && finalIn && finalOut) {
      const shiftCfg = getEmployeeShiftConfig(req.employeeId);
      const calc = calculateNetWorkedAndOvertime(finalIn, finalOut, shiftCfg);
      netWorkedMinutes = calc.netWorkedMinutes;
      breakDeductedMinutes = calc.breakDeductedMinutes;
      overtimeMinutes = calc.overtimeMinutes;
      hasOvertime = calc.isOvertime && calc.overtimeMinutes > 0;

      const netHours = Math.floor(netWorkedMinutes / 60);
      const netMins = netWorkedMinutes % 60;
      workStatsSummary += `\n⏱ کاتی کارکردنی خاوێن: <b>${netHours} کاتژمێر و ${netMins} خولەک</b>`;
      if (breakDeductedMinutes > 0) {
        workStatsSummary += ` <i>(پشووی ١٢-١ داشکێنرا: ${breakDeductedMinutes} خولەک)</i>`;
      }
      if (hasOvertime) {
        workStatsSummary += `\n⏰ کاتی زیادە (ئۆڤەرتایم): <b>${overtimeMinutes} خولەک</b>`;
      }
    }

    const typeLabel = targetPunch === 'check_in' ? '🟢 دەوامی هاتن' : '🔴 دەوامی دەرچوون';
    const distanceNote = distanceMeters > 0 ? `\n📍 مەودا لە سەنتەر: <b>${distanceMeters} مەتر</b>` : '';
    const sourceLabel = req.source === 'whatsapp' ? 'واتس ئەپ' : req.source === 'telegram' ? 'تەلەگرام' : 'مۆبایل';

    return {
      success: true,
      reason: 'SUCCESS',
      punchType: targetPunch,
      dateStr,
      timeStr,
      locationName,
      distanceMeters,
      hasOvertime,
      overtimeMinutes,
      netWorkedMinutes,
      breakDeductedMinutes,
      message: `✅ <b>بەڵێ، ${typeLabel} بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${empName}</b>\n⏱ کاتژمێر: <b>${timeStr}</b> (${dateStr})\n🏢 شوێن: <b>${locationName}</b>${distanceNote}${workStatsSummary}\n📱 لەڕێگەی: <b>${sourceLabel}</b>\n\nدەستت خۆش بێت و لە خشتەی سەرەکی وێبسایتەکە دانیشت! ✨`
    };
  } catch (err: any) {
    logger.error('[PunchService] Unexpected error:', err);
    return {
      success: false,
      reason: 'UNKNOWN',
      message: `❌ هەڵەی چاوەڕواننەکراو: ${err.message}`
    };
  }
}
