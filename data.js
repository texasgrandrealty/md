// Data Configuration for 109 Kelli Dr Market Analysis
// Contains property data, comparables, and pricing strategy

const propertyData = {
    isListingActive: true, // Presentation Mode = false, Client Mode = true
    address: '109 Kelli Dr, Forney, TX 75126',
    city: 'Forney',
    zipCode: '75126',
    price: 449900,
    sqft: 2890,
    beds: 4,
    baths: 3,
    lotSize: '0.19 AC',
    yearBuilt: '2005',
    youtubeID: 'fj_mo819gi0?si=Q98hN5PFlzK6MOKG',
    active: 14,
    pending: 5,
    underContract: 0,
    monthsSupply: 3.5,
    dom: 97,
    
    // Local Market KPIs (Broader Market Data)
    localMarket: {
        newListings: 217,
        newListingsChange: 14,
        medianSoldPrice: 342000,
        medianSoldPriceChangePct: 0.58,
        activeInventory: 2247,
        activeInventoryChange: -7,
        failedListings: 124,
        failed: 124,  // KCM Data: Used for failure rate calculation
        macroSold: 14  // Closed sales for outcome statistics chart (71 active / 5.04 months ≈ 14)
    },
    
    // Hunt County Macro Market Data (Forney 75126 Macro Environment)
    huntCountyMacro: {
        sold: 14,
        active: 71,
        pending: 4,
        failed: 124
    },
    
    // Liquidity KPIs (Market Velocity Metrics) - Synced to Macro Forney 75126
    liquidity: {
        totalMarketPool: 71,  // Active listings (Macro Forney 75126)
        pendingSales: 4,      // Pending sales (Macro Forney 75126)
        closedLastMonth: 14   // Sold last month (Macro Forney 75126)
    },
    marketRates: {
        current: '6.16% (MND Average)',
        fedCutProb: '14% (March 18th Outlook)',
        narrative: 'MBS investors have already baked in anticipated cuts; movement occurs only if future data exceeds expectations.',
        unemployment: 'Forecast 4.4% (Friday Jobs Report)',
        adp: 'Forecast 45k (Wednesday ADP)'
    },
    // Stagnation Risk Metrics
    stagnationThreshold: 74, // Area Average DOM - The "cliff" for liquidity probability
    roadmapPhases: [
        { phase: 1, price: 449900, label: 'Phase 1 (Day 0)', status: 'Market Test' },
        { phase: 2, price: 434900, label: 'Phase 2 (Day 30)', status: 'Strategic Pivot' },
        { phase: 3, price: 419900, label: 'Phase 3 (Day 60)', status: 'Expert Value' },
        { phase: 4, price: 404900, label: 'Phase 4 (Day 90+)', status: 'Liquidity Floor' }
    ],
    matterportLink: 'https://my.matterport.com/show/?m=cTSxrKFZQvR',
    matterportEmbedUrl: 'https://my.matterport.com/show/?m=cTSxrKFZQvR&play=1&mls=2',
    
    // BrokerBay Feedback Intelligence Log
    feedbackLog: [
    {
        "date": "02/24/2026",
        "interest": "Unknown",
        "comments": "- Thomas Andrew Miller <info@mg2.brokerbay.com>Date: Mon, Feb 23, 2026 at 10:05 AMSubject: Feedback Submitted - 109 Kelli DRTo: <tmiller@texasgrandrealty.com>"
    }
],
    
    // Syndication Stats for Funnel Performance Scoreboard
    // AUTOMATED FIELDS (sync_stats.py fills these from ListTrac API):
    //   listTracTotalViews, listTracViews30Days, listTracInquiries, 
    //   listTracTopWebsites, listTracTopCities, lastSync
    // MANUAL FIELDS (enter these directly):
    //   listHubReach, facebookReach, zillowSaves, facebookClicks,
    //   matterportWalkthroughs, brokerBayShowings, mlsReverseProspectMatches
    syndicationStats: {
        // Top Funnel: Awareness (AUTOMATED from ListTrac)
        listTracTotalViews: 3458,
        listTracViews30Days: 989,
        listTracTopWebsites: [{"name": "Zillow.com", "views": 349}, {"name": "Realtor.com", "views": 298}, {"name": "portal.onehome.com", "views": 80}, {"name": "Trulia", "views": 20}, {"name": "HAR.com", "views": 11}],
        listTracTopCities: [{"name": "Rowlett, TX", "views": 27}, {"name": "Mesquite, TX", "views": 26}, {"name": "Sulphur Springs, TX", "views": 17}, {"name": "Kilgore, TX", "views": 12}, {"name": "Longview, TX", "views": 10}],
        
        // Top Funnel: Awareness (MANUAL entry)
        listHubReach: 0,
        facebookReach: 0,
        facebookSpend: '--',
        
        // Mid Funnel: Engagement (AUTOMATED from ListTrac)
        listTracInquiries: 8,
        
        // Mid Funnel: Engagement (MANUAL entry)
        zillowSaves: 0,
        facebookClicks: 0,
        matterportWalkthroughs: 0,
        
        // Bottom Funnel: Conversion (MANUAL entry)
        brokerBayShowings: 1,
        mlsReverseProspectMatches: 0,

        // Metadata for the Command Center
        mlsNumber: '21178024',
        lastSync: 'February 25, 2026'
    },
    cdom: 0,
    downPaymentPct: 0.20,
    marketRate: 0.0616,
    priceFloor: 404900,
    ownerFinanceRate: 0.0655,
    ownerFinanceDownPct: 0.10,
    structural1: "To be determined upon preview.",
    structural2: "Details pending site walkthrough.",
    aesthetic1: "Pristine in-ground pool with poolside views.",
    aesthetic2: "Breathtaking Springtime patio views",
    aesthetic3: "Immaculate condition throughout.",
    
    // Reporting Links for Transparency Command Center
    reportingLinks: {
        'infographic': 'https://www.texasgrandrealty.com',
        'summary': 'https://drive.google.com/file/d/1UCden8LOdeNvIAG0qyUxaMNEruRyBG_S/view?usp=drive_link',
        'monthly-analysis': 'https://www.texasgrandrealty.com',
        'social-media': 'https://drive.google.com/file/d/1vyjNPbw4_Nq9bpNm2HLrD9EvUQO89wTG/view?usp=drive_link',
        'website-traffic': 'https://drive.google.com/file/d/1OhR6NcsaRv8i97aqI_JjGVCK92TyMgad/view?usp=drive_link',
        'homes-com': 'https://www.homes.com',
        'realtor-com': 'https://drive.google.com/file/d/18pcSMos0ZgbJ3Skztsb82aeTquM64Gb7/view?usp=drive_link',
        'zillow-com': 'https://drive.google.com/file/d/14fAhNT0vbhphNaCmw0mtBLBKMnnJ8uMw/view?usp=drive_link',
        'showing-activity': 'https://www.brokerbay.com',
        'mls-activity': 'https://drive.google.com/file/d/1YNAuUJIrEQPE8x7CGVYwujLCEIks4d-n/view?usp=drive_link',
        'onehome': 'https://portal.onehome.com',
        'tgr-valuation': 'https://www.texasgrandrealty.com/cma/property-valuation/',
        'rpr-market-report': 'https://www.narrpr.com/reports-v2/678e064b-e41e-4272-a9f2-ade2f00fc371/pdf'
    }
};

