import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface CompanyLocation {
    id?: string;
    name?: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active?: boolean;
}

interface AttendanceMapProps {
    companyLocations: CompanyLocation[];
    attendanceLogs?: Array<{
        id: string;
        latitude?: number;
        longitude?: number;
        employees?: { name: string };
        check_type: string;
        timestamp: string;
    }>;
    center?: [number, number];
    zoom?: number;
    height?: string;
}

const AttendanceMap: React.FC<AttendanceMapProps> = ({
    companyLocations,
    attendanceLogs = [],
    center,
    zoom = 13,
    height = '500px'
}) => {
    // 計算地圖中心點
    const mapCenter: LatLngExpression = center || (
        companyLocations.length > 0
            ? [companyLocations[0].latitude, companyLocations[0].longitude]
            : [25.0330, 121.5654] // 預設台北 101
    );

    // 公司地點圖示（藍色）
    const companyIcon = new Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // 打卡位置圖示（綠色=上班，紅色=下班）
    const checkInIcon = new Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const checkOutIcon = new Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    return (
        <div style={{ height, width: '100%' }}>
            <MapContainer
                center={mapCenter}
                zoom={zoom}
                style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* 公司地點標記 */}
                {companyLocations.map((location, index) => (
                    <React.Fragment key={location.id || `location-${index}`}>
                        <Marker
                            position={[location.latitude, location.longitude]}
                            icon={companyIcon}
                        >
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-bold text-blue-700">{location.name || '公司地點'}</h3>
                                    <p className="text-xs text-slate-500 mt-2">
                                        允許範圍：{location.radius_meters} 公尺
                                    </p>
                                </div>
                            </Popup>
                        </Marker>

                        {/* 顯示允許範圍圓圈 */}
                        <Circle
                            center={[location.latitude, location.longitude]}
                            radius={location.radius_meters}
                            pathOptions={{
                                color: 'blue',
                                fillColor: 'blue',
                                fillOpacity: 0.1,
                                weight: 2
                            }}
                        />
                    </React.Fragment>
                ))}

                {/* 打卡位置標記 */}
                {attendanceLogs
                    .filter(log => log.latitude && log.longitude)
                    .map((log) => (
                        <Marker
                            key={log.id}
                            position={[log.latitude!, log.longitude!]}
                            icon={log.check_type === 'IN' ? checkInIcon : checkOutIcon}
                        >
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-bold">{log.employees?.name || '未知員工'}</h3>
                                    <p className="text-sm mt-1">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${log.check_type === 'IN'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {log.check_type === 'IN' ? '上班' : '下班'}
                                        </span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {new Date(log.timestamp).toLocaleString('zh-TW')}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
            </MapContainer>
        </div>
    );
};

export default AttendanceMap;
