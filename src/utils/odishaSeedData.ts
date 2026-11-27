import { BusRoute, BusStop, FeedStatus, FleetCategory, LiveBus } from './transitTypes';

export const FLEET_CATEGORIES: {
  id: FleetCategory;
  shortLabel: string;
  operator: string;
  accentHex: string;
  description: string;
}[] = [
  {
    id: 'Shree Jagannath Express',
    shortLabel: 'Shree Jagannath Express',
    operator: 'OSRTC Pilgrim & Long-Distance AC Volvo',
    accentHex: '#e8641b',
    description: '3-axle AC luxury coaches connecting Puri and Bhubaneswar with major district headquarters and pilgrim shrines.'
  },
  {
    id: 'OSRTC',
    shortLabel: 'OSRTC',
    operator: 'Odisha State Road Transport Corporation',
    accentHex: '#d42a2f',
    description: 'Statewide intercity express network connecting all 30 districts with iconic red Sambalpuri motif coaches.'
  },
  {
    id: 'Mukhyamantri Bus Seva',
    shortLabel: 'Mukhyamantri Bus Seva',
    operator: 'Block & Gram Panchayat Connectivity',
    accentHex: '#f08c1c',
    description: 'Rural and block-to-district feeder midibuses serving towns, hats, and regional transit corridors.'
  },
  {
    id: 'Ama Bus',
    shortLabel: 'Ama Bus',
    operator: 'CRUT Urban Transit Network',
    accentHex: '#1f6fb8',
    description: 'Regular city midibuses operating across Bhubaneswar-Kataka-Puri, Sambalpur, Berhampur, Rourkela, and Keonjhar.'
  },
  {
    id: 'Ama Bus AC',
    shortLabel: 'Ama Bus AC',
    operator: 'CRUT Air-Conditioned Low-Floor',
    accentHex: '#1556a8',
    description: 'Climate-controlled low-floor blue city coaches serving high-density urban and inter-municipal corridors.'
  },
  {
    id: 'Mo Bus',
    shortLabel: 'Mo Bus',
    operator: 'Capital Region Urban Transport (CRUT)',
    accentHex: '#0d9488',
    description: 'Signature Capital Region smart transit fleet connecting Biju Patnaik Airport, Master Canteen, Nandankanan, Kataka, and Puri.'
  }
];

