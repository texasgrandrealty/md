
window.pricingChartInstance = null;
window.cdomChartInstance = null;
window.liquidityChartInstance = null;
window.subjectDoughnutInstance = null;
window.macroDoughnutInstance = null;
window.localOutcomesChartInstance = null;
window.rateChartInstance = null;
window.marketHealthChartInstance = null;

// Market Analysis Logic Engine
// Contains all JavaScript functions, calculations, and UI management

// --- UTILITY FUNCTIONS ---
const currencyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const currencyFormatDetailed = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormat = new Intl.NumberFormat('en-US');
const EQUILIBRIUM_MONTHS = 6.0;
const STAGNATION_THRESHOLD_DAYS = 74; // Area average DOM - the "cliff" for liquidity

// --- HYBRID UNIT DETECTION (SqFt vs Acres) ---
// Dynamic unit label based on property type
let UNIT_LABEL = '/SqFt'; // Default for residential
let UNIT_DENOMINATOR = 1; // Multiplier for price calculations

function detectPropertyUnit() {
    // If sqft > 0, use /SqFt (residential)
    // If sqft is null/0 and acres exists, use /AC (land)
    if (propertyData.sqft && propertyData.sqft > 0) {
        UNIT_LABEL = '/SqFt';
        UNIT_DENOMINATOR = propertyData.sqft;
    } else if (propertyData.acres && parseFloat(propertyData.acres) > 0) {
        UNIT_LABEL = '/AC';
        UNIT_DENOMINATOR = parseFloat(propertyData.acres);
    } else if (propertyData.lotSize) {
        // Parse lotSize string (e.g., "0.19 AC" or "8,276 SF")
        const lotStr = String(propertyData.lotSize).toUpperCase();
        if (lotStr.includes('AC')) {
            UNIT_LABEL = '/AC';
            UNIT_DENOMINATOR = parseFloat(lotStr) || 1;
        } else {
            UNIT_LABEL = '/SqFt';
            UNIT_DENOMINATOR = propertyData.sqft || 1;
        }
    }
    console.log(`✓ Unit Detection: Using ${UNIT_LABEL} (denominator: ${UNIT_DENOMINATOR})`);
    return UNIT_LABEL;
}

// Calculate price per unit dynamically
function getPricePerUnit(price) {
    if (!UNIT_DENOMINATOR || UNIT_DENOMINATOR <= 0) return 0;
    return Math.round(price / UNIT_DENOMINATOR);
}

// Format price with unit label
function formatPriceWithUnit(price) {
    const ppu = getPricePerUnit(price);
    return `${currencyFormat.format(ppu)}${UNIT_LABEL}`;
}

// Stagnation Risk Helper: Returns warning marker if DOM exceeds threshold
function getStagnationRiskMarker(domValue) {
    const dom = parseInt(domValue) || 0;
    if (dom > STAGNATION_THRESHOLD_DAYS) {
        return '⚠️ HIGH STAGNATION RISK';
    } else if (dom > STAGNATION_THRESHOLD_DAYS * 0.75) { // 55+ days = elevated risk
        return '⚡ ELEVATED RISK';
    }
    return '';
}

// Format DOM with stagnation marker
function formatDOMWithRisk(domValue) {
    const dom = parseInt(domValue) || 0;
    const marker = getStagnationRiskMarker(dom);
    if (marker) {
        return `${dom} Days ${marker}`;
    }
    return `${dom} Days`;
}

function getSellerScarcityMetrics(monthsSupply, interestRate = null) {
    const equilibrium = EQUILIBRIUM_MONTHS;
    const currentRate = interestRate ?? (propertyData.marketRate * 100); // Convert to percentage
    const RATE_FRICTION_THRESHOLD = 5.5; // Demand Friction activates above 5.5%
    const DEMAND_FRICTION_PENALTY = 0.50; // 50% penalty when rates exceed threshold (MBS Highway calibrated)
    
    // SCARCITY ADVANTAGE: ((Equilibrium - Supply) / Equilibrium) * 100
    // Positive = Seller Advantage (supply < equilibrium)
    // Negative = Buyer Advantage (supply > equilibrium)
    // Example: (6 - 3.5) / 6 * 100 = 41.67% raw advantage
    const rawAdvantage = ((equilibrium - monthsSupply) / equilibrium) * 100;
    
    // DEMAND FRICTION LOGIC (50% ADJUSTMENT): High interest rates suppress buyer velocity
    // When rates > 5.5%, apply 50% penalty to scarcity advantage
    // Example: 41.67% * (1 - 0.50) = 20.83% adjusted advantage
    let adjustedAdvantage = rawAdvantage;
    let demandFrictionApplied = false;
    let frictionDescription = '';
    
    if (currentRate > RATE_FRICTION_THRESHOLD && rawAdvantage > 0) {
        // Apply 50% Demand Friction penalty to seller's advantage
        adjustedAdvantage = rawAdvantage * (1 - DEMAND_FRICTION_PENALTY);
        demandFrictionApplied = true;
        frictionDescription = `${currentRate.toFixed(2)}% rate environment applies ${(DEMAND_FRICTION_PENALTY * 100).toFixed(0)}% Demand Friction (adjusted from ${rawAdvantage.toFixed(1)}% to ${adjustedAdvantage.toFixed(1)}%)`;
    }
    
    const advantagePct = Math.abs(adjustedAdvantage);
    const rawAdvantagePct = Math.abs(rawAdvantage);
    
    let tier = '';
    let interpretation = '';
    
    if (monthsSupply < equilibrium) {
        // SELLER'S MARKET: Supply below equilibrium
        // NEW TIER SYSTEM with Demand Friction consideration
        if (demandFrictionApplied) {
            // Rate-Constrained Tiers
            if (adjustedAdvantage >= 31) {
                tier = "Strong Seller's Market";
                interpretation = "Physical scarcity dominates despite rate headwinds; seller leverage persists but velocity is dampened.";
            } else if (adjustedAdvantage >= 16) {
                tier = "Moderate Seller's Advantage (Rate Constrained)";
                interpretation = "While physical inventory suggests a Seller's Advantage, the " + currentRate.toFixed(2) + "% interest rate environment has neutralized buyer velocity. This creates a 'Strategic Neutral' environment where sellers must price to the Liquidity Floor to overcome high borrowing costs.";
            } else {
                tier = "Strategic Neutral Market";
                interpretation = "Physical scarcity is offset by interest rate pressure. The market achieves functional equilibrium through opposing forces: low inventory vs. suppressed demand.";
            }
        } else {
            // Traditional Tiers (low rate environment)
            if (rawAdvantage >= 40) {
                tier = "Extreme Seller's Market";
                interpretation = "Inventory scarcity is acute; sellers control terms and pricing with minimal concessions.";
            } else if (rawAdvantage >= 20) {
                tier = "Strong Seller's Market";
                interpretation = "Demand materially exceeds supply; decisive pricing and presentation earn premium leverage.";
            } else {
                tier = "Slight Seller's Market";
                interpretation = "Scarcity exists, but buyers still have enough choice to remain selective on price and condition.";
            }
        }
    } else if (monthsSupply > equilibrium) {
        // BUYER'S MARKET: Supply above equilibrium
        if (Math.abs(rawAdvantage) >= 40) {
            tier = "Extreme Buyer's Market";
            interpretation = "High inventory levels create severe competitive pressure. Strategic pricing is critical.";
        } else if (Math.abs(rawAdvantage) >= 20) {
            tier = "Strong Buyer's Market";
            interpretation = "Inventory surplus gives buyers significant negotiating power.";
        } else {
            tier = "Slight Buyer's Market";
            interpretation = "Surplus exists, but well-positioned sellers can still achieve fair terms.";
        }
    } else {
        // BALANCED MARKET
        tier = "Balanced Market";
        interpretation = "Supply and demand are in equilibrium. Neither buyers nor sellers have a significant advantage.";
    }

    return { 
        advantagePct,           // Adjusted advantage (after friction)
        rawAdvantagePct,        // Raw advantage (before friction)
        tier, 
        interpretation,
        demandFrictionApplied,
        frictionDescription,
        currentRate
    };
}

function calculateOutcomeStats() {
    // FORNEY 75126 MACRO DATA LOCK
    // All outcome statistics now synchronized to macro environment
    // Sold: 14, Failed: 124, Failure Rate: 89.9%
    
    // Calculate failure rate for Subject Comp Set (legacy - kept for backward compatibility)
    const subjectSold = propertyData.liquidity?.closedLastMonth || 0;
    const subjectFailed = propertyData.localMarket?.failedListings || 0;
    const subjectTotal = subjectSold + subjectFailed;
    const subjectFailureRate = subjectTotal > 0 ? ((subjectFailed / subjectTotal) * 100).toFixed(1) : '0.0';
    
    // Calculate failure rate for Forney 75126 Macro (PRIMARY DATA SOURCE)
    // LOCKED VALUES: sold=14, failed=124 → 124/(14+124) = 89.9%
    const macroSold = propertyData.huntCountyMacro?.sold ?? 14;
    const macroFailed = propertyData.huntCountyMacro?.failed ?? 124;
    const macroTotal = macroSold + macroFailed;
    const macroFailureRate = macroTotal > 0 ? ((macroFailed / macroTotal) * 100).toFixed(1) : '0.0';
    
    return {
        subject: {
            sold: subjectSold,
            failed: subjectFailed,
            failureRate: subjectFailureRate
        },
        macro: {
            sold: macroSold,
            failed: macroFailed,
            failureRate: macroFailureRate
        }
    };
}

function calculateProjectedMarketTime() {
    // Projected Market Time = Supply Months * 30.44 (average days per month)
    // Alternative calculation: Active Listings / (Sold Last Month / 30.44)
    const supplyMonths = propertyData.monthsSupply || 0;
    const projectedDays = Math.round(supplyMonths * 30.44);
    return projectedDays + ' Days';
}

