// Vercel Serverless Function: Real-Time Official MT5 Broker & Server Search
// Queries MetaQuotes MT5 global registry via MetaApi Cloud Gateway
// URL: /api/portal/servers?query=brokerName

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_METAAPI_TOKEN = "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIxYzBlNDdiYTcxNTc1YjQ4N2M1ZGJjNzhjODU5NDFkNiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoibXQtbWFuYWdlci1hcGkiLCJtZXRob2RzIjpbIm10LW1hbmFnZXItYXBpOnJlc3Q6ZGVhbGluZzoqOioiLCJtdC1tYW5hZ2VyLWFwaTpyZXN0OnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJiaWxsaW5nLWFwaSIsIm1ldGhvZHMiOlsiYmlsbGluZy1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiMWMwZTQ3YmE3MTU3NWI0ODdjNWRiYzc4Yzg1OTQxZDYiLCJpYXQiOjE3ODg2MjMwODgsImV4cCI6MTgyMDA5Nzg4OH0.ZoXg1DudAvRQ9RuD1CQLHbYdVm2HTHp5bQQLyRrNNpK5XoWtMl5jn38OCH-lcKRx7-dyIIV4H28K3UEnCeFl_kFmMzTA5Oc_XlxqN4asFDouXyIZyHILSzNw0RaCWaLkDUlwRhGDyjparmcYxzkb7hEVmkRCH7yVbQkr43USrEQUacHkqCtXMsg4XrPPTMH0pOnzcEyTtiECyV1s1BKPQcLgjqzHSR1Vcbpv9FUOojPuVAuVg-mZ0DJSBA7fcuGSuzKdJUpp-n-UBkXPFLJD3tLZsU6-0t_TM1mNyITcC0KcSGP5UGnIOlFfsRMaPuVsLNph6TEO08OTUDNV-esGUpe0X3nptjy216CX6icL_sxZHQXKZ3ee6xF-t5jliPZeuFz5uR6IIANxdoMCUP1x1L5L7_ILs98fsVrrMMnvnYFQ6VAjijc-HgAwDkC6BdUc8xrODB8Ibn92B7UG_Zy8XDzhubIKI1f3kj1kuvIwzCt7cnWiaXtXm5I1ueH9hsEzYGgSKG7UV8oXsZIvECNQUpkSTSdmgwyaq_EhmflQCl-YvFKpLVnGSHqMezwQB-Ewkn3xhiTjhzJRLbPyx5YEI47fTIpoMWfcJvhDFRQIDATe5zalUJ642Ua_lJ4D-5IQS8wdPAxClmdP1FTfGnPYwu18OQ7hJkGShhXH8PIOeHY";

const searchCache = new Map();

function getMetaApiToken() {
    if (process.env.METAAPI_TOKEN) return process.env.METAAPI_TOKEN;
    return DEFAULT_METAAPI_TOKEN;
}

function fetchMetaApiServers(query, token) {
    return new Promise((resolve) => {
        const encodedQuery = encodeURIComponent(query);
        const options = {
            hostname: 'mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai',
            port: 443,
            path: '/known-mt-servers/5/search?query=' + encodedQuery,
            method: 'GET',
            headers: {
                'auth-token': token,
                'Accept': 'application/json'
            },
            rejectUnauthorized: false,
            timeout: 8000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: {} });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 504, data: {} });
        });

        req.on('error', (err) => {
            resolve({ status: 500, error: err.message, data: {} });
        });

        req.end();
    });
}