// Derived constants from propertyData
const SUBJECT_PRICE = propertyData.price;
const SUBJECT_SQFT = propertyData.sqft;
const SUBJECT_DP_PCT = propertyData.downPaymentPct;
const MARKET_RATE = propertyData.marketRate;
const PRICE_FLOOR_OPTION_1 = propertyData.priceFloor;
const BUYDOWN_PRICE_OPTION_2 = propertyData.price;
const OWNER_FINANCE_RATE = propertyData.ownerFinanceRate;
const OWNER_FINANCE_DP_PCT = propertyData.ownerFinanceDownPct;
const TOTAL_CDOM = propertyData.cdom;

// Pricing strategy constants
const BUYDOWNS = {
    RATES: [0.0305, 0.0405, 0.0505, 0.0605],
    SELLER_COST: 14819,
    PRICE_ANCHOR: BUYDOWN_PRICE_OPTION_2,
};

// Pricing schedule for chart data
const pricingStrategy = [
    { label: 'Phase 1', price: 449900, day: 0 },
    { label: 'Phase 2', price: 434900, day: 30 },
    { label: 'Phase 3', price: 419900, day: 60 },
    { label: 'Phase 4', price: 404900, day: 90 }
];

const compData = {
    ds1: {
        active: [
            { mls: '21028128', address: '1410 Surrey CT', city: 'Forney', sqft: 2013, yb: 1971, acres: 0.340, ppsf: 163.88, listPrice: 329900, cdom: 103, isSubject: false },
            { mls: '20984480', address: '1310 Briar Hollow LN', city: 'Forney', sqft: 2155, yb: 1971, acres: 0.260, ppsf: 157.77, listPrice: 340000, cdom: 142 },
            { mls: '21054767', address: '1214 Merrimac TRL', city: 'Forney', sqft: 2000, yb: 1971, acres: 0.234, ppsf: 179.50, listPrice: 359000, cdom: 71 },
            { mls: 'SUBJECT', address: propertyData.address.split(',')[0], city: propertyData.city, sqft: propertyData.sqft, yb: parseInt(propertyData.yearBuilt), acres: parseFloat(propertyData.lotSize), ppsf: Math.round((propertyData.price / propertyData.sqft) * 100) / 100, listPrice: propertyData.price, cdom: propertyData.cdom, isSubject: true },
        ],
        pending: [
            { mls: '20934922', address: '1305 Willow WAY', city: 'Forney', sqft: 2102, yb: 1975, acres: 0.234, ppsf: 161.27, listPrice: 339000, cdom: 150, status: 'PENDING' },
        ],
        closed: [
            { mls: '20946015', address: '4909 Berkeley CT', city: 'Forney', sqft: 2360, yb: 1989, soldPrice: 344900, soldDate: '08/29/2025', slRatio: 100.0, cdom: 74, ppsf: 146.14 },
            { mls: '21033627', address: '1401 Surrey CT', city: 'Forney', sqft: 2491, yb: 1972, soldPrice: 350000, soldDate: '11/07/2025', slRatio: 100.0, cdom: 46, ppsf: 140.51 },
            { mls: '20953092', address: '1902 Wiggs WAY', city: 'Forney', sqft: 2566, yb: 1972, soldPrice: 365000, soldDate: '11/07/2025', slRatio: 100.0, cdom: 158, ppsf: 142.24 },
        ],
    },
    ds2: {
        active: [
            { mls: 'SUBJECT', address: propertyData.address.split(',')[0], city: propertyData.city, sqft: propertyData.sqft, yb: parseInt(propertyData.yearBuilt), acres: parseFloat(propertyData.lotSize), ppsf: Math.round((propertyData.price / propertyData.sqft) * 100) / 100, listPrice: propertyData.price, cdom: propertyData.cdom, isSubject: true }, 
            { mls: 'AVM_A', address: '1410 Surrey Ct', city: 'Forney', sqft: 2013, yb: 1971, acres: 0.340, ppsf: 166.37, listPrice: 334900, cdom: 103, isSubject: false },
        ],
        pendingClosed: [ 
            { status: 'CLOSED', mls: 'AVM_1', address: '3438 Sunrise Ln', city: 'Forney', sqft: 2159, yb: 1977, soldPrice: 320000, soldDate: '06/12/2025', slRatio: 90.0, cdom: 27, ppsf: 148 },
            { status: 'CLOSED', mls: 'AVM_2', address: '3318 Sunrise Dr', city: 'Forney', sqft: 2031, yb: 1984, soldPrice: 389500, soldDate: '08/27/2025', slRatio: 100.0, cdom: 33, ppsf: 192 },
            { status: 'CLOSED', mls: 'AVM_3', address: '3321 Bluffview Dr', city: 'Forney', sqft: 2500, yb: 1978, soldPrice: 370000, soldDate: '11/11/2025', slRatio: 95.0, cdom: 79, ppsf: 148 },
            { status: 'CLOSED', mls: 'AVM_4', address: '3418 Hightrail Ln', city: 'Forney', sqft: 2213, yb: 1981, soldPrice: 385000, soldDate: '03/24/25', slRatio: 95.0, cdom: 33, ppsf: 174 },
            { status: 'CLOSED', mls: 'AVM_5', address: '3325 Bluffview Dr', city: 'Forney', sqft: 2500, yb: 1978, soldPrice: 425000, soldDate: '04/08/25', slRatio: 95.0, cdom: 54, ppsf: 170 },
        ],
    },
    ds3: {
        active: [
            { mls: '21095955', address: '4030 Random CIR', city: 'Forney', sqft: 1857, yb: 1972, acres: 0.213, ppsf: 166.94, listPrice: 310000, cdom: 23 },
            { mls: '21117110', address: '725 Middle Glen DR', city: 'Forney', sqft: 1738, yb: 1977, acres: 0.195, ppsf: 183.54, listPrice: 319000, cdom: 1 },
            { mls: '21015393', address: '1610 Iroquois DR', city: 'Forney', sqft: 2426, yb: 1966, acres: 0.293, ppsf: 131.90, listPrice: 320000, cdom: 116 },
            { mls: '21077244', address: '4006 Cedar Creek', city: 'Forney', sqft: 1694, yb: 1976, acres: 0.179, ppsf: 193.57, listPrice: 327900, cdom: 49 },
            { mls: '21028128', address: '1410 Surrey CT', city: 'Forney', sqft: 2013, yb: 1971, acres: 0.340, ppsf: 163.88, listPrice: 329900, cdom: 103, isSubject: false },
            { mls: '20993209', address: '4102 Cedar Creek DR', city: 'Forney', sqft: 2271, yb: 1978, acres: 0.180, ppsf: 145.31, listPrice: 330000, cdom: 136 },
            { mls: '20983199', address: '1706 Iroquois DR', city: 'Forney', sqft: 2538, yb: 1968, acres: 0.307, ppsf: 135.93, listPrice: 345000, cdom: 147 },
            { mls: '21117223', address: '1510 Palm Valley DR', city: 'Forney', sqft: 2319, yb: 1983, acres: 0.274, ppsf: 150.93, listPrice: 350000, cdom: 1 },
            { mls: 'SUBJECT', address: propertyData.address.split(',')[0], city: propertyData.city, sqft: propertyData.sqft, yb: parseInt(propertyData.yearBuilt), acres: parseFloat(propertyData.lotSize), ppsf: Math.round((propertyData.price / propertyData.sqft) * 100) / 100, listPrice: propertyData.price, cdom: propertyData.cdom, isSubject: true },
        ],
        pendingClosed: [
            { status: 'PENDING', mls: '20934922', address: '1305 Willow WAY', city: 'Forney', sqft: 2102, yb: 1975, soldPrice: 339000, soldDate: 'N/A', slRatio: 'N/A', cdom: 150, ppsf: 161.27 },
            { status: 'CLOSED', mls: '20829125', address: '3909 Larkin LN', city: 'Forney', sqft: 3555, yb: 1999, soldPrice: 300000, soldDate: '06/11/2025', slRatio: 88.7, cdom: 99, ppsf: 84.39 },
            { status: 'CLOSED', mls: '20910414', address: '237 Trailridge DR', city: 'Forney', sqft: 1537, yb: 1971, soldPrice: 300000, soldDate: '07/03/2025', slRatio: 96.8, cdom: 49, ppsf: 195.19 },
            { status: 'CLOSED', mls: '20965574', address: '5221 Sarasota DR', city: 'Forney', sqft: 2001, yb: 1974, soldPrice: 300000, soldDate: '08/18/2025', slRatio: 87.0, cdom: 49, ppsf: 149.93 },
            { status: 'CLOSED', mls: '20995742', address: '3510 Syracuse DR', city: 'Forney', sqft: 2307, yb: 1975, soldPrice: 300000, soldDate: '11/13/2025', slRatio: 100.0, cdom: 111, ppsf: 130.04 },
            { status: 'CLOSED', mls: '21039409', address: '4210 Mayflower DR', city: 'Forney', sqft: 1997, yb: 1973, soldPrice: 300000, soldDate: '10/14/2025', slRatio: 95.2, cdom: 25, ppsf: 150.23 },
            { status: 'CLOSED', mls: '21034251', address: '1625 Blackhawk LN', city: 'Forney', sqft: 1754, yb: 1956, soldPrice: 305000, soldDate: '09/16/2025', slRatio: 101.8, cdom: 1, ppsf: 173.89 },
            { status: 'CLOSED', mls: '20984464', address: '1310 David DR', city: 'Forney', sqft: 1807, yb: 1986, soldPrice: 314500, soldDate: '08/05/2025', slRatio: 101.5, cdom: 3, ppsf: 174.05 },
            { status: 'CLOSED', mls: '20884818', address: '710 Colonial DR', city: 'Forney', sqft: 1935, yb: 1968, soldPrice: 314900, soldDate: '07/22/2025', slRatio: 100.0, cdom: 91, ppsf: 162.74 },
            { status: 'CLOSED', mls: '20895891', address: '4906 Portola DR', city: 'Forney', sqft: 2052, yb: 1986, soldPrice: 315000, soldDate: '05/29/2025', slRatio: 100.0, cdom: 8, ppsf: 153.51 },
            { status: 'CLOSED', mls: '20880233', address: '1206 Mayapple DR', city: 'Forney', sqft: 1831, yb: 1978, soldPrice: 319000, soldDate: '08/15/2025', slRatio: 100.0, cdom: 100, ppsf: 174.22 },
            { status: 'CLOSED', mls: '21099405', address: '4301 Rosehill RD', city: 'Forney', sqft: 1512, yb: 1960, soldPrice: 320000, soldDate: '11/04/2025', slRatio: 97.0, cdom: 4, ppsf: 211.64 },
            { status: 'CLOSED', mls: '20784668', address: '4933 Avalon DR', city: 'Forney', sqft: 1635, yb: 1976, soldPrice: 324000, soldDate: '06/09/2025', slRatio: 103.2, cdom: 50, ppsf: 198.17 },
            { status: 'CLOSED', mls: '20697256', address: '4821 Worthing DR', city: 'Forney', sqft: 1982, yb: 1993, soldPrice: 325000, soldDate: '06/25/2025', slRatio: 100.0, cdom: 296, ppsf: 163.98 },
            { status: 'CLOSED', mls: '20914227', address: '718 Angle Ridge CIR', city: 'Forney', sqft: 1890, yb: 1975, soldPrice: 325000, soldDate: '08/21/2025', slRatio: 98.8, cdom: 88, ppsf: 171.96 },
            { status: 'CLOSED', mls: '20934688', address: '1111 Lupine DR', city: 'Forney', sqft: 2027, yb: 1978, soldPrice: 325000, soldDate: '07/09/2025', slRatio: 100.0, cdom: 11, ppsf: 160.34 },
            { status: 'CLOSED', mls: '20973032', address: '4005 Azalea LN', city: 'Forney', sqft: 1858, yb: 1977, soldPrice: 325000, soldDate: '08/29/2025', slRatio: 100.0, cdom: 24, ppsf: 174.92 },
            { status: 'CLOSED', mls: '20988836', address: '3816 Roan CIR', city: 'Forney', sqft: 1877, yb: 1976, soldPrice: 326000, soldDate: '08/21/2025', slRatio: 100.0, cdom: 2, ppsf: 173.68 },
            { status: 'CLOSED', mls: '21042599', address: '4022 Azalea LN', city: 'Forney', sqft: 1668, yb: 1981, soldPrice: 330000, soldDate: '10/31/2025', slRatio: 97.1, cdom: 34, ppsf: 197.84 },
            { status: 'CLOSED', mls: '21029010', address: '3001 Jeremes LNDG', city: 'Forney', sqft: 2142, yb: 1985, soldPrice: 339900, soldDate: '09/16/2025', slRatio: 100.0, cdom: 9, ppsf: 158.68 },
            { status: 'CLOSED', mls: '20946015', address: '4909 Berkeley CT', city: 'Forney', sqft: 2360, yb: 1989, soldPrice: 344900, soldDate: '08/29/2025', slRatio: 100.0, cdom: 74, ppsf: 146.14 },
            { status: 'CLOSED', mls: '20946685', address: '1429 Knob Hill DR', city: 'Forney', sqft: 1667, yb: 1985, soldPrice: 345000, soldDate: '07/23/2025', slRatio: 95.8, cdom: 11, ppsf: 206.96 },
            { status: 'CLOSED', mls: '21023759', address: '1902 Merrimac TRL', city: 'Forney', sqft: 2253, yb: 1984, soldPrice: 350010, soldDate: '10/10/2025', slRatio: 100.0, cdom: 15, ppsf: 155.35 },
            { status: 'CLOSED', mls: '20967291', address: '5214 Graham DR', city: 'Forney', sqft: 1886, yb: 2001, soldPrice: 355000, soldDate: '07/11/2025', slRatio: 98.6, cdom: 6, ppsf: 188.23 },
            { status: 'CLOSED', mls: '20970990', address: '209 Havenwood LN', city: 'Forney', sqft: 1875, yb: 2002, soldPrice: 360000, soldDate: '08/04/2025', slRatio: 94.7, cdom: 90, ppsf: 192.00 },
            { status: 'CLOSED', mls: '20880605', address: '1221 Pecan Valley DR', city: 'Forney', sqft: 2350, yb: 1972, soldPrice: 367500, soldDate: '07/15/2025', slRatio: 91.9, cdom: 84, ppsf: 156.38 },
            { status: 'CLOSED', mls: '21041035', address: '3321 Bluffview DR', city: 'Forney', sqft: 2500, yb: 1978, soldPrice: 370000, soldDate: '11/11/2025', slRatio: 94.9, cdom: 40, ppsf: 148.00 },
            { status: 'CLOSED', mls: '20879659', address: '1717 Lake Bluff DR', city: 'Forney', sqft: 2649, yb: 1999, soldPrice: 372500, soldDate: '06/23/2025', slRatio: 96.0, cdom: 48, ppsf: 140.62 },
            { status: 'CLOSED', mls: '21011459', address: '1605 James Good LN', city: 'Forney', sqft: 2483, yb: 1978, soldPrice: 375000, soldDate: '08/29/2025', slRatio: 100.0, cdom: 10, ppsf: 151.03 },
            { status: 'CLOSED', mls: '20773714', address: '1410 Pine Hill DR', city: 'Forney', sqft: 2751, yb: 1975, soldPrice: 376500, soldDate: '06/18/2025', slRatio: 97.8, cdom: 150, ppsf: 136.86 },
            { status: 'CLOSED', mls: '21041956', address: '1514 Dakota DR', city: 'Forney', sqft: 2410, yb: 1969, soldPrice: 380000, soldDate: '10/03/2025', slRatio: 100.0, cdom: 15, ppsf: 157.68 },
            { status: 'CLOSED', mls: '21051343', address: '918 Myers Meadow DR', city: 'Forney', sqft: 2299, yb: 2012, soldPrice: 380000, soldDate: '10/31/2025', slRatio: 97.7, cdom: 205, ppsf: 165.29 },
            { status: 'CLOSED', mls: '20857278', address: '8414 Slowburn DR', city: 'Forney', sqft: 1935, yb: 2025, soldPrice: 383585, soldDate: '05/28/2025', slRatio: 95.0, cdom: 17, ppsf: 198.24 },
            { status: 'CLOSED', mls: '20954539', address: '4521 Park Meadow CT', city: 'Forney', sqft: 2155, yb: 1997, soldPrice: 385000, soldDate: '06/27/2025', slRatio: 100.0, cdom: 7, ppsf: 178.65 },
            { status: 'CLOSED', mls: '21030173', address: '2809 Apple Valley DR', city: 'Forney', sqft: 2589, yb: 1982, soldPrice: 385710, soldDate: '11/12/2025', slRatio: 102.9, cdom: 53, ppsf: 148.98 },
            { status: 'CLOSED', mls: '21009914', address: '7293 Farmhouse DR', city: 'Forney', sqft: 1712, yb: 2025, soldPrice: 386085, soldDate: '09/26/2025', slRatio: 97.1, cdom: 33, ppsf: 225.52 },
            { status: 'CLOSED', mls: '21018005', address: '7322 Farmhouse DR', city: 'Forney', sqft: 1712, yb: 2025, soldPrice: 386085, soldDate: '08/28/2025', slRatio: 98.5, cdom: 4, ppsf: 225.52 },
            { status: 'CLOSED', mls: '21046799', address: '1302 Lakebreeze DR', city: 'Forney', sqft: 3065, yb: 2001, soldPrice: 387000, soldDate: '10/30/2025', slRatio: 96.8, cdom: 21, ppsf: 126.26 },
            { status: 'CLOSED', mls: '20884905', address: '7326 Farmhouse DR', city: 'Forney', sqft: 1935, yb: 2025, soldPrice: 388585, soldDate: '06/25/2025', slRatio: 97.5, cdom: 15, ppsf: 200.82 },
            { status: 'CLOSED', mls: '21016103', address: '4405 Fairlake DR', city: 'Forney', sqft: 2199, yb: 1998, soldPrice: 389000, soldDate: '09/09/2025', slRatio: 100.0, cdom: 2, ppsf: 176.90 },
            { status: 'CLOSED', mls: '20707645', address: '213 Hockaday AVE', city: 'Forney', sqft: 2500, yb: 1974, soldPrice: 390000, soldDate: '06/10/2025', slRatio: 101.3, cdom: 271, ppsf: 156.00 },
        ],
    },
};

