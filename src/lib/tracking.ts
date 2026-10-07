const CARRIERS: Array<[RegExp, (t: string) => string]> = [
  [/ups/i, (t) => `https://www.ups.com/track?tracknum=${t}`],
  [/fedex/i, (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`],
  [/dhl/i, (t) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${t}`],
  [/usps/i, (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`],
  [/aramex/i, (t) => `https://www.aramex.com/track/results?ShipmentNumber=${t}`],
  [/tnt/i, (t) => `https://www.tnt.com/express/en_gc/site/shipping-tools/tracking.html?searchType=con&cons=${t}`],
];

/** Public tracking page for a carrier + tracking number; falls back to a web search. */
export function trackingUrl(carrier?: string | null, tracking?: string | null) {
  if (!tracking) return null;
  const t = encodeURIComponent(tracking.trim());
  const hit = CARRIERS.find(([re]) => re.test(carrier ?? ""));
  return hit ? hit[1](t) : `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ""} tracking ${tracking}`)}`;
}