// Built-in registry of 183 official broker companies from MetaQuotes
const BUILTIN_BROKERS_MAP = {
  "InterStellar Financial Group Limited": [
    "InterStellarFinancial-Server"
  ],
  "WeTrade International LLC": [
    "WeTrade-MT5"
  ],
  "FBS Markets Inc.": [
    "FBS-Demo",
    "FBS-Real"
  ],
  "Tradestone Limited": [
    "FBSTradestone-EU",
    "FBSTradestone-Demo-01",
    "FBSTradestone-Demo",
    "FBSTradestone-Real"
  ],
  "FBS Trading (Seychelles) Ltd.": [
    "FBSTradingSeychelles-Demo",
    "FBSTradingSeychelles-Real"
  ],
  "HF Markets Ltd": [
    "HFMarkets-Live1"
  ],
  "HF Markets SA (Pty) Ltd": [
    "HFMarketsSA-Live1"
  ],
  "HF Markets (Seychelles) Ltd.": [
    "HFMarketsSC-Live1"
  ],
  "HF Markets (SV) Ltd.": [
    "HFMarketsGlobal-Live1"
  ],
  "Intelligent Financial Markets Pty Ltd": [
    "FBSOceania-Demo",
    "FBSOceania-Real"
  ],
  "Octa Markets Incorporated": [
    "OctaFX-Real",
    "OctaFX-Demo",
    "OctaFX-Real2"
  ],
  "Octa Markets Ltd": [
    "OctaMarkets-Real",
    "OctaMarkets-Demo"
  ],
  "Broctagon Prime Ltd": [
    "BroctagonPrimeLtd-Live"
  ],
  "Octa Markets Cyprus Ltd": [
    "OctaCy-Demo",
    "OctaCy-Real"
  ],
  "PT. Octa Investama Berjangka": [
    "OctaInvestama2-Server"
  ],
  "Broctagon Prime Markets Limited": [
    "BroctagonPrimeMarkets-Demo",
    "BroctagonPrimeMarkets-Live"
  ],
  "Elev8 Markets Ltd.": [
    "Elev8-Real2"
  ],
  "Octrado Ltd.": [
    "Octrado-Live"
  ],
  "Noctorial Ltd.": [
    "Noctorial-Trade"
  ],
  "2VoC Assets": [
    "2VoCAssets-Trade"
  ],
  "Exness B.V.": [
    "ExnessBV-MT5Real14",
    "ExnessBV-MT5Real11",
    "ExnessBV-MT5Real12",
    "ExnessBV-MT5Real10",
    "ExnessBV-MT5Real7",
    "ExnessBV-MT5Trial2",
    "ExnessBV-MT5Real4",
    "ExnessBV-MT5Trial5",
    "ExnessBV-MT5Real15",
    "ExnessBV-MT5Real9"
  ],
  "Exness Technologies Ltd": [
    "Exness-MT5Real14",
    "Exness-MT5Real7",
    "Exness-MT5Real10",
    "Exness-MT5Trial",
    "Exness-MT5Trial12",
    "Exness-MT5Real8",
    "Exness-MT5Trial9",
    "Exness-MT5Trial11",
    "Exness-MT5Real3",
    "Exness-MT5Trial5"
  ],
  "Exness (SC) Ltd": [
    "ExnessSC-MT5Real14",
    "ExnessSC-MT5Real11",
    "ExnessSC-MT5Real12",
    "ExnessSC-MT5Real10",
    "ExnessSC-MT5Real7",
    "ExnessSC-MT5Trial2",
    "ExnessSC-MT5Real4",
    "ExnessSC-MT5Trial5",
    "ExnessSC-MT5Real15",
    "ExnessSC-MT5Real9"
  ],
  "Exness (VG) Ltd": [
    "ExnessVG-MT5Real14",
    "ExnessVG-MT5Real11",
    "ExnessVG-MT5Real12",
    "ExnessVG-MT5Real10",
    "ExnessVG-MT5Real7",
    "ExnessVG-MT5Trial2",
    "ExnessVG-MT5Real4",
    "ExnessVG-MT5Trial5",
    "ExnessVG-MT5Real15",
    "ExnessVG-MT5Real9"
  ],
  "Exness (MU) Ltd": [
    "ExnessMU-MT5Real14",
    "ExnessMU-MT5Real",
    "ExnessMU-MT5Real10",
    "ExnessMU-MT5Real11",
    "ExnessMU-MT5Real12",
    "ExnessMU-MT5Real15",
    "ExnessMU-MT5Real3",
    "ExnessMU-MT5Real2",
    "ExnessMU-MT5Real4",
    "ExnessMU-MT5Real5"
  ],
  "Exness (UK) Ltd": [
    "ExnessUK-LP_Real1",
    "ExnessUK-Demo"
  ],
  "Exness (CY) Ltd": [
    "ExnessCY-Demo",
    "ExnessCY-LP_Real1"
  ],
  "Exness (KE) Limited": [
    "ExnessKE-MT5Trial4",
    "ExnessKE-MT5Real10",
    "ExnessKE-MT5Trial9",
    "ExnessKE-MT5Real4",
    "ExnessKE-MT5Trial10",
    "ExnessKE-MT5Real9",
    "ExnessKE-MT5Real21"
  ],
  "Exness Investment Bank Limited": [
    "ExnessInvestmentBank-MT5Trial",
    "ExnessInvestmentBankLtd-Demo",
    "ExnessInvestmentBankLtd-LP_Real1"
  ],
  "Exness Limited Jordan LLC": [
    "ExnessJO-MT5Real2",
    "ExnessJO-MT5Trial2",
    "ExnessJO-MT5Real35",
    "ExnessJO-MT5Trial16"
  ],
  "FundedNext Ltd": [
    "FundedNext-Server",
    "FundedNext-Server 2",
    "FundedNext-Server 3"
  ],
  "FundedVerse Ltd.": [
    "FundedVerse-Server"
  ],
  "Fundedelite Ltd.": [
    "Fundedelite-Server"
  ],
  "XFunded Ltd.": [
    "XFunded-Trade"
  ],
  "Vegafunded Ltd.": [
    "Vegafunded-Trade"
  ],
  "Funded Trader Markets Ltd.": [
    "FundedTraderMarkets-Server"
  ],
  "Funded Trading Plus Ltd.": [
    "FundedTradingPlus-Live"
  ],
  "Funded7 Ltd.": [
    "Funded7-Funded7"
  ],
  "Funded IQ LLC": [
    "FundedIQ-Trade"
  ],
  "DNA Funded Ltd.": [
    "DNAFundedLtd-MT5"
  ],
  "FTMO Global Markets Ltd": [
    "FTMO-Demo2",
    "FTMO-Server",
    "FTMO-Demo",
    "FTMO-Server2",
    "FTMO-Server3",
    "FTMO-Server4",
    "FTMO-Server5"
  ],
  "OANDA Corporation": [
    "OANDA-Prop Trader"
  ],
  "Atmos Global Ltd": [
    "AtmosGlobal-LIVE"
  ],
  "FT Worldwide Investments Limited": [
    "FTWorldwide-trade-uat",
    "FTWorldwide-MainTrade"
  ],
  "Shift Markets Group Inc.": [
    "ShiftMarkets-Live",
    "ShiftMarkets-Demo"
  ],
  "Swyft Markets South Africa (Pty) Ltd": [
    "SwyftMarkets-Live"
  ],
  "IC Markets Ltd": [
    "ICMarketsInternational-Demo",
    "ICMarketsInternational-MT5-2",
    "ICMarketsInternational-MT5",
    "ICMarketsInternational-MT5-4"
  ],
  "IC Markets Group Ltd": [
    "ICMarketsGRP-MT5",
    "ICMarketsGRP-Demo"
  ],
  "IC Markets (KE) Limited": [
    "ICMarketsKE-MT5-7",
    "ICMarketsKE-Demo"
  ],
  "IC Markets (EU) Ltd": [
    "ICMarketsEU-Demo",
    "ICMarketsEU-MT5-5"
  ],
  "CWG Markets Limited": [
    "CWGMarketsUK-Live",
    "CWGMarketsUK-Demo"
  ],
  "CMC Markets Plc": [
    "CMCMarkets-MT5-DEMO",
    "CMCMarkets-MT5-LIVE"
  ],
  "CWG Markets Ltd.": [
    "CWGMarketsSVG-Live",
    "CWGMarketsSVG-Demo"
  ],
  "No Limit Markets Ltd.": [
    "NoLimitMarkets-Live"
  ],
  "TIO Markets Ltd.": [
    "TIOMarkets-Demo1",
    "TIOMarkets-Live1"
  ],
  "TIO Markets UK Limited": [
    "TIOMarketsUK-Demo1",
    "TIOMarketsUK-Live1"
  ],
  "Deriv.com Limited": [
    "Deriv-Server",
    "Deriv-Server-03",
    "Deriv-Server-02",
    "Deriv-Demo",
    "DerivTest-Dev Demo"
  ],
  "Deriv (BVI) Ltd.": [
    "DerivBVI-Server",
    "DerivBVI-Server-03",
    "DerivBVI-Server-02",
    "DerivBVI-Demo"
  ],
  "Deriv (V) Ltd": [
    "DerivVU-Server",
    "DerivVU-Server-03",
    "DerivVU-Server-02",
    "DerivVU-Demo"
  ],
  "Deriv (FX) Ltd": [
    "DerivFX-Server",
    "DerivFX-Server-03",
    "DerivFX-Server-02",
    "DerivFX-Demo"
  ],
  "Deriv (SVG) LLC": [
    "DerivSVG-Server",
    "DerivSVG-Server-03",
    "DerivSVG-Server-02",
    "DerivSVG-Demo"
  ],
  "Deriv (Mauritius) Ltd": [
    "DerivMU-Server",
    "DerivMU-Server-03",
    "DerivMU-Server-02",
    "DerivMU-Demo"
  ],
  "Deriv Investments (Europe) Limited": [
    "DerivMT-Server",
    "DerivMT-Server-03",
    "DerivMT-Server-02",
    "DerivMT-Demo"
  ],
  "Deriv Investments (Cayman) Limited": [
    "DerivKY-Server",
    "DerivKY-Server-03",
    "DerivKY-Server-02",
    "DerivKY-Demo"
  ],
  "Deriv Capital Contracts and Currencies L.L.C": [
    "DerivUAE-Server",
    "DerivUAE-Server-03",
    "DerivUAE-Server-02",
    "DerivUAE-Demo"
  ],
  "River Prime Limited": [
    "RiverPrimeLimited-Server",
    "RiverPrimeLimited-Demo"
  ],
  "Pepperstone GmbH": [
    "PepperstoneGmbH-Demo",
    "PepperstoneGmbH-Live"
  ],
  "Pepperstone Limited": [
    "PepperstoneUK-Demo",
    "PepperstoneUK-Live"
  ],
  "Pepperstone Markets Limited": [
    "PepperstoneBS-Demo",
    "PepperstoneBS-MT5-Live01"
  ],
  "Pepperstone EU Limited": [
    "PepperstoneEU-Demo",
    "PepperstoneEU-Live"
  ],
  "Pepperstone Group Limited": [
    "Pepperstone-Demo",
    "Pepperstone-MT5-Live01"
  ],
  "Pepperstone Financial Services L.L.C": [
    "PepperstoneFinancialUAE-Demo",
    "PepperstoneFinancialUAE-MT5-Live01"
  ],
  "Pepperstone Financial Markets Limited": [
    "PepperstoneMU-Demo",
    "PepperstoneMU-MT5-Live01"
  ],
  "Pepperstone Markets Kenya Limited": [
    "PepperstoneKE-Demo",
    "PepperstoneKE-MT5-Live01"
  ],
  "Pepperstone Financial Services (DIFC) Limited": [
    "PepperstoneUAE-Demo",
    "PepperstoneUAE-MT5-Live01"
  ],
  "Pipstone Capital Ltd.": [
    "PipstoneCapital-Server"
  ],
  "XMAX Markets Limited": [
    "XmaxMarkets-Live"
  ],
  "XM Global Limited": [
    "XMGlobal-MT5",
    "XMGlobal-MT5 4",
    "XMGlobal-MT5 2",
    "XMGlobal-MT5 5",
    "XMGlobal-MT5 6",
    "XMGlobal-MT5 8",
    "XMGlobal-MT5 7",
    "XMGlobal-MT5 9",
    "XMGlobal-MT5 10",
    "XMGlobal-MT5 11"
  ],
  "XM International MU Limited": [
    "XMGlobalMU-MT5",
    "XMGlobalMU-MT5 4",
    "XMGlobalMU-MT5 6",
    "XMGlobalMU-MT5 2"
  ],
  "XM (SC) Limited": [
    "XMGlobalSC-MT5 16",
    "XMGlobalSC-MT5 4",
    "XMGlobalSC-MT5 5",
    "XMGlobalSC-MT5 6"
  ],
  "XM (BVI) Limited": [
    "XMGlobalBVI-MT5 2",
    "XMGlobalBVI-MT5 4",
    "XMGlobalBVI-MT5 16",
    "XMGlobalBVI-MT5 10",
    "XMGlobalBVI-MT5 9",
    "XMGlobalBVI-MT5 18"
  ],
  "XM ZA (Pty) Ltd": [
    "XMZA-MT5 15",
    "XMZA-MT5 16",
    "XMZA-MT5 2",
    "XMZA-MT5 4"
  ],
  "CXM Direct LLC": [
    "CXMDirect-Demo",
    "CXMDirect-Live"
  ],
  "CXM Trading LLC": [
    "CXMTrading-Primary",
    "CXMTrading-Demo",
    "CXMTrading-Live"
  ],
  "TPXMGlobal Kenya Limited": [
    "XMGlobalKE-MT5 16",
    "XMGlobalKE-MT5 2",
    "XMGlobalKE-MT5 4"
  ],
  "CXM Group (SC) Ltd": [
    "CXM-Primary",
    "CXM-Demo",
    "CXM-Live"
  ],
  "FundingPips Corp": [
    "FundingPips-SIM1",
    "FundingPips-Prime",
    "FundingPips-SIM",
    "FundingPips-Trial"
  ],
  "FundingPips Corp (2)": [
    "FundingPips2-SIM"
  ],
  "NG Funding Ltd.": [
    "NGFunding-Trade"
  ],
  "OFP Funding Ltd.": [
    "OFPFunding-Trade"
  ],
  "Funding Traders Group Ltd.": [
    "FundingTradersGroup-Server"
  ],
  "Dominion Funding Limited": [
    "DominionFunding-Server"
  ],
  "TX3 Funding Global Ltd.": [
    "TX3FundingGlobal-Server"
  ],
  "RoboForex Ltd": [
    "RoboForex-Pro",
    "RoboForex-ECN"
  ],
  "RannForex Limited": [
    "RannForex-Server"
  ],
  "Raw Forex Ltd.": [
    "RawForex-Live"
  ],
  "Icare Forex Limited": [
    "IcareForex-Server"
  ],
  "Trader One Forex Ltd.": [
    "TraderOneForex-Live"
  ],
  "\u041e\u041e\u041e \u0412\u0422\u0411 \u0424\u043e\u0440\u0435\u043a\u0441": [
    "VTBForex-Core"
  ],
  "ABH Forex Ltd": [
    "ABHForex-STP",
    "ABHForex-Server7"
  ],
  "Como Foreign Exchange Trading Ltd": [
    "ComoForeignExchange-Server"
  ],
  "Riston Capital Ltd.": [
    "FreshForex-MT5"
  ],
  "HFM Investments Ltd": [
    "HFMarketsKE-Live10",
    "HFMarketsKE-Live11",
    "HFMarketsKE-Live15",
    "HFMarketsKE-Demo5",
    "HFMarketsKE-Live2",
    "HFMarketsKE-Demo2",
    "HFMarketsKE-Live20"
  ],
  "HF Markets (Europe) Ltd": [
    "HFMarketsEurope-Live6"
  ],
  "HF Markets (DIFC) Limited": [
    "HFMarketsMENA-Live2",
    "HFMarketsMENA-Demo2"
  ],
  "HF Markets (UK) Limited": [
    "HFMarketsUK-Live2",
    "HFMarketsUK-Demo2"
  ],
  "WSFmarkets Ltd.": [
    "WSFmarkets-Server"
  ],
  "Chimara Ltd": [
    "Chimara-SRV01"
  ],
  "JT Markets Ltd": [
    "JTMarkets-Trade"
  ],
  "JustMarkets Ltd": [
    "JustMarketsCY-Live",
    "JustMarketsCY-Demo"
  ],
  "Just Global Markets Ltd.": [
    "JustMarkets-Live",
    "JustMarkets-Demo",
    "JustMarkets-Live2",
    "JustMarkets-Demo2",
    "JustMarkets-Live3",
    "JustMarkets-Demo3",
    "JustMarkets-Live6",
    "JustMarkets-LIVE7"
  ],
  "Aurum Markets Limited": [
    "AurumMarkets-Demo",
    "AurumMarkets-Live"
  ],
  "JinTrust Markets Limited": [
    "JinTrustMarkets-Live"
  ],
  "VaultMarkets (Pty) Ltd": [
    "VaultMarkets-Live"
  ],
  "Altus Markets Limited": [
    "AltusMarkets-Server"
  ],
  "Focus Markets Ltd.": [
    "FocusMarkets-MT5-2"
  ],
  "IST Markets LTD": [
    "ISTMarkets-Live"
  ],
  "Juno Markets Limited": [
    "JunoMarkets-Live"
  ],
  "Vantage Trading Ltd": [
    "VantageTradingLtd-Demo",
    "VantageTradingLtd-Live",
    "VantageTradingLtd-Live 2"
  ],
  "Vantage FX Pty Ltd.": [
    "VantageFX-Live",
    "VantageFX-Demo",
    "VantageFX-Live 4",
    "VantageFX-Live 6",
    "VantageFX-Live 11",
    "VantageFX-Live 13",
    "VantageFX-Live 10",
    "VantageFX-Live 5",
    "VantageFX-Live 14"
  ],
  "Vantage International Group Limited": [
    "VantageInternational-Demo",
    "VantageInternational-Live",
    "VantageInternational-Live 2",
    "VantageInternational-Live 9",
    "VantageInternational-Live 12",
    "VantageInternational-Live 17",
    "VantageInternational-Live 11",
    "VantageInternational-Live 3",
    "VantageInternational-Live 13",
    "VantageInternational-Live 6"
  ],
  "Vantage Global Prime LLP": [
    "VantageGlobalPrimeLLP-Live",
    "VantageGlobalPrimeLLP-Demo",
    "VantageGlobalPrimeLLP-Live 2"
  ],
  "Vantage Markets (Pty) Ltd": [
    "VantageMarkets-Demo",
    "VantageMarkets-Live",
    "VantageMarkets-Live 10",
    "VantageMarkets-Live 11",
    "VantageMarkets-Live 12",
    "VantageMarkets-Live 13",
    "VantageMarkets-Live 14",
    "VantageMarkets-Live 15",
    "VantageMarkets-Live 17",
    "VantageMarkets-Live 19"
  ],
  "Vantage Global Prime Pty Ltd": [
    "VantageGlobalPrimeAU-Demo",
    "VantageGlobalPrimeAU-Live"
  ],
  "PT. Vantage Markets Futures": [
    "VantageMarketsFutures-Demo",
    "VantageMarketsFutures-Live"
  ],
  "VIG Group Ltd.": [
    "VantageMarketsMU-Live",
    "VantageMarketsMU-Demo"
  ],
  "Levante Markets Ltd.": [
    "LevanteMarkets-Real",
    "LevanteMarkets-Server"
  ],
  "ISEC Wealth Management Ltd": [
    "ISECWealthManagement-Real"
  ],
  "FP Markets Ltd.": [
    "FPMarkets-Live2",
    "FPMarkets-Demo2",
    "FPMarketsLtd-Demo2",
    "FPMarketsLtd-Live2"
  ],
  "FP Markets LLC": [
    "FPMarketsLLC-Demo",
    "FPMarketsLLC-Live"
  ],
  "FP Markets Limited": [
    "FPMarketsKE-Demo",
    "FPMarketsKE-Live",
    "FPMarketsKE-Demo2",
    "FPMarketsKE-Live2"
  ],
  "VG Markets (Pty) Ltd": [
    "VGMarkets-Trade"
  ],
  "Coral Markets Limited": [
    "CoralMarkets-Server"
  ],
  "AP Markets Ltd.": [
    "APMarkets-Server"
  ],
  "Hantec Markets Limited": [
    "HantecMarketsUK-MT5"
  ],
  "FxPro Markets Ltd.": [
    "FxPro-MT5",
    "FxPro-MT5 Live03",
    "FxPro-MT5 Live02",
    "FxPro-MT5 Demo"
  ],
  "FXPRO Global Markets Ltd.": [
    "FxPro.Global-MT5 Live02"
  ],
  "EFX Pro Limited": [
    "EFXPro-Live"
  ],
  "bxpro Ltd.": [
    "bxpro-Trade"
  ],
  "IF Pro Ltd.": [
    "IFPro-Trade"
  ],
  "Oro Fintech Limited": [
    "FXOroGlobal-Trade"
  ],
  "Growell Capital Ltd.": [
    "FxGrow-Demo",
    "FxGrow-Live"
  ],
  "WePro Ltd.": [
    "WePro-Trade",
    "WePro-Live"
  ],
  "FXON Ltd": [
    "FXON-Demo02",
    "FXON-Live02",
    "FXON-Live01",
    "FXON-Demo01"
  ],
  "Myprop Ltd.": [
    "Myprop-Trade"
  ],
  "Ava Trade Markets Ltd.": [
    "AvaTradeMarkets-Demo 1-MT5",
    "AvaTradeMarkets-Real 1-MT5",
    "Ava-Demo 1-MT5",
    "Ava-Real 1-MT5"
  ],
  "Peninsula Markets (MU) Limited": [
    "tomotrader-Live"
  ],
  "ActivTrades Corp": [
    "ActivTradesCorp-Server"
  ],
  "ActivTrades Plc": [
    "ActivTrades-Server"
  ],
  "ActivTrades Markets Limited": [
    "ActivTradesMarkets-Server"
  ],
  "ActivTrades International Ltd.": [
    "ActivTradesInt-Server"
  ],
  "ActivMarkets - Empresa De Investimento, S.A.": [
    "ActivTradesEU-Server"
  ],
  "WaveTrade Ltd": [
    "WaveTrade-Server"
  ],
  "WaveTrade Limited": [
    "WaveTradeLtd-Server"
  ],
  "Novatradeex Ltd.": [
    "Novatradeex-Trade",
    "Novatradeex-Live"
  ],
  "Eightcap Pty Ltd": [
    "Eightcap-Live",
    "Eightcap-Demo"
  ],
  "Eightcap EU Ltd": [
    "EightcapEU-Live"
  ],
  "Eightcap Global Limited": [
    "EightcapGlobal-Live"
  ],
  "Eightcap International Trading Ltd.": [
    "EightcapInternational-MT5"
  ],
  "Xedge Capital Ltd.": [
    "XedgeCapital-Server"
  ],
  "DIH Capital Markets Limited": [
    "DIHCapitalMarkets-Server"
  ],
  "MAEX Limited": [
    "LibertexMU-MT5 Real Server"
  ],
  "\u041e\u041e\u041e ''\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u0430\u044f \u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f ''\u0424\u043e\u0440\u0435\u043a\u0441 \u041a\u043b\u0443\u0431''": [
    "ForexClubBY-MT5 Real Server"
  ],
  "Forex Club International LLC": [
    "ForexClub-MT5 Real Server"
  ],
  "Financial Markets Trading Company Limited": [
    "FinancialMarkets-MT5 Real Server"
  ],
  "Goat Funded Ltd.": [
    "GoatFunded-Server",
    "GoatFunded-Server2",
    "GoatFunded-Server3"
  ],
  "WeGetFunded Ltd.": [
    "WeGetFunded-Server"
  ],
  "BrightFunded Ltd.": [
    "BrightFunded-Server"
  ],
  "Atlas Funded Ltd.": [
    "AtlasFunded-Server"
  ],
  "Moneta Funded Ltd.": [
    "MonetaFunded-Live"
  ],
  "AquaFunded Ltd.": [
    "AquaFunded-Server"
  ],
  "Kudo Funded Ltd.": [
    "KudoFunded-Server"
  ],
  "Shark Funded Ltd.": [
    "SharkFundedLTD-live",
    "SharkFunded-live"
  ],
  "Chalixa Capital Ltd.": [
    "ChalixaCapital-Server"
  ],
  "Sharewealth Capital Ltd": [
    "SharewealthCapital-Server"
  ],
  "Aiwa Capital Limited": [
    "AiwaCapital-Server"
  ],
  "Amana Capital Ltd": [
    "AmanaCapital-Live",
    "AmanaCapital-Demo"
  ],
  "AH Capital DOO": [
    "AHCapital-LIVE"
  ],
  "KAMA Capital Ltd": [
    "KAMACapital-Server"
  ],
  "NAGA Capital Ltd": [
    "NAGACapital-Demo",
    "NAGACapital-Live"
  ],
  "Kama Capital LLC": [
    "KamaCapital-server"
  ],
  "Real Capital Limited": [
    "RealCapital-Server"
  ],
  "Apex Capital Markets LLC": [
    "ApexCapitalMarkets-ECN"
  ]
};