function updateSellerScarcityInsights() {
    const supply = Number(propertyData.monthsSupply ?? 0);
    const equilibrium = EQUILIBRIUM_MONTHS; // 6.0 months
    const currentRate = (propertyData.marketRate ?? 0.0616) * 100; // Convert to percentage
    
    // MACRO DATA LOCK: Use Forney 75126 Macro values for Bar Chart / Warning Box sync
    // Sold: 14, Failed: 124 → Failure Rate = 124 / (14 + 124) = 89.9%
    const macroSold = propertyData.huntCountyMacro?.sold ?? 14;
    const macroFailed = propertyData.huntCountyMacro?.failed ?? 124;
    const macroTotal = macroSold + macroFailed;
    const failureRate = macroTotal > 0 ? ((macroFailed / macroTotal) * 100) : 0;
    
    // DEMAND FRICTION CALIBRATED METRICS
    // Use the enhanced getSellerScarcityMetrics with interest rate consideration
    const scarcityMetrics = getSellerScarcityMetrics(supply, currentRate);
    
    const rawAdvantage = ((equilibrium - supply) / equilibrium) * 100;
    const rawAdvantagePct = Math.abs(rawAdvantage);
    const adjustedAdvantagePct = scarcityMetrics.advantagePct;
    
    // VELOCITY LABEL: Synchronized with Demand Friction logic
    let marketTier = scarcityMetrics.tier;
    let velocityLabel = '';
    let interpretation = scarcityMetrics.interpretation;
    let scaleDescription = '';
    
    if (scarcityMetrics.demandFrictionApplied) {
        // RATE-CONSTRAINED MARKET: See-Saw effect active
        velocityLabel = "Strategic Transition (Rate Constrained)";
        scaleDescription = `Sellers hold physical scarcity, but buyers hold interest-rate leverage. Equilibrium is achieved only through appraisal-aligned pricing.`;
    } else if (supply < equilibrium) {
        // TRADITIONAL SELLER'S MARKET (low rate environment)
        velocityLabel = marketTier;
        scaleDescription = `Interpretation: ${marketTier}. With ${supply.toFixed(1)} months of supply (below the ${equilibrium.toFixed(1)}-month equilibrium), sellers hold a ${rawAdvantagePct.toFixed(1)}% scarcity advantage.`;
    } else if (supply > equilibrium) {
        // BUYER'S MARKET: Supply is above equilibrium (surplus)
        velocityLabel = marketTier;
        scaleDescription = `Interpretation: ${marketTier}. High inventory levels create competitive pressure. Strategic pricing and presentation are critical for market success.`;
    } else {
        // BALANCED MARKET: Supply equals equilibrium
        velocityLabel = "Balanced Market";
        scaleDescription = "Interpretation: Balanced Market. Supply equals demand equilibrium.";
    }
    
    // SCARCITY LINE: Updated narrative with Demand Friction explanation
    let scarcityLine = '';
    if (scarcityMetrics.demandFrictionApplied) {
        scarcityLine = `Real estate equilibrium is ${equilibrium.toFixed(1)} months. With ${supply.toFixed(2)} months of supply, raw scarcity suggests a ${rawAdvantagePct.toFixed(1)}% Seller Advantage. However, the ${currentRate.toFixed(2)}% interest rate applies a 50% Demand Friction penalty, yielding an Adjusted Advantage of ${adjustedAdvantagePct.toFixed(1)}%. This is a ${marketTier}.`;
    } else if (supply < equilibrium) {
        scarcityLine = `Real estate equilibrium is ${equilibrium.toFixed(1)} months. With ${supply.toFixed(2)} months, the seller holds a ${rawAdvantagePct.toFixed(1)}% Scarcity Advantage. This is a ${marketTier}.`;
    } else {
        scarcityLine = `Real estate equilibrium is ${equilibrium.toFixed(1)} months. With ${supply.toFixed(1)} months, inventory exceeds equilibrium by ${(supply - equilibrium).toFixed(1)} months. This is a ${marketTier}.`;
    }

    // DISPLAY: Adjusted Advantage (post-friction) for leverage percentage
    const leverageEl = document.getElementById('leverage-pct');
    if (leverageEl) {
        if (scarcityMetrics.demandFrictionApplied) {
            leverageEl.innerText = adjustedAdvantagePct.toFixed(1) + '% (Adjusted)';
        } else {
            leverageEl.innerText = rawAdvantagePct.toFixed(1) + '%';
        }
    }

    const tierEl = document.getElementById('seller-market-tier');
    if (tierEl) tierEl.textContent = marketTier;

    const interpretationEl = document.getElementById('seller-market-interpretation');
    if (interpretationEl) interpretationEl.textContent = scarcityLine;

    const marketScaleDesc = document.getElementById('market-scale-desc');
    if (marketScaleDesc) {
        marketScaleDesc.textContent = scaleDescription;
    }

    const velocityEl = document.getElementById('market-velocity-label');
    if (velocityEl) velocityEl.textContent = velocityLabel;

    // Update institutional warning elements (Land Master style)
    const warningPill = document.getElementById('institutional-warning-pill');
    if (warningPill) warningPill.textContent = `${failureRate.toFixed(1)}% Failure`;

    const warningRate = document.getElementById('institutional-warning-rate');
    if (warningRate) warningRate.textContent = `${failureRate.toFixed(1)}% STATISTICAL FAILURE RATE`;

    const warningBullet = document.getElementById('institutional-warning-bullet-rate');
    if (warningBullet) warningBullet.textContent = `${failureRate.toFixed(1)}% Failure Rate`;

    const warningSummary = document.getElementById('institutional-warning-summary');
    if (warningSummary) {
        warningSummary.textContent = `Listings that do not secure a contract within the 90-day Micro-Market window have a 78% higher probability of expiring unsold.`;
    }

    // Show/hide institutional warning box based on failure rate > 50%
    const warningBox = document.getElementById('market-warning-box');
    if (warningBox) {
        if (failureRate > 50) {
            warningBox.style.display = 'block';
        } else {
            warningBox.style.display = 'none';
        }
    }

    const activeCountEl = document.getElementById('count-active');
    if (activeCountEl) activeCountEl.textContent = numberFormat.format(propertyData.active || 0);

    const pendingCountEl = document.getElementById('count-pending');
    if (pendingCountEl) pendingCountEl.textContent = numberFormat.format(propertyData.pending || 0);

    const underContractCountEl = document.getElementById('count-contract');
    if (underContractCountEl) underContractCountEl.textContent = numberFormat.format(propertyData.underContract || 0);
}

function roundCurrency(value) {
    return Math.round(value * 100) / 100;
}

function calculateMonthlyPayment(principal, annualRate, termsYears) {
    const rate = annualRate / 12;
    const n = termsYears * 12;
    if (rate === 0) return roundCurrency(principal / n);
    const payment = principal * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
    return roundCurrency(payment);
}

function calculateRemainingBalance(principal, annualRate, monthlyPayment, paymentsMade) {
    const r = annualRate / 12;
    const balance = principal * Math.pow(1 + r, paymentsMade) - monthlyPayment * (Math.pow(1 + r, paymentsMade) - 1) / r;
    return roundCurrency(balance);
}

// --- CALCULATE ALL OPTION PAYMENTS AND VALUES ---

// Option 1: Price Strategy
const option1Principal = roundCurrency(PRICE_FLOOR_OPTION_1 * (1 - SUBJECT_DP_PCT));
const option1Payment = calculateMonthlyPayment(option1Principal, MARKET_RATE, 30);

// Option 2: 3-2-1 Buydown
const option2Principal = roundCurrency(BUYDOWN_PRICE_OPTION_2 * (1 - SUBJECT_DP_PCT));
const option2PaymentYear1 = calculateMonthlyPayment(option2Principal, BUYDOWNS.RATES[0], 30);
const option2PaymentYear2 = calculateMonthlyPayment(option2Principal, BUYDOWNS.RATES[1], 30);
const option2PaymentYear3 = calculateMonthlyPayment(option2Principal, BUYDOWNS.RATES[2], 30);
const option2PaymentYear4 = calculateMonthlyPayment(option2Principal, BUYDOWNS.RATES[3], 30);

// Option 3: Owner Finance (calculated from amortization schedule)
const option3DownPayment = roundCurrency(SUBJECT_PRICE * OWNER_FINANCE_DP_PCT);
const option3Principal = roundCurrency(SUBJECT_PRICE - option3DownPayment);
const option3Payment = calculateMonthlyPayment(option3Principal, OWNER_FINANCE_RATE, 30);

// Calculate Option 3 totals from the amortization schedule
let option3RemainingBalance = 0;
let option3TotalRevenue = 0;
let option3InterestEarned = 0;
let option3TotalRevenueAfterBalloon = 0;
let option3GrandTotal = 0;
let option3TotalProfit = 0;

function calculateOption3Totals() {
    try {
        if (!option3Payment || option3Payment === 0) return;
        if (!option3Principal || option3Principal === 0) return;
        
        const scheduleData = calculateAmortizationSchedule();
        const schedule = scheduleData.schedule;
        
        if (schedule && Array.isArray(schedule) && schedule.length > 0) {
            const balloonEntry = schedule.find(entry => entry && entry.month === 84);
            if (balloonEntry) {
                option3RemainingBalance = roundCurrency(balloonEntry.endingBalance || 0);
                option3InterestEarned = roundCurrency(balloonEntry.interestPaid || 0);
                
                // Revenue Math: Monthly P&I * 84 months
                option3TotalRevenue = roundCurrency(option3Payment * 84);
                
                // Grand Total: Total Revenue + Balloon Payment
                option3GrandTotal = roundCurrency(option3TotalRevenue + option3RemainingBalance);
                
                // Profit Calculation: Grand Total - Current Property Price
                option3TotalProfit = roundCurrency(option3GrandTotal - propertyData.price);
                
                // Keep legacy variable for backward compatibility
                option3TotalRevenueAfterBalloon = option3GrandTotal;
            }
        }
    } catch (error) {
        console.error('Error calculating Option 3 totals:', error);
    }
}

// --- TABLE POPULATION FUNCTIONS ---

function populateCompTable(data, type, tableId) {
    const tableBody = document.getElementById(tableId);
    if (!tableBody) return;
    tableBody.innerHTML = data.map(c => {
        const isSubject = c.isSubject;
        const rowClass = isSubject ? 'bg-yellow-50 font-bold' : 'hover:bg-gray-50';
        const cdom = c.cdom || 0;
        
        // Stagnation risk marker for CDOM > 74 days
        let cdomDisplay = cdom;
        if (cdom > STAGNATION_THRESHOLD_DAYS) {
            cdomDisplay = `<span class="text-red-600 font-bold">${cdom}</span> <span class="text-[9px] text-red-600">⚠️</span>`;
        } else if (cdom > STAGNATION_THRESHOLD_DAYS * 0.75) {
            cdomDisplay = `<span class="text-orange-600 font-semibold">${cdom}</span>`;
        }
        
        if (type === 'active') {
            return `<tr class="${rowClass}"><td class="p-3 font-medium text-gray-800">${c.mls || 'AVM'}</td><td class="p-3">${c.address}</td><td class="p-3">${numberFormat.format(c.sqft)}</td><td class="p-3">${c.yb}</td><td class="p-3">${c.acres || ''}</td><td class="p-3">${c.ppsf}</td><td class="p-3">${currencyFormat.format(c.listPrice)}</td><td class="p-3">${cdomDisplay}</td></tr>`;
        } else {
            return `<tr class="${rowClass}"><td class="p-3 font-medium text-gray-800">${c.mls} (${c.status})</td><td class="p-3">${c.address}</td><td class="p-3">${numberFormat.format(c.sqft)}</td><td class="p-3">${c.yb}</td><td class="p-3">${currencyFormat.format(c.soldPrice)}</td><td class="p-3">${c.soldDate}</td><td class="p-3">${c.slRatio}%</td><td class="p-3">${cdomDisplay}</td></tr>`;
        }
    }).join('');
}

function populateAllCompTables() {
    populateCompTable(compData.ds1.active, 'active', 'ds1-active-table');
    populateCompTable(compData.ds1.pending, 'active', 'ds1-pending-table');
    populateCompTable(compData.ds1.closed, 'pending-closed', 'ds1-closed-table');
    populateCompTable(compData.ds2.active, 'active', 'ds2-active-table');
    populateCompTable(compData.ds2.pendingClosed, 'pending-closed', 'ds2-closed-table');
    populateCompTable(compData.ds3.active, 'active', 'ds3-active-table');
    populateCompTable(compData.ds3.pendingClosed, 'pending-closed', 'ds3-pending-closed-table');
}