export const SEED_STOPS: BusStop[] = [
  // OD06M9141 Route KAM0002U Stops (Kamakhyanagar Dkl -> Gangijodi)
  { id: 'nkamakhyanagar2093285544', name: 'Kamakhyanagar Dkl', district: 'Dhenkanal', lat: 20.93227, lon: 85.54403, isTerminal: true, code: 'KMN' },
  { id: 'nmahulapal2089585541', name: 'Mahulapal Chhaka', district: 'Dhenkanal', lat: 20.89518, lon: 85.54140, code: 'MHP' },
  { id: 'naluajharana2084685524', name: 'Aluajharana', district: 'Dhenkanal', lat: 20.84661, lon: 85.52417, code: 'ALJ' },
  { id: 'nanlabhata2080985540', name: 'Anlabhata', district: 'Dhenkanal', lat: 20.80956, lon: 85.54063, code: 'ANB' },
  { id: 'npandua2078585548', name: 'Pandua Chhaka', district: 'Dhenkanal', lat: 20.78589, lon: 85.54882, code: 'PND' },
  { id: 'ntumusingha2080085478', name: 'Tumusingha', district: 'Dhenkanal', lat: 20.80081, lon: 85.47860, code: 'TMS' },
  { id: 'nsirumula2079485468', name: 'Sirumula KM', district: 'Dhenkanal', lat: 20.79470, lon: 85.46864, code: 'SRM' },
  { id: 'ngangijodi2079985441', name: 'Gangijodi', district: 'Dhenkanal', lat: 20.79968, lon: 85.44126, isTerminal: true, code: 'GGJ' },

  // Major Odisha Intercity & City Terminals
  { id: 'nbhubaneswarbsabt2027485791', name: 'Bhubaneswar [BSABT] Baramunda', district: 'Khordha', lat: 20.27410, lon: 85.79120, isTerminal: true, code: 'BSABT' },
  { id: 'nmastercanteen2026685843', name: 'Master Canteen Terminal', district: 'Khordha', lat: 20.26650, lon: 85.84340, isTerminal: true, code: 'MCT' },
  { id: 'nbpiairport2024685817', name: 'Biju Patnaik International Airport', district: 'Khordha', lat: 20.24690, lon: 85.81780, isTerminal: true, code: 'BPIA' },
  { id: 'nkiitsquare2035385825', name: 'KIIT Square Patia', district: 'Khordha', lat: 20.35330, lon: 85.82510, code: 'KIIT' },
  { id: 'nnandankanan2039585825', name: 'Nandankanan Zoological Park', district: 'Khordha', lat: 20.39580, lon: 85.82590, isTerminal: true, code: 'NDK' },
  { id: 'naiimsbbsr2023185775', name: 'AIIMS Bhubaneswar', district: 'Khordha', lat: 20.23120, lon: 85.77530, isTerminal: true, code: 'AIIMS' },
  { id: 'nrasulgarh2029185862', name: 'Rasulgarh Square', district: 'Khordha', lat: 20.29120, lon: 85.86210, code: 'RSG' },
  { id: 'nkalpanasquare2025185838', name: 'Kalpana Square', district: 'Khordha', lat: 20.25120, lon: 85.83840, code: 'KLP' },
  { id: 'npipili2011385832', name: 'Pipili Toll Plaza', district: 'Puri', lat: 20.11340, lon: 85.83210, code: 'PPL' },
  { id: 'nsakhigopal1995285819', name: 'Sakhigopal Temple Chhak', district: 'Puri', lat: 19.95220, lon: 85.81950, code: 'SKG' },
  { id: 'npuribusstand1980785826', name: 'Puri Grand Road Bus Terminal', district: 'Puri', lat: 19.80750, lon: 85.82690, isTerminal: true, code: 'PURI' },
  { id: 'nkonark1988786094', name: 'Konark Sun Temple Stand', district: 'Puri', lat: 19.88760, lon: 86.09450, isTerminal: true, code: 'KNK' },
  { id: 'nkataka2045785880', name: 'Kataka CNBT Netaji Terminal', district: 'Kataka', lat: 20.45730, lon: 85.88040, isTerminal: true, code: 'CNBT' },
  { id: 'nscbmedical2047285888', name: 'SCB Medical College Kataka', district: 'Kataka', lat: 20.47210, lon: 85.88810, code: 'SCB' },
  { id: 'nkhordhabypass2018685645', name: 'Khordha Bypass', district: 'Khordha', lat: 20.18620, lon: 85.64510, code: 'KHD' },
  { id: 'nbalugaonbypass1975885192', name: 'Balugaon Chilika Bypass', district: 'Khordha', lat: 19.75810, lon: 85.19240, code: 'BLG' },
  { id: 'nrambha1950085086', name: 'Rambha Railway Station', district: 'Ganjam', lat: 19.49980, lon: 85.08614, code: 'RMB' },
  { id: 'nchatrapur1935284978', name: 'Chatrapur New Bus Stand', district: 'Ganjam', lat: 19.35242, lon: 84.97758, code: 'CTP' },
  { id: 'nbrahmapur1927084777', name: 'Brahmapur (Berhampur Haldiapadar)', district: 'Ganjam', lat: 19.26983, lon: 84.77731, isTerminal: true, code: 'BAM' },
  { id: 'ngopalpur1925884905', name: 'Gopalpur-on-Sea Junction', district: 'Ganjam', lat: 19.25840, lon: 84.90520, code: 'GPP' },
  { id: 'ndhenkanal2066185598', name: 'Dhenkanal Main Bus Stand', district: 'Dhenkanal', lat: 20.66120, lon: 85.59810, isTerminal: true, code: 'DKL' },
  { id: 'nanugola2084085101', name: 'Anugola (Angul OSRTC Depot)', district: 'Angul', lat: 20.84090, lon: 85.10160, isTerminal: true, code: 'ANG' },
  { id: 'nsambalpur2149583984', name: 'Sambalpur Ainthapali Bus Terminal', district: 'Sambalpur', lat: 21.49507, lon: 83.98443, isTerminal: true, code: 'SBP' },
  { id: 'nsambalpurrly2147684006', name: 'Sambalpur City Railway Station', district: 'Sambalpur', lat: 21.47678, lon: 84.00663, code: 'SBPR' },
  { id: 'nbirsamunda2149383988', name: 'Birsa Munda Chowk Ainthapali', district: 'Sambalpur', lat: 21.49372, lon: 83.98863, code: 'BMC' },
  { id: 'nburla2150183871', name: 'Burla VIMSAR & VSSUT Square', district: 'Sambalpur', lat: 21.50110, lon: 83.87120, code: 'BRL' },
  { id: 'njharsuguda2185584006', name: 'Jharsuguda Bus Terminal', district: 'Jharsuguda', lat: 21.85540, lon: 84.00620, isTerminal: true, code: 'JSG' },
  { id: 'nraurkela2222784825', name: 'Raurkela (Rourkela OSRTC Terminal)', district: 'Sundargarh', lat: 22.22711, lon: 84.82571, isTerminal: true, code: 'ROU' },
  { id: 'nkendujhar2163685608', name: 'Kendujhar (Keonjhar Bus Stand)', district: 'Keonjhar', lat: 21.63600, lon: 85.60800, isTerminal: true, code: 'KJR' },
  { id: 'nghatagaon2139185900', name: 'Ghatagaon Maa Tarini Chhak', district: 'Keonjhar', lat: 21.39100, lon: 85.90000, code: 'GTG' },
  { id: 'nbhadrak2107486502', name: 'Bhadrak Bus Terminal', district: 'Bhadrak', lat: 21.07400, lon: 86.50200, isTerminal: true, code: 'BHC' },
  { id: 'nbalasore2149486933', name: 'Balasore Sahadevkhunta Stand', district: 'Balasore', lat: 21.49420, lon: 86.93350, isTerminal: true, code: 'BLS' },
  { id: 'nbaripada2193286728', name: 'Baripada OSRTC Depot', district: 'Mayurbhanj', lat: 21.93200, lon: 86.72800, isTerminal: true, code: 'BPD' },
  { id: 'nphulbani2047784233', name: 'Phulbani OSRTC Bus Stand', district: 'Kandhamal', lat: 20.47700, lon: 84.23300, isTerminal: true, code: 'PBN' },
  { id: 'nbhanjanagar1993784582', name: 'Bhanjanagar Depot', district: 'Ganjam', lat: 19.93700, lon: 84.58200, code: 'BJN' },
  { id: 'nbeguniapada1963884993', name: 'Beguniapada Block', district: 'Ganjam', lat: 19.63806, lon: 84.99396, code: 'BED' },
  { id: 'nkumaripari1979485045', name: 'Kumaripari', district: 'Ganjam', lat: 19.79493, lon: 85.04562, code: 'KMP' },
  { id: 'njayapur1885682571', name: 'Jayapur (Jeypore OSRTC Zone)', district: 'Koraput', lat: 18.85620, lon: 82.57140, isTerminal: true, code: 'JYP' },
  { id: 'nkoraput1881382711', name: 'Koraput Bus Stand', district: 'Koraput', lat: 18.81350, lon: 82.71120, isTerminal: true, code: 'KPT' },
  { id: 'nrayagada1917183416', name: 'Rayagada Bus Terminal', district: 'Rayagada', lat: 19.17120, lon: 83.41620, isTerminal: true, code: 'RGD' },
  { id: 'nbalᆺ2070783484', name: 'Balangir OSRTC Stand', district: 'Balangir', lat: 20.70710, lon: 83.48420, isTerminal: true, code: 'BLR' },
  { id: 'nbargarh2133783622', name: 'Bargarh Main Stand', district: 'Bargarh', lat: 21.33740, lon: 83.62204, isTerminal: true, code: 'BRG' },
  { id: 'nkomna2050382672', name: 'Komna Block Stand', district: 'Nuapada', lat: 20.50300, lon: 82.67200, code: 'KMN2' }
];