function searchBuiltin(query) {
    const q = (query || '').toLowerCase();
    const results = [];
    for (const [name, servers] of Object.entries(BUILTIN_BROKERS_MAP)) {
        if (!q || name.toLowerCase().includes(q) || servers.some(s => s.toLowerCase().includes(q))) {
            results.push({ name, servers });
        }
    }
    return results;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const query = (req.query && req.query.query ? req.query.query : '').trim();
    const cacheKey = query.toLowerCase();

    if (cacheKey && searchCache.has(cacheKey)) {
        return res.status(200).json(searchCache.get(cacheKey));
    }

    const token = getMetaApiToken();
    if (!token) {
        return res.status(200).json({ success: true, source: 'builtin', brokers: searchBuiltin(query) });
    }

    const targetQuery = query || 'Exness';

    try {
        const metaRes = await fetchMetaApiServers(targetQuery, token);

        if (metaRes.status === 200 && metaRes.data && typeof metaRes.data === 'object' && Object.keys(metaRes.data).length > 0) {
            const brokers = [];

            for (const [companyName, serverList] of Object.entries(metaRes.data)) {
                if (Array.isArray(serverList) && serverList.length > 0) {
                    const sortedServers = [...serverList].sort((a, b) => {
                        const aIsDemo = /demo|trial/i.test(a);
                        const bIsDemo = /demo|trial/i.test(b);
                        if (!aIsDemo && bIsDemo) return -1;
                        if (aIsDemo && !bIsDemo) return 1;
                        return a.localeCompare(b);
                    });

                    brokers.push({
                        name: companyName,
                        servers: sortedServers
                    });
                }
            }

            brokers.sort((a, b) => {
                const aMatch = a.name.toLowerCase().startsWith(query.toLowerCase());
                const bMatch = b.name.toLowerCase().startsWith(query.toLowerCase());
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return a.name.localeCompare(b.name);
            });

            const result = { success: true, source: 'live_metaapi', brokers };
            if (query) {
                searchCache.set(cacheKey, result);
            }
            return res.status(200).json(result);
        } else {
            return res.status(200).json({ success: true, source: 'builtin', brokers: searchBuiltin(query) });
        }
    } catch (err) {
        return res.status(200).json({ success: true, source: 'builtin_fallback', brokers: searchBuiltin(query) });
    }
};