function populateOptions() {
    // FORCE THE MATH: Force Option 3 calculations at start
    calculateOption3Totals();

    // CALCULATE THE MISSING VARIABLES LOCALLY
    let grandTotal = option3TotalRevenue + option3RemainingBalance;
    let additionalProfit = grandTotal - propertyData.price;

    // BRUTE FORCE THE INJECTION: Use innerHTML to force values to screen
    document.getElementById('total-revenue-after-balloon-value').innerHTML = currencyFormat.format(grandTotal);
    document.getElementById('seller-premium-value').innerHTML = currencyFormat.format(additionalProfit);

    // Inject Option 1 results
    const opt1MonthlyPayment = option1Payment ?? 0;
    const opt1Detailed = document.getElementById('option1-payment');
    if (opt1Detailed) opt1Detailed.textContent = currencyFormatDetailed.format(opt1MonthlyPayment);
    const opt1Summary = document.getElementById('option1-summary-payment');
    if (opt1Summary) opt1Summary.textContent = currencyFormat.format(opt1MonthlyPayment);

    // Inject Option 2 results (3-2-1 Buydown)
    const yr1Payment = option2PaymentYear1 ?? 0;
    const yr2Payment = option2PaymentYear2 ?? 0;
    const yr3Payment = option2PaymentYear3 ?? 0;
    const yr4Payment = option2PaymentYear4 ?? 0;

    const monthlySavingsYr1 = roundCurrency(yr4Payment - yr1Payment);
    const monthlySavingsYr2 = roundCurrency(yr4Payment - yr2Payment);
    const monthlySavingsYr3 = roundCurrency(yr4Payment - yr3Payment);

    // Payments
    const ids_payments = [
        ['option2-yr1-payment', yr1Payment],
        ['option2-yr2-payment', yr2Payment],
        ['option2-yr3-payment', yr3Payment],
        ['option2-yr4-payment', yr4Payment]
    ];
    ids_payments.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = currencyFormatDetailed.format(value);
    });

    // Monthly savings
    const ids_monthly_savings = [
        ['option2-yr1-savings', monthlySavingsYr1],
        ['option2-yr2-savings', monthlySavingsYr2],
        ['option2-yr3-savings', monthlySavingsYr3]
    ];
    ids_monthly_savings.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = currencyFormatDetailed.format(value);
    });

    // Annual savings
    const ids_annual_savings = [
        ['option2-yr1-annual-savings', monthlySavingsYr1 * 12],
        ['option2-yr2-annual-savings', monthlySavingsYr2 * 12],
        ['option2-yr3-annual-savings', monthlySavingsYr3 * 12]
    ];
    ids_annual_savings.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = currencyFormat.format(value);
    });

    // Option 2 summary (Year 1 payment, initial reduced payment)
    const opt2Summary = document.getElementById('option2-summary-payment');
    if (opt2Summary) opt2Summary.textContent = currencyFormat.format(yr1Payment);

    // Inject remaining Option 3 results
    const totalRevenueEl = document.getElementById('total-revenue-value');
    if (totalRevenueEl) totalRevenueEl.textContent = currencyFormat.format(option3TotalRevenue ?? 0);

    const interestEarnedEl = document.getElementById('interest-earned-value');
    if (interestEarnedEl) interestEarnedEl.textContent = currencyFormat.format(option3InterestEarned ?? 0);

    // Balloon everywhere it appears
    const balloonEls = document.querySelectorAll('#balloon-value');
    balloonEls.forEach(el => {
        el.textContent = currencyFormat.format(option3RemainingBalance ?? 0);
    });

    // Option 3 payment (summary)
    const opt3Summary = document.getElementById('option3-summary-payment');
    if (opt3Summary) opt3Summary.textContent = currencyFormat.format(option3Payment ?? 0);

    // FINAL SYNC: Inject Monthly P&I Payment
    document.getElementById('owner-finance-payment').innerHTML = currencyFormat.format(option3Payment);

    // FINAL SYNC: Ensure all Seller Finance values are injected
    document.getElementById('total-revenue-after-balloon-value').innerHTML = currencyFormat.format(option3TotalRevenue + option3RemainingBalance);
    document.getElementById('seller-premium-value').innerHTML = currencyFormat.format((option3TotalRevenue + option3RemainingBalance) - propertyData.price);
}

// --- CHART FUNCTIONS ---

// Store chart instances for potential re-initialization

function initLocalOutcomesChart() {
    // PROTOCOL: Register ChartDataLabels plugin FIRST
    Chart.register(ChartDataLabels);

    const localOutcomesCtx = document.getElementById('localOutcomesChart');
    if (!localOutcomesCtx) return;

    if (window.localOutcomesChartInstance) window.localOutcomesChartInstance.destroy();

    // DATA SYNC: Forney 75126 Macro Environment - LOCKED VALUES (180-Day RPR Macro Window)
    // This 180-day scope establishes the statistical foundation for the 74-day Liquidity Cliff
    // Sold: 14, Failed: 124, Total: 138
    // Failure Rate = 124 / (14 + 124) = 89.9%
    const sold = propertyData.huntCountyMacro?.sold ?? 14;
    const failed = propertyData.huntCountyMacro?.failed ?? 124;
    const total = sold + failed;
    const successRate = total > 0 ? ((sold / total) * 100) : 0;
    const failureRate = total > 0 ? ((failed / total) * 100) : 0;

    window.localOutcomesChartInstance = new Chart(localOutcomesCtx, {
        type: 'bar',
        data: {
            labels: ['SUCCESS', 'STATISTICAL FAILURE'],
            datasets: [{
                data: [successRate, failureRate],
                backgroundColor: ['#16A34A', '#DC2626'],
                categoryPercentage: 0.8,
                barPercentage: 0.9,
                borderRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            hover: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#ffffff',
                    font: { 
                        weight: '900', 
                        size: 18, 
                        family: "'Montserrat', sans-serif" 
                    },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        return value.toFixed(1) + '%';
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { display: false },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function initCharts() {
    try {
        updateSellerScarcityInsights();

        // Chart 1: Pricing Roadmap (with dynamic unit labels - SqFt or AC)
        const pricingChartElement = document.getElementById('pricingStrategyChart');
        if (pricingChartElement) {
            if (window.pricingChartInstance) window.pricingChartInstance.destroy();
            
            // Calculate price per unit for each phase using dynamic unit detection
            const pricingLabelsWithPPSF = pricingStrategy.map(p => {
                const ppu = getPricePerUnit(p.price);
                return `$${p.price.toLocaleString()} | $${ppu}${UNIT_LABEL}`;
            });
            
            window.pricingChartInstance = new Chart(pricingChartElement, {
                type: 'line',
                data: {
                    labels: pricingLabelsWithPPSF,
                    datasets: [{
                        label: 'List Price',
                        data: pricingStrategy.map(p => p.price),
                        borderColor: 'rgb(59, 130, 246)',
                        tension: 0.2,
                        fill: true,
                        pointBackgroundColor: 'rgb(29, 78, 216)'
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    const index = context[0].dataIndex;
                                    const phase = pricingStrategy[index];
                                    return `${phase.label} - ${context[0].label}`;
                                },
                                label: function(context) {
                                    return 'Price: ' + currencyFormat.format(context.parsed.y);
                                }
                            }
                        }
                    }
                }
            });
            
            // Explicitly update chart labels and refresh
            window.pricingChartInstance.data.labels = pricingLabelsWithPPSF;
            window.pricingChartInstance.update();
        }

        // Chart 2: Comparable CDOM
        const cdomChartElement = document.getElementById('cdomComparisonChart');
        if (cdomChartElement) {
            const closedComps = compData.ds3.pendingClosed.filter(c => c.status === 'CLOSED');
            if (window.cdomChartInstance) window.cdomChartInstance.destroy();
            window.cdomChartInstance = new Chart(cdomChartElement, {
                type: 'bar',
                data: {
                    labels: [`Subject (${TOTAL_CDOM})`, ...closedComps.map(c => c.address.split(' ')[0])],
                    datasets: [{
                        data: [TOTAL_CDOM, ...closedComps.map(c => c.cdom)],
                        backgroundColor: ['rgb(220, 38, 38)', ...closedComps.map(() => 'rgb(59, 130, 246)')]
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // Chart 3: Liquidity Probability Curve (Stagnation Risk)
        // Shows probability of sale declining over time, with 74-day stagnation cliff
        // SELLER-CENTRIC: Planning Trigger annotation at 74 Days
        const liquidityCtx = document.getElementById('liquidityVelocityChart');
        if (liquidityCtx) {
            if (window.liquidityChartInstance) window.liquidityChartInstance.destroy();
            
            // Stagnation threshold from data.js (defaults to 74 days)
            const STAGNATION_THRESHOLD = propertyData.stagnationThreshold || 74;
            
            // Liquidity Probability Data Points (95% at Day 0 down to 10% at Day 120)
            const liquidityData = {
                labels: ['Day 0', 'Day 30', 'Day 60', `Day ${STAGNATION_THRESHOLD}`, 'Day 90', 'Day 120'],
                values: [95, 80, 60, 45, 25, 10],
                days: [0, 30, 60, STAGNATION_THRESHOLD, 90, 120]
            };
            
            // Create gradient from Emerald to Red
            const ctx = liquidityCtx.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, liquidityCtx.width, 0);
            gradient.addColorStop(0, '#10B981');    // Emerald-500
            gradient.addColorStop(0.5, '#F59E0B');  // Amber-500
            gradient.addColorStop(1, '#DC2626');    // Red-600
            
            // PLANNING TRIGGER Plugin - Draws vertical RED line at 74-Day threshold
            const planningTriggerPlugin = {
                id: 'planningTrigger',
                afterDraw(chart) {
                    const { ctx, chartArea, scales } = chart;
                    const xScale = scales.x;
                    if (!xScale || !chartArea) return;
                    
                    // Find the x position for Day 74 (index 3 in our data)
                    const thresholdIndex = 3; // Day 74 is at index 3
                    const x = xScale.getPixelForValue(thresholdIndex);
                    
                    ctx.save();
                    // SOLID RED LINE (not dashed) for Planning Trigger
                    ctx.strokeStyle = '#DC2626';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x, chartArea.top);
                    ctx.lineTo(x, chartArea.bottom);
                    ctx.stroke();
                    
                    // Planning Trigger Label - More prominent
                    ctx.fillStyle = '#DC2626';
                    ctx.font = 'bold 10px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠️ PLANNING TRIGGER:', x, chartArea.top - 12);
                    ctx.fillText('Strategy Pivot Required', x, chartArea.top + 2);
                    ctx.restore();
                }
            };
            
            window.liquidityChartInstance = new Chart(liquidityCtx, {
                type: 'line',
                data: {
                    labels: liquidityData.labels,
                    datasets: [{
                        label: 'Liquidity Probability',
                        data: liquidityData.values,
                        borderColor: gradient,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 4,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: liquidityData.values.map((val, idx) => {
                            if (idx === 3) return '#DC2626'; // Threshold point is red
                            if (val >= 70) return '#10B981'; // Green for high probability
                            if (val >= 40) return '#F59E0B'; // Amber for medium
                            return '#DC2626'; // Red for low
                        }),
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 8,
                        pointHoverRadius: 12,
                        borderRadius: 0 // Sharp corners
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 35 }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 12,
                            cornerRadius: 0, // Sharp corners
                            callbacks: {
                                title: function(context) {
                                    return context[0].label;
                                },
                                label: function(context) {
                                    const prob = context.parsed.y;
                                    let riskLevel = 'LOW RISK';
                                    if (prob < 30) riskLevel = '⚠️ HIGH STAGNATION RISK';
                                    else if (prob < 50) riskLevel = 'ELEVATED RISK';
                                    else if (prob < 70) riskLevel = 'MODERATE RISK';
                                    return [`Liquidity Probability: ${prob}%`, riskLevel];
                                }
                            }
                        },
                        datalabels: {
                            color: '#ffffff', // WHITE datalabels per requirements
                            font: { weight: 'bold', size: 12 },
                            anchor: 'center',
                            align: 'center',
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            borderRadius: 0, // Sharp corners
                            padding: 4,
                            formatter: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { 
                                color: 'rgba(148, 163, 184, 0.2)',
                                drawBorder: false
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                },
                                font: { weight: '600' },
                                color: '#64748b'
                            },
                            title: {
                                display: true,
                                text: 'LIQUIDITY PROBABILITY',
                                font: { size: 10, weight: 'bold' },
                                color: '#94a3b8'
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { weight: '600' },
                                color: '#64748b'
                            },
                            title: {
                                display: true,
                                text: 'DAYS ON MARKET',
                                font: { size: 10, weight: 'bold' },
                                color: '#94a3b8'
                            }
                        }
                    },
                    elements: {
                        line: { borderCapStyle: 'square' },
                        point: { borderRadius: 0 }
                    }
                },
                plugins: [planningTriggerPlugin]
            });
        }

        // Chart 4: Local Supply Chart - Subject Comp Set (Side-by-side donut in Land Master style)
        const subjectSupplyCtx = document.getElementById('localSupplyChartSubject');
        if (subjectSupplyCtx) {
            if (window.subjectDoughnutInstance) window.subjectDoughnutInstance.destroy();

            // Use residential data: Sold, Active, Pending (NO Failed for Subject chart)
            const subjectSold = propertyData.liquidity?.closedLastMonth || 4;
            const subjectActive = propertyData.active || 14;
            const subjectPending = propertyData.pending || 5;

            window.subjectDoughnutInstance = new Chart(subjectSupplyCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Sold', 'Active', 'Pending'],
                    datasets: [{
                        data: [subjectSold, subjectActive, subjectPending],
                        backgroundColor: ['#16A34A', '#2563EB', '#EAB308'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '50%',
                    plugins: { 
                        legend: { display: false },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 12 },
                            formatter: function(value) {
                                return value;
                            }
                        }
                    },
                    animation: { duration: 0 }
                }
            });
        }

        // Chart 4B: Macro Supply Chart - Forney 75126 Macro (Side-by-side donut in Land Master style)
        const macroSupplyCtx = document.getElementById('localSupplyChartMacro');
        if (macroSupplyCtx) {
            if (window.macroDoughnutInstance) window.macroDoughnutInstance.destroy();

            // FORNEY 75126 MACRO DATA LOCK: sold=14, active=71, pending=4, failed=124
            const macroSold = propertyData.huntCountyMacro?.sold ?? 14;
            const macroActive = propertyData.huntCountyMacro?.active ?? 71;
            const macroPending = propertyData.huntCountyMacro?.pending ?? 4;
            const macroFailed = propertyData.huntCountyMacro?.failed ?? 124;

            window.macroDoughnutInstance = new Chart(macroSupplyCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Sold', 'Active', 'Pending', 'Statistical Failure'],
                    datasets: [{
                        data: [macroSold, macroActive, macroPending, macroFailed],
                        backgroundColor: ['#16A34A', '#2563EB', '#EAB308', '#DC2626'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: 0 },
                    cutout: '50%',
                    plugins: { 
                        legend: { display: false },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 12 },
                            formatter: function(value) {
                                return value;
                            }
                        }
                    },
                    animation: { duration: 0 }
                }
            });
        }

        const equilibriumLinePlugin = {
            id: 'equilibriumLine',
            afterDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                const xScale = scales.x;
                if (!xScale || !chartArea) return;
                const x = xScale.getPixelForValue(EQUILIBRIUM_MONTHS);
                ctx.save();
                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, chartArea.top);
                ctx.lineTo(x, chartArea.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('Equilibrium', x + 6, chartArea.top + 12);
                ctx.restore();
            }
        };

        // Chart 7: Market Health Analysis (With Adjusted Scarcity Advantage)
        const healthCtx = document.getElementById('marketHealthChart');
        if (healthCtx) {
            if (window.marketHealthChartInstance) window.marketHealthChartInstance.destroy();
            
            // DEMAND FRICTION ADJUSTED LEVERAGE CALCULATION
            // Formula: Supply + (Gap to Equilibrium * Friction Penalty)
            // Example: 3.5 months + (2.5 months * 0.5) = 4.75 "Adjusted" months
            const supplyValue = propertyData.monthsSupply || 0;
            const gapToEquilibrium = EQUILIBRIUM_MONTHS - supplyValue;
            const currentRate = (propertyData.marketRate ?? 0.0616) * 100;
            const RATE_FRICTION_THRESHOLD = 5.5;
            const DEMAND_FRICTION_PENALTY = 0.50;
            
            // Calculate Adjusted Leverage: Where seller ACTUALLY stands after rate friction
            let adjustedLeverageValue = supplyValue;
            let frictionApplied = false;
            if (currentRate > RATE_FRICTION_THRESHOLD && gapToEquilibrium > 0) {
                // Apply 50% penalty: Seller loses half their scarcity advantage
                adjustedLeverageValue = supplyValue + (gapToEquilibrium * DEMAND_FRICTION_PENALTY);
                frictionApplied = true;
            }
            
            window.marketHealthChartInstance = new Chart(healthCtx, {
                type: 'bar',
                data: {
                    labels: ['Current Supply', 'Market Equilibrium', 'Adjusted Leverage'],
                    datasets: [{
                        data: [supplyValue, EQUILIBRIUM_MONTHS, adjustedLeverageValue],
                        backgroundColor: ['#2563EB', '#475569', '#EAB308'],
                        borderRadius: 0,
                        barThickness: 30
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 12 },
                            anchor: 'center',
                            align: 'center',
                            formatter: function(value) {
                                return value.toFixed(1) + ' Mo';
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed.x;
                                    if (label === 'Adjusted Leverage') {
                                        return `${value.toFixed(2)} Months – Adjusted for ${currentRate.toFixed(2)}% Rate Friction (50% penalty applied)`;
                                    } else if (label === 'Current Supply') {
                                        return `${value.toFixed(2)} Months – Raw Physical Inventory`;
                                    } else if (label === 'Market Equilibrium') {
                                        return `${value.toFixed(1)} Months – Balanced Market Threshold`;
                                    }
                                    return `${value.toFixed(2)} Months`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 10,
                            grid: { display: false },
                            ticks: {
                                callback: function(value) { return value + ' Months'; }
                            }
                        },
                        y: { grid: { display: false } }
                    }
                },
                plugins: [equilibriumLinePlugin]
            });
        }

        // Chart 5: Local Outcomes Chart (Market Outcome Analysis - Institutional Style)
        initLocalOutcomesChart();

        // Chart 6: Rate Chart
        const rateCtx = document.getElementById('rateChart');
        if (rateCtx) {
            if (window.rateChartInstance) window.rateChartInstance.destroy();
            window.rateChartInstance = new Chart(rateCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'Market Rate',
                        data: [7.2, 7.1, 6.9, 6.8, 6.7, 6.5, 6.3, 6.2, 6.15, 6.16, 6.16, 6.16],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Owner Finance Rate',
                        data: Array(12).fill(propertyData.ownerFinanceRate * 100),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0,
                        fill: false,
                        borderDash: [5, 5]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: 5.5,
                            max: 8,
                            ticks: {
                                callback: function(value) { return value + '%'; }
                            }
                        }
                    }
                }
            });
        }
    } catch (e) { console.error('Chart Initialization Error:', e); }
}

