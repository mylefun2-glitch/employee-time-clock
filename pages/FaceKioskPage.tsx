import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ScanFace, ShieldAlert, ShieldCheck, RefreshCw, Save, LocateFixed, ArrowLeftRight } from 'lucide-react';
import { getActiveLocations, CompanyLocation } from '../services/companyLocationService';
import {
  geolocationManager,
  getAccurateCurrentPosition,
  getIpBasedLocation,
  isGeolocationSupported,
  isWithinAnyLocation,
} from '../services/geolocation';
import { Employee } from '../types';
import { detectFaceDescriptor, findBestMatch, loadFaceModels } from '../services/faceRecognition';
import {
  getFaceProfiles,
  getFaceProfileByEmployeeId,
  getFaceTodayAttendance,
  logFaceAttendance,
  lookupOriginalEmployee,
  upsertFaceProfile,
  FaceEmployeeProfile,
} from '../services/faceAttendance';

const formatDateTime = (date = new Date()) =>
  new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

const formatDate = (date = new Date()) =>
  new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);

type Mode = 'punch' | 'enroll';

type LocationInfo = {
  distance: number;
  withinRange: boolean;
  locationName?: string;
  error?: string;
  accuracy?: number;
  origin?: 'gps' | 'ip' | 'network';
};

const MODEL_HINT = import.meta.env.VITE_FACE_MODEL_URL || 'https://justadudewhohacks.github.io/face-api.js/models';

const FaceKioskPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('punch');
  const [now, setNow] = useState(new Date());
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [profiles, setProfiles] = useState<FaceEmployeeProfile[]>([]);
  const [match, setMatch] = useState<{ profile: FaceEmployeeProfile; distance: number } | null>(null);
  const [recommendedType, setRecommendedType] = useState<'IN' | 'OUT' | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([]);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [originalEmployee, setOriginalEmployee] = useState<Employee | null>(null);
  const [enrollEmployeeId, setEnrollEmployeeId] = useState('');
  const [enrollSearchMessage, setEnrollSearchMessage] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [lastSavedProfile, setLastSavedProfile] = useState<FaceEmployeeProfile | null>(null);

  const canPunch = useMemo(() => Boolean(match && locationInfo?.withinRange !== false), [match, locationInfo]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('您的瀏覽器不支援相機存取。');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        setCameraError('');
      } catch (error: any) {
        setCameraError(error?.message || '相機啟動失敗，請確認網站有相機權限。');
      }
    };

    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadLocations = async () => {
      const locations = await getActiveLocations();
      if (active) setCompanyLocations(locations);
    };
    loadLocations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const initModels = async () => {
      try {
        await loadFaceModels();
        if (active) setModelReady(true);
      } catch (error) {
        console.error('loadFaceModels error:', error);
        if (active) {
          setStatusMessage('人臉模型載入失敗，請確認網路可連到模型來源。');
        }
      }
    };
    initModels();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost';

    const updateLocation = async () => {
      if (!isGeolocationSupported()) {
        const ipPos = await getIpBasedLocation();
        if (!active) return;
        if (ipPos) {
          const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
            ipPos.latitude,
            ipPos.longitude,
            companyLocations
          );
          setLocationInfo({
            distance,
            withinRange,
            locationName: nearestLocation?.name || '公司',
            accuracy: ipPos.accuracy,
            origin: 'ip',
          });
        } else {
          setLocationInfo({ distance: 0, withinRange: false, error: '您的瀏覽器不支援定位功能' });
        }
        return;
      }

      if (!isSecure) {
        setLocationInfo({ distance: 0, withinRange: false, error: '連線不安全：請使用 HTTPS 網址啟用定位' });
        return;
      }

      geolocationManager.startWatching();
      unsubscribe = geolocationManager.subscribe((status) => {
        if (!active) return;
        if (status.error) {
          getIpBasedLocation().then((ipPos) => {
            if (!active) return;
            if (ipPos) {
              const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
                ipPos.latitude,
                ipPos.longitude,
                companyLocations
              );
              setLocationInfo({
                distance,
                withinRange,
                locationName: nearestLocation?.name || '公司',
                accuracy: ipPos.accuracy,
                origin: 'ip',
              });
            } else {
              setLocationInfo((prev) => ({
                distance: prev?.distance || 0,
                withinRange: prev?.withinRange || false,
                error: status.error || undefined,
                accuracy: prev?.accuracy,
                origin: prev?.origin,
              }));
            }
          });
          return;
        }

        if (status.position) {
          const { withinRange, distance, nearestLocation } = isWithinAnyLocation(
            status.position.latitude,
            status.position.longitude,
            companyLocations
          );
          setLocationInfo({
            distance,
            withinRange,
            locationName: nearestLocation?.name || '公司',
            accuracy: status.position.accuracy,
            origin: 'gps',
          });
        }
      });
    };

    updateLocation();

    return () => {
      active = false;
      unsubscribe();
      geolocationManager.stopWatching();
    };
  }, [companyLocations]);

  useEffect(() => {
    let active = true;
    const refreshProfiles = async () => {
      const data = await getFaceProfiles();
      if (active) setProfiles(data);
    };
    refreshProfiles();
    return () => {
      active = false;
    };
  }, []);

  const performScan = useCallback(async () => {
    if (!videoRef.current) return;
    if (!cameraReady) {
      setStatusMessage('相機尚未就緒。');
      return;
    }

    setScanning(true);
    setStatusMessage('正在辨識人臉...');
    setMatch(null);
    setRecommendedType(null);

    try {
      const result = await detectFaceDescriptor(videoRef.current);
      if (!result.success || !result.descriptor) {
        setStatusMessage(result.error || '未能擷取人臉特徵。');
        return;
      }

      const faceProfiles = profiles.length > 0 ? profiles : await getFaceProfiles();
      setProfiles(faceProfiles);

      const best = findBestMatch(result.descriptor, faceProfiles);
      if (!best) {
        setStatusMessage('找不到相符的員工臉部資料，請先完成建檔。');
        return;
      }

      const logs = await getFaceTodayAttendance(best.profile.employee_id);
      const latest = logs.length > 0 ? logs[logs.length - 1] : null;
      const nextType: 'IN' | 'OUT' = latest && latest.check_type === 'IN' ? 'OUT' : 'IN';

      setMatch(best);
      setTodayLogs(logs);
      setRecommendedType(nextType);
      setStatusMessage(`辨識成功：${best.profile.name}（距離 ${best.distance.toFixed(3)}）`);
    } catch (error) {
      console.error('performScan error:', error);
      setStatusMessage('掃臉失敗，請再試一次。');
    } finally {
      setScanning(false);
    }
  }, [cameraReady, profiles]);

  const handlePunch = useCallback(
    async (type: 'IN' | 'OUT') => {
      if (!match) return;
      if (locationInfo?.withinRange === false) {
        setStatusMessage(locationInfo.error || '目前不在允許打卡範圍內。');
        return;
      }

      const currentPosition = locationInfo?.origin === 'gps' ? await getAccurateCurrentPosition(3000, 200, companyLocations) : null;
      const payloadLocation = currentPosition?.position
        ? {
            latitude: currentPosition.position.latitude,
            longitude: currentPosition.position.longitude,
            accuracy: currentPosition.position.accuracy,
          }
        : locationInfo?.origin
          ? undefined
          : undefined;

      const result = await logFaceAttendance({
        employee_id: match.profile.employee_id,
        check_type: type,
        latitude: payloadLocation?.latitude ?? null,
        longitude: payloadLocation?.longitude ?? null,
        location_accuracy: payloadLocation?.accuracy ?? locationInfo?.accuracy ?? null,
        match_distance: match.distance,
        reference_profile_id: match.profile.id ?? null,
      });

      if (!result.success) {
        setStatusMessage(`打卡失敗：${result.error || '未知錯誤'}`);
        return;
      }

      const logs = await getFaceTodayAttendance(match.profile.employee_id);
      setTodayLogs(logs);
      setRecommendedType(type === 'IN' ? 'OUT' : 'IN');
      setStatusMessage(`已完成 ${type === 'IN' ? '上班' : '下班'}打卡：${match.profile.name}`);
    },
    [companyLocations, locationInfo, match]
  );

  const handleEnrollmentSearch = useCallback(async () => {
    if (!enrollEmployeeId.trim()) {
      setEnrollSearchMessage('請先輸入員工編號。');
      setOriginalEmployee(null);
      return;
    }

    setEnrollSearchMessage('查詢中...');
    const employee = await lookupOriginalEmployee(enrollEmployeeId.trim());
    if (!employee) {
      setOriginalEmployee(null);
      setEnrollSearchMessage('找不到這位員工，請確認編號是否正確。');
      return;
    }

    setOriginalEmployee(employee);
    setEnrollSearchMessage(`已找到：${employee.name} ${employee.department ? `／${employee.department}` : ''}`);
  }, [enrollEmployeeId]);

  const handleEnrollFromCamera = useCallback(async () => {
    if (!videoRef.current) return;
    if (!originalEmployee) {
      setEnrollSearchMessage('請先查到員工資料。');
      return;
    }

    setEnrolling(true);
    setStatusMessage('正在擷取建檔人臉特徵...');
    try {
      const result = await detectFaceDescriptor(videoRef.current);
      if (!result.success || !result.descriptor) {
        setStatusMessage(result.error || '未能擷取人臉特徵。');
        return;
      }

      const saveResult = await upsertFaceProfile({
        employee_id: originalEmployee.id,
        name: originalEmployee.name,
        department: originalEmployee.department ?? null,
        descriptor: result.descriptor,
        is_active: true,
      });

      if (!saveResult.success || !saveResult.data) {
        setStatusMessage(`建檔失敗：${saveResult.error || '未知錯誤'}`);
        return;
      }

      setLastSavedProfile(saveResult.data);
      setStatusMessage(`已完成建檔：${originalEmployee.name}`);
      const refreshed = await getFaceProfiles();
      setProfiles(refreshed);
      const latest = await getFaceProfileByEmployeeId(originalEmployee.id);
      if (latest) setLastSavedProfile(latest);
    } catch (error) {
      console.error('handleEnrollFromCamera error:', error);
      setStatusMessage('建檔失敗，請重試。');
    } finally {
      setEnrolling(false);
    }
  }, [originalEmployee]);

  const refreshProfiles = useCallback(async () => {
    setStatusMessage('重新載入資料中...');
    const [freshProfiles] = await Promise.all([getFaceProfiles()]);
    setProfiles(freshProfiles);
    setStatusMessage('資料已更新。');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/30 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              <ScanFace className="h-4 w-4" />
              新版掃臉打卡系統
            </div>
            <h1 className="text-2xl font-bold tracking-tight">社照會掃臉版打卡站</h1>
            <p className="mt-1 text-sm text-slate-400">
              與原始系統分離，僅讀取員工主檔，打卡資料與臉部建檔都寫入新表。
            </p>
          </div>
          <div className="grid gap-2 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <div className="text-slate-500">現在時間</div>
              <div className="text-lg font-semibold">{formatDateTime(now)}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <div className="text-slate-500">今日日期</div>
              <div className="font-medium">{formatDate(now)}</div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setMode('punch')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === 'punch' ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
          >
            打卡模式
          </button>
          <button
            onClick={() => setMode('enroll')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === 'enroll' ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
          >
            建檔模式
          </button>
          <button
            onClick={refreshProfiles}
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            <RefreshCw className="mr-2 inline-block h-4 w-4" />
            更新資料
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">相機畫面</h2>
                  <p className="text-sm text-slate-400">請正面看鏡頭，臉部完整入鏡後再按掃描。</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 ${cameraReady ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {cameraReady ? '相機已就緒' : '相機未就緒'}
                  </span>
                  <span className={`rounded-full px-3 py-1 ${modelReady ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                    {modelReady ? '模型已載入' : '模型載入中'}
                  </span>
                  <span className={`rounded-full px-3 py-1 ${locationInfo?.withinRange ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                    {locationInfo?.withinRange ? '定位符合' : '定位檢查中 / 不符合'}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
                <video
                  ref={videoRef}
                  className="aspect-video w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              </div>

              {cameraError ? (
                <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {cameraError}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={performScan}
                  disabled={scanning || !cameraReady || !modelReady}
                  className="inline-flex items-center rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {scanning ? '掃描中...' : '掃臉辨識'}
                </button>
                {match ? (
                  <>
                    <button
                      onClick={() => handlePunch('IN')}
                      disabled={!canPunch}
                      className="inline-flex items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      上班打卡
                    </button>
                    <button
                      onClick={() => handlePunch('OUT')}
                      disabled={!canPunch}
                      className="inline-flex items-center rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" />
                      下班打卡
                    </button>
                  </>
                ) : null}
              </div>

              {statusMessage ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-200">
                  {statusMessage}
                </div>
              ) : null}
            </div>

            {mode === 'enroll' ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20">
                <h2 className="mb-2 text-lg font-semibold">員工臉部建檔</h2>
                <p className="mb-4 text-sm text-slate-400">只讀原始員工主檔，不會回寫原系統資料。</p>

                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    value={enrollEmployeeId}
                    onChange={(e) => setEnrollEmployeeId(e.target.value)}
                    placeholder="輸入員工編號"
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                  />
                  <button
                    onClick={handleEnrollmentSearch}
                    className="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    查詢員工
                  </button>
                </div>

                {enrollSearchMessage ? (
                  <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    {enrollSearchMessage}
                  </div>
                ) : null}

                {originalEmployee ? (
                  <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                    <div className="font-semibold">{originalEmployee.name}</div>
                    <div className="text-cyan-200/80">{originalEmployee.department || '未填部門'}</div>
                    <div className="mt-2 text-xs text-cyan-200/70">員工編號：{originalEmployee.id}</div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleEnrollFromCamera}
                    disabled={!cameraReady || !modelReady || !originalEmployee || enrolling}
                    className="inline-flex items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {enrolling ? '建檔中...' : '從相機擷取並儲存'}
                  </button>
                  {lastSavedProfile ? (
                    <span className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                      最新建檔：{lastSavedProfile.name}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20">
              <h2 className="mb-4 text-lg font-semibold">辨識結果</h2>
              {match ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                    <div className="text-sm text-emerald-200/80">辨識到員工</div>
                    <div className="text-xl font-bold text-emerald-100">{match.profile.name}</div>
                    <div className="text-sm text-emerald-200/70">{match.profile.department || '未填部門'}</div>
                    <div className="mt-2 text-xs text-emerald-200/70">
                      距離值：{match.distance.toFixed(3)} / 建議閾值 {0.48}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    <div className="mb-1 font-semibold text-slate-200">今日打卡紀錄</div>
                    {todayLogs.length > 0 ? (
                      <ul className="space-y-2">
                        {todayLogs.map((log) => (
                          <li key={log.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                            <span>{log.check_type === 'IN' ? '上班' : '下班'}</span>
                            <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString('zh-TW', { hour12: false })}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-slate-500">今日尚無紀錄</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    <div className="font-semibold text-slate-200">定位資訊</div>
                    {locationInfo?.error ? (
                      <div className="mt-2 text-rose-300">{locationInfo.error}</div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        <div>地點：{locationInfo?.locationName || '公司'}</div>
                        <div>距離：{Math.round(locationInfo?.distance || 0)} 公尺</div>
                        <div>精度：{Math.round(locationInfo?.accuracy || 0)} 公尺</div>
                      </div>
                    )}
                    {!locationInfo?.withinRange ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                        <ShieldAlert className="h-3 w-3" />
                        目前不在允許打卡範圍
                      </div>
                    ) : (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                        <LocateFixed className="h-3 w-3" />
                        定位範圍通過
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                    <div className="font-semibold text-slate-200">建議操作</div>
                    <div className="mt-2">
                      {recommendedType === 'IN' ? '建議先按「上班打卡」' : recommendedType === 'OUT' ? '建議按「下班打卡」' : '請先掃描臉部'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-6 text-sm text-slate-500">
                  尚未辨識到員工，請先按「掃臉辨識」。
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20">
              <h2 className="mb-4 text-lg font-semibold">系統狀態</h2>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                  <span>模型來源</span>
                  <span className="text-slate-500">{MODEL_HINT}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                  <span>員工臉部建檔數</span>
                  <span>{profiles.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                  <span>定位來源</span>
                  <span>{locationInfo?.origin || '等待中'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                  <span>相機權限</span>
                  <span>{cameraReady ? '已開啟' : '等待中'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceKioskPage;
