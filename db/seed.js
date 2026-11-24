const { db, initSchema } = require('./database');

function seedDatabase() {
  initSchema();

  // Clear existing
  db.exec('DELETE FROM stations;');
  try {
    db.exec("DELETE FROM sqlite_sequence WHERE name='stations';");
  } catch (err) {
    // sqlite_sequence might not exist before first autoincrement insert
  }

  const now = new Date();
  const minsAgo = (mins) => new Date(now.getTime() - mins * 60 * 1000).toISOString();
  const hoursAgo = (hours) => new Date(now.getTime() - hours * 3600 * 1000).toISOString();

  const sampleStations = [
    // Delhi NCR Hub (Indraprastha Gas cluster)
    {
      name: 'IGL CNG Mother Station - Connaught Place',
      address: 'Near Super Bazar, Outer Circle, Connaught Place',
      city: 'New Delhi',
      area: 'Connaught Place',
      latitude: 28.6315,
      longitude: 77.2167,
      phone: '+91 11 2341 5678',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 215,
      estimated_wait_minutes: 12,
      source: 'Sample Demo Dataset — IGL Regional Feed',
      is_demo: 1,
      last_updated_at: minsAgo(18) // Fresh (< 30 min)
    },
    {
      name: 'IGL CNG Station - Sector 62 Noida',
      address: 'Plot A-14, Institutional Area, Sector 62',
      city: 'Noida',
      area: 'Sector 62',
      latitude: 28.6258,
      longitude: 77.3644,
      phone: '+91 120 4567 890',
      opening_hours: '06:00 - 23:00',
      availability_status: 'available',
      pressure_status: 'medium',
      pressure_bar: 185,
      estimated_wait_minutes: 25,
      source: 'Sample Demo Dataset — Station Telemetry',
      is_demo: 1,
      last_updated_at: minsAgo(45) // Fresh
    },
    {
      name: 'HPCL-IGL CNG Station - Lajpat Nagar',
      address: 'Ring Road, Near Metro Station, Lajpat Nagar IV',
      city: 'New Delhi',
      area: 'Lajpat Nagar',
      latitude: 28.5677,
      longitude: 77.2433,
      phone: '+91 11 2984 1122',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 220,
      estimated_wait_minutes: 8,
      source: 'Sample Demo Dataset — IGL Regional Feed',
      is_demo: 1,
      last_updated_at: minsAgo(10) // Very fresh
    },
    {
      name: 'IndianOil CNG Station - Gurgaon Cyber City',
      address: 'DLF Phase 2, Near Shankar Chowk, NH-48',
      city: 'Gurugram',
      area: 'Cyber City',
      latitude: 28.4986,
      longitude: 77.0878,
      phone: '+91 124 4321 000',
      opening_hours: '24 Hours Open',
      availability_status: 'unavailable',
      pressure_status: 'low',
      pressure_bar: 60,
      estimated_wait_minutes: null, // Unknown/not applicable because station is unavailable
      source: 'Sample Demo Dataset — Maintenance Log',
      is_demo: 1,
      last_updated_at: hoursAgo(2) // 2 hours ago
    },
    {
      name: 'BPCL-IGL CNG Station - Dwarka Sector 10',
      address: 'Near District Court Complex, Sector 10, Dwarka',
      city: 'New Delhi',
      area: 'Dwarka',
      latitude: 28.5812,
      longitude: 77.0597,
      phone: '+91 11 2808 3490',
      opening_hours: '05:00 - 00:00',
      availability_status: 'unknown', // Status not updated, marked unknown
      pressure_status: 'unknown',
      pressure_bar: null,
      estimated_wait_minutes: null,
      source: 'Sample Demo Dataset — Offline Station Ping',
      is_demo: 1,
      last_updated_at: hoursAgo(9) // Stale (> 4h)
    },
    {
      name: 'IGL CNG Dispenser Hub - Anand Vihar ISBT',
      address: 'Opposite Inter-State Bus Terminus, Anand Vihar',
      city: 'New Delhi',
      area: 'Anand Vihar',
      latitude: 28.6475,
      longitude: 77.3158,
      phone: '+91 11 2215 6789',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'medium',
      pressure_bar: 190,
      estimated_wait_minutes: 35,
      source: 'Sample Demo Dataset — Traffic & Queue Camera Model',
      is_demo: 1,
      last_updated_at: minsAgo(22)
    },
    {
      name: 'Adani Total CNG - Faridabad Sector 15',
      address: 'Mathura Road, Near Main Market, Sector 15',
      city: 'Faridabad',
      area: 'Sector 15',
      latitude: 28.4089,
      longitude: 77.3178,
      phone: null, // Unknown phone
      opening_hours: '06:00 - 22:00',
      availability_status: 'not_reported', // Operational fields not reported
      pressure_status: 'unknown',
      pressure_bar: null,
      estimated_wait_minutes: null,
      source: 'Sample Demo Dataset — Public Directory',
      is_demo: 1,
      last_updated_at: hoursAgo(14) // Stale
    },

    // Mumbai Metropolitan Area (MGL cluster)
    {
      name: 'MGL Mother Station - Bandra Kurla Complex',
      address: 'G Block, Near ICICI Tower, BKC',
      city: 'Mumbai',
      area: 'BKC',
      latitude: 19.0662,
      longitude: 72.8687,
      phone: '+91 22 2659 0101',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 210,
      estimated_wait_minutes: 15,
      source: 'Sample Demo Dataset — MGL Live Telemetry (Simulated)',
      is_demo: 1,
      last_updated_at: minsAgo(15)
    },
    {
      name: 'HPCL-MGL CNG Station - Andheri East',
      address: 'Western Express Highway, Near Gundavali Metro, Andheri East',
      city: 'Mumbai',
      area: 'Andheri East',
      latitude: 19.1176,
      longitude: 72.8572,
      phone: '+91 22 2834 5678',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 205,
      estimated_wait_minutes: 20,
      source: 'Sample Demo Dataset — Driver Crowd Estimate',
      is_demo: 1,
      last_updated_at: minsAgo(30)
    },
    {
      name: 'BPCL Auto LPG & CNG - Dadar West',
      address: 'Senapati Bapat Marg, Near Elphinstone Bridge, Dadar West',
      city: 'Mumbai',
      area: 'Dadar',
      latitude: 19.0185,
      longitude: 72.8398,
      phone: '+91 22 2430 8912',
      opening_hours: '06:00 - 23:00',
      availability_status: 'available',
      pressure_status: 'medium',
      pressure_bar: 175,
      estimated_wait_minutes: 18,
      source: 'Sample Demo Dataset — MGL Hub Audit',
      is_demo: 1,
      last_updated_at: minsAgo(50)
    },
    {
      name: 'MGL CNG Station - Thane Ghodbunder Road',
      address: 'Survey 42, Near Waghbil Naka, Ghodbunder Road',
      city: 'Thane',
      area: 'Ghodbunder Road',
      latitude: 19.2573,
      longitude: 72.9691,
      phone: '+91 22 2597 1234',
      opening_hours: '24 Hours Open',
      availability_status: 'unavailable',
      pressure_status: 'low',
      pressure_bar: 45,
      estimated_wait_minutes: null,
      source: 'Sample Demo Dataset — Compressor Maintenance Report',
      is_demo: 1,
      last_updated_at: hoursAgo(5) // Stale & Unavailable
    },
    {
      name: 'IndianOil CNG Station - Vashi Sector 17',
      address: 'Palm Beach Road Junction, Sector 17, Vashi',
      city: 'Navi Mumbai',
      area: 'Vashi',
      latitude: 19.0768,
      longitude: 72.9984,
      phone: '+91 22 2789 4455',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 220,
      estimated_wait_minutes: 10,
      source: 'Sample Demo Dataset — Operator Log',
      is_demo: 1,
      last_updated_at: minsAgo(25)
    },

    // Pune Hub (MNGL cluster)
    {
      name: 'MNGL Mother Station - Shivajinagar',
      address: 'Old Pune-Mumbai Highway, Near COEP Ground, Shivajinagar',
      city: 'Pune',
      area: 'Shivajinagar',
      latitude: 18.5314,
      longitude: 73.8553,
      phone: '+91 20 2553 7890',
      opening_hours: '24 Hours Open',
      availability_status: 'available',
      pressure_status: 'high',
      pressure_bar: 215,
      estimated_wait_minutes: 14,
      source: 'Sample Demo Dataset — MNGL Dispenser Feed',
      is_demo: 1,
      last_updated_at: minsAgo(35)
    },
    {
      name: 'BPCL-MNGL CNG Station - Hinjewadi Phase 1',
      address: 'Rajiv Gandhi Infotech Park, Near Wipro Circle',
      city: 'Pune',
      area: 'Hinjewadi',
      latitude: 18.5912,
      longitude: 73.7389,
      phone: '+91 20 6688 9900',
      opening_hours: '06:00 - 23:30',
      availability_status: 'available',
      pressure_status: 'medium',
      pressure_bar: 180,
      estimated_wait_minutes: 28,
      source: 'Sample Demo Dataset — Driver Telemetry',
      is_demo: 1,
      last_updated_at: minsAgo(55)
    },
    {
      name: 'HPCL-MNGL Station - Hadapsar Bypass',
      address: 'Pune-Solapur Highway, Near Magarpatta City Corner, Hadapsar',
      city: 'Pune',
      area: 'Hadapsar',
      latitude: 18.5028,
      longitude: 73.9298,
      phone: '+91 20 2687 4512',
      opening_hours: '24 Hours Open',
      availability_status: 'unknown',
      pressure_status: 'unknown',
      pressure_bar: null,
      estimated_wait_minutes: null,
      source: 'Sample Demo Dataset — Network Sync Delayed',
      is_demo: 1,
      last_updated_at: hoursAgo(7) // Stale & Unknown
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO stations (
      name, address, city, area, latitude, longitude,
      phone, opening_hours, availability_status, pressure_status,
      pressure_bar, estimated_wait_minutes, source, is_demo,
      last_updated_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?
    )
  `);

  for (const s of sampleStations) {
    stmt.run(
      s.name,
      s.address,
      s.city,
      s.area,
      s.latitude,
      s.longitude,
      s.phone,
      s.opening_hours,
      s.availability_status,
      s.pressure_status,
      s.pressure_bar,
      s.estimated_wait_minutes,
      s.source,
      s.is_demo,
      s.last_updated_at,
      s.last_updated_at
    );
  }

  console.log(`[Seed] Successfully seeded ${sampleStations.length} realistic sample CNG stations into SQLite.`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