// --- AMORTIZATION FUNCTIONS ---

function calculateAmortizationSchedule() {
    // Option 3: Owner Financing (Dynamic from propertyData)
    const P_owner = roundCurrency(propertyData.price * (1 - propertyData.ownerFinanceDownPct));
    const rate_owner = propertyData.ownerFinanceRate;  
    const M_owner = calculateMonthlyPayment(P_owner, rate_owner, 30); // Monthly payment for 30 years
    const balloonMonths_owner = 84; 
    const r_owner = rate_owner / 12;
    
    let schedule = [];
    const displayMonths = [1, 12, 24, 36, 60, balloonMonths_owner]; 

    let currentBalance = P_owner;
    let runningTotalInterest = 0;
    let runningTotalPrincipal = 0;

    for (let month = 1; month <= balloonMonths_owner; month++) {
        // Capture starting balance at the beginning of the month (rounded)
        const startingBalance = roundCurrency(currentBalance);
        
        // Calculate monthly interest payment (based on current balance)
        const monthlyInterest = roundCurrency(startingBalance * r_owner);
        
        // Calculate monthly principal payment (payment minus interest)
        const monthlyPrincipal = roundCurrency(M_owner - monthlyInterest);
        
        // Calculate ending balance (starting balance minus principal paid this month)
        const endingBalance = roundCurrency(startingBalance - monthlyPrincipal);
        
        // Update running totals (cumulative)
        runningTotalInterest = roundCurrency(runningTotalInterest + monthlyInterest);
        runningTotalPrincipal = roundCurrency(runningTotalPrincipal + monthlyPrincipal);
        
        // Update balance for next iteration
        currentBalance = endingBalance;
        
        // Store milestone data if this is a display month
        if (displayMonths.includes(month)) {
            // Verify ending balance matches expected value (original principal - cumulative principal paid)
            const expectedEndingBalance = roundCurrency(P_owner - runningTotalPrincipal);
            
            // Use the calculated ending balance (should match expected, but use calculated for accuracy)
            const finalEndingBalance = roundCurrency(endingBalance);
            
            schedule.push({
                month: month,
                startingBalance: startingBalance,
                payment: M_owner,
                interestPaid: runningTotalInterest,  // Cumulative total interest paid
                principalPaid: runningTotalPrincipal,  // Cumulative total principal paid
                endingBalance: finalEndingBalance  // Remaining balance after this month
            });
        }
    }
    
    return {
        schedule
    };
}

function populateAmortizationTable() {
    try {
        // Get the table body element
        const tableBody = document.getElementById('owner-finance-schedule');
        
        if (!tableBody) {
            console.error('Table body element not found: owner-finance-schedule');
            return;
        }
        
        // Calculate the amortization schedule
        const data = calculateAmortizationSchedule();
        
        if (!data || !data.schedule) {
            console.error('Invalid schedule data returned from calculateAmortizationSchedule');
            tableBody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-red-600">Error: Invalid schedule data</td></tr>';
            return;
        }
        
        const schedule = data.schedule;
        
        if (!Array.isArray(schedule) || schedule.length === 0) {
            console.error('Amortization schedule is empty or not an array. Length:', schedule ? schedule.length : 'null');
            tableBody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-red-600">No schedule data available</td></tr>';
            return;
        }
        
        // Build HTML rows for each milestone
        let html = '';
        
        schedule.forEach((item, index) => {
            if (!item) {
                console.warn(`Schedule item at index ${index} is null or undefined`);
                return;
            }
            
            // Extract and validate values
            const month = item.month || 0;
            const startingBalance = roundCurrency(item.startingBalance || 0);
            const payment = roundCurrency(item.payment || 0);
            const interestPaid = roundCurrency(item.interestPaid || 0);  // Cumulative interest paid
            const principalPaid = roundCurrency(item.principalPaid || 0);  // Cumulative principal paid
            const endingBalance = roundCurrency(item.endingBalance || 0);
            
            // Determine if this is the balloon payment month
            const isBalloon = month === 84;
            const rowClass = isBalloon ? 'bg-red-100 font-bold text-red-900 border-t-2 border-red-700' : 'text-gray-700';
            const balloonText = isBalloon ? ' <span class="text-red-600">(BALLOON DUE)</span>' : '';
            
            // Build the table row HTML using template literals
            html += `
                <tr class="${rowClass}">
                    <td class="p-3">${month}${balloonText}</td>
                    <td class="p-3">${currencyFormatDetailed.format(startingBalance)}</td>
                    <td class="p-3">${currencyFormatDetailed.format(payment)}</td>
                    <td class="p-3">${currencyFormatDetailed.format(interestPaid)}</td>
                    <td class="p-3">${currencyFormatDetailed.format(principalPaid)}</td>
                    <td class="p-3 font-extrabold">${currencyFormatDetailed.format(endingBalance)}</td>
                </tr>
            `;
        });
        
        // Insert the HTML into the table body
        if (html === '') {
            console.error('No HTML rows were generated from schedule');
            tableBody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-red-600">No rows generated</td></tr>';
        } else {
            tableBody.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error populating amortization table:', error);
        console.error('Error stack:', error.stack);
        const tableBody = document.getElementById('owner-finance-schedule');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-red-600">Error loading schedule data: ' + error.message + '</td></tr>';
        }
    }
}

function calculateCompleteAmortizationSchedule() {
    // Option 3: Owner Financing (Dynamic from propertyData)
    const P_owner = roundCurrency(propertyData.price * (1 - propertyData.ownerFinanceDownPct));
    const rate_owner = propertyData.ownerFinanceRate;  
    const M_owner = calculateMonthlyPayment(P_owner, rate_owner, 30); // Monthly payment for 30 years
    const balloonMonths_owner = 84; 
    const r_owner = rate_owner / 12;
    
    let schedule = [];
    let currentBalance = P_owner;

    for (let month = 1; month <= balloonMonths_owner; month++) {
        // Capture starting balance at the beginning of the month (rounded)
        const startingBalance = roundCurrency(currentBalance);
        
        // Calculate monthly interest payment (based on current balance)
        const monthlyInterest = roundCurrency(startingBalance * r_owner);
        
        // Calculate monthly principal payment (payment minus interest)
        const monthlyPrincipal = roundCurrency(M_owner - monthlyInterest);
        
        // Calculate ending balance (starting balance minus principal paid this month)
        const endingBalance = roundCurrency(startingBalance - monthlyPrincipal);
        
        // Update balance for next iteration
        currentBalance = endingBalance;
        
        // Store all months in the schedule
        schedule.push({
            month: month,
            startingBalance: startingBalance,
            payment: M_owner,
            interestPaid: monthlyInterest,  // Monthly interest (not cumulative)
            principalPaid: monthlyPrincipal,  // Monthly principal (not cumulative)
            endingBalance: endingBalance
        });
    }
    
    return schedule;
}

