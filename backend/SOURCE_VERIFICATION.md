# Public source verification — 8 September 2026

Verified from this machine over HTTPS; certificate checks were never disabled. Raw discovery responses are in ignored `output/source-probes`, not committed HTML containing session identifiers.

| Source | Discovery and verified interface | Result |
| --- | --- | --- |
| PFZ | [Advisory](https://incois.gov.in/MarineFisheries/TextDataHome?mfid=1&request_locale=en) → [WebGIS](https://incois.gov.in/MarineFisheries/PfzWebGis) → [embedded map](https://incois.gov.in/DataInfo/MFASPFZ/index.html) → [published JS](https://incois.gov.in/DataInfo/MFASPFZ/js/wms.js) | Exact WFS URL is present in `fetchPFZLines`; HTTP 200, 90 features, Year 2026 / Julian day 250. |
| PFZ WFS | [GeoJSON](https://incois.gov.in/geoserver/PFZ_Automation/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=PFZ_Automation:pfzlines&outputFormat=application/json) | 1,197,448 bytes; MultiLineString coordinates in longitude/latitude. Validity separately matched to advisory 7 SEP / 8 SEP. No exact expiry hour published. |
| OSF | [Forecast](https://incois.gov.in/oceanservices/osfforecast.jsp) | Public JS declares `rsmc_combined_ww3` filename and exact `GetTimeseries` CSV requests; verified wave time series at 10.77 N, 80.1 E. |
| Open-Meteo Marine | [Official docs](https://open-meteo.com/en/docs/marine-weather-api) / `https://marine-api.open-meteo.com/v1/marine` | HTTP 200. Actual adapter normalization and persistence passed; source attribution retained. |
| Open-Meteo Weather | [Official docs](https://open-meteo.com/en/docs) / `https://api.open-meteo.com/v1/forecast` | HTTP 200; all seven normalized weather parameters returned at test location. |
| ERDDAP | [Catalog](https://erddap.incois.gov.in/erddap/info/index.json?itemsPerPage=1000) | Local Python verified-HTTPS request fails `CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate`. Do not bypass TLS or claim a successful grid integration. |

INCOIS's old PFZ `TextData` sector request returned a generic fisheries page without the required session context; it is not used. The embedded map also contains a private-network current URL; it is deliberately excluded from the allowlist and never fetched. PFZ uses the public same-origin WFS service instead.

**Later recheck at approximately 09:46 UTC:** the advisory table had advanced to 8 SEP / 9 SEP, but the WFS still returned Year 2026 / Julian day 250 (7 SEP). The adapter rejected that mismatch. Verified HTTP accessibility is distinct from availability of a coherent, currently valid advisory. The recorded demo remains the earlier matched product; no validity timestamps were refreshed or fabricated.

OSF discovery is isolated HTML/JS declaration parsing, without executing remote scripts or scraping image colors. Known variables are chosen from INCOIS's own requests: HS, PHS01, T02, PTP01. CSV headers, timestamps, numeric values and response sizes are checked. Open-Meteo fills missing marine parameters under its own provenance. SST remains model-derived fallback, chlorophyll is null, and warnings remain unavailable without a reviewed alert feed/import.