export const SEED_ROUTES: BusRoute[] = [
  {
    id: 'KAM0002U',
    routeNumber: 'KAM0002U',
    name: 'Kamakhyanagar Dkl → Gangijodi',
    origin: 'Kamakhyanagar Dkl',
    destination: 'Gangijodi',
    fleet: 'Mukhyamantri Bus Seva',
    corridor: 'Dhenkanal District Rural Corridor',
    distanceKm: 28,
    durationLabel: '1h 06m',
    departures: ['06:30', '10:15', '14:31', '17:45'],
    stops: [
      { stopId: 'nkamakhyanagar2093285544', stopName: 'Kamakhyanagar Dkl', lat: 20.93227, lon: 85.54403, scheduledTime: '14:31', estimatedTime: '14:31', status: 'passed', sequence: 1 },
      { stopId: 'nmahulapal2089585541', stopName: 'Mahulapal Chhaka', lat: 20.89518, lon: 85.54140, scheduledTime: '14:41', estimatedTime: '14:41', status: 'passed', sequence: 2 },
      { stopId: 'naluajharana2084685524', stopName: 'Aluajharana', lat: 20.84661, lon: 85.52417, scheduledTime: '14:51', estimatedTime: '14:51', status: 'passed', sequence: 3 },
      { stopId: 'nanlabhata2080985540', stopName: 'Anlabhata', lat: 20.80956, lon: 85.54063, scheduledTime: '14:58', estimatedTime: '14:58', status: 'passed', sequence: 4 },
      { stopId: 'npandua2078585548', stopName: 'Pandua Chhaka', lat: 20.78589, lon: 85.54882, scheduledTime: '15:02', estimatedTime: '15:02', status: 'passed', sequence: 5 },
      { stopId: 'ntumusingha2080085478', stopName: 'Tumusingha', lat: 20.80081, lon: 85.47860, scheduledTime: '15:25', estimatedTime: '15:25', status: 'passed', sequence: 6 },
      { stopId: 'nsirumula2079485468', stopName: 'Sirumula KM', lat: 20.79470, lon: 85.46864, scheduledTime: '15:31', estimatedTime: '15:31', status: 'passed', sequence: 7 },
      { stopId: 'ngangijodi2079985441', stopName: 'Gangijodi', lat: 20.79968, lon: 85.44126, scheduledTime: '15:37', estimatedTime: '15:37', status: 'current', sequence: 8 }
    ],
    path: [
      [20.93227, 85.54403],
      [20.89518, 85.54140],
      [20.84661, 85.52417],
      [20.80956, 85.54063],
      [20.78589, 85.54882],
      [20.80081, 85.47860],
      [20.79470, 85.46864],
      [20.79968, 85.44126]
    ]
  },
  {
    id: 'JE_0012U',
    routeNumber: 'JE_0012U',
    name: 'Puri → Bhubaneswar → Kendujhar (Maa Tarini Express)',
    origin: 'Puri Grand Road Bus Terminal',
    destination: 'Kendujhar (Keonjhar Bus Stand)',
    fleet: 'Shree Jagannath Express',
    corridor: 'Puri–Bhubaneswar–Ghatagaon Pilgrim Superfast',
    distanceKm: 278,
    durationLabel: '5h 15m',
    departures: ['05:45', '08:30', '13:15', '21:45'],
    stops: [
      { stopId: 'npuribusstand1980785826', stopName: 'Puri Grand Road Bus Terminal', lat: 19.80750, lon: 85.82690, scheduledTime: '13:15', estimatedTime: '13:15', status: 'passed', sequence: 1 },
      { stopId: 'npipili2011385832', stopName: 'Pipili Toll Plaza', lat: 20.11340, lon: 85.83210, scheduledTime: '14:00', estimatedTime: '14:02', status: 'passed', sequence: 2 },
      { stopId: 'nbhubaneswarbsabt2027485791', stopName: 'Bhubaneswar [BSABT] Baramunda', lat: 20.27410, lon: 85.79120, scheduledTime: '14:35', estimatedTime: '14:38', status: 'passed', sequence: 3 },
      { stopId: 'nkataka2045785880', stopName: 'Kataka CNBT Netaji Terminal', lat: 20.45730, lon: 85.88040, scheduledTime: '15:15', estimatedTime: '15:18', status: 'current', sequence: 4 },
      { stopId: 'nghatagaon2139185900', stopName: 'Ghatagaon Maa Tarini Chhak', lat: 21.39100, lon: 85.90000, scheduledTime: '17:30', estimatedTime: '17:34', status: 'upcoming', sequence: 5 },
      { stopId: 'nkendujhar2163685608', stopName: 'Kendujhar (Keonjhar Bus Stand)', lat: 21.63600, lon: 85.60800, scheduledTime: '18:30', estimatedTime: '18:30', status: 'upcoming', sequence: 6 }
    ],
    path: [
      [19.80750, 85.82690],
      [20.11340, 85.83210],
      [20.27410, 85.79120],
      [20.45730, 85.88040],
      [21.39100, 85.90000],
      [21.63600, 85.60800]
    ]
  },
  {
    id: 'CTC0005D',
    routeNumber: 'CTC0005D',
    name: 'Brahmapur → Bhubaneswar [BSABT] → Kataka',
    origin: 'Brahmapur (Berhampur Haldiapadar)',
    destination: 'Kataka CNBT Netaji Terminal',
    fleet: 'OSRTC',
    corridor: 'NH-16 Coastal Express Highway',
    distanceKm: 196,
    durationLabel: '3h 55m',
    departures: ['06:00', '09:30', '13:45', '17:00', '21:30'],
    stops: [
      { stopId: 'nbrahmapur1927084777', stopName: 'Brahmapur (Berhampur Haldiapadar)', lat: 19.26983, lon: 84.77731, scheduledTime: '13:45', estimatedTime: '13:45', status: 'passed', sequence: 1 },
      { stopId: 'nchatrapur1935284978', stopName: 'Chatrapur New Bus Stand', lat: 19.35242, lon: 84.97758, scheduledTime: '14:15', estimatedTime: '14:16', status: 'passed', sequence: 2 },
      { stopId: 'nrambha1950085086', stopName: 'Rambha Railway Station', lat: 19.49980, lon: 85.08614, scheduledTime: '14:45', estimatedTime: '14:48', status: 'passed', sequence: 3 },
      { stopId: 'nbalugaonbypass1975885192', stopName: 'Balugaon Chilika Bypass', lat: 19.75810, lon: 85.19240, scheduledTime: '15:25', estimatedTime: '15:27', status: 'current', sequence: 4 },
      { stopId: 'nkhordhabypass2018685645', stopName: 'Khordha Bypass', lat: 20.18620, lon: 85.64510, scheduledTime: '16:35', estimatedTime: '16:38', status: 'upcoming', sequence: 5 },
      { stopId: 'nbhubaneswarbsabt2027485791', stopName: 'Bhubaneswar [BSABT] Baramunda', lat: 20.27410, lon: 85.79120, scheduledTime: '17:05', estimatedTime: '17:08', status: 'upcoming', sequence: 6 },
      { stopId: 'nkataka2045785880', stopName: 'Kataka CNBT Netaji Terminal', lat: 20.45730, lon: 85.88040, scheduledTime: '17:40', estimatedTime: '17:42', status: 'upcoming', sequence: 7 }
    ],
    path: [
      [19.26983, 84.77731],
      [19.35242, 84.97758],
      [19.49980, 85.08614],
      [19.75810, 85.19240],
      [20.18620, 85.64510],
      [20.27410, 85.79120],
      [20.45730, 85.88040]
    ]
  },
  {
    id: 'BSR0024U',
    routeNumber: 'BSR0024U',
    name: 'Bhubaneswar [BSABT] → Anugola → Sambalpur → Raurkela',
    origin: 'Bhubaneswar [BSABT] Baramunda',
    destination: 'Raurkela (Rourkela OSRTC Terminal)',
    fleet: 'OSRTC',
    corridor: 'NH-55 Western Odisha Trunk Route',
    distanceKm: 398,
    durationLabel: '7h 45m',
    departures: ['06:15', '11:00', '14:00', '20:30'],
    stops: [
      { stopId: 'nbhubaneswarbsabt2027485791', stopName: 'Bhubaneswar [BSABT] Baramunda', lat: 20.27410, lon: 85.79120, scheduledTime: '11:00', estimatedTime: '11:00', status: 'passed', sequence: 1 },
      { stopId: 'ndhenkanal2066185598', stopName: 'Dhenkanal Main Bus Stand', lat: 20.66120, lon: 85.59810, scheduledTime: '12:35', estimatedTime: '12:35', status: 'passed', sequence: 2 },
      { stopId: 'nanugola2084085101', stopName: 'Anugola (Angul OSRTC Depot)', lat: 20.84090, lon: 85.10160, scheduledTime: '13:50', estimatedTime: '13:55', status: 'passed', sequence: 3 },
      { stopId: 'nsambalpur2149583984', stopName: 'Sambalpur Ainthapali Bus Terminal', lat: 21.49507, lon: 83.98443, scheduledTime: '16:20', estimatedTime: '16:24', status: 'current', sequence: 4 },
      { stopId: 'njharsuguda2185584006', stopName: 'Jharsuguda Bus Terminal', lat: 21.85540, lon: 84.00620, scheduledTime: '17:25', estimatedTime: '17:30', status: 'upcoming', sequence: 5 },
      { stopId: 'nraurkela2222784825', stopName: 'Raurkela (Rourkela OSRTC Terminal)', lat: 22.22711, lon: 84.82571, scheduledTime: '18:45', estimatedTime: '18:48', status: 'upcoming', sequence: 6 }
    ],
    path: [
      [20.27410, 85.79120],
      [20.66120, 85.59810],
      [20.84090, 85.10160],
      [21.49507, 83.98443],
      [21.85540, 84.00620],
      [22.22711, 84.82571]
    ]
  },
  {
    id: 'AMA_200S',
    routeNumber: '200S',
    name: 'Sambalpur City Railway Station → Ainthapali Bus Terminal → Burla VIMSAR',
    origin: 'Sambalpur City Railway Station',
    destination: 'Burla VIMSAR & VSSUT Square',
    fleet: 'Ama Bus',
    corridor: 'Sambalpur Urban Transit Line',
    distanceKm: 18,
    durationLabel: '42m',
    departures: ['07:00', '08:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'],
    stops: [
      { stopId: 'nsambalpurrly2147684006', stopName: 'Sambalpur City Railway Station', lat: 21.47678, lon: 84.00663, scheduledTime: '15:00', estimatedTime: '15:00', status: 'passed', sequence: 1 },
      { stopId: 'nbirsamunda2149383988', stopName: 'Birsa Munda Chowk Ainthapali', lat: 21.49372, lon: 83.98863, scheduledTime: '15:14', estimatedTime: '15:15', status: 'current', sequence: 2 },
      { stopId: 'nsambalpur2149583984', stopName: 'Sambalpur Ainthapali Bus Terminal', lat: 21.49507, lon: 83.98443, scheduledTime: '15:20', estimatedTime: '15:21', status: 'upcoming', sequence: 3 },
      { stopId: 'nburla2150183871', stopName: 'Burla VIMSAR & VSSUT Square', lat: 21.50110, lon: 83.87120, scheduledTime: '15:42', estimatedTime: '15:42', status: 'upcoming', sequence: 4 }
    ],
    path: [
      [21.47678, 84.00663],
      [21.49372, 83.98863],
      [21.49507, 83.98443],
      [21.50110, 83.87120]
    ]
  },
  {
    id: 'AMAAC_18A',
    routeNumber: '18A-AC',
    name: 'Kataka CNBT → Rasulgarh → Master Canteen → AIIMS Bhubaneswar',
    origin: 'Kataka CNBT Netaji Terminal',
    destination: 'AIIMS Bhubaneswar',
    fleet: 'Ama Bus AC',
    corridor: 'Twin City AC Metro Spine',
    distanceKm: 34,
    durationLabel: '1h 10m',
    departures: ['06:30', '07:30', '09:00', '11:30', '14:30', '16:30', '18:30', '20:30'],
    stops: [
      { stopId: 'nscbmedical2047285888', stopName: 'SCB Medical College Kataka', lat: 20.47210, lon: 85.88810, scheduledTime: '14:30', estimatedTime: '14:30', status: 'passed', sequence: 1 },
      { stopId: 'nkataka2045785880', stopName: 'Kataka CNBT Netaji Terminal', lat: 20.45730, lon: 85.88040, scheduledTime: '14:40', estimatedTime: '14:40', status: 'passed', sequence: 2 },
      { stopId: 'nrasulgarh2029185862', stopName: 'Rasulgarh Square', lat: 20.29120, lon: 85.86210, scheduledTime: '15:08', estimatedTime: '15:10', status: 'current', sequence: 3 },
      { stopId: 'nmastercanteen2026685843', stopName: 'Master Canteen Terminal', lat: 20.26650, lon: 85.84340, scheduledTime: '15:20', estimatedTime: '15:22', status: 'upcoming', sequence: 4 },
      { stopId: 'nbhubaneswarbsabt2027485791', stopName: 'Bhubaneswar [BSABT] Baramunda', lat: 20.27410, lon: 85.79120, scheduledTime: '15:30', estimatedTime: '15:32', status: 'upcoming', sequence: 5 },
      { stopId: 'naiimsbbsr2023185775', stopName: 'AIIMS Bhubaneswar', lat: 20.23120, lon: 85.77530, scheduledTime: '15:40', estimatedTime: '15:42', status: 'upcoming', sequence: 6 }
    ],
    path: [
      [20.47210, 85.88810],
      [20.45730, 85.88040],
      [20.29120, 85.86210],
      [20.26650, 85.84340],
      [20.27410, 85.79120],
      [20.23120, 85.77530]
    ]
  },
  {
    id: 'MOBUS_13E',
    routeNumber: '13E',
    name: 'Nandankanan → KIIT Square → Master Canteen → Pipili → Puri',
    origin: 'Nandankanan Zoological Park',
    destination: 'Puri Grand Road Bus Terminal',
    fleet: 'Mo Bus',
    corridor: 'CRUT Capital Region Heritage Express',
    distanceKm: 76,
    durationLabel: '1h 55m',
    departures: ['06:00', '08:00', '10:30', '13:30', '15:00', '17:30', '19:45'],
    stops: [
      { stopId: 'nnandankanan2039585825', stopName: 'Nandankanan Zoological Park', lat: 20.39580, lon: 85.82590, scheduledTime: '14:30', estimatedTime: '14:30', status: 'passed', sequence: 1 },
      { stopId: 'nkiitsquare2035385825', stopName: 'KIIT Square Patia', lat: 20.35330, lon: 85.82510, scheduledTime: '14:42', estimatedTime: '14:43', status: 'passed', sequence: 2 },
      { stopId: 'nmastercanteen2026685843', stopName: 'Master Canteen Terminal', lat: 20.26650, lon: 85.84340, scheduledTime: '15:05', estimatedTime: '15:06', status: 'passed', sequence: 3 },
      { stopId: 'nkalpanasquare2025185838', stopName: 'Kalpana Square', lat: 20.25120, lon: 85.83840, scheduledTime: '15:14', estimatedTime: '15:15', status: 'current', sequence: 4 },
      { stopId: 'npipili2011385832', stopName: 'Pipili Toll Plaza', lat: 20.11340, lon: 85.83210, scheduledTime: '15:40', estimatedTime: '15:42', status: 'upcoming', sequence: 5 },
      { stopId: 'nsakhigopal1995285819', stopName: 'Sakhigopal Temple Chhak', lat: 19.95220, lon: 85.81950, scheduledTime: '16:05', estimatedTime: '16:06', status: 'upcoming', sequence: 6 },
      { stopId: 'npuribusstand1980785826', stopName: 'Puri Grand Road Bus Terminal', lat: 19.80750, lon: 85.82690, scheduledTime: '16:25', estimatedTime: '16:25', status: 'upcoming', sequence: 7 }
    ],
    path: [
      [20.39580, 85.82590],
      [20.35330, 85.82510],
      [20.26650, 85.84340],
      [20.25120, 85.83840],
      [20.11340, 85.83210],
      [19.95220, 85.81950],
      [19.80750, 85.82690]
    ]
  },
  {
    id: 'MOBUS_10A',
    routeNumber: '10',
    name: 'Biju Patnaik Airport → Master Canteen → KIIT Square → Nandankanan',
    origin: 'Biju Patnaik International Airport',
    destination: 'Nandankanan Zoological Park',
    fleet: 'Mo Bus',
    corridor: 'Bhubaneswar Smart Airport Trunk Line',
    distanceKm: 21,
    durationLabel: '50m',
    departures: ['06:15', '07:15', '08:15', '09:30', '11:30', '13:30', '15:15', '17:15', '19:15', '21:15'],
    stops: [
      { stopId: 'nbpiairport2024685817', stopName: 'Biju Patnaik International Airport', lat: 20.24690, lon: 85.81780, scheduledTime: '15:00', estimatedTime: '15:00', status: 'passed', sequence: 1 },
      { stopId: 'nmastercanteen2026685843', stopName: 'Master Canteen Terminal', lat: 20.26650, lon: 85.84340, scheduledTime: '15:14', estimatedTime: '15:15', status: 'current', sequence: 2 },
      { stopId: 'nkiitsquare2035385825', stopName: 'KIIT Square Patia', lat: 20.35330, lon: 85.82510, scheduledTime: '15:36', estimatedTime: '15:37', status: 'upcoming', sequence: 3 },
      { stopId: 'nnandankanan2039585825', stopName: 'Nandankanan Zoological Park', lat: 20.39580, lon: 85.82590, scheduledTime: '15:50', estimatedTime: '15:50', status: 'upcoming', sequence: 4 }
    ],
    path: [
      [20.24690, 85.81780],
      [20.26650, 85.84340],
      [20.35330, 85.82510],
      [20.39580, 85.82590]
    ]
  }
];