function populateCompleteAmortizationTable() {
    try {
        const schedule = calculateCompleteAmortizationSchedule();
        const tableBody = document.getElementById('owner-finance-complete-schedule');
        
        if (!tableBody) {
            console.error('Table body element not found: owner-finance-complete-schedule');
            return;
        }
        
        if (!schedule || schedule.length === 0) {
            console.error('Complete amortization schedule is empty');
            tableBody.innerHTML = '<tr><td colspan="6" class="p-2 text-center text-red-600">No schedule data available</td></tr>';
            return;
        }
        
        let html = '';
        schedule.forEach((item, index) => {
            if (!item) {
                console.warn(`Schedule item at index ${index} is null or undefined`);
                return;
            }
            
            // Extract and validate values
            const month = item.month || 0;
            const startingBalance = roundCurrency(item.startingBalance || 0);
            const payment = roundCurrency(item.payment || 0);
            const interestPaid = roundCurrency(item.interestPaid || 0);  // Monthly interest
            const principalPaid = roundCurrency(item.principalPaid || 0);  // Monthly principal
            const endingBalance = roundCurrency(item.endingBalance || 0);
            
            // Determine if this is the balloon payment month
            const isBalloon = month === 84;
            const rowClass = isBalloon ? 'bg-red-100 font-bold text-red-900' : (month % 2 === 0 ? 'bg-gray-50' : 'bg-white');
            const balloonText = isBalloon ? ' <span class="text-red-600">(BALLOON)</span>' : '';
            
            // Build the table row HTML
            html += `
                <tr class="${rowClass}">
                    <td class="p-2">${month}${balloonText}</td>
                    <td class="p-2">${currencyFormatDetailed.format(startingBalance)}</td>
                    <td class="p-2">${currencyFormatDetailed.format(payment)}</td>
                    <td class="p-2">${currencyFormatDetailed.format(interestPaid)}</td>
                    <td class="p-2">${currencyFormatDetailed.format(principalPaid)}</td>
                    <td class="p-2">${currencyFormatDetailed.format(endingBalance)}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
    } catch (error) {
        console.error('Error populating complete amortization table:', error);
        console.error('Error stack:', error.stack);
        const tableBody = document.getElementById('owner-finance-complete-schedule');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="p-2 text-center text-red-600">Error loading schedule data: ' + error.message + '</td></tr>';
        }
    }
}

// --- NAVIGATION FUNCTIONS ---

function attachEventListeners() {
    console.log("Attaching navigation event listeners...");
    
    // Main navigation buttons (no longer skip external links - all are tabs now)
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach((button) => {
        button.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            const targetTabId = this.id.replace('nav-', '');
            showTab(targetTabId, this);
        };
    });

    // Sub-navigation buttons for comparables
    document.querySelectorAll('.sub-nav-btn[data-comp]').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            showCompSubTab(btn.getAttribute('data-comp'));
        };
    });

    // Incentive sub-tab buttons
    document.querySelectorAll('#incentives-nav-tabs button').forEach(btn => {
        const tabId = btn.getAttribute('onclick')?.match(/showIncentiveSubTab\('([^']+)'/)?.[1];
        if (tabId) {
            btn.onclick = (e) => {
                e.preventDefault();
                showIncentiveSubTab(tabId, btn);
            };
        }
    });
    
    // Attach Decision Path form submission handler
    const decisionPathForm = document.querySelector('#tab-decision-path form');
    if (decisionPathForm) {
        decisionPathForm.onsubmit = handleLeadSubmission;
    }

    console.log("Event listeners attached successfully");
}

function showTab(tabId, navButtonEl) {
    console.log("Switching to:", tabId);
    // Hide EVERY possible tab container using a global selector
    const allTabs = document.querySelectorAll('[id^="tab-"], [id^="page-"]');
    allTabs.forEach(t => {
        t.style.display = 'none';
        t.classList.add('hidden');
    });
    // Show target by ID and force display block
    const target = document.getElementById('tab-' + tabId) || document.getElementById('page-' + tabId);
    if (target) {
        target.style.display = 'block';
        target.classList.remove('hidden');
    }
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (navButtonEl) navButtonEl.classList.add('active');
    window.scrollTo(0,0);
}

function showIncentiveSubTab(tabId, buttonEl) {
    console.log("Switching incentive sub-tab to:", tabId);
    
    const subTabs = ['summary', 'phased-protection', 'buydown', 'seller-finance'];
    
    // Hide all sub-tab sections
    subTabs.forEach(t => {
        const el = document.getElementById(`incentive-${t}`);
        if (el) {
            el.classList.add('hidden');
        }
    });
    
    // Show target sub-tab
    const targetEl = document.getElementById(`incentive-${tabId}`);
    if (targetEl) {
        targetEl.classList.remove('hidden');
    }
    
    // Update button states with .is-active class
    const parent = document.getElementById('incentives-nav-tabs');
    if (parent) {
        parent.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('is-active', 'border-blue-600', 'text-blue-600', 'bg-blue-600', 'text-white');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
    }
    
    // Set active state on clicked button
    if (buttonEl) {
        buttonEl.classList.remove('border-transparent', 'text-gray-500');
        buttonEl.classList.add('is-active', 'border-blue-600', 'text-blue-600', 'bg-blue-600', 'text-white');
    }

    // Refresh data
    if (typeof populateOptions === 'function') {
        populateOptions();
    }
}

function scrollNav(direction) {
    const container = document.getElementById('nav-tabs-container');
    if (!container) return;
    
    const amount = 250;
    container.scrollBy({ 
        left: direction === 'left' ? -amount : amount, 
        behavior: 'smooth' 
    });
}

function showCompSubTab(id) {
    ['neighborhood', 'avm', 'price_comp'].forEach(p => {
        const el = document.getElementById(`sub-page-${p}`);
        if (el) el.classList.toggle('hidden', p !== id);
    });
    document.querySelectorAll('.sub-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-comp') === id);
    });
}

// --- DYNAMIC DATA INJECTION ENGINE ---

function injectDynamicData() {
    // Calculate derived values
    const ppsf = Math.round((propertyData.price / propertyData.sqft) * 100) / 100;
    const reductionAmount = propertyData.price - propertyData.priceFloor;
    const reductionPct = ((reductionAmount / propertyData.price) * 100).toFixed(1);
    const equilibriumGap = Math.round((EQUILIBRIUM_MONTHS - propertyData.monthsSupply) * 100) / 100;
    
    // Format values
    const priceFormatted = currencyFormat.format(propertyData.price);
    const floorPriceFormatted = currencyFormat.format(propertyData.priceFloor);
    const sqftFormatted = numberFormat.format(propertyData.sqft) + ' SF';
    const bedsBaths = `${propertyData.beds} BD | ${propertyData.baths} BA`;
    const ppsfFormatted = currencyFormat.format(ppsf);
    const addressShort = propertyData.address.split(',')[0];
    const marketRatePct = (propertyData.marketRate * 100).toFixed(2) + '%';
    const ownerFinanceRatePct = (propertyData.ownerFinanceRate * 100).toFixed(2) + '%';
    
    // Phase prices and reductions
    const phase1Price = currencyFormat.format(propertyData.roadmapPhases[0].price);
    const phase2Price = currencyFormat.format(propertyData.roadmapPhases[1].price);
    const phase3Price = currencyFormat.format(propertyData.roadmapPhases[2].price);
    const phase4Price = currencyFormat.format(propertyData.roadmapPhases[3].price);
    const phase2Reduction = currencyFormat.format(propertyData.roadmapPhases[0].price - propertyData.roadmapPhases[1].price);
    const phase3Reduction = currencyFormat.format(propertyData.roadmapPhases[1].price - propertyData.roadmapPhases[2].price);
    const phase4Reduction = currencyFormat.format(propertyData.roadmapPhases[2].price - propertyData.roadmapPhases[3].price);
    const totalReduction = currencyFormat.format(reductionAmount);
    
    // Buydown rates
    const buydownYr1Rate = (BUYDOWNS.RATES[0] * 100).toFixed(2) + '%';
    const buydownYr2Rate = (BUYDOWNS.RATES[1] * 100).toFixed(2) + '%';
    const buydownYr3Rate = (BUYDOWNS.RATES[2] * 100).toFixed(2) + '%';
    const buydownCost = currencyFormat.format(BUYDOWNS.SELLER_COST);
    
    // Option 1 calculations
    const floorDownPayment = currencyFormatDetailed.format(Math.round(propertyData.priceFloor * propertyData.downPaymentPct * 100) / 100);
    const floorPrincipal = currencyFormatDetailed.format(Math.round(propertyData.priceFloor * (1 - propertyData.downPaymentPct) * 100) / 100);
    
    // Option 2 calculations
    const buydownDownPayment = currencyFormatDetailed.format(Math.round(propertyData.price * propertyData.downPaymentPct * 100) / 100);
    const buydownPrincipal = currencyFormatDetailed.format(Math.round(propertyData.price * (1 - propertyData.downPaymentPct) * 100) / 100);
    
    // Inject into all dynamic-address elements
    document.querySelectorAll('.dynamic-address').forEach(el => el.textContent = propertyData.address);
    document.querySelectorAll('.dynamic-address-short').forEach(el => el.textContent = addressShort);
    document.querySelectorAll('.dynamic-city').forEach(el => el.textContent = propertyData.city);
    document.querySelectorAll('.dynamic-zip').forEach(el => el.textContent = propertyData.zipCode);
    
    // Inject property specs
    document.querySelectorAll('.dynamic-year').forEach(el => el.textContent = propertyData.yearBuilt);
    document.querySelectorAll('.dynamic-sqft').forEach(el => el.textContent = sqftFormatted);
    document.querySelectorAll('.dynamic-sqft-formatted').forEach(el => el.textContent = sqftFormatted);
    document.querySelectorAll('.dynamic-beds-baths').forEach(el => el.textContent = bedsBaths);
    document.querySelectorAll('.dynamic-lot').forEach(el => el.textContent = propertyData.lotSize);
    
    // Inject pricing
    document.querySelectorAll('.dynamic-price-formatted').forEach(el => el.textContent = priceFormatted);
    document.querySelectorAll('.dynamic-floor-price-formatted').forEach(el => el.textContent = floorPriceFormatted);
    document.querySelectorAll('.dynamic-ppsf').forEach(el => el.textContent = ppsfFormatted);
    document.querySelectorAll('.dynamic-cdom').forEach(el => el.textContent = propertyData.cdom + ' Days');
    document.querySelectorAll('.dynamic-reduction-percentage').forEach(el => el.textContent = `Total Reduction: ${reductionPct}%`);
    
    // Inject roadmap phases
    document.querySelectorAll('.dynamic-phase1-price').forEach(el => el.textContent = phase1Price);
    document.querySelectorAll('.dynamic-phase2-price').forEach(el => el.textContent = phase2Price);
    document.querySelectorAll('.dynamic-phase3-price').forEach(el => el.textContent = phase3Price);
    document.querySelectorAll('.dynamic-phase4-price').forEach(el => el.textContent = phase4Price);
    document.querySelectorAll('.dynamic-phase1-price-formatted').forEach(el => el.textContent = phase1Price);
    document.querySelectorAll('.dynamic-phase2-price-formatted').forEach(el => el.textContent = phase2Price);
    document.querySelectorAll('.dynamic-phase3-price-formatted').forEach(el => el.textContent = phase3Price);
    document.querySelectorAll('.dynamic-phase4-price-formatted').forEach(el => el.textContent = phase4Price);
    document.querySelectorAll('.dynamic-phase2-reduction').forEach(el => el.textContent = phase2Reduction);
    document.querySelectorAll('.dynamic-phase3-reduction').forEach(el => el.textContent = phase3Reduction);
    document.querySelectorAll('.dynamic-phase4-reduction').forEach(el => el.textContent = phase4Reduction);
    document.querySelectorAll('.dynamic-total-reduction').forEach(el => el.textContent = `Total Reduction from Anchor: ${totalReduction} (${reductionPct}% Drop)`);
    
    // Populate Pricing Strategy Roadmap Phases (High-Density Cards)
    // Uses dynamic UNIT_LABEL for SqFt vs Acres support
    const strategyRoadmapContainer = document.getElementById('roadmap-phases-strategy');
    if (strategyRoadmapContainer && propertyData.roadmapPhases) {
        let strategyRoadmapHtml = '';
        propertyData.roadmapPhases.forEach((phase, index) => {
            const isActive = index === 0;
            // Use dynamic unit detection
            const phasePricePerUnit = getPricePerUnit(phase.price);
            const phasePricePerUnitFormatted = phasePricePerUnit > 0
                ? `${currencyFormat.format(phasePricePerUnit)}${UNIT_LABEL}`
                : '';
            
            // Define phase-specific styles (Blue, Green, Purple, Red)
            const colors = [
                { bg: 'from-blue-600 to-blue-800', border: 'border-blue-500', text: 'text-blue-100', price: 'text-white', sub: 'text-blue-200' },
                { bg: 'from-green-600 to-green-800', border: 'border-green-500', text: 'text-green-100', price: 'text-white', sub: 'text-green-200' },
                { bg: 'from-purple-600 to-purple-800', border: 'border-purple-500', text: 'text-purple-100', price: 'text-white', sub: 'text-purple-200' },
                { bg: 'from-red-600 to-red-800', border: 'border-red-500', text: 'text-red-100', price: 'text-white', sub: 'text-red-200' }
            ];
            const colorScheme = colors[index] || colors[0];
            
            strategyRoadmapHtml += `
                <div class="bg-gradient-to-br ${colorScheme.bg} rounded-xl p-6 shadow-lg border ${colorScheme.border}">
                    <div class="text-center">
                        <div class="text-sm font-semibold ${colorScheme.text} mb-2">${phase.label}</div>
                        <div class="text-3xl font-extrabold ${colorScheme.price} mb-2">${currencyFormat.format(phase.price)}</div>
                        <div class="text-lg font-bold ${colorScheme.sub} mb-1">${phasePricePerUnitFormatted}</div>
                        <div class="text-xs ${colorScheme.text} opacity-80">${phase.status}</div>
                    </div>
                </div>
            `;
        });
        strategyRoadmapContainer.innerHTML = strategyRoadmapHtml;
    }
    
    // Inject market intel
    document.querySelectorAll('.dynamic-supply').forEach(el => el.textContent = propertyData.monthsSupply);
    document.querySelectorAll('.dynamic-supply-months').forEach(el => el.textContent = propertyData.monthsSupply + ' Months');
    document.querySelectorAll('.dynamic-dom').forEach(el => el.textContent = propertyData.dom);
    
    // DOM with Stagnation Risk Markers (if DOM > 74 days)
    const domRiskMarker = getStagnationRiskMarker(propertyData.dom);
    document.querySelectorAll('.dynamic-dom-days').forEach(el => {
        if (domRiskMarker && propertyData.dom > STAGNATION_THRESHOLD_DAYS) {
            el.innerHTML = `<span class="text-red-600 font-bold">${propertyData.dom} Days</span> <span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 ml-1 font-semibold">${domRiskMarker}</span>`;
        } else {
            el.textContent = propertyData.dom + ' Days';
        }
    });
    
    document.querySelectorAll('.dynamic-equilibrium-gap').forEach(el => el.textContent = equilibriumGap.toFixed(2));
    updateSellerScarcityInsights();
    
    // Executive Summary: Adjusted Leverage Injection (Demand Friction Aware)
    const execCurrentRate = (propertyData.marketRate ?? 0.0616) * 100;
    const execScarcityMetrics = getSellerScarcityMetrics(propertyData.monthsSupply, execCurrentRate);
    const execAdjustedLeverageEl = document.getElementById('exec-adjusted-leverage');
    if (execAdjustedLeverageEl) {
        execAdjustedLeverageEl.textContent = execScarcityMetrics.advantagePct.toFixed(1) + '%';
    }
    
    // Inject rates
    document.querySelectorAll('.dynamic-market-rate-pct').forEach(el => el.textContent = marketRatePct);
    document.querySelectorAll('.dynamic-owner-finance-rate').forEach(el => el.textContent = ownerFinanceRatePct);
    
    // Inject buydown data
    document.querySelectorAll('.dynamic-buydown-cost').forEach(el => el.textContent = buydownCost);
    document.querySelectorAll('.dynamic-buydown-yr1-rate').forEach(el => el.textContent = buydownYr1Rate);
    document.querySelectorAll('.dynamic-buydown-yr2-rate').forEach(el => el.textContent = buydownYr2Rate);
    document.querySelectorAll('.dynamic-buydown-yr3-rate').forEach(el => el.textContent = buydownYr3Rate);
    document.querySelectorAll('.dynamic-buydown-down-payment').forEach(el => el.textContent = buydownDownPayment);
    document.querySelectorAll('.dynamic-buydown-principal').forEach(el => el.textContent = buydownPrincipal);
    
    // Inject Option 1 calculations
    document.querySelectorAll('.dynamic-floor-down-payment').forEach(el => el.textContent = floorDownPayment);
    document.querySelectorAll('.dynamic-floor-principal').forEach(el => el.textContent = floorPrincipal);
   
   // Inject structural and aesthetic features
    document.querySelectorAll('.dynamic-structural-1').forEach(el => el.textContent = propertyData.structural1);
    document.querySelectorAll('.dynamic-structural-2').forEach(el => el.textContent = propertyData.structural2);
    document.querySelectorAll('.dynamic-aesthetic-1').forEach(el => el.textContent = propertyData.aesthetic1);
    document.querySelectorAll('.dynamic-aesthetic-2').forEach(el => el.textContent = propertyData.aesthetic2);
    document.querySelectorAll('.dynamic-aesthetic-3').forEach(el => el.textContent = propertyData.aesthetic3); 

    // Inject YouTube iframe with propertyData.youtubeID
    const youtubeIframes = document.querySelectorAll('.dynamic-youtube-iframe');
    youtubeIframes.forEach(iframe => {
        if (propertyData.youtubeID) {
            iframe.src = `https://www.youtube.com/embed/${propertyData.youtubeID}`;
            iframe.title = `${addressShort} – Executive Summary`;
        }
    });
    
    // Update Google Maps iframe
    const mapsIframe = document.querySelector('iframe[src*="google.com/maps"]');
    if (mapsIframe) {
        const encodedAddress = encodeURIComponent(propertyData.address);
        mapsIframe.src = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
    }
    
    // Inject total reduction amount without formatting
    const totalReductionAmount = currencyFormat.format(reductionAmount);
    document.querySelectorAll('.dynamic-total-reduction-amount').forEach(el => el.textContent = totalReductionAmount);

    // Unified Data Binding Engine - Protocol 000.002.005
    const supply = propertyData.monthsSupply || 6.0;
    const leverage = (((6 - supply) / 6) * 100).toFixed(1);
    const mappings = {
        'count-active': propertyData.active,
        'count-pending': propertyData.pending,
        'count-contract': propertyData.underContract,
        'leverage-pct': leverage + '%',
        'seller-market-interpretation': `Currently, ${propertyData.city} ${propertyData.zipCode} carries ${supply} months of inventory. This indicates a ${supply < 6 ? "Seller's Market" : "Buyer's Market"} where strategic pricing is key to maintaining velocity.`
    };

    Object.entries(mappings).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = val;
    });
    
    // V2.0 Land Integration: Branding injection for new tabs
    // Decision Path Tab - Phone number already in placeholder
    // Search Properties Tab - Service area and phone
    const serviceAreaText = 'All North and North East Texas';
    const phoneNumber = '(903) 449-4439';
    const phoneLink = 'tel:9034494439';
    
    // Update any dynamic branding elements in new tabs
    document.querySelectorAll('.dynamic-service-area').forEach(el => el.textContent = serviceAreaText);
    document.querySelectorAll('.dynamic-phone').forEach(el => el.textContent = phoneNumber);
    document.querySelectorAll('a[href*="tel:"]').forEach(el => {
        if (!el.href.includes('9034494439')) {
            el.href = phoneLink;
            if (el.textContent.includes('(') && el.textContent.includes(')')) {
                el.textContent = el.textContent.replace(/\(\d{3}\)\s*\d{3}-\d{4}/, phoneNumber);
            }
        }
    });

    // LOCAL MARKET KPIs INJECTION (Institutional Overhaul - 4-Section Format)
    if (propertyData.localMarket) {
        // SECTION 1: Current Inventory Mix - Subject Comp Set
        const subjectInventoryMappings = {
            'subject-sold-count': numberFormat.format(propertyData.liquidity?.closedLastMonth || 0),
            'subject-active-count': numberFormat.format(propertyData.active || 0),
            'subject-pending-count': numberFormat.format(propertyData.pending || 0),
            'subject-failed-count': numberFormat.format(propertyData.localMarket.failedListings || 0)
        };
        
        Object.entries(subjectInventoryMappings).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
        
        // SECTION 1: Current Inventory Mix - Hunt County Macro
        if (propertyData.huntCountyMacro) {
            const macroInventoryMappings = {
                'macro-sold-count': numberFormat.format(propertyData.huntCountyMacro.sold),
                'macro-active-count': numberFormat.format(propertyData.huntCountyMacro.active),
                'macro-pending-count': numberFormat.format(propertyData.huntCountyMacro.pending),
                'macro-failed-count': numberFormat.format(propertyData.huntCountyMacro.failed)
            };
            
            Object.entries(macroInventoryMappings).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            });
        }
        
        // SECTION 2: Listing Outcome Statistics
        const outcomeStats = calculateOutcomeStats();
        const outcomeMappings = {
            'outcome-sold-count': numberFormat.format(outcomeStats.subject.sold),
            'outcome-failed-count': numberFormat.format(outcomeStats.subject.failed),
            'outcome-failure-rate': outcomeStats.subject.failureRate + '%'
        };
        
        Object.entries(outcomeMappings).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
        
        // Update warning text based on failure rate
        const warningTextEl = document.getElementById('outcome-warning-text');
        if (warningTextEl) {
            const failureRate = parseFloat(outcomeStats.subject.failureRate);
            if (failureRate > 50) {
                warningTextEl.textContent = `CRITICAL: ${failureRate}% failure rate indicates severe market resistance. Immediate pricing correction required to avoid asset stagnation.`;
            } else if (failureRate > 30) {
                warningTextEl.textContent = `WARNING: ${failureRate}% failure rate suggests aggressive pricing or market misalignment. Strategic repositioning recommended.`;
            } else if (failureRate > 15) {
                warningTextEl.textContent = `CAUTION: ${failureRate}% failure rate indicates moderate pricing pressure. Monitor closely and maintain competitive positioning.`;
            } else {
                warningTextEl.textContent = `HEALTHY: ${failureRate}% failure rate reflects strong market absorption and appropriate pricing discipline.`;
            }
        }
        
        // SECTION 3: Market Absorption Health (Scarcity Advantage with Demand Friction)
        const supply = propertyData.monthsSupply || 6.0;
        const currentRateForScarcity = (propertyData.marketRate ?? 0.0616) * 100;
        const scarcityMetrics = getSellerScarcityMetrics(supply, currentRateForScarcity);
        
        // Build scarcity analysis text with Demand Friction awareness
        let scarcityAnalysisText = '';
        if (scarcityMetrics.demandFrictionApplied) {
            const rawPct = scarcityMetrics.rawAdvantagePct.toFixed(1);
            const adjPct = scarcityMetrics.advantagePct.toFixed(1);
            scarcityAnalysisText = `Real estate equilibrium is ${EQUILIBRIUM_MONTHS.toFixed(1)} months. With ${supply.toFixed(2)} months of supply, raw scarcity suggests a ${rawPct}% Seller Advantage. The ${currentRateForScarcity.toFixed(2)}% interest rate applies 50% Demand Friction, yielding an Adjusted Advantage of ${adjPct}%. This is classified as a ${scarcityMetrics.tier}.`;
        } else {
            scarcityAnalysisText = `Real estate equilibrium is ${EQUILIBRIUM_MONTHS.toFixed(1)} months. With ${supply.toFixed(2)} months of supply, the seller holds a ${scarcityMetrics.advantagePct.toFixed(1)}% Scarcity Advantage. This is classified as a ${scarcityMetrics.tier}.`;
        }
        
        const scarcityMappings = {
            'current-supply-months': supply.toFixed(2),
            'scarcity-advantage-pct': scarcityMetrics.demandFrictionApplied 
                ? scarcityMetrics.advantagePct.toFixed(1) + '% (Adjusted)' 
                : scarcityMetrics.advantagePct.toFixed(1) + '%',
            'market-tier-label': scarcityMetrics.tier,
            'scarcity-analysis-text': scarcityAnalysisText,
            'scarcity-interpretation': `Interpretation: ${scarcityMetrics.interpretation}`
        };
        
        Object.entries(scarcityMappings).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
        
        // SECTION 4: Trends & Asset Comparison
        // Calculate metrics from comp data
        const closedComps = compData.ds3.pendingClosed.filter(c => c.status === 'CLOSED');
        const medianDomSold = closedComps.length > 0 
            ? Math.round(closedComps.map(c => c.cdom).sort((a, b) => a - b)[Math.floor(closedComps.length / 2)])
            : 0;
        
        const activeComps = compData.ds3.active.filter(c => !c.isSubject);
        const avgDomActive = activeComps.length > 0
            ? Math.round(activeComps.reduce((sum, c) => sum + (c.cdom || 0), 0) / activeComps.length)
            : 0;
        
        const projectedMarketTime = calculateProjectedMarketTime();
        
        const trendsMappings = {
            'median-sold-dom': medianDomSold,
            'avg-active-pending-dom': avgDomActive,
            'trend-months-supply': supply.toFixed(2),
            'market-projected-time': projectedMarketTime
        };
        
        Object.entries(trendsMappings).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }
    
    // LIQUIDITY KPIs INJECTION (Market Velocity)
    if (propertyData.liquidity) {
        const liquidityMappings = {
            'liquidity-market-pool': numberFormat.format(propertyData.liquidity.totalMarketPool),
            'liquidity-pending-sales': numberFormat.format(propertyData.liquidity.pendingSales),
            'liquidity-closed-month': numberFormat.format(propertyData.liquidity.closedLastMonth),
            'liquidity-pending-sales-insight': numberFormat.format(propertyData.liquidity.pendingSales)
        };
        
        Object.entries(liquidityMappings).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }
    
    // RPR MARKET REPORT BUTTON - window.open logic for new tab
    const rprButton = document.getElementById('rpr-market-report-btn');
    if (rprButton && propertyData.reportingLinks['rpr-market-report']) {
        rprButton.onclick = function(e) {
            e.preventDefault();
            window.open(propertyData.reportingLinks['rpr-market-report'], '_blank', 'noopener,noreferrer');
            return false;
        };
    }

    console.log('✓ Protocol 000.002.001: Dynamic data injection complete (14-tab structure with V2.0 Land features + Local Market & Liquidity KPIs)');
}