// Chart data preparation
const allClosedPpsf = compData.ds3.pendingClosed.filter(c => c.status === 'CLOSED').map(c => c.ppsf);
const avgClosedPpsf = allClosedPpsf.reduce((sum, p) => sum + p, 0) / allClosedPpsf.length;
const subjectPpsf = Math.round((propertyData.price / propertyData.sqft) * 100) / 100;

// Image Gallery Arrays - 109 Kelli Dr Property (Google Drive CDN Format)
// Updated image IDs for Marketing Strategy tab carousels
const dollhouseIds = ['1IxWnN9ygY-qTNAfHU0ytwI4lXMMdpbCb', '1uHrVVgtapRcFvnIu81nVT6UTeoBp9TjH', '1L1TsaFekr6ITPzJXKifct36tYYwr-q1n', '1L6jkRleArz8samLVe-YeRxFyD1ygkbsC', '1myWkBu6_5R5Nb_gnOmmh4Y5XeMCx4ssV', '1QckLczCXH4PbAZammDug-w85ztmrCBK8', '1bgk33EXHiz655g07ZIKH1qXV6cm9_WAc', '1r7w4tC5LI8QlsvevrnaJu1_tkJfM5lKl'];

const hdrIds = ['111CrFRaYPFQ6sgbsfVezt7IYiKua--in', '1_gpSI8O7C8vrqLZSRkDHyUXfh5CwDzKc', '16izSvZYtMRdV8YK-goslUHXrezHOGqYn', '1NXhhpCZz5JH1ohPUeSp74nGx4ZAXcw5i', '1JJ-otWlDZmqQhBcjfEwHU1oFZVVA45o-', '1mrtDyYZ9jO4ztJRqqvEL9k9Q8-BbKUZB', '1lFArAm14XvxoyyeE5RHjpFT0yHHBTVaI', '1VZ8XXPNmOYYP2Sz8jskftGmriwcShZbF', '1m0LL1y8DL6mUqFjwsyDlyEuiHiYIhAHk', '1aMJSD-jWRyvMPuQz_vRa-xjR-Rv55r1G', '1Xwqdl8Mhla6zjswAKK8IpT14tPhyoXyx', '1B1tCqZQrult1-5EXFYs6n36qnVcA_A8i', '165AhMJAbOr-65pJ3zOay413lrYQPqgos', '1OriqtEG-yBMGA-RNyFxk2cdByyuCNetz', '1dTPRM6S-y6TT5lhP05Smmh4sLwDhKE3D', '1RJlJuC7IpAJdSrnflzXuGn9sKRhos7kP', '1aAxUPS3kzXSBLhUH7kpHjlr8NWHi0Uyy', '1OIz2yQ3F_u0Wq_rOgp7uYNiBnte2VAGg', '1OA0xSZNCpFVijU14lEWRR5iczhSpgcwQ', '1msiCeiqMzF1dRx9i4D1OSHM-2PLPZ_Sl', '1zu19BAkuiz0QkkjLEBhceKGgtBTxu88I', '11JLLscJ9Do1n4l545s3DhkWRVfDOEs-B', '1ADFnfhmvTy_O61I-9WX27yPmjU5UCUMD', '1GKkwf_M11cTCa7Qyz_ETtZuMKG2YKD3l', '1wrrkqlU9GP7uxhLEZtc98S5wOIzaYcOb', '1jpG4vwRDN10QlQ6VWV2nOGfQGLu3YNVU'];