export const SEED_LIVE_BUSES: LiveBus[] = [
  {
    id: '1742',
    registrationNumber: 'OD06M9141',
    fleet: 'Mukhyamantri Bus Seva',
    routeId: 'KAM0002U',
    routeNumber: 'KAM0002U',
    routeName: 'Kamakhyanagar Dkl → Gangijodi',
    origin: 'Kamakhyanagar Dkl',
    destination: 'Gangijodi',
    lat: 20.79720,
    lon: 85.44855,
    bearing: 187,
    speedKmh: 38,
    timestamp: Math.floor(Date.now() / 1000) - 24,
    depot: 'Dhenkanal Depot',
    isOnTrip: true,
    lastStopName: 'Sirumula KM',
    nextStopName: 'Gangijodi',
    nextStopEta: '15:37',
    tripStops: SEED_ROUTES[0].stops,
    path: SEED_ROUTES[0].path
  },
  {
    id: '2901',
    registrationNumber: 'OD02CE7701',
    fleet: 'Shree Jagannath Express',
    routeId: 'JE_0012U',
    routeNumber: 'JE_0012U',
    routeName: 'Puri → Bhubaneswar → Kendujhar',
    origin: 'Puri Grand Road Bus Terminal',
    destination: 'Kendujhar (Keonjhar Bus Stand)',
    lat: 20.45730,
    lon: 85.88040,
    bearing: 14,
    speedKmh: 64,
    timestamp: Math.floor(Date.now() / 1000) - 15,
    depot: 'Puri Central Depot',
    isOnTrip: true,
    lastStopName: 'Bhubaneswar [BSABT] Baramunda',
    nextStopName: 'Ghatagaon Maa Tarini Chhak',
    nextStopEta: '17:34',
    tripStops: SEED_ROUTES[1].stops,
    path: SEED_ROUTES[1].path
  },
  {
    id: '2532',
    registrationNumber: 'OD07AT9515',
    fleet: 'OSRTC',
    routeId: 'CTC0005D',
    routeNumber: 'CTC0005D',
    routeName: 'Brahmapur → Bhubaneswar [BSABT] → Kataka',
    origin: 'Brahmapur (Berhampur Haldiapadar)',
    destination: 'Kataka CNBT Netaji Terminal',
    lat: 19.75810,
    lon: 85.19240,
    bearing: 42,
    speedKmh: 56,
    timestamp: Math.floor(Date.now() / 1000) - 19,
    depot: 'Berhampur OSRTC Depot',
    isOnTrip: true,
    lastStopName: 'Rambha Railway Station',
    nextStopName: 'Khordha Bypass',
    nextStopEta: '16:38',
    tripStops: SEED_ROUTES[2].stops,
    path: SEED_ROUTES[2].path
  },
  {
    id: '2548',
    registrationNumber: 'OD33AW2477',
    fleet: 'OSRTC',
    routeId: 'BSR0024U',
    routeNumber: 'BSR0024U',
    routeName: 'Bhubaneswar [BSABT] → Anugola → Sambalpur → Raurkela',
    origin: 'Bhubaneswar [BSABT] Baramunda',
    destination: 'Raurkela (Rourkela OSRTC Terminal)',
    lat: 21.49507,
    lon: 83.98443,
    bearing: 342,
    speedKmh: 52,
    timestamp: Math.floor(Date.now() / 1000) - 31,
    depot: 'Bhubaneswar Zone II',
    isOnTrip: true,
    lastStopName: 'Anugola (Angul OSRTC Depot)',
    nextStopName: 'Jharsuguda Bus Terminal',
    nextStopEta: '17:30',
    tripStops: SEED_ROUTES[3].stops,
    path: SEED_ROUTES[3].path
  },
  {
    id: 'c2001',
    registrationNumber: 'OD15X3905',
    fleet: 'Ama Bus',
    routeId: 'AMA_200S',
    routeNumber: '200S',
    routeName: 'Sambalpur City Railway Station → Ainthapali → Burla',
    origin: 'Sambalpur City Railway Station',
    destination: 'Burla VIMSAR & VSSUT Square',
    lat: 21.49372,
    lon: 83.98863,
    bearing: 288,
    speedKmh: 34,
    timestamp: Math.floor(Date.now() / 1000) - 12,
    depot: 'Sambalpur CRUT Terminal',
    isOnTrip: true,
    lastStopName: 'Sambalpur City Railway Station',
    nextStopName: 'Sambalpur Ainthapali Bus Terminal',
    nextStopEta: '15:21',
    tripStops: SEED_ROUTES[4].stops,
    path: SEED_ROUTES[4].path
  },
  {
    id: 'c1804',
    registrationNumber: 'OD02BV1108',
    fleet: 'Ama Bus AC',
    routeId: 'AMAAC_18A',
    routeNumber: '18A-AC',
    routeName: 'Kataka CNBT → Rasulgarh → Master Canteen → AIIMS Bhubaneswar',
    origin: 'Kataka CNBT Netaji Terminal',
    destination: 'AIIMS Bhubaneswar',
    lat: 20.29120,
    lon: 85.86210,
    bearing: 215,
    speedKmh: 41,
    timestamp: Math.floor(Date.now() / 1000) - 10,
    depot: 'Patia EV & AC Depot',
    isOnTrip: true,
    lastStopName: 'Kataka CNBT Netaji Terminal',
    nextStopName: 'Master Canteen Terminal',
    nextStopEta: '15:22',
    tripStops: SEED_ROUTES[5].stops,
    path: SEED_ROUTES[5].path
  },
  {
    id: 'm1301',
    registrationNumber: 'OD02AY1013',
    fleet: 'Mo Bus',
    routeId: 'MOBUS_13E',
    routeNumber: '13E',
    routeName: 'Nandankanan → KIIT Square → Master Canteen → Pipili → Puri',
    origin: 'Nandankanan Zoological Park',
    destination: 'Puri Grand Road Bus Terminal',
    lat: 20.25120,
    lon: 85.83840,
    bearing: 184,
    speedKmh: 46,
    timestamp: Math.floor(Date.now() / 1000) - 8,
    depot: 'Master Canteen CRUT Hub',
    isOnTrip: true,
    lastStopName: 'Master Canteen Terminal',
    nextStopName: 'Pipili Toll Plaza',
    nextStopEta: '15:42',
    tripStops: SEED_ROUTES[6].stops,
    path: SEED_ROUTES[6].path
  },
  {
    id: 'm1002',
    registrationNumber: 'OD02AY2210',
    fleet: 'Mo Bus',
    routeId: 'MOBUS_10A',
    routeNumber: '10',
    routeName: 'Biju Patnaik Airport → Master Canteen → KIIT Square → Nandankanan',
    origin: 'Biju Patnaik International Airport',
    destination: 'Nandankanan Zoological Park',
    lat: 20.26650,
    lon: 85.84340,
    bearing: 12,
    speedKmh: 35,
    timestamp: Math.floor(Date.now() / 1000) - 14,
    depot: 'Pokhariput CRUT Depot',
    isOnTrip: true,
    lastStopName: 'Biju Patnaik International Airport',
    nextStopName: 'KIIT Square Patia',
    nextStopEta: '15:37',
    tripStops: SEED_ROUTES[7].stops,
    path: SEED_ROUTES[7].path
  }
];

export const SEED_STATUS: FeedStatus = {
  network: 'osrtc',
  feedTime: Math.floor(Date.now() / 1000),
  written: Math.floor(Date.now() / 1000),
  vehicles: 1722,
  onTrip: 168,
  onRoute: 168,
  tripUpdates: 164,
  lastSyncedIso: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  sourceMode: 'live-gtfs'
};