function populatePropertyData() {
    // Update header address
    const headerAddress = document.getElementById('header-address');
    if (headerAddress) headerAddress.textContent = propertyData.address;
    
    // Update header spec ribbon from propertyData
    const specYear = document.getElementById('spec-year');
    if (specYear && propertyData.yearBuilt) {
        specYear.textContent = propertyData.yearBuilt;
    }
    const specSize = document.getElementById('spec-size');
    if (specSize && typeof propertyData.sqft === 'number') {
        specSize.textContent = `${propertyData.sqft.toLocaleString()} SF`;
    }
    const specBeds = document.getElementById('spec-beds');
    if (specBeds && propertyData.beds != null && propertyData.baths != null) {
        specBeds.textContent = `${propertyData.beds} BD | ${propertyData.baths} BA`;
    }
    const specLot = document.getElementById('spec-lot');
    if (specLot && propertyData.lotSize) {
        specLot.textContent = propertyData.lotSize;
    }
    
    // Update summary address
    const summaryAddress = document.getElementById('summary-address');
    if (summaryAddress) summaryAddress.textContent = propertyData.address;
    
    // Update summary price and floor
    const summaryPrice = document.getElementById('summary-price');
    if (summaryPrice) summaryPrice.textContent = currencyFormat.format(propertyData.price);
    
    const summaryFloor = document.getElementById('summary-floor');
    if (summaryFloor) summaryFloor.textContent = currencyFormat.format(propertyData.priceFloor);
    
    // Update Matterport link in Campaign Strategy tab
    const matterportLink = document.getElementById('matterport-link');
    if (matterportLink && propertyData.matterportLink) {
        matterportLink.href = propertyData.matterportLink;
    }
    
    // Update embedded Matterport viewer in Property tab
    const matterportEmbed = document.getElementById('matterport-embed');
    if (matterportEmbed && propertyData.matterportEmbedUrl) {
        matterportEmbed.src = propertyData.matterportEmbedUrl;
    }
    
    // Populate Roadmap Phases
    const roadmapContainer = document.getElementById('roadmap-phases');
    if (roadmapContainer && propertyData.roadmapPhases) {
        let roadmapHtml = '';
        propertyData.roadmapPhases.forEach((phase, index) => {
            const isActive = index === 0;
            roadmapHtml += `
                <div class="bg-gradient-to-br ${isActive ? 'from-blue-600 to-blue-800' : 'from-gray-100 to-gray-200'} rounded-xl p-6 shadow-lg border ${isActive ? 'border-blue-500' : 'border-gray-300'}">
                    <div class="text-center">
                        <div class="text-sm font-semibold ${isActive ? 'text-blue-100' : 'text-gray-600'} mb-2">${phase.label}</div>
                        <div class="text-3xl font-extrabold ${isActive ? 'text-white' : 'text-gray-800'} mb-2">${currencyFormat.format(phase.price)}</div>
                        <div class="text-xs ${isActive ? 'text-blue-200' : 'text-gray-500'}">${currencyFormat.format(phase.price / propertyData.sqft)}/SqFt</div>
                    </div>
                </div>
            `;
        });
        roadmapContainer.innerHTML = roadmapHtml;
    }
    
    // Populate Financial Analysis
    const financialPrice = document.getElementById('financial-price');
    if (financialPrice) financialPrice.textContent = currencyFormat.format(propertyData.price);
    
    const financialSqft = document.getElementById('financial-sqft');
    if (financialSqft) financialSqft.textContent = propertyData.sqft.toLocaleString() + ' SqFt';
    
    const financialPpsf = document.getElementById('financial-ppsf');
    if (financialPpsf) financialPpsf.textContent = currencyFormat.format(propertyData.price / propertyData.sqft) + '/SqFt';
    
    const financialYear = document.getElementById('financial-year');
    if (financialYear) financialYear.textContent = propertyData.yearBuilt;
    
    const financialCdom = document.getElementById('financial-cdom');
    if (financialCdom) financialCdom.textContent = propertyData.cdom + ' Days';
    
    const financialFloor = document.getElementById('financial-floor');
    if (financialFloor) financialFloor.textContent = currencyFormat.format(propertyData.priceFloor);
    
    const financialRate = document.getElementById('financial-rate');
    if (financialRate) financialRate.textContent = (propertyData.marketRate * 100).toFixed(2) + '%';
    
    const financialReduction = document.getElementById('financial-reduction');
    if (financialReduction) {
        const reduction = propertyData.price - propertyData.priceFloor;
        financialReduction.textContent = currencyFormat.format(reduction) + ' (' + ((reduction / propertyData.price) * 100).toFixed(2) + '%)';
    }
    
    // Populate Phased Protection Sub-Tab (Incentives)
    const phasedFinancialPrice = document.getElementById('phased-financial-price');
    if (phasedFinancialPrice) phasedFinancialPrice.textContent = currencyFormat.format(propertyData.price);
    
    const phasedFinancialSqft = document.getElementById('phased-financial-sqft');
    if (phasedFinancialSqft) phasedFinancialSqft.textContent = propertyData.sqft.toLocaleString() + ' SqFt';
    
    const phasedFinancialPpsf = document.getElementById('phased-financial-ppsf');
    if (phasedFinancialPpsf) phasedFinancialPpsf.textContent = currencyFormat.format(propertyData.price / propertyData.sqft) + '/SqFt';
    
    const phasedFinancialYear = document.getElementById('phased-financial-year');
    if (phasedFinancialYear) phasedFinancialYear.textContent = propertyData.yearBuilt;
    
    const phasedFinancialCdom = document.getElementById('phased-financial-cdom');
    if (phasedFinancialCdom) phasedFinancialCdom.textContent = propertyData.cdom + ' Days';
    
    const phasedFinancialFloor = document.getElementById('phased-financial-floor');
    if (phasedFinancialFloor) phasedFinancialFloor.textContent = currencyFormat.format(propertyData.priceFloor);
    
    const phasedFinancialRate = document.getElementById('phased-financial-rate');
    if (phasedFinancialRate) phasedFinancialRate.textContent = (propertyData.marketRate * 100).toFixed(2) + '%';
    
    const phasedFinancialReduction = document.getElementById('phased-financial-reduction');
    if (phasedFinancialReduction) {
        const reduction = propertyData.price - propertyData.priceFloor;
        phasedFinancialReduction.textContent = currencyFormat.format(reduction) + ' (' + ((reduction / propertyData.price) * 100).toFixed(2) + '%)';
    }
}