const virtualIds = ['1iSiTmbiYrv0-ZykZM3q8341I3ROV_OdI', '1OkRW3JcjLiDelWD7b731uN5PBqpyOFYT', '19lZdJCf1U_uXUBB7c1sFm0-9_ulKBmFC', '1YXFFVpjUSmNYhh34xIfKomBpHFlubu7t', '1smj4srBN7Csb9L1raLbEo_LDOmZlYDWx', '1T8M8Bes2aitCWOa3e09-bk9QN9vo9NtC', '1NZ34Ouc-OT77Q02ODizDxhjM034DlR0U', '16-gwlV2Uvsml6q7d1lZD64q-La-HdDu5', '1h7CRKaz58uUlxrh-2QdT27-3Tl6R_iG6', '1bb9lGZysJsxwUD_PDYRxlteak1FA0cUi', '1UAPubN58Q-3q4RFcVDCx1E9xuSrR5Cox', '1sdYE0AG9f_IRMNj6fgkciUAf0ggm-ch9', '1TvOZsDMiPheCpBjBXj0dV6XD_e-Y3piJ', '1N3J0kz1rJfSVvhdUKBXGXqcbohXGszdo'];

const droneIds = ['1d73zdVIcgqVhtMDKHZzdaA-YbVSEaGSj', '19i0vdDYEeIrz-O8jHJqt7pkAuFbjiU--', '1Rfmas63N5WlsE2NNbALGLcutHAKzjO56', '1zlRqh1RW6C9tBhpEFLSUjUI2xjx8yFEs', '17njfYLIDzQ7Ej_C_4mFE89IYH2671v_y', '19ExwvWE2aymyEOZJ_j0JF144M6FHhzXY', '1zn110Bjsemwg-8K5-JGr_vxTRkAvS9Sr', '13tblUO2EuaX1kJxb64MzefPqF35lp1WT', '12DMvY7xUCKL-3fCuQPvOse8-Kckmwa4a', '1ZOot2JiOOZbVC6O3N2uYpJlQzH7SZJAw', '1KenXrxBk-gkOM2HNrzLCKrIeMZiABCIs', '1kPACw-aCsXjXI69NeIItTgfYUJEja_Hh', '1YvoS7DJ7ZraKAR04S2nXGto-KSJvqgzD', '18g4dZ90xzdn8tBfOyotpT4o7zjSXKmMy', '1F3gP4IudSCLR-Lb82uPztZ2CSrLnajKo', '1_3OHXiBTMB5VfdFESwFvQ2AapiMgnzeO', '1sMmjExZ1x0JduMflNlLv1IhfqrbX3THE', '1KLvqdGA_CkIguMHMt05NjGdNjC0VP_14', '1ktkE5HeaVna9Yr1ADoki-e8uMjjHbdTw', '1OD4yBxJCazWIhFPILK79Hg4ch7UB7L9E', '1Jslc1QhI9JKZasa0WQWkVMZC0Kj6pyhE', '1n1G43l4dyJ6q7R_rsTE6o8-dwUb3hsV2', '1Z08S4ujd-OVpN4ATdnhafKjiD8hh8UHE', '1VF7KGgYq12KkNWUgU5b1M-kHprd7jrAT', '1sjSFeLPKRZHxkfksvFpl0y-gv46Dk-8_'];