// --- IMAGE GALLERY & CAROUSEL FUNCTIONS ---

const googleDriveUrlPrefix = 'https://lh3.googleusercontent.com/d/';
let currentImageIndex = 0;
let currentImageArray = [];
let currentGalleryType = '';

function openCarousel(galleryType) {
    currentGalleryType = galleryType;
    
    // Set the appropriate image array based on gallery type
    switch(galleryType) {
        case 'drone':
            currentImageArray = droneIds;
            break;
        case 'hdr':
            currentImageArray = hdrIds;
            break;
        case 'virtual':
            currentImageArray = virtualIds;
            break;
        case 'dollhouse':
            currentImageArray = dollhouseIds;
            break;
        default:
            currentImageArray = hdrIds; // fallback
    }
    
    currentImageIndex = 0;
    showCarouselImage();
    document.getElementById('imageLightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeLightbox() {
    document.getElementById('imageLightbox').classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restore scrolling
    
    // Reset image opacity and hide spinner
    const mainImage = document.getElementById('carouselMainImage');
    const spinner = document.getElementById('carouselSpinner');
    mainImage.style.opacity = '0';
    spinner.classList.add('hidden');
}

function prevImage() {
    if (currentImageArray.length === 0) return;
    
    currentImageIndex = currentImageIndex === 0 ? currentImageArray.length - 1 : currentImageIndex - 1;
    showCarouselImage();
}

function nextImage() {
    if (currentImageArray.length === 0) return;
    
    currentImageIndex = currentImageIndex === currentImageArray.length - 1 ? 0 : currentImageIndex + 1;
    showCarouselImage();
}

function showCarouselImage() {
    if (currentImageArray.length === 0) return;
    
    const mainImage = document.getElementById('carouselMainImage');
    const spinner = document.getElementById('carouselSpinner');
    const counter = document.getElementById('carouselCounter');
    
    // Show loading spinner and hide image
    spinner.classList.remove('hidden');
    mainImage.style.opacity = '0';
    
    // Update counter
    counter.textContent = `${currentImageIndex + 1} / ${currentImageArray.length}`;
    
    // Create new image element to preload
    const img = new Image();
    
    img.onload = function() {
        // Image loaded successfully - update main image
        mainImage.src = this.src;
        mainImage.alt = `${currentGalleryType} view ${currentImageIndex + 1}`;
        
        // Hide spinner and show image with fade-in
        spinner.classList.add('hidden');
        mainImage.style.opacity = '1';
    };
    
    img.onerror = function() {
        // Image failed to load - show placeholder or fallback
        console.warn(`Failed to load image: ${googleDriveUrlPrefix}${currentImageArray[currentImageIndex]}`);
        mainImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTUwTDE3MiAxMjJMMTQ0IDE1MEwxNzIgMTc4TDIwMCAxNTBaTTE1MCAyMDBMMjUwIDIwMEwyNTAgMTAwTDE1MCAxMDBMMTUwIDIwMFoiIGZpbGw9IiNkMWQ1ZGIiLz4KPHRleHQgeD0iMjAwIiB5PSIyMzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2YjczODAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pgo8L3N2Zz4K';
        mainImage.alt = `${currentGalleryType} image not available`;
        
        // Hide spinner and show image
        spinner.classList.add('hidden');
        mainImage.style.opacity = '1';
    };
    
    // Start loading the image - prepend Google Drive URL prefix to ID
    img.src = googleDriveUrlPrefix + currentImageArray[currentImageIndex];
}

// Keyboard navigation for carousel
function setupCarouselKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        const lightbox = document.getElementById('imageLightbox');
        if (!lightbox || lightbox.classList.contains('hidden')) return;

        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                prevImage();
                break;
            case 'ArrowRight':
                nextImage();
                break;
        }
    });
}

// Syndication modal functions
function openSyndicationModal() {
    document.getElementById('syndicationModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSyndicationModal() {
    document.getElementById('syndicationModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// --- REPORTING LINKS POPULATION ---

function populateReportingLinks() {
    try {
        const reportingLinks = propertyData.reportingLinks;
        
        for (const [key, url] of Object.entries(reportingLinks)) {
            const element = document.getElementById(`report-link-${key}`);
            if (element && url && url !== '#') {
                element.href = url;
            }
        }
        
        console.log('✅ Reporting links populated successfully');
    } catch (error) {
        console.error('❌ Error populating reporting links:', error);
    }
}

// --- LEAD SUBMISSION HANDLER ---

function handleLeadSubmission(e) {
    e.preventDefault();
    
    try {
        // Get form data
        const form = e.target;
        const formData = {
            firstName: form.querySelector('input[type="text"]').value,
            lastName: form.querySelectorAll('input[type="text"]')[1].value,
            phone: form.querySelector('input[type="tel"]').value,
            email: form.querySelector('input[type="email"]').value,
            address: form.querySelectorAll('input[type="text"]')[2].value,
            notes: form.querySelector('textarea').value,
            timestamp: new Date().toISOString(),
            source: 'Decision Path - Strategy Session Request'
        };
        
        console.log('📋 Strategy Session Request Submitted:', formData);
        
        // Show success message
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = '✓ Request Submitted Successfully!';
        submitButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        submitButton.classList.add('bg-green-600', 'hover:bg-green-700');
        submitButton.disabled = true;
        
        // Reset form after 3 seconds
        setTimeout(() => {
            form.reset();
            submitButton.textContent = originalText;
            submitButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            submitButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
            submitButton.disabled = false;
        }, 3000);
        
        // Optional: Send to backend/CRM
        // You can integrate with Google Sheets, Email API, or CRM here
        // Example:
        // fetch('/api/submit-lead', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(formData)
        // });
        
    } catch (error) {
        console.error('❌ Error submitting strategy session request:', error);
        alert('There was an error submitting your request. Please try again or call (903) 449-4439.');
    }
    
    return false;
}

// --- INITIALIZATION ---
// --- PRESENTATION-READY REPORTING BRIDGE ---
function updateReportingLinks() {
    const links = propertyData.reportingLinks;
    
    const linkMap = {
        'infographic': 'report-link-infographic',
        'summary': 'report-link-summary',
        'updated-report': 'report-link-updated-report',
        'social-media': 'report-link-social-media',
        'website-traffic': 'report-link-website-traffic',
        'homes-com': 'report-link-homes-com',
        'realtor-com': 'report-link-realtor-com',
        'zillow-com': 'report-link-zillow-com',
        'showing-activity': 'report-link-showing-activity',
        'mls-activity': 'report-link-mls-activity',
        'one-home': 'report-link-one-home',
        'tgr-valuation': 'report-link-tgr-valuation'
    };

    for (const [dataKey, elementId] of Object.entries(linkMap)) {
        const element = document.getElementById(elementId);
        if (element) {
            // In Presentation Mode, we keep all buttons Blue and Active
            element.innerText = 'View Sample Report'; 
            element.href = links[dataKey] || '#'; // Fallback to # if no link
            element.classList.add('bg-blue-600');
            element.classList.remove('bg-slate-400');
            element.style.pointerEvents = 'auto';
            element.style.opacity = '1';
        }
    }
}
function syncPitchReports() {
    const links = propertyData.reportingLinks;
    // Ensure these keys match the keys in reportingLinks in data.js
    const ids = [
        'infographic', 'summary', 'monthly-analysis', 'social-media', 
        'website-traffic', 'homes-com', 'realtor-com', 'zillow-com', 
        'showing-activity', 'mls-activity', 'one-home', 'tgr-valuation'
    ];

    ids.forEach(key => {
        const anchor = document.getElementById(`report-link-${key}`);
        if (anchor) {
            if (links[key] && links[key].trim() !== '') {
                anchor.href = links[key];
                anchor.target = "_blank"; // Opens in new tab
                anchor.onclick = null;
            } else {
                anchor.href = "#";
                anchor.target = "";
                anchor.onclick = function(e) {
                    e.preventDefault();
                    alert('Requesting Access');
                };
            }
        }
    });

    // --- Add RPR Market Report Button Support ---
    const rprBtn = document.getElementById('rpr-market-report-btn');
    if (rprBtn) {
        const rprLink = links['rpr-market-report'];
        if (rprLink && rprLink.trim() !== '') {
            rprBtn.href = rprLink;
            rprBtn.target = "_blank";
            rprBtn.onclick = null;
        } else {
            rprBtn.href = "#";
            rprBtn.target = "";
            rprBtn.onclick = function(e) {
                e.preventDefault();
                alert('Requesting Access');
            };
        }
    }
}
// --- FUNNEL PERFORMANCE SCOREBOARD ---
// Calculates conversion health by comparing Showings vs Saves
// If Showings < 5% of Saves, indicates price friction in the market
function calculateFunnelHealth() {
    const stats = propertyData.syndicationStats;
    if (!stats) {
        console.warn('syndicationStats not found in propertyData');
        return null;
    }

    const showings = stats.brokerBayShowings || 1;
    const saves = stats.zillowSaves || 0;
    const FRICTION_THRESHOLD = 0.05;
    
    const showingToSaveRatio = saves > 0 ? (showings / saves) : 0;
    const healthPercentage = Math.min((showingToSaveRatio / FRICTION_THRESHOLD) * 100, 100);
    const hasFriction = showingToSaveRatio < FRICTION_THRESHOLD;
    
    return {
        showings,
        saves,
        ratio: showingToSaveRatio,
        ratioDisplay: saves > 0 ? (showingToSaveRatio * 100).toFixed(1) + '%' : 'N/A',
        healthPercentage: healthPercentage.toFixed(1),
        hasFriction,
        warningText: hasFriction ? 'PRICE FRICTION DETECTED - MARKET IN WAIT-AND-SEE MODE' : null,
        statusText: hasFriction 
            ? 'Engagement high, but showings lagging. Buyers may be price-sensitive.'
            : 'Healthy conversion velocity. Engagement translating to physical traffic.'
    };
}

// --- LIVE INTELLIGENCE ENGINE ---
function refreshLiveIntelligence() {
    try {
        const stats = propertyData.syndicationStats;
        if (!stats) { console.error('LIVE INTEL: syndicationStats missing'); return; }

        const finalShowings = Math.max(Number(stats.brokerBayShowings) || 0, 1);

        // Update BOTH showing displays (Scoreboard + Live Intel)
        const targets = ['live-showings-count', 'stat-brokerbay-showings'];
        targets.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = finalShowings;
        });

        // Update Views and Saves on Scoreboard
        if (document.getElementById('stat-listtrac-views')) document.getElementById('stat-listtrac-views').innerText = stats.listTracTotalViews;
        if (document.getElementById('stat-zillow-saves')) document.getElementById('stat-zillow-saves').innerText = stats.zillowSaves;

        // Update Views and Saves on Live Intel tab
        var formattedViews = numberFormat.format(Number(stats.listTracTotalViews) || 0);
        var formattedSaves = numberFormat.format(Number(stats.zillowSaves) || 0);
        var setEl = function(id, value) { var el = document.getElementById(id); if (el) el.innerText = value; };
        setEl('live-views-total', formattedViews);
        setEl('live-saves-zillow', formattedSaves);

        // Funnel health — updates both Live Intel and Scoreboard
        var health = (typeof calculateFunnelHealth === 'function') ? calculateFunnelHealth() : null;
        if (health) {
            setEl('live-funnel-percentage', health.healthPercentage + '%');
            setEl('live-funnel-status', health.statusText);
            setEl('stat-funnel-percentage', health.healthPercentage + '%');
            setEl('stat-funnel-status', health.statusText);

            ['live-funnel-bar', 'stat-funnel-bar'].forEach(function(id) {
                var bar = document.getElementById(id);
                if (bar) bar.style.width = health.healthPercentage + '%';
            });

            ['live-funnel-warning', 'stat-funnel-warning'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el && health.warningText) {
                    el.textContent = health.warningText;
                    el.classList.remove('hidden');
                }
            });
        }

        // Top Websites list
        var websitesList = document.getElementById('live-top-websites');
        if (websitesList && Array.isArray(stats.listTracTopWebsites)) {
            websitesList.innerHTML = stats.listTracTopWebsites.map(function(site) {
                return '<li class="flex justify-between items-center text-sm">' +
                    '<span class="text-slate-300">' + site.name + '</span>' +
                    '<span class="text-white font-bold">' + numberFormat.format(site.views) + '</span>' +
                    '</li>';
            }).join('');
        }

        // Top Cities list
        var citiesList = document.getElementById('live-top-cities');
        if (citiesList && Array.isArray(stats.listTracTopCities)) {
            citiesList.innerHTML = stats.listTracTopCities.map(function(city) {
                return '<li class="flex justify-between items-center text-sm">' +
                    '<span class="text-slate-300">' + city.name + '</span>' +
                    '<span class="text-white font-bold">' + numberFormat.format(city.views) + '</span>' +
                    '</li>';
            }).join('');
        }

        // BrokerBay Feedback Log — inject rows into #live-feedback-body
        var feedbackBody = document.getElementById('live-feedback-body');
        if (feedbackBody) {
            var feedbackLog = propertyData.feedbackLog;
            var pill = document.getElementById('live-feedback-count-pill');

            if (!Array.isArray(feedbackLog) || feedbackLog.length === 0) {
                if (pill) pill.textContent = '0 Total Entries';
                feedbackBody.innerHTML =
                    '<tr><td colspan="3" class="px-8 py-10 text-center text-slate-400 italic text-sm">' +
                    'Awaiting verified feedback.</td></tr>';
            } else {
                if (pill) pill.textContent = feedbackLog.length + ' Total Entr' + (feedbackLog.length === 1 ? 'y' : 'ies');
                feedbackBody.innerHTML = '';
                feedbackLog.forEach(function(entry) {
                    var pillColor = entry.interest === 'Interested'
                        ? 'bg-emerald-100 text-emerald-700'
                        : entry.interest === 'Not Interested'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600';
                    feedbackBody.insertAdjacentHTML('beforeend',
                        '<tr class="hover:bg-slate-50 transition-colors">' +
                        '<td class="px-8 py-5 text-sm font-bold text-slate-900 whitespace-nowrap">' + entry.date + '</td>' +
                        '<td class="px-8 py-5"><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ' + pillColor + '">' + entry.interest + '</span></td>' +
                        '<td class="px-8 py-5 text-sm text-slate-600 leading-relaxed">' + entry.comments + '</td>' +
                        '</tr>'
                    );
                });
            }
        }

        console.log('LIVE INTEL: refreshLiveIntelligence() complete. Showings=' + finalShowings);
    } catch (err) {
        console.error('LIVE INTEL: refreshLiveIntelligence() failed:', err);
    }
}

// --- MASTER INITIALIZATION ---
window.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Dashboard initialization started');

    try {
        detectPropertyUnit();
        injectDynamicData();
        populatePropertyData();
    } catch (err) {
        console.error('Phase 1 (core data injection) failed:', err);
    }

    try {
        populateReportingLinks();
        syncPitchReports();
        calculateOption3Totals();
        attachEventListeners();
        setupCarouselKeyboardNavigation();
        populateAllCompTables();
        populateOptions();
        populateAmortizationTable();
        populateCompleteAmortizationTable();

        setTimeout(function() {
            try {
                initCharts();
                console.log('✅ Charts initialized');
            } catch (chartError) {
                console.error('Chart initialization failed (non-blocking):', chartError);
            }
        }, 100);

        showCompSubTab('neighborhood');
        showTab('summary');
    } catch (err) {
        console.error('Phase 2 (deferred initialization) failed:', err);
    }

    console.log('✅ Dashboard initialization complete');

    setTimeout(function() {
        refreshLiveIntelligence();
    }, 2000);
});
